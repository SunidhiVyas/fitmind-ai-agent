const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const STORE_PATH = path.join(__dirname, 'data', 'store.json');

app.use(cors());
app.use(express.json());

/* ---------------------------------------------------------
   Persistence — simple JSON-file store (no external DB needed)
--------------------------------------------------------- */
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (err) {
    return { totalScans: 0, totalSessions: 0, createdAt: new Date().toISOString(), scanLog: [], latestScan: null };
  }
}
function ensureStoreShape(s){
  if(!s.scanLog) s.scanLog = [];
  if(!('latestScan' in s)) s.latestScan = null;
  if(!('totalScans' in s)) s.totalScans = 0;
  if(!('totalSessions' in s)) s.totalSessions = 0;
  return s;
}
function deriveVitalsFromScan(scan){
  if(!scan || !scan.metrics) return null;
  const posture = Number(scan.metrics.posture) || 75;
  const mobility = Number(scan.metrics.mobility) || 75;
  const symmetry = Number(scan.metrics.symmetry) || 75;
  const bpm = Math.max(62, Math.min(102, Math.round(65 + (100 - posture) * 0.32)));
  const energy = Math.max(15, Math.min(99, Math.round(mobility)));
  const recovery = Math.max(15, Math.min(99, Math.round(symmetry)));
  return { bpm, energy, recovery };
}
function deriveFuelFromScan(scan){
  if(!scan || !scan.metrics) return null;
  return {
    protein: Math.max(15, Math.min(99, Math.round(scan.metrics.posture || scan.muscles?.shoulders || 75))),
    hydration: Math.max(15, Math.min(99, Math.round(scan.metrics.balance || 72))),
    recovery: Math.max(15, Math.min(99, Math.round(scan.metrics.symmetry || 91))),
    absorption: Math.max(15, Math.min(99, Math.round(scan.metrics.mobility || 88)))
  };
}
function deriveMuscleFromScan(scan){
  if(!scan) return null;
  const m = scan.muscles || {};
  const met = scan.metrics || {};
  return {
    shoulders: Math.max(15, Math.min(99, Math.round(m.shoulders ?? met.posture ?? 74))),
    arms: Math.max(15, Math.min(99, Math.round(m.arms ?? met.mobility ?? 61))),
    core: Math.max(15, Math.min(99, Math.round(m.core ?? met.balance ?? 92))),
    legs: Math.max(15, Math.min(99, Math.round(m.legs ?? met.mobility ?? 88))),
    chest: Math.max(15, Math.min(99, Math.round(m.chest ?? ((m.shoulders ?? 74 + m.core ?? 92)/2)))),
    symmetry: Math.max(15, Math.min(99, Math.round(met.symmetry ?? 96))),
    poseConfidence: Math.max(60, Math.min(99.9, Number((met.posture ? (met.posture*0.4 + (scan.confidence||90)*0.6) : scan.confidence||98.4).toFixed(1))))
  };
}
function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

let store = ensureStoreShape(loadStore());
store.totalSessions += 1;
saveStore(store);

const serverStart = Date.now();

/* ---------------------------------------------------------
   GET /api/health
--------------------------------------------------------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor((Date.now() - serverStart) / 1000) });
});

/* ---------------------------------------------------------
   GET /api/vitals — real scan-driven if available, else
   server-authoritative sine-wave fallback.
--------------------------------------------------------- */
app.get('/api/vitals', (req, res) => {
  store = ensureStoreShape(loadStore());
  if (store.latestScan && store.latestScan.metrics) {
    const v = deriveVitalsFromScan(store.latestScan);
    // add tiny live jitter so it feels alive but stays anchored to real scan
    const t = Date.now() / 1000;
    const jitter = Math.round(Math.sin(t * 1.1) * 1);
    return res.json({ bpm: Math.max(62, Math.min(102, v.bpm + jitter)), energy: v.energy, recovery: v.recovery, ts: Date.now(), source: 'scan' });
  }
  const t = Date.now() / 1000;
  const bpm = Math.round(124 + Math.sin(t / 4.2) * 6 + Math.sin(t / 1.3) * 2);
  const energy = Math.round(70 + Math.sin(t / 6) * 12);
  const recovery = Math.round(78 + Math.cos(t / 7) * 9);
  res.json({ bpm, energy, recovery, ts: Date.now(), source: 'live' });
});

/* ---------------------------------------------------------
   GET /api/muscle-activation — real scan-driven if available
--------------------------------------------------------- */
app.get('/api/muscle-activation', (req, res) => {
  store = ensureStoreShape(loadStore());
  if (store.latestScan) {
    const m = deriveMuscleFromScan(store.latestScan);
    // add micro jitter for liveness but keep anchored to real scan
    const t = Date.now() / 1000;
    const j = Math.round(Math.sin(t * 0.9) * 1);
    return res.json({
      shoulders: Math.max(15, Math.min(99, m.shoulders + j)),
      arms: Math.max(15, Math.min(99, m.arms + j)),
      chest: Math.max(15, Math.min(99, m.chest + j)),
      core: Math.max(15, Math.min(99, m.core + j)),
      legs: Math.max(15, Math.min(99, m.legs + j)),
      symmetry: m.symmetry,
      poseConfidence: m.poseConfidence,
      ts: Date.now(),
      source: 'scan'
    });
  }
  const t = Date.now() / 1000;
  const zone = (base, freq, phase, amp) =>
    Math.max(15, Math.min(99, Math.round(base + Math.sin(t / freq + phase) * amp)));
  res.json({
    shoulders: zone(74, 5.5, 0.3, 14),
    arms: zone(61, 4.8, 1.1, 16),
    chest: zone(84, 6.2, 2.0, 10),
    core: zone(92, 5.0, 0.6, 6),
    legs: zone(88, 6.8, 1.6, 9),
    symmetry: zone(96, 9, 0, 3),
    poseConfidence: zone(98.4, 11, 0, 1.2),
    ts: Date.now(),
    source: 'live'
  });
});

/* ---------------------------------------------------------
   GET /api/coach/decision — shared AI decision, rotates every
   ~5.2s server-side so every connected client sees the same
   decision at the same time (real shared state, not per-tab).
--------------------------------------------------------- */
const COACH_CHOICES = [
  { title: 'TRAIN TODAY', explain: 'High recovery + rising energy detected. Your system is ready for a focused training session.' },
  { title: 'PUSH PERFORMANCE', explain: 'Your recovery reserve is strong. FitMind has increased today\u2019s training ceiling.' },
  { title: 'RECOVER SMART', explain: 'Your signals suggest reducing load. Recovery is now the highest-value action.' },
  { title: 'MOVE + REFUEL', explain: 'Energy is available, but hydration and nutrition should come first.' }
];
app.get('/api/coach/decision', (req, res) => {
  const idx = Math.floor(Date.now() / 5200) % COACH_CHOICES.length;
  res.json({ ...COACH_CHOICES[idx], index: idx, ts: Date.now() });
});

/* ---------------------------------------------------------
   GET /api/fuel/stats — scan-driven if available
--------------------------------------------------------- */
app.get('/api/fuel/stats', (req, res) => {
  store = ensureStoreShape(loadStore());
  if (store.latestScan && store.latestScan.metrics) {
    const f = deriveFuelFromScan(store.latestScan);
    const t = Date.now() / 1000;
    const j = Math.round(Math.sin(t * 0.7) * 1);
    return res.json({ protein: Math.max(15, Math.min(99, f.protein + j)), hydration: Math.max(15, Math.min(99, f.hydration + j)), recovery: Math.max(15, Math.min(99, f.recovery + j)), absorption: Math.max(15, Math.min(99, f.absorption + j)), ts: Date.now(), source: 'scan' });
  }
  const t = Date.now() / 1000;
  res.json({
    protein: Math.round(84 + Math.sin(t / 5) * 6),
    hydration: Math.round(72 + Math.sin(t / 6.4) * 8),
    recovery: Math.round(91 + Math.sin(t / 7) * 4),
    absorption: Math.round(88 + Math.sin(t / 4.4) * 5),
    ts: Date.now(),
    source: 'live'
  });
});

/* ---------------------------------------------------------
   POST /api/scan — persists the REAL scan payload from scan.html
   (metrics + muscles) so every frontend view can reflect it.
   Simple zone pings (glass hover) are also counted but don't
   overwrite the latest full scan.
--------------------------------------------------------- */
app.post('/api/scan', (req, res) => {
  store = ensureStoreShape(loadStore());
  const body = req.body || {};
  const isFullScan = !!(body.metrics || body.muscles || body.score);

  store.totalScans += 1;

  if (isFullScan) {
    const scanToSave = {
      ts: new Date().toISOString(),
      score: body.score,
      confidence: body.confidence ?? Math.min(96, 72 + Math.floor(store.totalScans / 3)),
      metrics: body.metrics,
      muscles: body.muscles,
      model: body.model || 'MoveNet Thunder',
      timestamp: body.timestamp || new Date().toISOString(),
      zone: body.zone || 'full-body'
    };
    store.latestScan = scanToSave;
    store.scanLog.push(scanToSave);
  } else {
    store.scanLog.push({ ts: new Date().toISOString(), zone: body.zone || 'full-body' });
  }

  if (store.scanLog.length > 200) store.scanLog = store.scanLog.slice(-200);
  saveStore(store);

  const confidence = store.latestScan ? store.latestScan.confidence : Math.min(96, 72 + Math.floor(store.totalScans / 3));
  res.json({ totalScans: store.totalScans, confidence, latestScan: store.latestScan });
});

/* ---------------------------------------------------------
   GET /api/stats — overall persisted analytics + latest scan
--------------------------------------------------------- */
app.get('/api/stats', (req, res) => {
  store = ensureStoreShape(loadStore());
  res.json({
    totalScans: store.totalScans,
    totalSessions: store.totalSessions,
    uptimeSeconds: Math.floor((Date.now() - serverStart) / 1000),
    latestScan: store.latestScan || null
  });
});
app.get('/api/latest-scan', (req, res) => {
  store = ensureStoreShape(loadStore());
  if (!store.latestScan) return res.json({ hasScan: false, totalScans: store.totalScans });
  res.json({ hasScan: true, totalScans: store.totalScans, latestScan: store.latestScan, vitals: deriveVitalsFromScan(store.latestScan), fuel: deriveFuelFromScan(store.latestScan), muscles: deriveMuscleFromScan(store.latestScan) });
});
app.get('/api/body-state', (req, res) => {
  store = ensureStoreShape(loadStore());
  if (!store.latestScan) {
    // no scan yet — return live sine-wave snapshot
    const t = Date.now() / 1000;
    return res.json({
      hasScan: false,
      vitals: { bpm: Math.round(124 + Math.sin(t/4.2)*6), energy: Math.round(70+Math.sin(t/6)*12), recovery: Math.round(78+Math.cos(t/7)*9) },
      fuel: { protein: Math.round(84+Math.sin(t/5)*6), hydration: Math.round(72+Math.sin(t/6.4)*8), recovery: Math.round(91+Math.sin(t/7)*4), absorption: Math.round(88+Math.sin(t/4.4)*5) },
      muscles: null,
      totalScans: store.totalScans
    });
  }
  res.json({
    hasScan: true,
    latestScan: store.latestScan,
    vitals: deriveVitalsFromScan(store.latestScan),
    fuel: deriveFuelFromScan(store.latestScan),
    muscles: deriveMuscleFromScan(store.latestScan),
    totalScans: store.totalScans
  });
});

/* ---------------------------------------------------------
   AGENT PROXY — forwards to the Python fitness agent
   (agent/agent_server.py, backed by a local Ollama model).
   Keeping this behind the Node backend means the frontend
   only ever talks to one origin.
--------------------------------------------------------- */
const AGENT_BASE = process.env.AGENT_URL || 'http://localhost:5000';

async function callAgent(path, body) {
  const res = await fetch(AGENT_BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(65000)
  });
  if (!res.ok) throw new Error('agent responded ' + res.status);
  return res.json();
}

app.get('/api/agent/health', async (req, res) => {
  try {
    res.json(await callAgent('/agent/health'));
  } catch (err) {
    res.json({ ok: false, ollama: false, mode: 'unreachable', detail: String(err).slice(0, 200) });
  }
});

// Real AI coach decision, computed from the last SCANNED vitals if available.
app.get('/api/agent/coach-decision', async (req, res) => {
  store = ensureStoreShape(loadStore());
  let vitals;
  if (store.latestScan && store.latestScan.metrics) {
    const v = deriveVitalsFromScan(store.latestScan);
    const m = deriveMuscleFromScan(store.latestScan);
    const avgActivation = Math.round((m.shoulders + m.arms + m.core + m.legs)/4);
    vitals = { bpm: v.bpm, energy: v.energy, recovery: v.recovery, activation: avgActivation };
  } else {
    const t = Date.now() / 1000;
    vitals = {
      bpm: Math.round(124 + Math.sin(t / 4.2) * 6),
      energy: Math.round(70 + Math.sin(t / 6) * 12),
      recovery: Math.round(78 + Math.cos(t / 7) * 9),
      activation: Math.round(84 + Math.sin(t / 5.5) * 8)
    };
  }
  try {
    const out = await callAgent('/agent/coach-decision', vitals);
    res.json({ ...out, vitals });
  } catch (err) {
    res.json({
      title: 'TRAIN MODERATE',
      explain: 'Agent service unreachable — showing a safe default.',
      source: 'fallback',
      vitals
    });
  }
});

app.post('/api/agent/muscle-insight', async (req, res) => {
  try {
    res.json(await callAgent('/agent/muscle-insight', req.body));
  } catch (err) {
    res.json({
      headline: 'Zone engaged',
      note: 'Agent service unreachable — start the agent for live coaching.',
      source: 'fallback'
    });
  }
});

app.post('/api/agent/fuel-guidance', async (req, res) => {
  try {
    res.json(await callAgent('/agent/fuel-guidance', req.body));
  } catch (err) {
    res.json({
      headline: 'Steady fueling',
      note: 'Agent service unreachable — start the agent for live guidance.',
      source: 'fallback'
    });
  }
});

app.post('/api/agent/chat', async (req, res) => {
  try {
    res.json(await callAgent('/agent/chat', req.body));
  } catch (err) {
    res.json({
      answer: "The coaching agent isn't reachable right now. Start it with: cd agent && python agent_server.py",
      source: 'fallback'
    });
  }
});

app.listen(PORT, () => {
  console.log(`FitMind AI backend running at http://localhost:${PORT}`);
});

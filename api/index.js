const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const STORE_PATH = path.join(__dirname, '..', 'backend', 'data', 'store.json');
let memStore = { totalScans: 0, totalSessions: 0, latestScan: null, scanLog: [] };
try { const raw = fs.readFileSync(STORE_PATH, 'utf8'); const j = JSON.parse(raw); memStore = { ...memStore, ...j }; } catch(e){}
memStore.totalSessions += 1;

function deriveVitals(scan){
  if(!scan || !scan.metrics) return { bpm: 74, energy: 78, recovery: 82 };
  const p = Number(scan.metrics.posture)||75;
  return { bpm: Math.max(62,Math.min(102,Math.round(65+(100-p)*0.32))), energy: Math.round(scan.metrics.mobility||75), recovery: Math.round(scan.metrics.symmetry||75) };
}
function deriveFuel(scan){
  if(!scan || !scan.metrics) return { protein:84, hydration:72, recovery:91, absorption:88 };
  return { protein: Math.round(scan.metrics.posture||75), hydration: Math.round(scan.metrics.balance||72), recovery: Math.round(scan.metrics.symmetry||91), absorption: Math.round(scan.metrics.mobility||88) };
}
function deriveMuscle(scan){
  if(!scan) return { shoulders:74, arms:61, core:92, legs:88, chest:84, symmetry:96, poseConfidence:98.4 };
  const m=scan.muscles||{}, mt=scan.metrics||{};
  return { shoulders: Math.round(m.shoulders??mt.posture??74), arms: Math.round(m.arms??mt.mobility??61), core: Math.round(m.core??mt.balance??92), legs: Math.round(m.legs??mt.mobility??88), chest: Math.round(m.chest??74), symmetry: Math.round(mt.symmetry??96), poseConfidence: Number((scan.confidence||98.4).toFixed?scan.confidence.toFixed(1):98.4) };
}

app.get('/api/health', (req,res)=> res.json({ ok:true, uptimeSeconds: Math.floor(process.uptime()) }));
app.get('/api/vitals', (req,res)=>{
  if(memStore.latestScan) { const v=deriveVitals(memStore.latestScan); const t=Date.now()/1000; const j=Math.round(Math.sin(t*1.1)*1); return res.json({ bpm: Math.max(62,Math.min(102,v.bpm+j)), energy:v.energy, recovery:v.recovery, ts:Date.now(), source:'scan'}); }
  const t=Date.now()/1000; res.json({ bpm: Math.round(124+Math.sin(t/4.2)*6+Math.sin(t/1.3)*2), energy: Math.round(70+Math.sin(t/6)*12), recovery: Math.round(78+Math.cos(t/7)*9), ts:Date.now(), source:'live'});
});
app.get('/api/muscle-activation', (req,res)=>{
  if(memStore.latestScan){ const m=deriveMuscle(memStore.latestScan); const t=Date.now()/1000; const j=Math.round(Math.sin(t*0.9)*1); return res.json({ ...m, shoulders: Math.max(15,Math.min(99,m.shoulders+j)), arms: Math.max(15,Math.min(99,m.arms+j)), core: Math.max(15,Math.min(99,m.core+j)), legs: Math.max(15,Math.min(99,m.legs+j)), ts:Date.now(), source:'scan'}); }
  const t=Date.now()/1000; const z=(b,f,p,a)=>Math.max(15,Math.min(99,Math.round(b+Math.sin(t/f+p)*a)));
  res.json({ shoulders:z(74,5.5,0.3,14), arms:z(61,4.8,1.1,16), chest:z(84,6.2,2,10), core:z(92,5,0.6,6), legs:z(88,6.8,1.6,9), symmetry:z(96,9,0,3), poseConfidence:z(98.4,11,0,1.2), ts:Date.now(), source:'live'});
});
app.get('/api/fuel/stats', (req,res)=>{
  if(memStore.latestScan){ const f=deriveFuel(memStore.latestScan); const t=Date.now()/1000; const j=Math.round(Math.sin(t*0.7)*1); return res.json({ protein:Math.max(15,Math.min(99,f.protein+j)), hydration:Math.max(15,Math.min(99,f.hydration+j)), recovery:Math.max(15,Math.min(99,f.recovery+j)), absorption:Math.max(15,Math.min(99,f.absorption+j)), ts:Date.now(), source:'scan'}); }
  const t=Date.now()/1000; res.json({ protein:Math.round(84+Math.sin(t/5)*6), hydration:Math.round(72+Math.sin(t/6.4)*8), recovery:Math.round(91+Math.sin(t/7)*4), absorption:Math.round(88+Math.sin(t/4.4)*5), ts:Date.now(), source:'live'});
});
app.post('/api/scan', (req,res)=>{
  const body=req.body||{}; const isFull=!!(body.metrics||body.muscles||body.score);
  memStore.totalScans+=1;
  if(isFull){ const s={ ts:new Date().toISOString(), score:body.score, confidence:body.confidence||Math.min(96,72+Math.floor(memStore.totalScans/3)), metrics:body.metrics, muscles:body.muscles, model:body.model||'MoveNet', timestamp:body.timestamp||new Date().toISOString(), zone:body.zone||'full-body'}; memStore.latestScan=s; memStore.scanLog.push(s); } else { memStore.scanLog.push({ ts:new Date().toISOString(), zone:body.zone||'full-body'}); }
  if(memStore.scanLog.length>200) memStore.scanLog=memStore.scanLog.slice(-200);
  res.json({ totalScans: memStore.totalScans, confidence: memStore.latestScan?memStore.latestScan.confidence:Math.min(96,72+Math.floor(memStore.totalScans/3)), latestScan: memStore.latestScan });
});
app.get('/api/stats', (req,res)=> res.json({ totalScans: memStore.totalScans, totalSessions: memStore.totalSessions, uptimeSeconds: Math.floor(process.uptime()), latestScan: memStore.latestScan||null }));
app.get('/api/latest-scan', (req,res)=>{ if(!memStore.latestScan) return res.json({ hasScan:false, totalScans: memStore.totalScans}); const v=deriveVitals(memStore.latestScan); const f=deriveFuel(memStore.latestScan); const m=deriveMuscle(memStore.latestScan); res.json({ hasScan:true, totalScans: memStore.totalScans, latestScan: memStore.latestScan, vitals:v, fuel:f, muscles:m}); });
app.get('/api/body-state', (req,res)=>{
  if(!memStore.latestScan){ const t=Date.now()/1000; return res.json({ hasScan:false, vitals:{ bpm:Math.round(124+Math.sin(t/4.2)*6), energy:Math.round(70+Math.sin(t/6)*12), recovery:Math.round(78+Math.cos(t/7)*9)}, fuel:{ protein:Math.round(84+Math.sin(t/5)*6), hydration:Math.round(72+Math.sin(t/6.4)*8), recovery:Math.round(91+Math.sin(t/7)*4), absorption:Math.round(88+Math.sin(t/4.4)*5)}, muscles:null, totalScans: memStore.totalScans}); }
  res.json({ hasScan:true, latestScan: memStore.latestScan, vitals: deriveVitals(memStore.latestScan), fuel: deriveFuel(memStore.latestScan), muscles: deriveMuscle(memStore.latestScan), totalScans: memStore.totalScans });
});
const AGENT_BASE = process.env.AGENT_URL || 'http://localhost:5000';
async function callAgent(p,b){
  const r=await fetch(AGENT_BASE+p,{ method:b?'POST':'GET', headers:b?{'Content-Type':'application/json'}:undefined, body:b?JSON.stringify(b):undefined, signal:AbortSignal.timeout(65000)});
  if(!r.ok) throw new Error('agent '+r.status); return r.json();
}
app.get('/api/agent/health', async (req,res)=>{ try{ res.json(await callAgent('/agent/health')); }catch(e){ res.json({ ok:false, ollama:false, mode:'unreachable', detail:String(e).slice(0,200)}); }});
app.get('/api/agent/coach-decision', async (req,res)=>{
  let vitals;
  if(memStore.latestScan){ const v=deriveVitals(memStore.latestScan); const m=deriveMuscle(memStore.latestScan); vitals={ bpm:v.bpm, energy:v.energy, recovery:v.recovery, activation: Math.round((m.shoulders+m.arms+m.core+m.legs)/4)}; } else { const t=Date.now()/1000; vitals={ bpm:Math.round(124+Math.sin(t/4.2)*6), energy:Math.round(70+Math.sin(t/6)*12), recovery:Math.round(78+Math.cos(t/7)*9), activation:Math.round(84+Math.sin(t/5.5)*8)}; }
  try{ const out=await callAgent('/agent/coach-decision', vitals); res.json({...out, vitals}); }catch(e){ res.json({ title:'TRAIN MODERATE', explain:'Agent service unreachable — showing a safe default.', source:'fallback', vitals}); }
});
app.post('/api/agent/muscle-insight', async (req,res)=>{ try{ res.json(await callAgent('/agent/muscle-insight', req.body)); }catch(e){ res.json({ headline:'Zone engaged', note:'Agent service unreachable — start the agent for live coaching.', source:'fallback'}); }});
app.post('/api/agent/fuel-guidance', async (req,res)=>{ try{ res.json(await callAgent('/agent/fuel-guidance', req.body)); }catch(e){ res.json({ headline:'Steady fueling', note:'Agent service unreachable — start the agent for live guidance.', source:'fallback'}); }});
app.post('/api/agent/chat', async (req,res)=>{ try{ res.json(await callAgent('/agent/chat', req.body)); }catch(e){ res.json({ answer:"The coaching agent isn't reachable right now. Start it with: cd agent && python agent_server.py", source:'fallback'}); }});

module.exports = app;

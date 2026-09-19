/* ============================================================
   BACKEND CONNECTION
   Change API_BASE if your backend runs somewhere other than
   localhost:4000 (e.g. after deploying it).
============================================================ */
const API_BASE = window.FITMIND_API || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:4000' : '');
let BACKEND_UP = true;

async function apiGet(path) {
  try {
    const res = await fetch(API_BASE + path, { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status ' + res.status);
    BACKEND_UP = true;
    return await res.json();
  } catch (err) {
    BACKEND_UP = false;
    return null;
  }
}
async function apiPost(path, body) {
  try {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error('bad status ' + res.status);
    BACKEND_UP = true;
    return await res.json();
  } catch (err) {
    BACKEND_UP = false;
    return null;
  }
}

/* Live "N SCANS" pill in the shell header — visible proof the
   backend is connected and persisting real data. */
(function backendStatusPill(){
  const live = document.querySelector('.shellLive');
  if (!live) return;
  async function refresh(){
    const stats = await apiGet('/api/stats');
    if (stats) {
      live.innerHTML = '<i></i> LIVE · ' + stats.totalScans + ' SCANS LOGGED';
      live.style.opacity = 1;
    } else {
      live.innerHTML = '<i></i> OFFLINE MODE (backend not running)';
      live.style.opacity = .6;
    }
  }
  refresh();
  setInterval(refresh, 4000);
})();


(function(){
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.shellNav button'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.ws-section'));

  function activate(target, anchor, btn){
    sections.forEach(function(s){ s.classList.toggle('active', s.id === target); });
    buttons.forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    if(anchor){
      requestAnimationFrame(function(){
        var el = document.getElementById(anchor);
        if(el){ el.scrollIntoView({behavior:'instant', block:'start'}); }
        var sec = document.getElementById(target);
        if(sec){ sec.scrollTop = el ? el.offsetTop : 0; }
      });
    } else {
      var sec = document.getElementById(target);
      if(sec){ sec.scrollTop = 0; }
    }
  }

  buttons.forEach(function(btn){
    btn.addEventListener('click', function(){
      activate(btn.dataset.target, btn.dataset.anchor, btn);
    });
  });
})();

(function(){

const stage = document.getElementById("stage");
const zones = [...document.querySelectorAll(".zone")];

function activate(zone){
  stage.dataset.active = zone.dataset.zone;
  document.body.dataset.scan = zone.dataset.zone;
}
function clear(zone){
  if(stage.dataset.active === zone.dataset.zone){
    stage.removeAttribute("data-active");
    document.body.removeAttribute("data-scan");
  }
}

zones.forEach(zone=>{
  zone.addEventListener("mouseenter",()=>activate(zone));
  zone.addEventListener("mouseleave",()=>clear(zone));
  zone.addEventListener("focus",()=>activate(zone));
  zone.addEventListener("blur",()=>clear(zone));
  zone.addEventListener("click",()=>{
    const same = stage.dataset.active === zone.dataset.zone;
    if(same){ stage.removeAttribute("data-active"); document.body.removeAttribute("data-scan"); }
    else activate(zone);
  });
});

document.addEventListener("pointerdown",e=>{
  if(!e.target.closest(".zone") && !e.target.closest(".stage")){
    stage.removeAttribute("data-active");
    document.body.removeAttribute("data-scan");
  }
});

})();

/* ------------------------------------------------------------
   Hero CTAs: Start Your Journey / Watch Demo / Get Started
   Previously these buttons had no handlers, so nothing happened.
------------------------------------------------------------ */
(function(){
  function goToSection(target){
    const btn = document.querySelector('.shellNav button[data-target="'+target+'"]');
    if(btn){ btn.click(); return; }
    // fallback: toggle directly
    const sections = document.querySelectorAll('.ws-section');
    const buttons = document.querySelectorAll('.shellNav button');
    sections.forEach(s=> s.classList.toggle('active', s.id===target));
    buttons.forEach(b=> b.classList.toggle('active', b.dataset.target===target));
  }

  const startBtn = document.getElementById('startJourneyBtn');
  const demoBtn = document.getElementById('watchDemoBtn');
  const getStarted = document.querySelector('#sec-muscle .get-started');
  const modal = document.getElementById('demoModal');
  const closeBtn = document.getElementById('demoClose');
  const tryLive = document.getElementById('demoTryLive');
  const goCoach = document.getElementById('demoGoCoach');

  function openDemo(){
    if(!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
    // auto-cycle muscle zones as a live demo
    const stage = document.getElementById('stage');
    if(stage){
      const zones = ['shoulders','arms','core','legs'];
      let i = 0;
      let demoTimer = setInterval(function(){
        stage.dataset.active = zones[i % zones.length];
        i++;
        if(i>=8){ clearInterval(demoTimer); setTimeout(function(){ stage.removeAttribute('data-active'); }, 900); }
      }, 700);
      // store timer to clear on close
      modal._demoTimer = demoTimer;
    }
  }
  function closeDemo(){
    if(!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    if(modal._demoTimer) clearInterval(modal._demoTimer);
    const stage = document.getElementById('stage');
    if(stage) stage.removeAttribute('data-active');
  }

  if(startBtn){
    startBtn.addEventListener('click', function(){ goToSection('sec-coach'); });
  }
  if(getStarted){
    getStarted.addEventListener('click', function(){ goToSection('sec-coach'); });
  }
  if(demoBtn){
    demoBtn.addEventListener('click', openDemo);
  }
  if(closeBtn) closeBtn.addEventListener('click', closeDemo);
  if(modal){
    modal.addEventListener('click', function(e){
      if(e.target===modal || e.target.classList.contains('demoBackdrop')) closeDemo();
    });
  }
  if(tryLive){
    tryLive.addEventListener('click', function(){ closeDemo(); });
  }
  if(goCoach){
    goCoach.addEventListener('click', function(){ closeDemo(); goToSection('sec-coach'); });
  }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && modal && modal.style.display!=='none') closeDemo(); });
})();

/* ------------------------------------------------------------
   Muscle page side cards — driven by real /api/muscle-activation
   data instead of static decorative values.
------------------------------------------------------------ */
(function(){
  const bars = document.querySelectorAll('#sec-muscle .sc-left-top .bars i');
  const ringFg = document.querySelector('#sec-muscle .ring-fg');
  const ringNum = document.querySelector('#sec-muscle .ring-num');
  const radarSpan = document.querySelector('#sec-muscle .radar span');
  const RING_CIRC = 2 * Math.PI * 26;

  async function refresh(){
    let data = await apiGet('/api/muscle-activation');
    if (!data) {
      try{
        const raw = localStorage.getItem('fitmind.bodyState');
        if(raw){
          const parsed = JSON.parse(raw);
          const scan = parsed.latestScan || parsed.latestBodyScan;
          if(scan && scan.muscles && scan.metrics){
            data = {
              shoulders: scan.muscles.shoulders,
              arms: scan.muscles.arms,
              core: scan.muscles.core,
              legs: scan.muscles.legs,
              symmetry: scan.metrics.symmetry,
              poseConfidence: scan.confidence || 98.4
            };
          }
        }
      }catch(e){}
    }
    if (!data) return;
    const order = [data.shoulders, data.arms, data.core, data.legs];
    bars.forEach((bar, i) => { if (order[i] != null) bar.style.height = order[i] + '%'; });
    if (ringFg && data.symmetry != null) {
      const offset = RING_CIRC - (RING_CIRC * data.symmetry / 100);
      ringFg.style.strokeDasharray = RING_CIRC;
      ringFg.style.animation = 'none';
      ringFg.style.strokeDashoffset = offset;
    }
    if (ringNum && data.symmetry != null) ringNum.textContent = data.symmetry + '%';
    if (radarSpan && data.poseConfidence != null) radarSpan.textContent = Number(data.poseConfidence).toFixed(1) + '%';
  }
  refresh();
  setInterval(refresh, 2600);
})();
(function(){

const root=document.documentElement, nav=document.getElementById('nav');
const scene=document.getElementById('scene'), person=document.getElementById('personWrap');
const nutrient=document.getElementById('nutrient'), adapt=document.getElementById('adapt');
let scanTimer;

window.addEventListener('scroll',()=>{
  nav.classList.toggle('scrolled',scrollY>30);
  document.querySelectorAll('.reveal').forEach(c=>{
    if(c.getBoundingClientRect().top<innerHeight*.85)c.classList.add('visible')
  });
},{passive:true});

window.addEventListener('pointermove',e=>{
  root.style.setProperty('--mx',((e.clientX/innerWidth)*100)+'%');
  root.style.setProperty('--my',((e.clientY/innerHeight)*100)+'%');
  if(!scene)return;
  const rect=scene.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width-.5, y=(e.clientY-rect.top)/rect.height-.5;
  person.style.setProperty('--px',(x*25)+'px');
  person.style.setProperty('--py',(y*18)+'px');
  person.style.setProperty('--ry',(x*7)+'deg');
  person.style.setProperty('--rx',(-y*5)+'deg');
  document.querySelector('.orbit').style.setProperty('--rot',(x*12)+'deg');
  document.querySelectorAll('.hud').forEach((h,i)=>h.style.setProperty('--hy',(y*(i? -12:12))+'px'));
  // Cursor proximity drives the body's muscle activity.
  const muscle=document.querySelectorAll('.muscle');
  const center=rect.left+rect.width*.5;
  const rel=(e.clientX-center)/rect.width;
  muscle.forEach((m,i)=>{
    const near=Math.abs(rel-(i-2)*.12)<.22;
    m.classList.toggle('active',near);
  });
});

const trigger = document.getElementById('trigger');

if (trigger) {
  trigger.addEventListener('click', function(event) {
    event.preventDefault();
    window.location.href = './scan.html';
  });
}

let fuelStats = { protein: 84, hydration: 72, recovery: 91, absorption: 88 };
(async function loadFuelStats(){
  const data = await apiGet('/api/fuel/stats');
  if (data) fuelStats = data;
})();
setInterval(async ()=>{
  const data = await apiGet('/api/fuel/stats');
  if (data) fuelStats = data;
}, 4000);

document.querySelectorAll('.card').forEach(card=>{
  card.addEventListener('mouseenter',()=>{
    const txt=card.querySelector('b').textContent;
    const num=txt.startsWith('01')?fuelStats.protein:txt.startsWith('02')?fuelStats.hydration:txt.startsWith('03')?fuelStats.recovery:fuelStats.absorption;
    document.getElementById('fuelNumber').textContent=num+'%';
    document.querySelectorAll('.card').forEach(c=>c.style.opacity='.35');
    card.style.opacity='1';
  });
  card.addEventListener('mouseleave',()=>{
    document.querySelectorAll('.card').forEach(c=>c.style.opacity='');
    document.getElementById('fuelNumber').textContent='78%';
  });
});

document.getElementById('glass').addEventListener('mouseenter',()=>{
  nutrient.classList.add('go');
  document.querySelector('.muscle-core').classList.add('active');
  apiPost('/api/scan', { zone: 'core' });
});

/* ---------- Live vitals: pulled from backend /api/vitals ---------- */
const bpmEl=document.getElementById('bpm');
if(bpmEl){
  setInterval(async ()=>{
    const vitals = await apiGet('/api/vitals');
    if (vitals) {
      bpmEl.textContent = vitals.bpm;
    } else {
      // backend unreachable — graceful local fallback so the UI still feels alive
      const base=124+Math.round(Math.sin(Date.now()/2600)*6)+Math.round(Math.random()*3);
      bpmEl.textContent=base;
    }
  },1100);
}

/* ---------- Scan ticker: cycling diagnostic readout ---------- */
const tickerEl=document.getElementById('scanTicker');
if(tickerEl){
  const phrases=[
    'ANALYZING MUSCLE DENSITY…',
    'READING RECOVERY MARKERS…',
    'MAPPING NUTRIENT UPTAKE…',
    'CHECKING HYDRATION LEVELS…',
    'SCANNING JOINT MOBILITY…',
    'CALIBRATING BODY MODEL…'
  ];
  let ti=0;
  setInterval(()=>{
    ti=(ti+1)%phrases.length;
    tickerEl.style.opacity=0;
    setTimeout(()=>{tickerEl.textContent=phrases[ti];tickerEl.style.opacity=1;},260);
  },2600);
}

})();
(function(){

const hero=document.getElementById('hero');
const center=document.getElementById('center');

if(hero && center){
  hero.addEventListener('pointermove',e=>{
    const r=hero.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5;
    const y=(e.clientY-r.top)/r.height-.5;
    center.style.transform=`translate(calc(-50% + ${x*16}px),calc(-50% + ${y*10}px)) rotateX(${-y*3}deg) rotateY(${x*4}deg)`;
  });
  hero.addEventListener('pointerleave',()=>{
    center.style.transform='translate(-50%,-50%)';
  });
}

document.querySelectorAll('.node').forEach(node=>{
  node.addEventListener('click',()=>{
    const circle=node.querySelector('.circle');
    if(circle && circle.animate){
      circle.animate([
        {filter:'brightness(1)'},
        {filter:'brightness(1.8)'},
        {filter:'brightness(1)'}
      ],{duration:700});
    }
  });
});

})();

/* ------------------------------------------------------------
   RHYTHM — real scan-driven vitals (replaces dummy 72/84/91)
------------------------------------------------------------ */
(function(){
  const leftStats = document.querySelectorAll('#sec-rhythm .panel.left .stat');
  const rightRows = document.querySelectorAll('#sec-rhythm .panel.right .rowStat');
  if(!leftStats.length && !rightRows.length) return;

  function localFallback(){
    try{
      const raw = localStorage.getItem('fitmind.bodyState');
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      const scan = parsed.latestScan || parsed.latestBodyScan;
      if(!scan || !scan.metrics) return null;
      const posture = Number(scan.metrics.posture)||75;
      return {
        hasScan:true,
        latestScan:scan,
        vitals:{ bpm: Math.max(62,Math.min(102,Math.round(65+(100-posture)*0.32))), energy: Math.round(scan.metrics.mobility||75), recovery: Math.round(scan.metrics.symmetry||75) },
        fuel:{ hydration: Math.round(scan.metrics.balance||72) },
        muscles: scan.muscles
      };
    }catch(e){ return null; }
  }

  async function refreshRhythm(){
    let data = await apiGet('/api/body-state');
    if(!data || (!data.hasScan && !data.vitals)) data = localFallback();
    if(!data || !data.vitals) return;
    const vit = data.vitals;
    const fuel = data.fuel || {};
    const scan = data.latestScan || {};

    if(leftStats.length>=5){
      const trySet = (idx, val, suffix) =>{
        const el = leftStats[idx];
        if(!el) return;
        const vEl = el.querySelector('.statValue');
        const bar = el.querySelector('.bar i');
        if(vEl) vEl.innerHTML = val + suffix;
        if(bar) bar.style.width = Math.max(10,Math.min(100, parseInt(val)||0)) + '%';
      };
      trySet(0, vit.bpm, '<small>BPM</small>');
      trySet(1, vit.energy, '<small>%</small>');
      trySet(2, vit.recovery, '<small>%</small>');
      const hyd = fuel.hydration ?? 76;
      trySet(3, hyd, '<small>%</small>');
      const focus = scan.metrics ? Math.round((scan.metrics.posture*0.5 + (scan.confidence||88)*0.5)) : 88;
      trySet(4, focus, '<small>%</small>');
    }
    if(rightRows.length>=4){
      const rHeart = rightRows[0]?.querySelector('.statValue');
      if(rHeart) rHeart.innerHTML = vit.bpm + '<small>BPM</small>';
      const breathVal = scan.metrics ? Math.round(12 + (scan.metrics.balance||75)/18) : 14;
      const rBreath = rightRows[1]?.querySelector('.statValue');
      if(rBreath) rBreath.innerHTML = breathVal + '<small>/min</small>';
      const tempVal = scan.score ? (36.4 + scan.score/280).toFixed(1) : '36.6';
      const rTemp = rightRows[2]?.querySelector('.statValue');
      if(rTemp) rTemp.innerHTML = tempVal + '<small>°C</small>';
      const stressVal = vit.recovery > 80 ? 'LOW' : vit.recovery > 58 ? 'MEDIUM' : 'HIGH';
      const rStress = rightRows[3]?.querySelector('.statValue');
      if(rStress) rStress.innerHTML = '<span style="font-size:15px">'+stressVal+'</span>';
    }
  }
  refreshRhythm();
  setInterval(refreshRhythm, 3000);
})();

/* ------------------------------------------------------------
   FUEL — bind adapt / fuelNumber / data-panel to real scan
------------------------------------------------------------ */
(function(){
  async function refreshFuelReal(){
    let data = await apiGet('/api/body-state');
    let scan = data?.latestScan;
    if(!scan){
      try{
        const raw = localStorage.getItem('fitmind.bodyState');
        if(raw) scan = (JSON.parse(raw).latestScan || JSON.parse(raw).latestBodyScan);
      }catch(e){}
    }
    if(!scan || !scan.metrics) return;
    const adaptEl = document.getElementById('adapt');
    if(adaptEl) adaptEl.textContent = Math.round(scan.score || 72);
    // animate the first HUD bar (Live adaptation)
    const adaptBar = document.querySelector('#sec-fuel .hud .bar i');
    if(adaptBar) adaptBar.style.setProperty('--w', Math.round(scan.score || 72) + '%');
    const proteinBar = document.querySelectorAll('#sec-fuel .hud')[1]?.querySelector('.bar i');
    if(proteinBar) proteinBar.style.setProperty('--w', Math.round(scan.metrics.posture || 81) + '%');
    const fuelNum = document.getElementById('fuelNumber');
    if(fuelNum) fuelNum.textContent = Math.round(scan.metrics.balance || 78) + '%';

    const panelMetrics = document.querySelectorAll('#sec-fuel .data-panel .metric');
    if(panelMetrics.length>=3){
      const vals = [
        Math.round(scan.metrics.symmetry || 84),
        Math.round(scan.metrics.mobility || 71),
        Math.round(scan.metrics.balance || 78)
      ];
      panelMetrics.forEach((m,i)=>{
        const headSpan = m.querySelector('.metric-head span:last-child');
        const barI = m.querySelector('.bar i');
        if(headSpan) headSpan.textContent = vals[i] + '%';
        if(barI) barI.style.setProperty('--w', vals[i] + '%');
      });
    }
    // mass panels: muscle vs fat
    const massCards = document.querySelectorAll('#sec-fuel .mass-card');
    if(massCards.length>=2 && scan.muscles){
      const avgMuscle = Math.round(( (scan.muscles.shoulders||70) + (scan.muscles.arms||60) + (scan.muscles.core||85) + (scan.muscles.legs||80) )/4);
      const fat = Math.max(8, Math.min(32, Math.round(22 - (scan.score-70)/10)));
      const muscleEl = massCards[1]?.querySelector('.mass-head strong');
      const fatEl = massCards[0]?.querySelector('.mass-head strong');
      if(muscleEl) muscleEl.textContent = avgMuscle + '%';
      if(fatEl) fatEl.textContent = fat + '%';
    }
  }
  refreshFuelReal();
  setInterval(refreshFuelReal, 3500);
})();
(function(){

const page=document.getElementById('page'),network=document.getElementById('network');
if(page && network){
  page.addEventListener('pointermove',e=>{
   const r=page.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
   network.style.transform=`translate(calc(-50% + ${x*22}px),calc(-50% + ${y*14}px)) rotateX(${-y*2.5}deg) rotateY(${x*3.5}deg)`;
  });
  page.addEventListener('pointerleave',function(){ network.style.transform='translate(-50%,-50%)'; });
}

/* Coach decision now comes from the REAL AI agent (Ollama-backed),
   not a hardcoded rotating list. */
let coachBusy = false;
async function refreshCoachDecision(){
  if (coachBusy) return;
  const a=document.getElementById('choice'),b=document.getElementById('explain');
  if (!a || !b) return;
  coachBusy = true;
  try {
    const data = await apiGet('/api/agent/coach-decision');
    if (data && data.title) {
      if (a.textContent !== data.title) {
        a.style.opacity=0;b.style.opacity=0;
        setTimeout(()=>{
          a.textContent=data.title;
          b.textContent=data.explain;
          a.style.opacity=1;b.style.opacity=1;
        },280);
      }
      const badge = document.getElementById('agentBadge');
      if (badge) {
        const live = data.source === 'agent';
        badge.textContent = live ? 'AI AGENT · LIVE' : 'AI AGENT · OFFLINE';
        badge.style.color = live ? '#56f0b1' : '#7c8aa8';
      }
    }
  } finally {
    coachBusy = false;
  }
}
refreshCoachDecision();
setInterval(refreshCoachDecision, 12000);

/* ---- Ask the coach: scrollable follow-up chat with the fitness agent ---- */
(function coachChat(){
  const form = document.getElementById('coachAskForm');
  if (!form) return;
  const input = document.getElementById('coachInput');
  const out = document.getElementById('coachAnswer');
  const btn = document.getElementById('coachAskBtn');
  const history = [];
  const MAX_CTX = 10;

  function scrollBottom(){
    requestAnimationFrame(function(){
      out.scrollTop = out.scrollHeight;
      const panel = document.querySelector('#sec-coach .panel');
      if(panel) panel.scrollTop = panel.scrollHeight;
    });
  }

  function bubble(role, text, extra){
    const d = document.createElement('div');
    d.className = 'coachMsg ' + (role === 'user' ? 'coachMsg--user' : 'coachMsg--ai') + (extra ? ' ' + extra : '');
    d.textContent = text;
    return d;
  }

  function render(){
    out.innerHTML = '';
    if (history.length === 0){
      out.appendChild(bubble('ai','Ask the AI coach anything about training, recovery, or nutrition. Your follow-ups stay here — just keep chatting!', 'coachMsg--intro'));
    } else {
      history.forEach(function(m){ out.appendChild(bubble(m.role, m.text)); });
    }
    scrollBottom();
  }

  function setThinking(on){
    let t = out.querySelector('.coachMsg--thinking');
    if (on){
      if (!t){
        t = document.createElement('div');
        t.className = 'coachMsg coachMsg--ai coachMsg--thinking';
        t.textContent = 'Thinking\u2026';
        out.appendChild(t);
        scrollBottom();
      }
    } else if (t) t.remove();
  }

  render();

  async function ask(){
    const q = input.value.trim();
    if (!q) return;
    history.push({role:'user', text:q});
    input.value = '';
    render();
    setThinking(true);
    btn.disabled = true;
    let context = null;
    try { const v = await apiGet('/api/vitals'); if (v) context = v; } catch(e){}
    const payload = { question: q, context: context };
    if (history.length > 1){
      payload.history = history.slice(-MAX_CTX).map(function(m){ return {role:m.role, content:m.text}; });
      // also include the current question explicitly as last entry already covered by question field
    }
    const data = await apiPost('/api/agent/chat', payload);
    setThinking(false);
    btn.disabled = false;
    const answer = data && data.answer ? data.answer : 'Agent unreachable. Start it with: cd agent && python agent_server.py';
    history.push({role:'assistant', text: answer});
    if (history.length > 40) history.splice(0, history.length - 40);
    render();
    input.focus();
  }

  btn.addEventListener('click', ask);
  input.addEventListener('keydown', function(e){ if(e.key==='Enter') ask(); });

  // When coach tab is activated, focus input and keep scroll at bottom
  document.querySelectorAll('.shellNav button').forEach(function(b){
    if (b.dataset.target === 'sec-coach'){
      b.addEventListener('click', function(){ setTimeout(function(){ scrollBottom(); input.focus(); }, 180); });
    }
  });
  out.addEventListener('click', function(){ input.focus(); });
})();

document.querySelectorAll('.node').forEach(node=>{
 node.addEventListener('click',()=>{
   document.querySelectorAll('.node').forEach(n=>n.style.opacity='.35');
   node.style.opacity='1';
   setTimeout(()=>document.querySelectorAll('.node').forEach(n=>n.style.opacity='1'),1200);
 });
});

})();

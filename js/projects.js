/* ═══════════════════════════════════════════════════
   GreenBee — Space Scenes (mathematically correct)
   Scene 0: Deep Space  — stars + shooting stars
   Scene 1: Nebula      — gas clouds + star cluster
   Scene 2: Solar System — sun + 5 planets on correct
            elliptical orbits with proper tilt

   ACCURACY NOTES:
   - Planets orbit on a tilted ellipse (perspective view
     of a flat orbital plane seen at ~30° inclination).
     orbitRx = full radius, orbitRy = orbitRx * sin(tilt)
   - Meteor angles: all spawn off-screen, travel across.
     Angle always points INTO the canvas, never away.
   - Tail is drawn from head backwards along -velocity.
   - RAF loop has single entry guard.
   - setInterval created once, cleared on stop().
   - ResizeObserver rebuilds scene geometry on resize.
═══════════════════════════════════════════════════ */

window.SpaceScenes = (() => {
  let canvas, ctx;
  let W = 0, H = 0;           // canvas pixels (pre-DPR)
  let DPR = 1;
  let raf = null;
  let spawnTimer = null;
  let scene = 0;
  const TOTAL = 3;
  let S = {};                  // scene state object

  // ── INIT ─────────────────────────────
  function init() {
    canvas = document.getElementById('spaceCanvas');
    if (!canvas || canvas._gbInit) return;
    canvas._gbInit = true;
    ctx = canvas.getContext('2d');
    resize();
    new ResizeObserver(resize).observe(canvas.parentElement);
    canvas.addEventListener('touchstart', onTS, { passive: true });
    canvas.addEventListener('touchend',   onTE, { passive: true });
    document.querySelectorAll('.scene-dot').forEach((d, i) =>
      d.addEventListener('click', () => switchScene(i))
    );
    if (!raf) loop();
    if (!spawnTimer) spawnTimer = setInterval(tick, 1400);
    updateDots();
  }

  function resize() {
    if (!canvas) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    buildScene(scene);
  }

  // ── SCENE BUILDERS ───────────────────
  function buildScene(i) {
    S = {};
    if (i === 0) S = buildDeepSpace();
    if (i === 1) S = buildNebula();
    if (i === 2) S = buildSolar();
  }

  function buildDeepSpace() {
    return {
      stars: Array.from({ length: 150 }, () => ({
        x: rand(0, W), y: rand(0, H),
        r: rand(0.3, 1.6),
        base: rand(0.15, 0.75),
        phase: rand(0, TAU),
        freq:  rand(0.5, 1.8),    // twinkle Hz
        hue:   pick([null,null,null,null,210,220,45,280]),
      })),
      meteors: [],
    };
  }

  function buildNebula() {
    // Nebula blobs are static gradients — positions computed once
    const blobs = [
      { x:W*0.22, y:H*0.28, r:W*0.48, h:270, a:0.055 },
      { x:W*0.78, y:H*0.65, r:W*0.38, h:200, a:0.048 },
      { x:W*0.50, y:H*0.85, r:W*0.40, h:320, a:0.040 },
      { x:W*0.08, y:H*0.70, r:W*0.32, h:150, a:0.032 },
    ];
    return {
      blobs,
      stars: Array.from({ length: 220 }, () => ({
        x: rand(0, W), y: rand(0, H),
        r: rand(0.2, 1.1),
        base: rand(0.1, 0.85),
        phase: rand(0, TAU),
        freq:  rand(0.3, 1.5),
        hue:   pick([null,200,210,260,280,320]),
        sat:   rand(30, 70),
      })),
      // Cluster center
      clusterX: W * 0.72, clusterY: H * 0.32,
      clusterStars: Array.from({ length: 24 }, (_, i) => ({
        angle: (i / 24) * TAU,
        orbitR: rand(12, 60),
        phase: rand(0, TAU),
        r: rand(0.6, 1.8),
        hue: 200 + i * 5,
      })),
    };
  }

  function buildSolar() {
    const cx   = W * 0.42;
    const cy   = H * 0.50;
    const sunR = clamp(Math.min(W, H) * 0.082, 10, 40);
    const TILT = Math.sin(toRad(28)); // orbital plane tilt factor

    const planets = [
      // { name, orbitRx, speed deg/frame, r, color, angle0, hasRings, moon }
      // Speeds loosely scaled to real relative periods (Mercury fastest)
      { name:'Mercury', orbitRx:sunR*2.2,  speed:0.030, r:sunR*0.17, color:'#aab8d0', angle:0.40 },
      { name:'Venus',   orbitRx:sunR*3.2,  speed:0.020, r:sunR*0.26, color:'#e8c97a', angle:1.20 },
      { name:'Earth',   orbitRx:sunR*4.4,  speed:0.014, r:sunR*0.28, color:'#5b9bd5', angle:2.10,
        moon:{ orbitRx:sunR*0.56, speed:0.065, r:sunR*0.10, color:'#cccccc', angle:0 } },
      { name:'Mars',    orbitRx:sunR*5.9,  speed:0.009, r:sunR*0.22, color:'#d96a4a', angle:3.80 },
      { name:'Jupiter', orbitRx:sunR*8.2,  speed:0.004, r:sunR*0.45, color:'#c9a96e', angle:0.90, hasRings:true },
    ].map(p => ({ ...p, orbitRy: p.orbitRx * TILT, angle: p.angle }));

    return {
      cx, cy, sunR, TILT,
      planets,
      bgStars: Array.from({ length: 90 }, () => ({
        x: rand(0,W), y: rand(0,H),
        r: rand(0.2, 0.9),
        o: rand(0.08, 0.45),
        phase: rand(0, TAU), freq: rand(0.3, 1.0),
      })),
      sunPulse: 0,
    };
  }

  // ── DRAW LOOP ────────────────────────
  function loop() {
    raf = requestAnimationFrame(loop);
    const t = performance.now() * 0.001;   // seconds
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (scene === 0) drawDeepSpace(t);
    if (scene === 1) drawNebula(t);
    if (scene === 2) drawSolar(t);
  }

  // ── SCENE 0: DEEP SPACE ──────────────
  function drawDeepSpace(t) {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);
    radialGlow(W*0.65, H*0.25, W*0.55, 'rgba(60,20,140,0.06)');
    radialGlow(W*0.10, H*0.80, W*0.38, 'rgba(8,55,35,0.05)');

    S.stars.forEach(s => {
      const a = s.base * (0.65 + 0.35 * Math.sin(s.phase + t * s.freq * TAU));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fillStyle = s.hue != null
        ? `hsla(${s.hue},55%,88%,${a})` : `rgba(255,255,255,${a})`;
      ctx.fill();
    });

    // Meteors
    S.meteors = S.meteors.filter(m => m.life > 0);
    S.meteors.forEach(m => {
      // Tail starts at head, extends BACKWARDS (opposite velocity direction)
      const tailLen = m.len * m.life;
      const tx = m.x - Math.cos(m.ang) * tailLen;
      const ty = m.y - Math.sin(m.ang) * tailLen;

      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      const c = m.purple ? 'hsla(265,75%,82%,' : 'rgba(255,255,255,';
      g.addColorStop(0,   c + (m.life * 0.92) + ')');
      g.addColorStop(0.35,c + (m.life * 0.30) + ')');
      g.addColorStop(1,   c + '0)');
      ctx.strokeStyle = g;
      ctx.lineWidth   = 2.2 * m.life;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();

      // Head glow
      const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 5 * m.life);
      hg.addColorStop(0, c + (m.life * 0.9) + ')');
      hg.addColorStop(1, c + '0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(m.x, m.y, 5 * m.life, 0, TAU); ctx.fill();

      // Advance position
      m.x    += Math.cos(m.ang) * m.spd;
      m.y    += Math.sin(m.ang) * m.spd;
      m.life -= m.decay;
    });
  }

  // Spawn a meteor that enters from off-screen and travels ACROSS
  function spawnMeteor() {
    if (!S.meteors || S.meteors.length >= 4) return;

    // Pick entry edge (top or right) and a valid trajectory angle
    // All angles are in [0, π] range (downward) or near-right
    let x, y, ang;
    const fromTop = Math.random() < 0.55;
    if (fromTop) {
      // Enter from top edge somewhere across the width
      x   = rand(W * 0.05, W * 0.90);
      y   = -8;
      // Travel downward: angle in 25°–80° (right-leaning) or 100°–155° (left-leaning)
      ang = Math.random() < 0.6
        ? toRad(rand(25, 78))    // down-right
        : toRad(rand(102, 155)); // down-left
    } else {
      // Enter from right edge
      x   = W + 8;
      y   = rand(H * 0.02, H * 0.65);
      // Travel leftward-downward: angle 195°–240° (pointing into canvas)
      ang = toRad(rand(198, 238));
    }

    S.meteors.push({
      x, y, ang,
      spd:   rand(2.0, 5.5),
      len:   rand(55, 130),
      life:  1.0,
      decay: rand(0.010, 0.016),
      purple: Math.random() < 0.38,
    });
  }

  // ── SCENE 1: NEBULA ──────────────────
  function drawNebula(t) {
    ctx.fillStyle = '#040410';
    ctx.fillRect(0, 0, W, H);

    // Static nebula blobs
    S.blobs.forEach(b => radialGlow(b.x, b.y, b.r, `hsla(${b.h},70%,50%,${b.a})`));

    // Stars with gentle twinkling
    S.stars.forEach(s => {
      const a = s.base * (0.55 + 0.45 * Math.sin(s.phase + t * s.freq * TAU));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fillStyle = s.hue
        ? `hsla(${s.hue},${s.sat}%,88%,${a})`
        : `rgba(255,255,255,${a})`;
      ctx.fill();
    });

    // Rotating star cluster (slow drift)
    const cx = S.clusterX, cy = S.clusterY;
    const drift = t * 0.018; // very slow rotation in radians
    S.clusterStars.forEach(s => {
      const a  = s.angle + drift;
      const px = cx + Math.cos(a) * s.orbitR;
      const py = cy + Math.sin(a) * s.orbitR * 0.55; // flattened
      const brightness = 0.35 + 0.55 * Math.abs(Math.sin(s.phase + t * 0.9));
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, TAU);
      ctx.fillStyle = `hsla(${s.hue},65%,86%,${brightness})`;
      ctx.fill();
    });

    // Central cluster glow
    radialGlow(cx, cy, 30, `rgba(180,160,255,0.18)`);
  }

  // ── SCENE 2: SOLAR SYSTEM ────────────
  function drawSolar(t) {
    ctx.fillStyle = '#010008';
    ctx.fillRect(0, 0, W, H);
    radialGlow(W*0.85, H*0.12, W*0.40, 'rgba(30,10,80,0.07)');

    const { cx, cy, sunR, planets } = S;

    // Background stars
    S.bgStars.forEach(s => {
      const a = s.o * (0.7 + 0.3 * Math.sin(s.phase + t * s.freq * TAU));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
    });

    // Orbit ellipses (perspective: planet's flat orbit at ~28° inclination)
    planets.forEach(p => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, p.orbitRx, p.orbitRy, 0, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Sun — pulsing core
    S.sunPulse = (S.sunPulse || 0) + 0.028;
    const pulse = 1 + 0.038 * Math.sin(S.sunPulse);

    // Sun outer corona
    const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 3.2 * pulse);
    corona.addColorStop(0,   'rgba(255,220,120,0.22)');
    corona.addColorStop(0.35,'rgba(255,140,20,0.10)');
    corona.addColorStop(0.7, 'rgba(255,60,0,0.04)');
    corona.addColorStop(1,   'transparent');
    ctx.fillStyle = corona;
    ctx.beginPath(); ctx.arc(cx, cy, sunR * 3.2 * pulse, 0, TAU); ctx.fill();

    // Sun core
    const core = ctx.createRadialGradient(cx-sunR*0.28, cy-sunR*0.28, 0, cx, cy, sunR * pulse);
    core.addColorStop(0,   '#fffde8');
    core.addColorStop(0.45,'#ffd020');
    core.addColorStop(1,   '#ff7800');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, sunR * pulse, 0, TAU); ctx.fill();

    // Advance planet angles (degrees converted to radians per frame @60fps ~16ms)
    planets.forEach(p => { p.angle += p.speed; });

    // Draw planets back-to-front based on y position (painter's algorithm)
    // Position each planet on its tilted ellipse
    const positioned = planets.map(p => ({
      ...p,
      px: cx + Math.cos(p.angle) * p.orbitRx,
      py: cy + Math.sin(p.angle) * p.orbitRy,
    }));
    // Sort by py so closer planets (higher py) are drawn on top
    positioned.sort((a, b) => a.py - b.py);

    positioned.forEach(p => {
      const { px, py } = p;

      // Saturn rings — draw before planet (behind it)
      if (p.hasRings) {
        const rw = p.r * 2.4, rh = p.r * 0.55;
        ctx.save();
        ctx.translate(px, py);
        // Outer ring
        ctx.beginPath();
        ctx.ellipse(0, 0, rw, rh, 0, 0, TAU);
        ctx.strokeStyle = 'rgba(200,170,100,0.40)';
        ctx.lineWidth = p.r * 0.55;
        ctx.stroke();
        // Inner ring gap
        ctx.beginPath();
        ctx.ellipse(0, 0, rw*0.78, rh*0.78, 0, 0, TAU);
        ctx.strokeStyle = 'rgba(200,170,100,0.22)';
        ctx.lineWidth = p.r * 0.22;
        ctx.stroke();
        ctx.restore();
      }

      // Planet atmosphere glow
      const atm = ctx.createRadialGradient(px, py, 0, px, py, p.r * 2.0);
      atm.addColorStop(0,   p.color + '55');
      atm.addColorStop(0.6, p.color + '18');
      atm.addColorStop(1,   'transparent');
      ctx.fillStyle = atm;
      ctx.beginPath(); ctx.arc(px, py, p.r * 2.0, 0, TAU); ctx.fill();

      // Planet body with shading
      const lit = ctx.createRadialGradient(
        px - p.r*0.32, py - p.r*0.32, 0,
        px, py, p.r
      );
      lit.addColorStop(0,   lighten(p.color, 50));
      lit.addColorStop(0.6, p.color);
      lit.addColorStop(1,   darken(p.color, 45));
      ctx.fillStyle = lit;
      ctx.beginPath(); ctx.arc(px, py, p.r, 0, TAU); ctx.fill();

      // Earth special: continent patches
      if (p.name === 'Earth') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#2d8f4e';
        [[0.2,0.1,p.r*0.3],[-.3,-.2,p.r*0.22],[ .1,-.3,p.r*0.18]].forEach(([dx,dy,cr]) => {
          ctx.beginPath(); ctx.arc(px+dx*p.r, py+dy*p.r, cr, 0, TAU); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      // Moon (Earth only)
      if (p.moon) {
        const m = p.moon;
        m.angle += m.speed;
        // Moon orbits in the same tilted plane as planets
        const mx = px + Math.cos(m.angle) * m.orbitRx;
        const my = py + Math.sin(m.angle) * m.orbitRx * S.TILT;
        ctx.fillStyle = m.color;
        ctx.beginPath(); ctx.arc(mx, my, m.r, 0, TAU); ctx.fill();
      }
    });
  }

  // ── SPAWN TICK ───────────────────────
  function tick() {
    if (scene === 0 && document.getElementById('view-projects')?.classList.contains('active')) {
      spawnMeteor();
    }
  }

  // ── STOP ─────────────────────────────
  function stop() {
    if (raf)        { cancelAnimationFrame(raf); raf = null; }
    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    if (canvas)     { canvas._gbInit = false; }
  }

  // ── SWIPE ────────────────────────────
  let tx0 = 0, ty0 = 0;
  function onTS(e) { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }
  function onTE(e) {
    const dx = e.changedTouches[0].clientX - tx0;
    const dy = e.changedTouches[0].clientY - ty0;
    if (Math.abs(dx) < 32 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0 && scene < TOTAL-1) switchScene(scene+1);
    if (dx > 0 && scene > 0)       switchScene(scene-1);
  }

  function switchScene(i) {
    if (i === scene) return;
    scene = i;
    buildScene(i);
    updateDots();
    showToast(['✦ Deep Space','✦ Nebula','✦ Solar System'][i]);
  }
  function updateDots() {
    document.querySelectorAll('.scene-dot').forEach((d, i) =>
      d.classList.toggle('active', i === scene)
    );
  }

  // ── HELPERS ──────────────────────────
  const TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
  function toRad(d)   { return d * Math.PI / 180; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function radialGlow(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#',''), 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  }
  function lighten(hex, amt) {
    const [r,g,b] = hexToRgb(hex);
    return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
  }
  function darken(hex, amt) { return lighten(hex, -amt); }

  return { init, stop, switchScene };
})();

// ══════════════════════════════════════
// PROJECTS MODULE
// ══════════════════════════════════════
window.Projects = (() => {
  async function render() {
    SpaceScenes.init();

    const list  = document.getElementById('projectsList');
    const empty = document.getElementById('projectsEmpty');
    if (!list) return;
    [...list.querySelectorAll('.project-card')].forEach(n => n.remove());

    const projects = await Storage.getProjects();
    setText('projectCount', projects.length);
    empty.style.display = projects.length === 0 ? '' : 'none';

    projects.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'project-card';
      const tags = (proj.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
      card.innerHTML = `
        <button class="proj-card-menu" onclick="projMenu(event,'${esc(proj.id)}','${esc(proj.name)}')" aria-label="Options">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
        <div class="proj-card-name">${esc(proj.name)}</div>
        ${proj.description ? `<div class="proj-card-desc">${esc(proj.description)}</div>` : ''}
        <div class="proj-card-links">
          ${proj.url  ? `<a href="${esc(proj.url)}"  class="proj-link-btn" target="_blank" rel="noopener"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Live</a>` : ''}
          ${proj.repo ? `<a href="${esc(proj.repo)}" class="proj-link-btn" target="_blank" rel="noopener"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg> Repo</a>` : ''}
        </div>
        ${tags.length ? `<div class="proj-tags">${tags.map(t=>`<span class="proj-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      `;
      card.addEventListener('click', e => {
        if (e.target.closest('.proj-card-menu,.proj-link-btn')) return;
        openProjectEditor(proj);
      });
      list.appendChild(card);
    });
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  return { render };
})();

function projMenu(e, id, name) {
  e.stopPropagation();
  showContextMenu(e, [
    {
      label:'Edit',
      icon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      action: async () => {
        const p = (await Storage.getProjects()).find(p=>p.id===id);
        if (p) openProjectEditor(p);
      }
    },
    {
      label:'Delete', danger:true,
      icon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>',
      action: async () => {
        if (confirm(`Delete "${name}"?`)) {
          await Storage.deleteProject(id);
          Projects.render(); refreshStats();
          showToast('Project deleted');
        }
      }
    }
  ]);
}

let _editProjId = null;
function openProjectEditor(proj) {
  _editProjId = proj?.id || null;
  document.getElementById('projNameInput').value = proj?.name || '';
  document.getElementById('projUrlInput').value  = proj?.url  || '';
  document.getElementById('projRepoInput').value = proj?.repo || '';
  document.getElementById('projTagsInput').value = proj?.tags || '';
  document.getElementById('projDescInput').value = proj?.description || '';
  document.getElementById('projectEditorOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('projNameInput').focus(), 100);
}
function closeProjectEditor() {
  document.getElementById('projectEditorOverlay').classList.add('hidden');
  _editProjId = null;
}
async function saveProject() {
  const name = document.getElementById('projNameInput').value.trim();
  if (!name) { showToast('Enter a project name'); return; }
  await Storage.saveProject({
    id: _editProjId, name,
    url:         document.getElementById('projUrlInput').value.trim(),
    repo:        document.getElementById('projRepoInput').value.trim(),
    tags:        document.getElementById('projTagsInput').value.trim(),
    description: document.getElementById('projDescInput').value.trim(),
  });
  closeProjectEditor();
  showToast('Project saved ✓');
  Projects.render(); refreshStats();
}

function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

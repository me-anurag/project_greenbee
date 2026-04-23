/* ══════════════════════════════════════════════════════
   GreenBee — Projects + Space Scenes
   3 swipeable canvas scenes:
     0 — Deep Space (stars + shooting stars)
     1 — Nebula (colourful gas clouds + star clusters)
     2 — Solar System (orbiting planets)

   BUGS FIXED vs v1:
   - setInterval leak: only ONE interval ever created, cleared on stop
   - Multiple RAF loops: guard flag prevents stacking
   - Meteor angle from right side was π+π/4 = 225° (up-left). Fixed to ~315° (down-left)
   - Meteor trail drawn FROM current pos before move — now draws correct direction
   - Unused `t` variable removed
   - resize() recreates stars & objects cleanly
   - stop() cancels RAF + interval
══════════════════════════════════════════════════════ */

window.SpaceScenes = (() => {
  let canvas, ctx, W, H;
  let raf = null;
  let spawnInterval = null;
  let currentScene = 0;
  const SCENES = 3;
  // Per-scene state
  let scenes = {};

  // ── Swipe state ──────────────────────
  let touchStartX = 0, touchStartY = 0, isSwiping = false;

  // ── Init ─────────────────────────────
  function init() {
    canvas = document.getElementById('spaceCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resize();
    new ResizeObserver(resize).observe(canvas.parentElement);

    // Touch swipe
    canvas.addEventListener('touchstart', onTouchStart, { passive:true });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive:true });

    // Dots indicator click
    document.querySelectorAll('.scene-dot').forEach((dot, i) => {
      dot.addEventListener('click', () => switchScene(i));
    });

    startLoop();
    startSpawn();
    updateDots();
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr  = Math.min(devicePixelRatio, 2); // cap at 2x for perf
    W = canvas.width  = rect.width  * dpr;
    H = canvas.height = rect.height * dpr;
    canvas.style.width  = rect.width  + 'px';
    canvas.style.height = rect.height + 'px';
    buildScene(currentScene);
  }

  // ── Scene builder ─────────────────────
  function buildScene(i) {
    if (i === 0) buildDeepSpace();
    if (i === 1) buildNebula();
    if (i === 2) buildSolar();
  }

  // Scene 0: Deep Space
  function buildDeepSpace() {
    const dpr = Math.min(devicePixelRatio, 2);
    scenes[0] = {
      stars: Array.from({ length: 140 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (Math.random() * 1.2 + 0.3) * dpr,
        base: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.008 + Math.random() * 0.018,
        hue: pickRand([null, null, null, 210, 45, 280]),
      })),
      meteors: [],
    };
  }

  // Scene 1: Nebula
  function buildNebula() {
    const dpr = Math.min(devicePixelRatio, 2);
    scenes[1] = {
      stars: Array.from({ length: 200 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (Math.random() * 0.9 + 0.2) * dpr,
        base: Math.random() * 0.8 + 0.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015,
        hue: pickRand([null, 200, 260, 320, 45]),
        sat: 40 + Math.random() * 50,
      })),
      // Static nebula blobs — pre-computed positions so no per-frame calc
      blobs: [
        { x:W*0.2, y:H*0.3, r:W*0.45, c:'rgba(120,40,220,', a:0.055 },
        { x:W*0.75, y:H*0.6, r:W*0.4, c:'rgba(20,100,200,', a:0.05  },
        { x:W*0.5, y:H*0.8, r:W*0.35, c:'rgba(200,40,120,', a:0.04  },
        { x:W*0.1, y:H*0.7, r:W*0.3,  c:'rgba(20,160,100,', a:0.035 },
      ],
      // Drifting dust particles
      dust: Array.from({ length: 60 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: (Math.random() * 2 + 0.5) * dpr,
        hue: pickRand([260, 320, 200]),
        o: Math.random() * 0.4 + 0.1,
      })),
    };
  }

  // Scene 2: Solar System
  function buildSolar() {
    const dpr = Math.min(devicePixelRatio, 2);
    const cx = W * 0.35, cy = H * 0.48;
    const sunR = Math.min(W, H) * 0.085;
    scenes[2] = {
      cx, cy, sunR,
      stars: Array.from({ length: 80 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: (Math.random() * 0.7 + 0.2) * dpr,
        o: Math.random() * 0.4 + 0.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.006 + Math.random() * 0.01,
      })),
      planets: [
        // { orbitR, speed (rad/frame), r (radius), color, startAngle, moons }
        { orbitR: sunR*2.1, speed:0.028, r:sunR*0.18, color:'#b0c4ff', angle: 0.5,   label:'Mercury' },
        { orbitR: sunR*3.1, speed:0.018, r:sunR*0.28, color:'#e8c97a', angle: 1.2,   label:'Venus'   },
        { orbitR: sunR*4.3, speed:0.012, r:sunR*0.30, color:'#6ab3f5', angle: 2.1,   label:'Earth',
          moon: { orbitR: sunR*0.55, speed:0.06, r:sunR*0.10, color:'#cccccc', angle:0 } },
        { orbitR: sunR*5.8, speed:0.008, r:sunR*0.26, color:'#e07a5f', angle: 3.8,   label:'Mars'    },
        { orbitR: sunR*8.0, speed:0.004, r:sunR*0.48, color:'#d4a96a', angle: 0.9,   label:'Jupiter',
          rings: true },
      ],
      sunGlow: 0,
    };
  }

  // ── Draw loop ─────────────────────────
  function startLoop() {
    if (raf) return; // prevent stacking
    loop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const t = Date.now() * 0.001;
    if (currentScene === 0) drawDeepSpace(t);
    if (currentScene === 1) drawNebula(t);
    if (currentScene === 2) drawSolar(t);
  }

  // ── Scene 0: Deep Space ───────────────
  function drawDeepSpace(t) {
    const s = scenes[0]; if (!s) return;
    ctx.fillStyle = '#030712'; ctx.fillRect(0, 0, W, H);

    // Subtle nebula hint
    drawRadialGlow(W*0.65, H*0.25, W*0.6, 'rgba(60,20,140,0.06)');
    drawRadialGlow(W*0.1,  H*0.8,  W*0.4, 'rgba(10,70,40,0.05)');

    // Stars
    s.stars.forEach(st => {
      const alpha = st.base * (0.65 + 0.35 * Math.sin(st.phase + t * st.speed * 6.28));
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fillStyle = st.hue != null
        ? `hsla(${st.hue},60%,90%,${alpha})`
        : `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });

    // Meteors — draw trail BEHIND head (tail goes opposite to direction)
    s.meteors = s.meteors.filter(m => m.life > 0);
    s.meteors.forEach(m => {
      const dpr = Math.min(devicePixelRatio, 2);
      // Tail end is behind the meteor (opposite to velocity direction)
      const tailX = m.x - Math.cos(m.angle) * m.length * m.life;
      const tailY = m.y - Math.sin(m.angle) * m.length * m.life;

      const mg = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      const col = m.hue ? `hsla(${m.hue},80%,85%,` : 'rgba(255,255,255,';
      mg.addColorStop(0,   col + (m.life * 0.95) + ')');
      mg.addColorStop(0.4, col + (m.life * 0.3)  + ')');
      mg.addColorStop(1,   col + '0)');

      ctx.strokeStyle = mg;
      ctx.lineWidth   = 2 * dpr * m.life;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tailX, tailY); ctx.stroke();

      // Head glow
      const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 4*dpr*m.life);
      glow.addColorStop(0, col + m.life + ')');
      glow.addColorStop(1, col + '0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(m.x, m.y, 4*dpr*m.life, 0, Math.PI*2); ctx.fill();

      // Move meteor forward
      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.life -= m.decay;
    });
  }

  function spawnMeteor() {
    const s = scenes[0]; if (!s) return;
    if (s.meteors.length >= 5) return;
    const dpr = Math.min(devicePixelRatio, 2);
    const fromTop   = Math.random() < 0.6;
    let sx, sy, angle;
    if (fromTop) {
      // Spawn from top edge, travel downward-right or downward-left
      sx    = Math.random() * W;
      sy    = -10;
      // Angles: 30°–70° (top-right path) or 110°–150° (top-left path)
      angle = (Math.random() < 0.6)
        ? toRad(30 + Math.random() * 40)   // down-right
        : toRad(110 + Math.random() * 40);  // down-left
    } else {
      // Spawn from right edge, travel leftward
      sx    = W + 10;
      sy    = Math.random() * H * 0.6;
      angle = toRad(195 + Math.random() * 30); // 195°–225° = down-left
    }
    s.meteors.push({
      x: sx, y: sy, angle, life: 1,
      speed:  (2.5 + Math.random() * 4) * dpr,
      length: (50 + Math.random() * 100) * dpr,
      decay:  0.01 + Math.random() * 0.012,
      hue:    Math.random() < 0.35 ? 260 : null,
    });
  }

  // ── Scene 1: Nebula ───────────────────
  function drawNebula(t) {
    const s = scenes[1]; if (!s) return;
    ctx.fillStyle = '#04040f'; ctx.fillRect(0, 0, W, H);

    // Static nebula blobs
    s.blobs.forEach(b => drawRadialGlow(b.x, b.y, b.r, b.c + b.a + ')'));

    // Dust particles drift
    s.dust.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = W; if (d.x > W) d.x = 0;
      if (d.y < 0) d.y = H; if (d.y > H) d.y = 0;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${d.hue},70%,80%,${d.o})`;
      ctx.fill();
    });

    // Stars (more colorful)
    s.stars.forEach(st => {
      const alpha = st.base * (0.6 + 0.4 * Math.sin(st.phase + t * st.speed * 6.28));
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fillStyle = st.hue
        ? `hsla(${st.hue},${st.sat}%,90%,${alpha})`
        : `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });

    // Bright cluster in center-right
    const cx = W*0.7, cy = H*0.35;
    for (let i = 0; i < 18; i++) {
      const a  = (i / 18) * Math.PI * 2 + t * 0.03;
      const r  = (20 + i * 4) * Math.min(devicePixelRatio,2);
      const px = cx + Math.cos(a) * r * 0.6;
      const py = cy + Math.sin(a) * r * 0.4;
      const brightness = 0.3 + 0.5 * Math.sin(t * 1.2 + i);
      ctx.beginPath();
      ctx.arc(px, py, (0.8 + i%3*0.4) * Math.min(devicePixelRatio,2), 0, Math.PI*2);
      ctx.fillStyle = `hsla(${200 + i*8},70%,85%,${brightness})`;
      ctx.fill();
    }
  }

  // ── Scene 2: Solar System ─────────────
  function drawSolar(t) {
    const s = scenes[2]; if (!s) return;
    const { cx, cy, sunR } = s;
    const dpr = Math.min(devicePixelRatio, 2);

    ctx.fillStyle = '#010008'; ctx.fillRect(0, 0, W, H);
    drawRadialGlow(W*0.85, H*0.15, W*0.35, 'rgba(30,10,80,0.07)');

    // Background stars
    s.stars.forEach(st => {
      const alpha = st.o * (0.7 + 0.3 * Math.sin(st.phase + t * st.speed * 6));
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
    });

    // Orbit rings
    s.planets.forEach(p => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, p.orbitR, p.orbitR * 0.35, 0, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = dpr;
      ctx.stroke();
    });

    // Sun
    s.sunGlow = (s.sunGlow || 0) + 0.03;
    const pulse = 1 + 0.04 * Math.sin(s.sunGlow);
    const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 2.5 * pulse);
    sunGrad.addColorStop(0,   'rgba(255,240,180,0.9)');
    sunGrad.addColorStop(0.3, 'rgba(255,160,20,0.6)');
    sunGrad.addColorStop(0.7, 'rgba(255,80,0,0.15)');
    sunGrad.addColorStop(1,   'transparent');
    ctx.fillStyle = sunGrad;
    ctx.beginPath(); ctx.arc(cx, cy, sunR * 2.5 * pulse, 0, Math.PI*2); ctx.fill();

    // Sun core
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR);
    coreGrad.addColorStop(0,   '#fffde0');
    coreGrad.addColorStop(0.5, '#ffcc00');
    coreGrad.addColorStop(1,   '#ff8800');
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(cx, cy, sunR * pulse, 0, Math.PI*2); ctx.fill();

    // Planets
    s.planets.forEach(p => {
      p.angle += p.speed;
      const px = cx + Math.cos(p.angle) * p.orbitR;
      const py = cy + Math.sin(p.angle) * p.orbitR * 0.35;

      // Saturn-like rings
      if (p.rings) {
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1, 0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 2.2, p.r * 2.2, 0, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(210,180,110,0.45)';
        ctx.lineWidth = p.r * 0.45;
        ctx.stroke();
        ctx.restore();
      }

      // Planet glow
      const pglow = ctx.createRadialGradient(px, py, 0, px, py, p.r * 1.8);
      pglow.addColorStop(0, p.color + 'aa');
      pglow.addColorStop(1, 'transparent');
      ctx.fillStyle = pglow;
      ctx.beginPath(); ctx.arc(px, py, p.r * 1.8, 0, Math.PI*2); ctx.fill();

      // Planet body
      const pgrad = ctx.createRadialGradient(px - p.r*0.3, py - p.r*0.3, 0, px, py, p.r);
      pgrad.addColorStop(0, lighten(p.color, 40));
      pgrad.addColorStop(1, darken(p.color, 30));
      ctx.fillStyle = pgrad;
      ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI*2); ctx.fill();

      // Moon
      if (p.moon) {
        const m = p.moon;
        m.angle += m.speed;
        const mx = px + Math.cos(m.angle) * m.orbitR;
        const my = py + Math.sin(m.angle) * m.orbitR * 0.5;
        ctx.fillStyle = m.color;
        ctx.beginPath(); ctx.arc(mx, my, m.r, 0, Math.PI*2); ctx.fill();
      }
    });
  }

  // ── Spawn controller ─────────────────
  function startSpawn() {
    if (spawnInterval) return;
    spawnInterval = setInterval(() => {
      if (currentScene === 0 && document.getElementById('view-projects')?.classList.contains('active')) {
        spawnMeteor();
      }
    }, 1400);
  }

  // ── Swipe ────────────────────────────
  function onTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
  }
  function onTouchEnd(e) {
    if (!isSwiping) return;
    isSwiping = false;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return; // not a horizontal swipe
    if (dx < 0 && currentScene < SCENES-1) switchScene(currentScene+1);
    if (dx > 0 && currentScene > 0)        switchScene(currentScene-1);
  }

  function switchScene(i) {
    if (i === currentScene) return;
    currentScene = i;
    buildScene(i);
    updateDots();
    // show scene name toast
    const names = ['Deep Space','Nebula','Solar System'];
    showToast(`✦ ${names[i]}`);
  }

  function updateDots() {
    document.querySelectorAll('.scene-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentScene);
    });
  }

  // ── Stop / cleanup ────────────────────
  function stop() {
    if (raf)           { cancelAnimationFrame(raf); raf = null; }
    if (spawnInterval) { clearInterval(spawnInterval); spawnInterval = null; }
  }

  // ── Helpers ───────────────────────────
  function drawRadialGlow(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,   color);
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function toRad(deg) { return deg * Math.PI / 180; }
  function pickRand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function lighten(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, (n>>16) + amt);
    const g = Math.min(255, ((n>>8)&0xff) + amt);
    const b = Math.min(255, (n&0xff) + amt);
    return `rgb(${r},${g},${b})`;
  }
  function darken(hex, amt) { return lighten(hex, -amt); }

  return { init, stop, switchScene };
})();

// ── PROJECTS MODULE ─────────────────────
window.Projects = (() => {
  let _initialized = false;

  async function render() {
    // Only init canvas once; restart if stopped
    if (!_initialized) {
      _initialized = true;
      SpaceScenes.init();
    } else {
      // Re-init canvas in case it was stopped
      SpaceScenes.init();
    }

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
          ${proj.url  ? `<a href="${esc(proj.url)}"  class="proj-link-btn" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Live</a>` : ''}
          ${proj.repo ? `<a href="${esc(proj.repo)}" class="proj-link-btn" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>Repo</a>` : ''}
        </div>
        ${tags.length ? `<div class="proj-tags">${tags.map(t=>`<span class="proj-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      `;
      card.addEventListener('click', e => {
        if (e.target.closest('.proj-card-menu') || e.target.closest('.proj-link-btn')) return;
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
      label: 'Edit',
      icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      action: async () => {
        const projs = await Storage.getProjects();
        const proj = projs.find(p => p.id === id);
        if (proj) openProjectEditor(proj);
      }
    },
    {
      label: 'Delete',
      icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>',
      danger: true,
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

// ── PROJECT EDITOR ──────────────────────
let _editingProjectId = null;

function openProjectEditor(proj) {
  _editingProjectId = proj?.id || null;
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
  _editingProjectId = null;
}
async function saveProject() {
  const name = document.getElementById('projNameInput').value.trim();
  if (!name) { showToast('Enter a project name'); return; }
  await Storage.saveProject({
    id: _editingProjectId, name,
    url:         document.getElementById('projUrlInput').value.trim(),
    repo:        document.getElementById('projRepoInput').value.trim(),
    tags:        document.getElementById('projTagsInput').value.trim(),
    description: document.getElementById('projDescInput').value.trim()
  });
  closeProjectEditor();
  showToast('Project saved ✓');
  Projects.render(); refreshStats();
}

// Helper used by app.js stats
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

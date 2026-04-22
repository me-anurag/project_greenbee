/* ══════════════════════════════════════
   GreenBee — Projects + Space Canvas
══════════════════════════════════════ */

// ── SPACE ANIMATION ────────────────────
let _spaceRAF = null;

function initSpaceCanvas() {
  const canvas = document.getElementById('spaceCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [], meteors = [];

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width  = rect.width  * devicePixelRatio;
    H = canvas.height = rect.height * devicePixelRatio;
    canvas.style.width  = rect.width  + 'px';
    canvas.style.height = rect.height + 'px';
    spawnStars();
  }

  function spawnStars() {
    stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 * devicePixelRatio + 0.3,
      o: Math.random() * 0.7 + 0.15,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.01 + Math.random() * 0.02,
      // colour: mostly white, some blue-ish, some amber
      hue: Math.random() < 0.15 ? 220 : Math.random() < 0.08 ? 45 : 0,
      sat: Math.random() < 0.23 ? 60 : 0
    }));
  }

  function spawnMeteor() {
    const side = Math.random();
    let sx, sy, angle;
    if (side < 0.5) {
      sx = Math.random() * W * 0.7;
      sy = 0;
      angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5;
    } else {
      sx = W;
      sy = Math.random() * H * 0.5;
      angle = Math.PI + Math.PI / 4 + (Math.random() - 0.5) * 0.4;
    }
    const speed  = (3 + Math.random() * 5) * devicePixelRatio;
    const length = (60 + Math.random() * 120) * devicePixelRatio;
    meteors.push({ x: sx, y: sy, angle, speed, length, life: 1, decay: 0.012 + Math.random() * 0.015, hue: Math.random() < 0.4 ? 260 : 0 });
  }

  // spawn meteors periodically
  setInterval(() => {
    if (document.getElementById('view-projects')?.classList.contains('active')) {
      if (meteors.length < 4) spawnMeteor();
    }
  }, 1200);

  function draw() {
    _spaceRAF = requestAnimationFrame(draw);

    // deep space background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);

    // nebula glow
    const grad = ctx.createRadialGradient(W * 0.7, H * 0.3, 0, W * 0.7, H * 0.3, W * 0.55);
    grad.addColorStop(0, 'rgba(88,28,220,.07)');
    grad.addColorStop(0.5, 'rgba(30,58,138,.04)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const grad2 = ctx.createRadialGradient(W * 0.15, H * 0.8, 0, W * 0.15, H * 0.8, W * 0.4);
    grad2.addColorStop(0, 'rgba(16,92,56,.06)');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, W, H);

    // stars
    const t = Date.now() * 0.001;
    stars.forEach(s => {
      s.twinkle += s.twinkleSpeed;
      const alpha = s.o * (0.7 + 0.3 * Math.sin(s.twinkle));
      if (s.sat > 0) {
        ctx.fillStyle = `hsla(${s.hue},${s.sat}%,90%,${alpha})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // meteors / shooting stars
    meteors = meteors.filter(m => m.life > 0);
    meteors.forEach(m => {
      const tx = m.x + Math.cos(m.angle) * m.length;
      const ty = m.y + Math.sin(m.angle) * m.length;
      const mg = ctx.createLinearGradient(m.x, m.y, tx, ty);
      const col = m.hue > 0 ? `hsla(${m.hue},80%,80%,` : 'rgba(255,255,255,';
      mg.addColorStop(0, col + (m.life * 0.9) + ')');
      mg.addColorStop(0.3, col + (m.life * 0.4) + ')');
      mg.addColorStop(1, col + '0)');
      ctx.strokeStyle = mg;
      ctx.lineWidth   = 1.5 * devicePixelRatio * m.life;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // head glow
      ctx.fillStyle = col + m.life + ')';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2 * devicePixelRatio * m.life, 0, Math.PI * 2);
      ctx.fill();

      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.life -= m.decay;
    });
  }

  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  draw();
}

function stopSpaceCanvas() {
  if (_spaceRAF) { cancelAnimationFrame(_spaceRAF); _spaceRAF = null; }
}

// ── PROJECTS MODULE ────────────────────
window.Projects = (() => {
  async function render() {
    // Start space animation
    initSpaceCanvas();

    const list  = document.getElementById('projectsList');
    const empty = document.getElementById('projectsEmpty');
    if (!list) return;
    [...list.querySelectorAll('.project-card')].forEach(n => n.remove());

    const projects = await Storage.getProjects();
    document.getElementById('projectCount').textContent = projects.length;
    empty.style.display = projects.length === 0 ? '' : 'none';

    projects.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'project-card';

      const tags = (proj.tags || '').split(',').map(t => t.trim()).filter(Boolean);

      card.innerHTML = `
        <button class="proj-card-menu" onclick="projMenu(event,'${proj.id}','${esc(proj.name)}')" aria-label="Options">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
        <div class="proj-card-name">${esc(proj.name)}</div>
        ${proj.description ? `<div class="proj-card-desc">${esc(proj.description)}</div>` : ''}
        <div class="proj-card-links">
          ${proj.url  ? `<a href="${proj.url}"  class="proj-link-btn" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Live</a>` : ''}
          ${proj.repo ? `<a href="${proj.repo}" class="proj-link-btn" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>Repo</a>` : ''}
        </div>
        ${tags.length ? `<div class="proj-tags">${tags.map(t => `<span class="proj-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.proj-card-menu') || e.target.closest('.proj-link-btn')) return;
        openProjectEditor(proj);
      });

      list.appendChild(card);
    });
  }

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
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

// ── PROJECT EDITOR ─────────────────────
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
    id: _editingProjectId,
    name,
    url:         document.getElementById('projUrlInput').value.trim(),
    repo:        document.getElementById('projRepoInput').value.trim(),
    tags:        document.getElementById('projTagsInput').value.trim(),
    description: document.getElementById('projDescInput').value.trim()
  });
  closeProjectEditor();
  showToast('Project saved ✓');
  Projects.render(); refreshStats();
}

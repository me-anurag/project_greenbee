/* ══════════════════════════════════════
   GreenBee App — Core
══════════════════════════════════════ */

'use strict';

// ── GREETING ─────────────────────────
function updateGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const el = document.getElementById('heroGreeting');
  if (el) el.textContent = g;
}

// ── SIDE PANEL ────────────────────────
function openPanel() {
  document.getElementById('sidePanel').classList.add('open');
  document.getElementById('overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePanel() {
  document.getElementById('sidePanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// Close panel with ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePanel();
    closeFolderModal();
    closeNoteEditor();
    closeContextMenu();
  }
});

// ── NAVIGATION ────────────────────────
let currentView = 'home';

function navigate(view) {
  // hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // show target
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // update nav highlight
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });

  // update topbar title
  const titles = {
    home:        '<span class="logo-green">Green</span><span class="logo-bee">Bee</span>',
    'html-notes':'HTML Files',
    notes:       'Notes',
    voice:       'Voice Notes',
    ai:          'AI Tools'
  };
  document.getElementById('topbarTitle').innerHTML = titles[view] || view;

  currentView = view;
  closePanel();

  // refresh data for view
  if (view === 'home')       { refreshHomeHtml(); refreshStats(); }
  if (view === 'html-notes') HtmlNotes.render(null);
  if (view === 'notes')      Notes.render();
  if (view === 'voice')      Voice.render();
}

// ── STATS ─────────────────────────────
async function refreshStats() {
  try {
    const [files, notes, voice] = await Promise.all([
      Storage.getAllHtmlFiles(),
      Storage.getNotes(),
      Storage.getVoiceNotes()
    ]);
    document.getElementById('statHtml').textContent  = files.length;
    document.getElementById('statNotes').textContent = notes.length;
    document.getElementById('statVoice').textContent = voice.length;
    document.getElementById('htmlCount').textContent  = files.length;
  } catch(e) {}
}

// ── HOME HTML PREVIEW ─────────────────
async function refreshHomeHtml() {
  try {
    const [folders, files] = await Promise.all([
      Storage.getFolders(null),
      Storage.getHtmlFiles(null)
    ]);

    const grid  = document.getElementById('homeHtmlGrid');
    const empty = document.getElementById('homeHtmlEmpty');
    const items = [...folders, ...files];

    if (items.length === 0) {
      empty.style.display = '';
    } else {
      empty.style.display = 'none';
    }

    // Remove old cards (keep empty hint)
    [...grid.querySelectorAll('.html-card,.folder-card')].forEach(n => n.remove());

    // Render max 6 for home screen
    const preview = items.slice(0, 6);
    for (const item of preview) {
      const card = item.content !== undefined
        ? HtmlNotes.buildFileCard(item)
        : HtmlNotes.buildFolderCard(item);
      grid.appendChild(card);
    }
  } catch(e) {}
}

// ── TOAST ──────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── COMING SOON ───────────────────────
function showComingSoon(name) {
  showToast(`✦ ${name} — coming soon!`);
}

// ── HOME FAB MENU ─────────────────────
let fabMenuOpen = false;
function showHomeAddMenu() {
  const menu = document.getElementById('homeFabMenu');
  fabMenuOpen = !fabMenuOpen;
  menu.classList.toggle('hidden', !fabMenuOpen);
}
document.addEventListener('click', e => {
  if (!e.target.closest('#homeFab') && !e.target.closest('#homeFabMenu')) {
    document.getElementById('homeFabMenu')?.classList.add('hidden');
    fabMenuOpen = false;
  }
});

// ── FOLDER MODAL ─────────────────────
function createFolder() {
  document.getElementById('folderModalOverlay').classList.remove('hidden');
  document.getElementById('folderNameInput').value = '';
  setTimeout(() => document.getElementById('folderNameInput').focus(), 100);
  closeFabMenu();
}
function closeFolderModal() {
  document.getElementById('folderModalOverlay').classList.add('hidden');
}
async function confirmCreateFolder() {
  const name = document.getElementById('folderNameInput').value.trim();
  if (!name) { showToast('Please enter a folder name'); return; }
  const folder = await Storage.createFolder({ name, parentId: HtmlNotes.currentFolder });
  closeFolderModal();
  showToast(`📁 "${name}" created`);
  HtmlNotes.render(HtmlNotes.currentFolder);
  refreshHomeHtml();
  refreshStats();
}
document.getElementById('folderNameInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmCreateFolder();
});

function closeFabMenu() {
  document.getElementById('homeFabMenu')?.classList.add('hidden');
  fabMenuOpen = false;
}

// ── CONTEXT MENU ─────────────────────
let _ctxMenu = null;

function closeContextMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
}

function showContextMenu(e, items) {
  e.stopPropagation();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';

  items.forEach(({ label, icon, action, danger }) => {
    const btn = document.createElement('button');
    btn.className = 'ctx-item' + (danger ? ' danger' : '');
    btn.innerHTML = `<span style="width:16px">${icon}</span> ${label}`;
    btn.onclick = () => { closeContextMenu(); action(); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  _ctxMenu = menu;

  // Position
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = e.clientX;
  let y = e.clientY;
  requestAnimationFrame(() => {
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    if (x + mw > vw) x = vw - mw - 8;
    if (y + mh > vh) y = vh - mh - 8;
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
  });

  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true });
  }, 10);
}

// ── TRIGGER HTML UPLOAD ───────────────
function triggerHtmlUpload() {
  document.getElementById('htmlFileInput').click();
  closeFabMenu();
}

async function handleHtmlUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  let added = 0;
  for (const file of files) {
    const content = await file.text();
    await Storage.addHtmlFile({
      name: file.name.replace(/\.html?$/i, ''),
      content,
      folderId: HtmlNotes.currentFolder
    });
    added++;
  }
  event.target.value = '';
  showToast(`✦ ${added} file${added > 1 ? 's' : ''} added`);

  HtmlNotes.render(HtmlNotes.currentFolder);
  refreshHomeHtml();
  refreshStats();
}

// ── HTML VIEWER ───────────────────────
function openViewer(file) {
  const viewer = document.getElementById('htmlViewer');
  const frame  = document.getElementById('viewerFrame');
  const title  = document.getElementById('viewerTitle');
  const delBtn = document.getElementById('viewerDeleteBtn');

  title.textContent = file.name;
  viewer.classList.add('open');
  document.body.style.overflow = 'hidden';

  // write content to iframe via blob URL
  const blob = new Blob([file.content], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  frame.src  = url;
  frame._blobUrl = url;

  delBtn.onclick = async () => {
    if (confirm(`Delete "${file.name}"?`)) {
      await Storage.deleteHtmlFile(file.id);
      closeViewer();
      HtmlNotes.render(HtmlNotes.currentFolder);
      refreshHomeHtml();
      refreshStats();
      showToast('File deleted');
    }
  };
}

function closeViewer() {
  const viewer = document.getElementById('htmlViewer');
  const frame  = document.getElementById('viewerFrame');
  viewer.classList.remove('open');
  document.body.style.overflow = '';
  if (frame._blobUrl) { URL.revokeObjectURL(frame._blobUrl); frame._blobUrl = null; }
  frame.src = '';
}

// ── INIT ──────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateGreeting();
  navigate('home');
});

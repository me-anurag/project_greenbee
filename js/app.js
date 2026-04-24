'use strict';
/* ══════════════════════════════════════
   GreenBee — Core App v4
   Back button: single DOM element,
   shown/hidden with .hidden class.
   Never inserted dynamically = no duplicates.
══════════════════════════════════════ */

function updateGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  ['panelGreeting','homeGreeting'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = g;
  });
}

// ── PANEL ─────────────────────────────
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

// ── NAV CONFIG ────────────────────────
const viewTitles = {
  home:         null,   // null = show logo HTML
  'html-notes': 'HTML Files',
  pdfs:         'PDFs',
  notes:        'Notes',
  projects:     'Projects',
  voice:        'Voice Notes',
  ai:           'AI Tools'
};
let currentView = 'home';

// ── NAVIGATE ──────────────────────────
function navigate(view, pushHistory = true) {
  if (currentView === 'projects' && view !== 'projects') SpaceScenes.stop();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.view === view)
  );

  // ── Topbar update — ONLY toggle classes, never insert elements ──
  const titleEl  = document.getElementById('topbarTitle');
  const backBtn  = document.getElementById('backBtn');
  const hamburger = document.getElementById('hamburgerBtn');

  if (view === 'home') {
    titleEl.innerHTML = '<span class="logo-g">Green</span><span class="logo-b">Bee</span>';
    backBtn.classList.add('hidden');
    if (hamburger) hamburger.style.display = '';
  } else {
    titleEl.textContent = viewTitles[view] || view;
    backBtn.classList.remove('hidden');
    if (hamburger) hamburger.style.display = '';
  }

  currentView = view;
  closePanel();
  closeFabMenuUI();

  if (pushHistory) history.pushState({ view }, '', '#' + view);

  if (view === 'home')       { refreshHomeHtml(); refreshStats(); }
  if (view === 'html-notes') HtmlNotes.render(HtmlNotes.currentFolder);
  if (view === 'notes')      Notes.render();
  if (view === 'voice')      Voice.render();
  if (view === 'pdfs')       Pdfs.render();
  if (view === 'projects')   Projects.render();
}

// ── BACK ──────────────────────────────
function navigateBack() {
  if (currentView === 'html-notes' && HtmlNotes.currentFolder !== null) {
    HtmlNotes.goUp(); return;
  }
  navigate('home');
}

// ── HARDWARE BACK (Android) ───────────
window.addEventListener('popstate', e => {
  const view = e.state?.view;
  // Close overlays first
  const checks = [
    ['noteEditorOverlay',    closeNoteEditor],
    ['projectEditorOverlay', closeProjectEditor],
    ['folderModalOverlay',   closeFolderModal],
  ];
  for (const [id, fn] of checks) {
    if (!document.getElementById(id)?.classList.contains('hidden')) {
      fn(); history.pushState({ view: currentView }, '', '#' + currentView); return;
    }
  }
  if (document.getElementById('htmlViewer')?.classList.contains('open')) {
    closeViewer(); history.pushState({ view: currentView }, '', '#' + currentView); return;
  }
  if (document.getElementById('pdfViewer')?.classList.contains('open')) {
    closePdfViewer(); history.pushState({ view: currentView }, '', '#' + currentView); return;
  }
  if (document.getElementById('sidePanel')?.classList.contains('open')) {
    closePanel(); history.pushState({ view: currentView }, '', '#' + currentView); return;
  }
  if (view && view !== currentView) navigate(view, false);
  else navigate('home', false);
});

// ── ESC ────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('noteEditorOverlay')?.classList.contains('hidden'))    { closeNoteEditor(); return; }
  if (!document.getElementById('projectEditorOverlay')?.classList.contains('hidden')) { closeProjectEditor(); return; }
  if (!document.getElementById('folderModalOverlay')?.classList.contains('hidden'))   { closeFolderModal(); return; }
  if (document.getElementById('htmlViewer')?.classList.contains('open'))              { closeViewer(); return; }
  if (document.getElementById('pdfViewer')?.classList.contains('open'))               { closePdfViewer(); return; }
  if (document.getElementById('sidePanel')?.classList.contains('open'))               { closePanel(); return; }
  closeContextMenu();
});

// ── STATS ──────────────────────────────
async function refreshStats() {
  try {
    const [h, n, v, p, pr] = await Promise.all([
      Storage.getAllHtmlFiles(), Storage.getNotes(), Storage.getVoiceNotes(),
      Storage.getPdfs(), Storage.getProjects()
    ]);
    setText('scHtml',      h.length);
    setText('scPdf',       p.length);
    setText('scNotes',     n.length);
    setText('scProjects',  pr.length);
    setText('projectCount',pr.length);
  } catch(_) {}
}
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

// ── HOME RECENT HTML ──────────────────
async function refreshHomeHtml() {
  try {
    const [folders, files] = await Promise.all([Storage.getFolders(null), Storage.getHtmlFiles(null)]);
    const grid  = document.getElementById('homeHtmlGrid');
    const empty = document.getElementById('homeHtmlEmpty');
    if (!grid) return;
    [...grid.querySelectorAll('.html-card,.folder-card')].forEach(n => n.remove());
    const items = [...folders, ...files].slice(0, 6);
    empty.style.display = items.length === 0 ? '' : 'none';
    for (const item of items) {
      grid.appendChild(item.content !== undefined
        ? HtmlNotes.buildFileCard(item) : HtmlNotes.buildFolderCard(item));
    }
  } catch(_) {}
}

// ── FAB ────────────────────────────────
let _fabOpen = false;
function fabTap() { _fabOpen ? closeFabMenuUI() : openFabMenu(); }

function openFabMenu() {
  const menu = document.getElementById('fabMenu');
  const fab  = document.getElementById('globalFab');
  menu.innerHTML = '';
  getFabOptions(currentView).forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'fab-opt';
    btn.innerHTML = `${opt.icon}<span>${opt.label}</span>`;
    btn.onclick = () => { closeFabMenuUI(); opt.action(); };
    menu.appendChild(btn);
  });
  menu.classList.remove('hidden');
  fab.classList.add('open');
  _fabOpen = true;
}
function closeFabMenuUI() {
  document.getElementById('fabMenu').classList.add('hidden');
  document.getElementById('globalFab').classList.remove('open');
  _fabOpen = false;
}
function getFabOptions(view) {
  const ico = p => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`;
  const opts = {
    home: [
      { label:'Add HTML File', icon:ico('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'), action:triggerHtmlUpload },
      { label:'Add PDF',       icon:ico('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'), action:triggerPdfUpload },
      { label:'New Note',      icon:ico('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'), action:()=>openNoteEditor() },
      { label:'New Project',   icon:ico('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'), action:()=>openProjectEditor() },
    ],
    'html-notes': [
      { label:'Add HTML File', icon:ico('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'), action:triggerHtmlUpload },
      { label:'New Folder',    icon:ico('<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>'), action:createFolder },
    ],
    pdfs:     [{ label:'Add PDF',     icon:ico('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'), action:triggerPdfUpload }],
    notes:    [{ label:'New Note',    icon:ico('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'), action:()=>openNoteEditor() }],
    projects: [{ label:'New Project', icon:ico('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'), action:()=>openProjectEditor() }],
    voice:    [{ label:'Record',      icon:ico('<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/>'), action:toggleRecording }],
    ai:       [{ label:'Coming Soon', icon:ico('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'), action:()=>showToast('AI Tools coming soon ✦') }],
  };
  return opts[view] || opts.home;
}
document.addEventListener('click', e => {
  if (_fabOpen && !e.target.closest('#globalFab') && !e.target.closest('#fabMenu')) closeFabMenuUI();
});

// ── FOLDER MODAL ───────────────────────
function createFolder() {
  document.getElementById('folderModalOverlay').classList.remove('hidden');
  document.getElementById('folderNameInput').value = '';
  setTimeout(() => document.getElementById('folderNameInput').focus(), 100);
}
function closeFolderModal() { document.getElementById('folderModalOverlay').classList.add('hidden'); }
async function confirmCreateFolder() {
  const name = document.getElementById('folderNameInput').value.trim();
  if (!name) { showToast('Enter a folder name'); return; }
  await Storage.createFolder({ name, parentId: HtmlNotes.currentFolder });
  closeFolderModal();
  showToast(`📁 "${name}" created`);
  HtmlNotes.render(HtmlNotes.currentFolder);
  refreshHomeHtml();
}
document.getElementById('folderNameInput')?.addEventListener('keydown', e => { if (e.key==='Enter') confirmCreateFolder(); });

// ── TOAST ──────────────────────────────
let _tt;
function showToast(msg, dur=2400) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), dur);
}
function showComingSoon(name) { showToast(`✦ ${name} — coming soon!`); }

// ── HTML UPLOAD / VIEWER ───────────────
function triggerHtmlUpload() { document.getElementById('htmlFileInput').click(); }
async function handleHtmlUpload(e) {
  const files = Array.from(e.target.files); if (!files.length) return;
  for (const f of files) {
    const content = await f.text();
    await Storage.addHtmlFile({ name: f.name.replace(/\.html?$/i,''), content, folderId: HtmlNotes.currentFolder });
  }
  e.target.value = '';
  showToast(`✦ ${files.length} file${files.length > 1 ? 's' : ''} added`);
  HtmlNotes.render(HtmlNotes.currentFolder);
  refreshHomeHtml(); refreshStats();
}
function openViewer(file) {
  const viewer = document.getElementById('htmlViewer');
  const frame  = document.getElementById('viewerFrame');
  document.getElementById('viewerTitle').textContent = file.name;
  const blob = new Blob([file.content], { type:'text/html' });
  const url  = URL.createObjectURL(blob);
  frame.src = url; frame._blobUrl = url;
  viewer.classList.add('open');
  document.body.style.overflow = 'hidden';
  history.pushState({ view: currentView, modal:'htmlViewer' }, '', '#' + currentView + '-viewer');
  document.getElementById('viewerDeleteBtn').onclick = async () => {
    if (confirm(`Delete "${file.name}"?`)) {
      await Storage.deleteHtmlFile(file.id);
      closeViewer(); HtmlNotes.render(HtmlNotes.currentFolder);
      refreshHomeHtml(); refreshStats(); showToast('File deleted');
    }
  };
}
function closeViewer() {
  const frame = document.getElementById('viewerFrame');
  document.getElementById('htmlViewer').classList.remove('open');
  document.body.style.overflow = '';
  if (frame._blobUrl) { URL.revokeObjectURL(frame._blobUrl); frame._blobUrl = null; }
  frame.src = '';
}

// ── CONTEXT MENU ───────────────────────
let _ctxMenu = null;
function closeContextMenu() { if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; } }
function showContextMenu(e, items) {
  e.stopPropagation(); closeContextMenu();
  const menu = document.createElement('div'); menu.className = 'ctx-menu';
  items.forEach(({ label, icon, action, danger }) => {
    const btn = document.createElement('button');
    btn.className = 'ctx-item' + (danger ? ' danger' : '');
    btn.innerHTML = `<span>${icon}</span>${label}`;
    btn.onclick = () => { closeContextMenu(); action(); };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu); _ctxMenu = menu;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX, y = e.clientY;
  requestAnimationFrame(() => {
    if (x + menu.offsetWidth  > vw) x = vw - menu.offsetWidth  - 8;
    if (y + menu.offsetHeight > vh) y = vh - menu.offsetHeight - 8;
    menu.style.left = x+'px'; menu.style.top = y+'px';
  });
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once:true }), 10);
}

// ── INIT ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateGreeting();
  history.replaceState({ view:'home' }, '', '#home');
  navigate('home', false);
});

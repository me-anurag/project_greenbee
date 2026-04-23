/* ══════════════════════════════════════
   GreenBee — HTML Notes Manager
   Preview strategy: canvas thumbnail,
   NOT live iframes — eliminates all
   scroll flicker and GPU thrashing.
══════════════════════════════════════ */

window.HtmlNotes = (() => {

  let currentFolder = null;
  const folderStack = [];

  // ── RENDER ─────────────────────────
  async function render(folderId) {
    currentFolder = folderId ?? null;
    const grid  = document.getElementById('htmlGrid');
    const empty = document.getElementById('htmlEmpty');
    if (!grid) return;

    [...grid.querySelectorAll('.html-card,.folder-card')].forEach(n => n.remove());

    const [folders, files] = await Promise.all([
      Storage.getFolders(currentFolder),
      Storage.getHtmlFiles(currentFolder)
    ]);

    const total = folders.length + files.length;
    empty.style.display = total === 0 ? '' : 'none';

    for (const folder of folders) grid.appendChild(buildFolderCard(folder));
    for (const file   of files)   grid.appendChild(buildFileCard(file));

    _updateBreadcrumb();
  }

  // ── THUMBNAIL GENERATOR ────────────
  // Renders the HTML into a hidden iframe ONCE, screenshots it via
  // html2canvas-style canvas drawing, stores as dataURL in IndexedDB.
  // Cards then just show a plain <img> — zero GPU thrash on scroll.

  function generateThumbnail(file) {
    return new Promise((resolve) => {
      // If thumbnail already stored, return immediately
      if (file.thumbnail) { resolve(file.thumbnail); return; }

      // Parse the HTML to extract visible text + background color
      // We build a lightweight visual card instead of rendering full HTML
      // This is intentional — full iframe thumbnails cause the exact bug reported
      const parser  = new DOMParser();
      const doc     = parser.parseFromString(file.content, 'text/html');

      // Extract title and first meaningful text
      const title   = doc.querySelector('title')?.textContent
                   || doc.querySelector('h1,h2,h3')?.textContent
                   || file.name;
      const bodyText = (doc.body?.innerText || doc.body?.textContent || '').trim().slice(0, 300);

      // Detect background color from inline style or meta
      let bg = '#ffffff';
      const bodyStyle = doc.body?.getAttribute('style') || '';
      const bgMatch = bodyStyle.match(/background(?:-color)?\s*:\s*([^;]+)/i);
      if (bgMatch) bg = bgMatch[1].trim();

      // Draw a representative thumbnail on canvas — pure 2D, no iframe
      const W = 300, H = 400;
      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Top accent bar (green)
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(0, 0, W, 6);

      // Title text
      ctx.fillStyle = '#1c2218';
      ctx.font = 'bold 20px Georgia, serif';
      wrapText(ctx, title.slice(0, 60), 20, 42, W - 40, 26);

      // Divider
      ctx.strokeStyle = '#e0d8cc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 80); ctx.lineTo(W - 20, 80);
      ctx.stroke();

      // Body preview text
      ctx.fillStyle = '#3d4a38';
      ctx.font = '13px -apple-system, sans-serif';
      wrapText(ctx, bodyText, 20, 100, W - 40, 18, 14);

      // HTML badge bottom
      ctx.fillStyle = '#e8f5e3';
      ctx.beginPath();
      ctx.roundRect(W - 70, H - 36, 50, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#3a7032';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('HTML', W - 59, H - 21);

      const dataURL = canvas.toDataURL('image/jpeg', 0.75);

      // Cache thumbnail back to storage
      Storage.saveThumbnail(file.id, dataURL).catch(() => {});

      resolve(dataURL);
    });
  }

  function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 3) {
    if (!text) return;
    const words = text.split(/\s+/);
    let line = '';
    let lines = 0;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + lines * lineH);
        line = word;
        lines++;
        if (lines >= maxLines) { ctx.fillText(line + '…', x, y + lines * lineH); return; }
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y + lines * lineH);
  }

  // ── FILE CARD ──────────────────────
  function buildFileCard(file) {
    const card = document.createElement('div');
    card.className = 'html-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open ${file.name}`);

    // Preview area — uses <img> not <iframe>
    const preview = document.createElement('div');
    preview.className = 'card-preview';

    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.alt = file.name;
    img.loading = 'lazy'; // native lazy load — browser handles it efficiently
    img.decoding = 'async';

    // Show placeholder immediately, load thumbnail async
    img.src = getPlaceholderDataURL(file.name);
    preview.appendChild(img);

    // Generate/load thumbnail without blocking render
    const thumbSrc = file.thumbnail || null;
    if (thumbSrc) {
      img.src = thumbSrc;
    } else {
      // Generate off main thread via requestIdleCallback if available
      const generate = () => generateThumbnail(file).then(url => { img.src = url; });
      if (window.requestIdleCallback) {
        requestIdleCallback(generate, { timeout: 2000 });
      } else {
        setTimeout(generate, 100);
      }
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `
      <div class="card-name">${escHtml(file.name)}</div>
      <div class="card-meta">${formatDate(file.createdAt)}</div>
    `;

    // 3-dot menu
    const menuBtn = document.createElement('button');
    menuBtn.className = 'card-menu-btn';
    menuBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;
    menuBtn.setAttribute('aria-label', 'File options');

    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      showContextMenu(e, [
        {
          label: 'Open',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
          action: () => Storage.getHtmlFile(file.id).then(openViewer)
        },
        {
          label: 'Delete',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>',
          danger: true,
          action: async () => {
            if (confirm(`Delete "${file.name}"?`)) {
              await Storage.deleteHtmlFile(file.id);
              render(currentFolder);
              refreshHomeHtml();
              refreshStats();
              showToast('File deleted');
            }
          }
        }
      ]);
    });

    card.appendChild(preview);
    card.appendChild(footer);
    card.appendChild(menuBtn);

    card.addEventListener('click', () => Storage.getHtmlFile(file.id).then(openViewer));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        Storage.getHtmlFile(file.id).then(openViewer);
      }
    });

    return card;
  }

  // Lightweight SVG placeholder shown before thumbnail loads
  function getPlaceholderDataURL(name) {
    const initial = (name || '?')[0].toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">
      <rect width="300" height="400" fill="#f4faf2"/>
      <rect width="300" height="6" fill="#2d5a27"/>
      <text x="150" y="210" font-family="Georgia,serif" font-size="72" fill="#b8e0b0" text-anchor="middle" dominant-baseline="middle">${initial}</text>
      <text x="150" y="330" font-family="monospace" font-size="11" fill="#a8b5a2" text-anchor="middle">HTML</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  // ── FOLDER CARD ────────────────────
  function buildFolderCard(folder) {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open folder ${folder.name}`);

    card.innerHTML = `
      <div class="folder-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      </div>
      <div class="folder-name">${escHtml(folder.name)}</div>
    `;

    // Context menu
    const menuBtn = document.createElement('button');
    menuBtn.className = 'card-menu-btn';
    menuBtn.style.cssText = 'opacity:0;transition:opacity .2s';
    menuBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;
    menuBtn.setAttribute('aria-label', 'Folder options');

    card.addEventListener('mouseenter', () => menuBtn.style.opacity = '1');
    card.addEventListener('mouseleave', () => menuBtn.style.opacity = '0');

    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      showContextMenu(e, [
        {
          label: 'Delete folder',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>',
          danger: true,
          action: async () => {
            if (confirm(`Delete folder "${folder.name}"? Files will be moved to parent.`)) {
              await Storage.deleteFolder(folder.id);
              render(currentFolder);
              refreshHomeHtml();
              refreshStats();
              showToast(`Folder deleted`);
            }
          }
        }
      ]);
    });

    card.appendChild(menuBtn);

    // Navigate into folder
    card.addEventListener('click', () => enterFolder(folder));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterFolder(folder); }
    });

    return card;
  }

  // ── FOLDER NAVIGATION ──────────────
  function enterFolder(folder) {
    folderStack.push({ id: folder.id, name: folder.name });
    currentFolder = folder.id;
    render(folder.id);
  }

  function goToStackIndex(index) {
    folderStack.splice(index + 1);
    const folderId = index < 0 ? null : folderStack[index]?.id ?? null;
    currentFolder = folderId;
    render(folderId);
  }

  function _updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    bc.innerHTML = '';

    // Root crumb
    const root = document.createElement('button');
    root.className = 'crumb' + (folderStack.length === 0 ? ' active' : '');
    root.textContent = 'All Files';
    root.onclick = () => { folderStack.length = 0; currentFolder = null; render(null); };
    bc.appendChild(root);

    folderStack.forEach((f, i) => {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '/';
      bc.appendChild(sep);

      const crumb = document.createElement('button');
      crumb.className = 'crumb' + (i === folderStack.length - 1 ? ' active' : '');
      crumb.textContent = f.name;
      crumb.onclick = () => goToStackIndex(i);
      bc.appendChild(crumb);
    });
  }

  // ── HELPERS ────────────────────────
  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' });
  }

  return { render, buildFileCard, buildFolderCard,
    get currentFolder() { return currentFolder; },
    goUp() {
      if (folderStack.length === 0) return;
      folderStack.pop();
      currentFolder = folderStack.length > 0 ? folderStack[folderStack.length-1].id : null;
      render(currentFolder);
    }
  };
})();

/* ══════════════════════════════════════
   GreenBee — PDFs
══════════════════════════════════════ */
window.Pdfs = (() => {
  async function render() {
    const grid  = document.getElementById('pdfGrid');
    const empty = document.getElementById('pdfEmpty');
    if (!grid) return;
    [...grid.querySelectorAll('.pdf-card')].forEach(n => n.remove());
    const pdfs = await Storage.getPdfs();
    empty.style.display = pdfs.length === 0 ? '' : 'none';
    pdfs.forEach(pdf => {
      const card = document.createElement('div');
      card.className = 'pdf-card';
      const kb = pdf.size ? Math.round(pdf.size / 1024) : '?';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:11px">
          <div class="pdf-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div class="pdf-name">${esc(pdf.name)}</div>
            <div class="pdf-meta">${kb} KB · ${fmt(pdf.createdAt)}</div>
          </div>
          <button class="icon-btn" data-id="${pdf.id}" aria-label="Options" onclick="pdfMenu(event,'${pdf.id}','${esc(pdf.name)}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
      `;
      card.addEventListener('click', e => {
        if (e.target.closest('.icon-btn')) return;
        openPdfViewer(pdf);
      });
      grid.appendChild(card);
    });
  }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(ts) { return new Date(ts).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); }
  return { render };
})();

function pdfMenu(e, id, name) {
  e.stopPropagation();
  showContextMenu(e, [{
    label: 'Delete',
    icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    danger: true,
    action: async () => {
      if (confirm(`Delete "${name}"?`)) {
        await Storage.deletePdf(id);
        Pdfs.render(); refreshStats();
        showToast('PDF deleted');
      }
    }
  }]);
}

function triggerPdfUpload() {
  document.getElementById('pdfFileInput').click();
}

async function handlePdfUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  for (const f of files) {
    const data = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
    await Storage.addPdf({ name: f.name.replace(/\.pdf$/i,''), data, size: f.size });
  }
  e.target.value = '';
  showToast(`✦ ${files.length} PDF${files.length > 1 ? 's' : ''} added`);
  Pdfs.render(); refreshStats();
}

function openPdfViewer(pdf) {
  const viewer = document.getElementById('pdfViewer');
  const frame  = document.getElementById('pdfFrame');
  document.getElementById('pdfViewerTitle').textContent = pdf.name;
  frame.src = pdf.data;
  viewer.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('pdfDeleteBtn').onclick = async () => {
    if (confirm(`Delete "${pdf.name}"?`)) {
      await Storage.deletePdf(pdf.id);
      closePdfViewer(); Pdfs.render(); refreshStats();
      showToast('PDF deleted');
    }
  };
}

function closePdfViewer() {
  document.getElementById('pdfViewer').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('pdfFrame').src = '';
}

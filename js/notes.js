/* ══════════════════════════════════════
   GreenBee — Notes
══════════════════════════════════════ */

window.Notes = (() => {

  let editingId = null;

  async function render() {
    const list  = document.getElementById('notesList');
    const empty = document.getElementById('notesEmpty');
    if (!list) return;

    const notes = await Storage.getNotes();
    [...list.querySelectorAll('.note-card')].forEach(n => n.remove());

    empty.style.display = notes.length === 0 ? '' : 'none';

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML = `
        <div class="note-card-title">${escHtml(note.title || 'Untitled')}</div>
        <div class="note-card-body">${escHtml(note.body || '')}</div>
        <div class="note-card-date">${formatDate(note.updatedAt)}</div>
      `;
      card.onclick = () => openNoteEditor(note);
      list.appendChild(card);
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' });
  }

  return { render };
})();

// ── Note Editor ────────────────────────
let _noteEditingId = null;

function openNoteEditor(note) {
  _noteEditingId = note?.id || null;
  document.getElementById('noteTitleInput').value = note?.title || '';
  document.getElementById('noteBodyInput').value  = note?.body  || '';
  document.getElementById('noteEditorOverlay').classList.remove('hidden');
  setTimeout(() => {
    const ti = document.getElementById('noteTitleInput');
    ti.focus();
    ti.setSelectionRange(ti.value.length, ti.value.length);
  }, 100);
}

function closeNoteEditor() {
  document.getElementById('noteEditorOverlay').classList.add('hidden');
  _noteEditingId = null;
}

async function saveNote() {
  const title = document.getElementById('noteTitleInput').value.trim();
  const body  = document.getElementById('noteBodyInput').value.trim();
  if (!title && !body) { showToast('Write something first'); return; }

  await Storage.saveNote({ id: _noteEditingId, title: title || 'Untitled', body });
  closeNoteEditor();
  showToast('Note saved ✓');
  Notes.render();
  refreshStats();
}

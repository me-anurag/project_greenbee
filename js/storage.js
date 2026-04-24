/* ══════════════════════════════════════════════════
   GreenBee Storage v2
   IndexedDB = primary (fast, offline)
   FirebaseSync = background cloud backup
   
   Pattern for every write:
     1. Write to IndexedDB (instant)
     2. Call FirebaseSync.up() in background (don't await)
   
   Pattern for every delete:
     1. Delete from IndexedDB
     2. Call FirebaseSync.del() in background
══════════════════════════════════════════════════ */

const DB_NAME    = 'greenbee';
const DB_VERSION = 3;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      const stores = [
        ['html_files', 'folderId'],
        ['folders',    null],
        ['notes',      null],
        ['voice_notes',null],
        ['pdfs',       null],
        ['projects',   null],
      ];
      stores.forEach(([name, idx]) => {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath:'id' });
          if (idx) s.createIndex(idx, idx, { unique:false });
        }
      });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function tx(store, mode='readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}
function idbGetAll(store) {
  return tx(store).then(s => new Promise((res,rej)=>{ const r=s.getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }));
}
function idbGet(store, id) {
  return tx(store).then(s => new Promise((res,rej)=>{ const r=s.get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }));
}
function idbPut(store, value) {
  return tx(store,'readwrite').then(s => new Promise((res,rej)=>{ const r=s.put(value); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }));
}
function idbDelete(store, id) {
  return tx(store,'readwrite').then(s => new Promise((res,rej)=>{ const r=s.delete(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

// Shorthand: sync up without blocking
function up(col, item) {
  if (window.FirebaseSync) FirebaseSync.up(col, item).catch(()=>{});
}
function del(col, id) {
  if (window.FirebaseSync) FirebaseSync.del(col, id).catch(()=>{});
}

window.Storage = {

  // ── HTML FILES ────────────────────────────────────
  async addHtmlFile({ name, content, folderId=null }) {
    const item = { id:uid(), name, content, folderId, createdAt:Date.now(), size:content.length };
    await idbPut('html_files', item);
    up('html_files', item);
    return item;
  },
  async getHtmlFiles(folderId=null) {
    const all = await idbGetAll('html_files');
    return all.filter(f=>f.folderId===folderId).sort((a,b)=>b.createdAt-a.createdAt);
  },
  async getAllHtmlFiles() { return idbGetAll('html_files'); },
  async getHtmlFile(id)   { return idbGet('html_files', id); },
  async deleteHtmlFile(id) {
    await idbDelete('html_files', id);
    del('html_files', id);
  },
  async saveThumbnail(id, dataURL) {
    const f = await idbGet('html_files', id);
    if (f) { f.thumbnail=dataURL; await idbPut('html_files', f); }
    // thumbnails are NOT synced to Firebase (large, regeneratable)
  },
  async moveHtmlFile(id, folderId) {
    const f = await idbGet('html_files', id);
    if (f) { f.folderId=folderId; await idbPut('html_files', f); up('html_files', f); }
  },

  // ── FOLDERS ───────────────────────────────────────
  async createFolder({ name, parentId=null }) {
    const item = { id:uid(), name, parentId, createdAt:Date.now() };
    await idbPut('folders', item);
    up('folders', item);
    return item;
  },
  async getFolders(parentId=null) {
    const all = await idbGetAll('folders');
    return all.filter(f=>f.parentId===parentId).sort((a,b)=>a.name.localeCompare(b.name));
  },
  async deleteFolder(id) {
    const folder = await idbGet('folders', id);
    const files  = await idbGetAll('html_files');
    for (const f of files.filter(f=>f.folderId===id)) {
      f.folderId = folder?.parentId ?? null;
      await idbPut('html_files', f); up('html_files', f);
    }
    const subs = await idbGetAll('folders');
    for (const sf of subs.filter(f=>f.parentId===id)) await Storage.deleteFolder(sf.id);
    await idbDelete('folders', id);
    del('folders', id);
  },

  // ── NOTES ─────────────────────────────────────────
  async saveNote({ id, title, body }) {
    const item = { id:id||uid(), title, body, updatedAt:Date.now() };
    await idbPut('notes', item);
    up('notes', item);
    return item;
  },
  async getNotes() {
    const all = await idbGetAll('notes');
    return all.sort((a,b)=>b.updatedAt-a.updatedAt);
  },
  async deleteNote(id) {
    await idbDelete('notes', id); del('notes', id);
  },

  // ── VOICE NOTES ───────────────────────────────────
  async saveVoiceNote({ name, blob, duration }) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const item = { id:uid(), name, data:reader.result, duration, createdAt:Date.now() };
        await idbPut('voice_notes', item);
        up('voice_notes', item);
        resolve(item);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },
  async getVoiceNotes() {
    const all = await idbGetAll('voice_notes');
    return all.sort((a,b)=>b.createdAt-a.createdAt);
  },
  async deleteVoiceNote(id) {
    await idbDelete('voice_notes', id); del('voice_notes', id);
  },

  // ── PDFs ──────────────────────────────────────────
  async addPdf({ name, data, size }) {
    const item = { id:uid(), name, data, size, createdAt:Date.now() };
    await idbPut('pdfs', item);
    up('pdfs', item);
    return item;
  },
  async getPdfs() {
    const all = await idbGetAll('pdfs');
    return all.sort((a,b)=>b.createdAt-a.createdAt);
  },
  async getPdf(id)   { return idbGet('pdfs', id); },
  async deletePdf(id) {
    await idbDelete('pdfs', id); del('pdfs', id);
  },

  // ── PROJECTS ──────────────────────────────────────
  async saveProject({ id, name, url, repo, tags, description }) {
    const item = { id:id||uid(), name, url, repo, tags, description, updatedAt:Date.now() };
    await idbPut('projects', item);
    up('projects', item);
    return item;
  },
  async getProjects() {
    const all = await idbGetAll('projects');
    return all.sort((a,b)=>b.updatedAt-a.updatedAt);
  },
  async deleteProject(id) {
    await idbDelete('projects', id); del('projects', id);
  },
};

// Expose internals for firebase-sync.js
window._idbPut = idbPut;
window._idbGet = idbGet;

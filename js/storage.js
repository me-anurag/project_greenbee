/* ══════════════════════════════════════
   GreenBee Storage — IndexedDB wrapper
   Handles: html_files, folders, notes, voice_notes
══════════════════════════════════════ */

const DB_NAME    = 'greenbee';
const DB_VERSION = 3;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('html_files')) {
        const hs = db.createObjectStore('html_files', { keyPath: 'id' });
        hs.createIndex('folder', 'folderId', { unique: false });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('voice_notes')) {
        db.createObjectStore('voice_notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pdfs')) {
        db.createObjectStore('pdfs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
    };

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = (e) => reject(e.target.error);
  });
}

function tx(store, mode = 'readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

function idbGetAll(store) {
  return tx(store).then(s => new Promise((res, rej) => {
    const r = s.getAll();
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  }));
}

function idbGet(store, id) {
  return tx(store).then(s => new Promise((res, rej) => {
    const r = s.get(id);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  }));
}

function idbPut(store, value) {
  return tx(store, 'readwrite').then(s => new Promise((res, rej) => {
    const r = s.put(value);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  }));
}

function idbDelete(store, id) {
  return tx(store, 'readwrite').then(s => new Promise((res, rej) => {
    const r = s.delete(id);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  }));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── HTML FILES ──────────────────────────

window.Storage = {
  // HTML Files
  async addHtmlFile({ name, content, folderId = null }) {
    const item = {
      id: uid(),
      name,
      content,       // raw HTML string
      folderId,
      createdAt: Date.now(),
      size: content.length
    };
    await idbPut('html_files', item);
    return item;
  },

  async getHtmlFiles(folderId = null) {
    const all = await idbGetAll('html_files');
    return all
      .filter(f => f.folderId === folderId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async getAllHtmlFiles() {
    return idbGetAll('html_files');
  },

  async getHtmlFile(id) {
    return idbGet('html_files', id);
  },

  async deleteHtmlFile(id) {
    return idbDelete('html_files', id);
  },

  async saveThumbnail(id, dataURL) {
    const f = await idbGet('html_files', id);
    if (f) { f.thumbnail = dataURL; await idbPut('html_files', f); }
  },

  async moveHtmlFile(id, folderId) {
    const f = await idbGet('html_files', id);
    if (f) { f.folderId = folderId; await idbPut('html_files', f); }
  },

  // Folders
  async createFolder({ name, parentId = null }) {
    const item = {
      id: uid(),
      name,
      parentId,
      createdAt: Date.now()
    };
    await idbPut('folders', item);
    return item;
  },

  async getFolders(parentId = null) {
    const all = await idbGetAll('folders');
    return all
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async deleteFolder(id) {
    // cascade: move files to parent
    const folder  = await idbGet('folders', id);
    const files   = await idbGetAll('html_files');
    const children = files.filter(f => f.folderId === id);
    for (const f of children) {
      f.folderId = folder?.parentId ?? null;
      await idbPut('html_files', f);
    }
    // cascade sub-folders
    const subFolders = await idbGetAll('folders');
    for (const sf of subFolders.filter(f => f.parentId === id)) {
      await Storage.deleteFolder(sf.id);
    }
    return idbDelete('folders', id);
  },

  // Notes
  async saveNote({ id, title, body }) {
    const item = {
      id: id || uid(),
      title,
      body,
      updatedAt: Date.now()
    };
    await idbPut('notes', item);
    return item;
  },

  async getNotes() {
    const all = await idbGetAll('notes');
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async deleteNote(id) {
    return idbDelete('notes', id);
  },

  // Voice Notes
  async saveVoiceNote({ name, blob, duration }) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const item = {
          id: uid(),
          name,
          data: reader.result,   // base64 dataURL
          duration,
          createdAt: Date.now()
        };
        await idbPut('voice_notes', item);
        resolve(item);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async getVoiceNotes() {
    const all = await idbGetAll('voice_notes');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },

  async deleteVoiceNote(id) {
    return idbDelete('voice_notes', id);
  },

  // PDFs
  async addPdf({ name, data, size }) {
    const item = { id: uid(), name, data, size, createdAt: Date.now() };
    await idbPut('pdfs', item); return item;
  },
  async getPdfs() {
    const all = await idbGetAll('pdfs');
    return all.sort((a,b) => b.createdAt - a.createdAt);
  },
  async getPdf(id) { return idbGet('pdfs', id); },
  async deletePdf(id) { return idbDelete('pdfs', id); },

  // Projects
  async saveProject({ id, name, url, repo, tags, description }) {
    const item = { id: id || uid(), name, url, repo, tags, description, updatedAt: Date.now() };
    await idbPut('projects', item); return item;
  },
  async getProjects() {
    const all = await idbGetAll('projects');
    return all.sort((a,b) => b.updatedAt - a.updatedAt);
  },
  async deleteProject(id) { return idbDelete('projects', id); }

};

/* ═══════════════════════════════════════════════════════════
   GreenBee — Firebase Sync v2
   Firestore ONLY — no Firebase Storage, no billing required.
   Works entirely on the free Spark plan.

   How large files are handled:
   - HTML files: stored as-is (text, usually small)
   - PDFs / Voice notes: split into 700KB chunks stored as
     separate Firestore documents, reassembled on read.
     Firestore limit is 1MB/doc, we stay safely under it.
   - Thumbnails: never synced (regenerated locally)

   ⚠️  REPLACE firebaseConfig below with yours.
═══════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyAklCfUUG_gX0mPgaxcEZSCN1YzNOHnapA",
  authDomain: "greenbee-68c23.firebaseapp.com",
  projectId: "greenbee-68c23",
  storageBucket: "greenbee-68c23.firebasestorage.app",
  messagingSenderId: "904480546954",
  appId: "1:904480546954:web:672aef8520c05d573c0d73"
};

const CHUNK_SIZE = 700_000;  // bytes per Firestore doc chunk (safe under 1MB limit)

let _fs   = null;   // Firestore instance
let _uid  = null;   // anonymous user id
let _ready = false;

// ── INIT ─────────────────────────────────────────────────
async function firebaseInit() {
  try {
    // Prevent double-init if called twice
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
    _fs = firebase.firestore();

    // Enable offline cache (Firestore's own local persistence)
    await _fs.enablePersistence({ synchronizeTabs: false }).catch(() => {
      // Fails in some browsers — not critical, just means no offline Firestore cache
    });

    // Sign in anonymously — no account needed, data tied to this browser
    const result = await firebase.auth().signInAnonymously();
    _uid  = result.user.uid;
    _ready = true;

    console.log('[GreenBee] Firebase ready uid=', _uid);

    // Pull all cloud data into local IndexedDB on start
    await syncAllDown();
    return true;

  } catch (err) {
    console.warn('[GreenBee] Firebase unavailable — offline mode only.', err.message);
    _ready = false;
    return false;
  }
}

// ── COLLECTION REFERENCE ─────────────────────────────────
function col(name) {
  // All data under /users/{uid}/{collection}
  return _fs.collection('users').doc(_uid).collection(name);
}

// ── SYNC ALL DOWN (cloud → local) ────────────────────────
// Called once on startup. Pulls every Firestore document into IndexedDB.
async function syncAllDown() {
  if (!_ready) return;
  const collections = ['html_files', 'folders', 'notes', 'projects', 'pdfs', 'voice_notes'];
  for (const name of collections) {
    try {
      const snap = await col(name).get();
      for (const doc of snap.docs) {
        const data = doc.data();
        // Reassemble chunked data if needed
        if (data._chunked) {
          data.data = await downloadChunks(name, doc.id);
          delete data._chunked;
          delete data._chunkCount;
        }
        // Don't overwrite if local copy is newer
        const existing = await window._idbGet(name, doc.id);
        const cloudTs  = data.updatedAt || data.createdAt || 0;
        const localTs  = existing?.updatedAt || existing?.createdAt || 0;
        if (!existing || cloudTs >= localTs) {
          await window._idbPut(name, { ...data, id: doc.id });
        }
      }
    } catch (e) {
      console.warn(`[GreenBee] syncDown(${name}) failed`, e.message);
    }
  }
  console.log('[GreenBee] Sync down complete');
}

// ── SYNC UP (local item → Firestore) ─────────────────────
async function syncUp(collectionName, item) {
  if (!_ready) return;
  try {
    const toStore = { ...item };

    // Never store thumbnails in cloud (large, regeneratable)
    delete toStore.thumbnail;

    // Large binary (PDFs, voice notes stored as base64 dataURL)
    // Split into chunks if over CHUNK_SIZE
    const binaryField = collectionName === 'pdfs'         ? 'data'
                      : collectionName === 'voice_notes'  ? 'data'
                      : null;

    if (binaryField && toStore[binaryField] && toStore[binaryField].length > CHUNK_SIZE) {
      await uploadChunks(collectionName, item.id, toStore[binaryField]);
      delete toStore[binaryField];
      toStore._chunked    = true;
      toStore._chunkCount = Math.ceil(item[binaryField].length / CHUNK_SIZE);
    }

    await col(collectionName).doc(item.id).set(toStore, { merge: true });

  } catch (err) {
    console.warn(`[GreenBee] syncUp(${collectionName}) failed`, err.message);
  }
}

// ── SYNC DELETE ───────────────────────────────────────────
async function syncDelete(collectionName, id) {
  if (!_ready) return;
  try {
    // Delete any chunks first
    const doc = await col(collectionName).doc(id).get();
    if (doc.exists && doc.data()._chunked) {
      const count = doc.data()._chunkCount || 0;
      const batch = _fs.batch();
      for (let i = 0; i < count; i++) {
        const ref = col(`${collectionName}_chunks`).doc(`${id}_${i}`);
        batch.delete(ref);
      }
      await batch.commit();
    }
    await col(collectionName).doc(id).delete();
  } catch (err) {
    console.warn(`[GreenBee] syncDelete(${collectionName}, ${id}) failed`, err.message);
  }
}

// ── CHUNKED UPLOAD ────────────────────────────────────────
// Splits a long base64 string into multiple Firestore documents
async function uploadChunks(collectionName, id, data) {
  const chunkCol = col(`${collectionName}_chunks`);
  const total    = Math.ceil(data.length / CHUNK_SIZE);
  const batch    = _fs.batch();
  for (let i = 0; i < total; i++) {
    const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    batch.set(chunkCol.doc(`${id}_${i}`), { chunk, index: i });
  }
  await batch.commit();
}

// ── CHUNKED DOWNLOAD ─────────────────────────────────────
async function downloadChunks(collectionName, id) {
  const chunkCol = col(`${collectionName}_chunks`);
  const snap     = await chunkCol
    .where(firebase.firestore.FieldPath.documentId(), '>=', `${id}_`)
    .where(firebase.firestore.FieldPath.documentId(), '<=', `${id}_\uf8ff`)
    .orderBy(firebase.firestore.FieldPath.documentId())
    .get();

  if (snap.empty) return null;
  // Sort by index and reassemble
  const sorted = snap.docs
    .map(d => d.data())
    .sort((a, b) => a.index - b.index);
  return sorted.map(d => d.chunk).join('');
}

// ── EXPORT ────────────────────────────────────────────────
window.FirebaseSync = {
  init:   firebaseInit,
  up:     syncUp,
  del:    syncDelete,
  down:   syncAllDown,
};

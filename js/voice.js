/* ══════════════════════════════════════
   GreenBee — Voice Notes
══════════════════════════════════════ */

window.Voice = (() => {

  let mediaRecorder = null;
  let chunks        = [];
  let startTime     = null;
  let timerInterval = null;
  let isRecording   = false;

  async function render() {
    const list = document.getElementById('voiceRecordings');
    if (!list) return;
    list.innerHTML = '';

    const recordings = await Storage.getVoiceNotes();
    recordings.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'voice-rec-card';

      const mins = String(Math.floor(rec.duration / 60)).padStart(2, '0');
      const secs = String(rec.duration % 60).padStart(2, '0');

      card.innerHTML = `
        <button class="voice-play-btn" aria-label="Play ${rec.name}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="voice-rec-info">
          <div class="voice-rec-name">${escHtml(rec.name)}</div>
          <div class="voice-rec-dur">${mins}:${secs} · ${formatDate(rec.createdAt)}</div>
        </div>
        <button class="voice-del-btn" aria-label="Delete recording">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      `;

      // play
      const playBtn = card.querySelector('.voice-play-btn');
      let audioEl = null;
      playBtn.onclick = () => {
        if (audioEl) { audioEl.pause(); audioEl = null; playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'; return; }
        audioEl = new Audio(rec.data);
        audioEl.play();
        playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        audioEl.onended = () => { audioEl = null; playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'; };
      };

      // delete
      card.querySelector('.voice-del-btn').onclick = async () => {
        if (confirm('Delete this recording?')) {
          await Storage.deleteVoiceNote(rec.id);
          render();
          refreshStats();
          showToast('Recording deleted');
        }
      };

      list.appendChild(card);
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day:'numeric', month:'short' });
  }

  return { render };
})();

async function toggleRecording() {
  const btn   = document.getElementById('voiceRecordBtn');
  const ring  = document.getElementById('voiceRing');
  const hint  = document.getElementById('voiceHint');
  const timer = document.getElementById('voiceTimer');

  if (btn.classList.contains('recording')) {
    // stop
    if (window._mediaRecorder) {
      window._mediaRecorder.stop();
    }
  } else {
    // start
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      window._mediaRecorder = mr;
      const startTs = Date.now();

      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = async () => {
        clearInterval(window._timerInt);
        stream.getTracks().forEach(t => t.stop());

        const duration = Math.round((Date.now() - startTs) / 1000);
        const blob     = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        const name     = `Voice ${new Date().toLocaleDateString(undefined, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;

        await Storage.saveVoiceNote({ name, blob, duration });

        btn.classList.remove('recording');
        ring.classList.remove('recording');
        hint.textContent = 'Tap to record';
        timer.classList.add('hidden');

        Voice.render();
        refreshStats();
        showToast('Voice note saved ✓');
      };

      mr.start();
      btn.classList.add('recording');
      ring.classList.add('recording');
      hint.textContent = 'Recording… tap to stop';
      timer.classList.remove('hidden');

      // update timer display
      window._timerInt = setInterval(() => {
        const s  = Math.round((Date.now() - startTs) / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        timer.textContent = `${mm}:${ss}`;
      }, 500);

    } catch(err) {
      showToast('Microphone access denied');
    }
  }
}

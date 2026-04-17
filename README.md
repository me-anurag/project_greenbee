# 🐝 GreenBee PWA

A personal productivity PWA — HTML file viewer, notes, voice memos, and AI tools (coming soon).

---

## Folder Structure

```
greenbee/
├── index.html          ← App entry point
├── manifest.json       ← PWA manifest
├── sw.js               ← Service worker (offline support)
├── css/
│   └── main.css        ← Design system & all styles
├── js/
│   ├── storage.js      ← IndexedDB wrapper (offline-first data)
│   ├── app.js          ← Core: navigation, panel, toasts, viewer
│   ├── html-notes.js   ← HTML file cards, folders, breadcrumb
│   ├── notes.js        ← Text notes CRUD
│   └── voice.js        ← Voice recording & playback
├── icons/
│   ├── icon-192.png    ← PWA icon (192×192)
│   └── icon-512.png    ← PWA icon (512×512)
└── make_icons.py       ← Icon generator script
```

---

## How to run locally

### Option 1 — Python (simplest)
```bash
cd greenbee
python3 -m http.server 8080
# open http://localhost:8080
```

### Option 2 — Node / npx
```bash
cd greenbee
npx serve .
# or
npx http-server . -p 8080
```

### Option 3 — VS Code
Install the **Live Server** extension, right-click `index.html` → "Open with Live Server".

---

## Install as PWA

1. Open in Chrome/Edge on **Android** → Menu → "Add to Home Screen"
2. Open in **Safari on iOS** → Share → "Add to Home Screen"
3. On **Desktop Chrome/Edge** → address bar install icon

---

## Deploy (free options)

### Netlify (drag & drop)
1. Go to [netlify.com/drop](https://netlify.com/drop)
2. Drag the entire `greenbee/` folder onto the page
3. Done — live URL instantly

### GitHub Pages
```bash
git init
git add .
git commit -m "GreenBee MVP"
gh repo create greenbee --public --push --source=.
# enable Pages in repo Settings → Pages → Deploy from branch (main / root)
```

### Vercel
```bash
npm i -g vercel
vercel
```

---

## Future features (scaffolded)

- **AI Tools** — buttons and slots are ready; add API calls when ready
- **Daily Quotes** — data model ready in storage; UI scaffold in side panel
- **Folders** — fully working; nested folders supported

---

## Data & Privacy

All data is stored **locally on your device** using IndexedDB.  
Nothing is sent to any server. Works fully offline after first load.

# GreenBee — Firebase Setup Guide
## Permanent cloud sync — FREE, no billing required

This uses only Firestore (Firebase's free database).
No Firebase Storage, no credit card needed.

---

## STEP 1 — Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name: **GreenBee** → Continue
4. Disable Google Analytics → **Create project**
5. Wait ~20 seconds

---

## STEP 2 — Enable Anonymous Auth

1. Left sidebar → **Build → Authentication**
2. **Get started**
3. Click **Anonymous** under Sign-in providers
4. Toggle **Enable** → **Save**

---

## STEP 3 — Create Firestore Database

1. Left sidebar → **Build → Firestore Database**
2. **Create database**
3. Select **"Start in production mode"** → Next
4. Location: choose closest to you
   - India → `asia-south1`
   - Europe → `europe-west`
   - US → `us-central`
5. **Enable** — wait ~30 seconds

### Set Security Rules (important)

1. Firestore → **Rules** tab
2. Replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

3. **Publish**

This ensures only your device can read and write your data.

---

## STEP 4 — Get Your Config

1. Top of left sidebar → **gear icon → Project Settings**
2. Scroll to **"Your apps"** section
3. Click **"</> Web"** icon
4. App nickname: **GreenBee** → **Register app**
5. Copy the config object — looks like:

```js
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXX",
  authDomain: "greenbee-12345.firebaseapp.com",
  projectId: "greenbee-12345",
  storageBucket: "greenbee-12345.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## STEP 5 — Paste Config into GreenBee

1. Open `js/firebase-sync.js` in any text editor (Notepad, VS Code, etc.)
2. Find the block at the very top:

```js
const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  ...
};
```

3. Replace the placeholder values with your real values
4. **Save the file**

---

## STEP 6 — Deploy

```bash
git add .
git commit -m "add Firebase cloud sync"
git push
```

Netlify deploys in ~30 seconds.

---

## STEP 7 — Verify it works

1. Open GreenBee on your phone
2. Look for the toast: **"☁️ Cloud sync active"**
3. Add a note
4. Firebase Console → Firestore → Data tab
   → you should see `users → {your-uid} → notes → {your-note}`

Now reinstall the app anytime — your data always comes back.

---

## Free Plan Limits (Spark plan — no card needed)

| What | Free limit |
|---|---|
| Firestore reads | 50,000 per day |
| Firestore writes | 20,000 per day |
| Firestore storage | 1 GB total |

For a personal app with notes, HTML files, PDFs and projects
you will not come close to these limits in normal use.

---

## Troubleshooting

**Toast says "☁️ Cloud sync active" but nothing in Firestore**
→ Check security rules — make sure you published them correctly.

**No toast at all / console error about config**
→ Check `firebase-sync.js` — make sure all 6 config values are replaced,
  no "PASTE_YOUR..." text remaining.

**Works on first install but data gone after reinstall**
→ Anonymous auth creates a new UID on reinstall.
  Solution: add Google login later so UID is tied to your Google account.
  (Can be added as a future improvement.)

**"Missing or insufficient permissions" error**
→ Anonymous auth is not enabled. Go back to Step 2.

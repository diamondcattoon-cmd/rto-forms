# RTO Forms Server

## Files
```
rto-platform/
├── server.js          ← Node.js server (Express + Puppeteer)
├── package.json       ← Dependencies
├── render.yaml        ← Render.com config
├── public/
│   └── index.html     ← Frontend form
└── templates/
    ├── form29.html    ← Form 29 template
    ├── form30.html    ← Form 30 template
    └── affidavit.html ← Affidavit template (seller + purchaser)
```

## Local test karna
```bash
npm install
node server.js
# Open: http://localhost:3000
```

## Render.com pe deploy karna
1. GitHub pe push karo
2. render.com → New Web Service
3. GitHub repo connect karo
4. Build: npm install
5. Start: node server.js
6. Deploy!

## Kaise kaam karta hai
1. User form fill karta hai
2. POST /api/generate call hota hai
3. Server HTML templates mein data fill karta hai
4. Puppeteer (headless Chrome) HTML ko PDF banata hai
5. 4 pages ka PDF download hota hai

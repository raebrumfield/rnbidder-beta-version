# RnB Bidding Tool

Internal bid estimator for **RnB Homes Electrical** — Colorado Springs, CO.

## Pages

| Page | File | Purpose |
|------|------|---------|
| Login | `public/index.html` | Password-protected entry (via Netlify function) |
| Dashboard | `public/landing.html` | Hub — Start New Bid, Open Existing, Export |
| Estimator | `public/blueprint.html` | Line-item estimator with PDF upload |
| Saved Bids | `public/bids.html` | Browse, search, duplicate, delete, export bids |

## Project Structure

```
rnb-bidding-tool/
├── netlify.toml                    # Netlify config (publish: public/)
├── README.md
├── public/                         # Static site root
│   ├── index.html                  # Login page
│   ├── landing.html                # Dashboard hub
│   ├── blueprint.html              # Estimator
│   ├── bids.html                   # Saved bids list + export
│   ├── styles.css                  # Shared styles
│   ├── blueprint.css               # Estimator-specific styles
│   ├── auth.js                     # Auth guard utilities
│   ├── bid-store.js                # localStorage CRUD for bids
│   └── blueprint.js                # Estimator logic + presets
└── netlify/
    └── functions/
        └── validate-password.js    # Serverless login validator
```

## Setup

1. Push to GitHub and connect to Netlify.
2. In Netlify dashboard → Site settings → Environment variables → set `RNB_APP_PASSWORD` to your desired password.
3. Netlify publishes `public/` — no build command needed.

## Local Dev

Open `public/index.html` directly in a browser. The login falls back to a hardcoded password (`rnb2026`) when the Netlify function is unavailable.

## Data Storage

Bids are stored in the browser's `localStorage` under the key `rnb_bids`. Export bids as JSON or formatted text from the estimator or bids page.

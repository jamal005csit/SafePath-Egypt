# SafePath Egypt — طريق آمن

A private, Arabic-language digital navigator prototype for the technology-facilitated violence hackathon brief. Female university students describe an incident in Arabic → a lightweight classification step triages the incident type → the app returns tailored evidence-preservation guidance and official Egyptian reporting pathways.

## Run locally

```bash
npm install
export GEMINI_API_KEY="your-key-here"
npm start
```

Then open `http://localhost:3000`.

Get a free Gemini API key at https://aistudio.google.com/apikey (free tier is generous — plenty for a hackathon demo).

Without a key set, the app still runs end-to-end: classification silently falls back to "unclear" (fail-safe, never blocks the user) so you can test the whole UI/flow before wiring the key in.

## Deploy (free tier)

Works as-is on **Render** (Web Service, Node) or as a Space on **Hugging Face** (Docker/Node SDK). Set `GEMINI_API_KEY` as an environment variable in the platform's dashboard — never commit it to the repo.

## Architecture & the privacy trade-off

The original brief says "local processing only, no cloud storage." Using Gemini's API is *not* local processing — it's a cloud call. Rather than claim something inaccurate, the app draws the privacy line at a different, more honest place:

1. **PII redaction happens client-side, in the browser, before anything is sent anywhere** (`public/app.js` → `redactPII()`). Phone numbers, emails, and national ID numbers are stripped first. This part genuinely is local and instant.
2. Only the *redacted* text is sent to Gemini for classification. Nothing about the request identifies the user.
3. **The server never persists incident text.** `/api/classify` is fully stateless — the text passes through to Gemini and the response passes back; nothing touches disk or a database.
4. `/api/report` stores only a category + text length + timestamp in an in-memory array (cleared on server restart) and returns a reference code. No text, no identity.

The UI copy was written to match this honestly: *"Nothing is saved. Your identifying details are removed before analysis"* rather than the original "local processing only" claim.

## Files

- `public/index.html` — 4-screen SPA shell (entry, intake, analysis, action plan), RTL Arabic
- `public/style.css` — design system (trauma-informed calm aesthetic — see design notes below)
- `public/app.js` — routing, client-side PII redaction, classification call, checklist/accordion state
- `server/index.js` — Express server: `/api/classify` (Gemini proxy), `/api/report` (reference code generator)

## Design direction

Not a "cinematic SaaS" aesthetic on purpose — someone using this is likely in acute distress. Soft sage/slate palette, Tajawal typeface (calm, humanist, native Arabic support), generous whitespace, minimal motion (one deliberate rise-in on the classification result — the moment of clarity). Bright red is reserved exclusively for the physical-danger alert, never used decoratively. Quick Exit is a persistent fixed element, RTL-mirrored back navigation throughout.

## Extending this

- **Category taxonomy**: defined in two places that must stay in sync — `SYSTEM_PROMPT` in `server/index.js` and `CATEGORIES` in `public/app.js`. If you add/change categories, update both.
- **Reporting pathways**: `PATHWAYS` object in `app.js` — currently only 15115 (NCW hotline) and 122 (emergency) are wired in per the brief. Add more as you confirm real institutional contacts.
- **Swap Gemini for another model**: only `callGemini()` in `server/index.js` needs to change — the rest of the app is model-agnostic (it just expects a category string back).

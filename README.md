# SmartSDR Frontend

The web app for SmartSDR: leads, AI calling, campaigns, conversion, meetings, reports and
administration. It is a React 19 single-page app that talks to one backend, the SmartSDR API
(`smartsdr-platform`, FastAPI).

## Quick start

You need Node.js 22 (the version Netlify builds with) and the backend running on
`http://localhost:8000`. See the backend README for that.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start                 # http://localhost:3000
```

Sign in with a user from the backend's seed data.

## Configuration

Settings are read at build time from `.env`. Only `REACT_APP_*` variables reach the browser, so never
put secrets in them.

| Variable | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | The API origin. Leave empty locally (falls back to `http://localhost:8000`); set per deployment in Netlify. Never commit an ngrok URL. |
| `REACT_APP_USD_INR_RATE` | Optional display rate for prices shown in INR (default 88). Stripe always charges in USD. |
| `BACKEND_URL` | Optional target of the dev-server proxy in `src/setupProxy.js` (default `http://localhost:8000`). |
| `ENABLE_HEALTH_CHECK` | Optional `true` adds the dev-server health endpoints in `plugins/health-check/`. |

`REACT_APP_VOICE_AGENT_URL` and `REACT_APP_REPORT_AGENT_URL` are deprecated: everything is served by the
one backend, and `src/lib/api.js` uses `REACT_APP_BACKEND_URL` first.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server on port 3000 with hot reload. |
| `npm test` | Jest in watch mode. |
| `npm test -- --watchAll=false` | Runs every test once (about 785 tests, under a minute). |
| `npm run build` | Production build in `build/`. |

The scripts run through CRACO (`craco.config.js`), which adds the `@` → `src/` import alias and the
React hooks lint rules. `NODE_OPTIONS` (OpenSSL legacy provider, 4 GB heap) is already set in
`package.json`.

## Project structure

```
src/
├── App.js          routes and role guards
├── pages/          one file per screen (tests sit next to them as *.test.jsx)
├── components/     feature components (leads, conversion, voice, billing, admin, ...) and ui/ primitives
├── lib/            API client (api.js), auth context, role rules (rbac.js), shared helpers
├── hooks/          shared hooks (polling, call logs, API actions, toasts)
└── test/           test helpers and fixtures (renderWithAuth, lead score fixtures)
```

UI building blocks are shadcn/ui components (Radix UI + Tailwind CSS) in `components/ui/`, configured in
`components.json`. Charts use Recharts.

## Main screens

| Area | Routes |
|---|---|
| Leads and prospecting | `/leads` (incl. Archived view), `/prospecting`, `/research`, `/sheets-sync` |
| Calling | `/voice_agent`, `/voice-campaigns`, `/calls`, `/audio-upload`, `/call-quality`, `/agent-performance`, `/agent-runs` |
| Campaigns and inbox | `/campaigns/*`, `/inbox` |
| Conversion | `/conversion` |
| Meetings | `/meetings`, `/settings/calendar` (Nylas calendar connection) |
| Dashboards and reports | `/dashboard`, `/manager-dashboard`, `/reports` |
| Catalog and marketplace | `/catalog`, `/marketplace`, `/projects`, `/properties` |
| Administration | `/settings`, `/settings/users`, `/settings/teams`, `/settings/tenants`, `/billing`, `/weight-config`, `/knowledge-base` |

What each role can see is defined in `src/lib/rbac.js` (it mirrors the backend's
`app/core/permissions.py`). The frontend only hides things; the backend enforces every rule. Lead
visibility, archive/restore and delete follow the backend's lead rules (see its README).

## Analytics

PostHog is loaded in `public/index.html`. Session recordings mask all text and element attributes, and
pages that cannot be masked safely (sign-in, registration, settings, billing, inbox, calls, audio upload,
call quality) are never recorded. Keep that list in step when adding a page that shows personal data.

## Deployment

Netlify builds the site with `netlify.toml` (Node 22, `craco build`, `build/` published, all routes
served by `index.html`). Set `REACT_APP_BACKEND_URL` in Netlify's environment variables for each
deploy context.

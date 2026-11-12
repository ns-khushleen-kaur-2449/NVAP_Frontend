# NVIP — Netsmartz Voice Intelligence Platform (frontend)

One portal for every NVIP voice agent: AI Receptionist / Router, Outbound Lead Gen,
Inbound Voice SDR, Hiring / Recruitment and Real Estate. All agents run on the same
platform (Twilio · Vapi · ElevenLabs · Nylas); each one is a configuration, not a
separate app. See the NVIP Architecture, SRS & FRS document, §29 for the portal structure.

## Run it

```bash
npm install
npm start          # http://localhost:3000
```

Without a backend it runs on built-in demo data. Open `/signin`, enter any email and
pick a role to preview that role's workspace.

```bash
npm test -- --watchAll=false   # tests
npm run build                  # production build in /build
```

Copy `.env.example` to `.env` to point at a real backend:

| Variable | Meaning |
|---|---|
| `REACT_APP_NVIP_API_URL` | NVIP backend origin; requests go to `<origin>/api/v1/...` |
| `REACT_APP_NVIP_USE_MOCKS` | `false` to call the backend instead of demo data |

## Structure

```
src/
  routes.jsx            all routes: public site, /signin, /app/* workspace
  config/
    agents.js           agent catalog: the one list of agent types, tiers, guardrails
    navigation.js       sidebar per role; also decides route access
    roles.js            platform admin, tenant admin, agent user, reporting
  api/
    client.js           axios client, auth header, mock switch
    services.js         platform endpoints (doc §9), one function each
    mocks.js            demo data
  agents/               per-agent screens — the plug-in point for each agent's backend
    index.js            registry: agent type → extra tabs on the agent page
    <type>/index.jsx    that agent's tabs (Campaigns, Candidates, Listings…)
  lib/                  lifecycle rules (§26), acceptance checklist (§18)
  layouts/              public top-nav layout, workspace sidebar layout
  pages/public/         marketplace, agent detail, pricing, demo/quote, sign-in
  pages/workspace/      dashboard, my agents, agent page, orders, usage, team, integrations
  components/           shared UI primitives
```

### Adding an agent's backend

1. Put the agent's endpoints in `src/agents/<type>/api.js`, using `http` and `call`
   from `src/api/client.js`.
2. Replace the placeholder tabs in `src/agents/<type>/index.jsx` with real screens.
   Each tab receives `{ instance, agent }`.

Routing, navigation and the agent page pick the tabs up automatically.

// In-memory (module-scope) chat state for the AI Strategist page. Persists across
// React Router navigation within the SPA (the module stays loaded), but resets on a
// real browser/hard refresh (the whole JS bundle re-executes) — intentionally NOT
// using sessionStorage/localStorage, which would survive a hard refresh too.
export const strategistStore = {
  msgs: [],
  prospectIds: [],
};

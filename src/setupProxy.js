/**
 * CRA dev-server proxy configuration.
 *
 * All API paths route to the ONE backend (app.main:app). Identity, CRM, Voice,
 * Report and marketplace are served by a single application on a single origin,
 * so there is one target here.
 *
 * src/lib/api.js normally calls the backend by absolute URL, so this proxy only
 * matters for browser requests that use relative URLs in local development.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000';

module.exports = function (app) {
  app.use(
    createProxyMiddleware(
      ['/api', '/auth', '/vapi-webhook', '/voice-agent', '/audio', '/call-analysis', '/weights', '/executive-selection', '/config'],
      { target: BACKEND, changeOrigin: true }
    )
  );
};

/* The preview Worker's front door: one shared password, the same shape as BUNSO's.

   Every request, the pictures, models and scripts included, meets this check before the
   asset store is asked (`run_worker_first` in wrangler.jsonc), so nothing on the page can be
   reached around the password. Browser basic auth: the visitor types it once and the browser
   keeps it for the session. Any username is accepted; there is one key, not accounts.

   It fails closed. The password is the Worker secret PREVIEW_PASSWORD, set with
   `npx wrangler secret put PREVIEW_PASSWORD` and never written into this folder. With no secret
   set nothing is served at all, so a deploy that forgot it is a locked door, not an open one. */
const REALM = 'Basic realm="Mamasons preview", charset="UTF-8"';

async function digest(text) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

// compared as digests so both sides are the same length, which timingSafeEqual requires
async function allowed(request, password) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const given = decoded.slice(decoded.indexOf(':') + 1);
  const [a, b] = await Promise.all([digest(given), digest(password)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function refuse(status, body, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra },
  });
}

export default {
  async fetch(request, env) {
    if (!env.PREVIEW_PASSWORD) return refuse(503, 'This preview is locked: no password has been set.');
    if (!(await allowed(request, env.PREVIEW_PASSWORD))) return refuse(401, 'Password required.', { 'WWW-Authenticate': REALM });
    const asset = await env.ASSETS.fetch(request);
    // a preview is never meant for search engines
    const res = new Response(asset.body, asset);
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  },
};

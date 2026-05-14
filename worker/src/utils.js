// ── Crypto helpers (Web Crypto API — Workers compatible) ──────
export function uid() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hash(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function parseJSON(val) {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return val || [];
}

// ── JWT (using Web Crypto — HS256) ───────────────────────────
async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

export async function signJWT(payload, secret, expiresIn = '8h') {
  const now = Math.floor(Date.now() / 1000);
  const expSeconds = expiresIn === '30d' ? 30 * 86400 : 8 * 3600;
  const fullPayload = { ...payload, iat: now, exp: now + expSeconds };
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = b64url(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const key    = await importKey(secret);
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC', key,
    Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error('Bad signature');
  const payload = JSON.parse(b64urlDecode(parts[1]));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

// ── D1 wrappers ───────────────────────────────────────────────
export async function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const res  = await (params.length ? stmt.bind(...params) : stmt).all();
  return res.results || [];
}

export async function dbGet(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const res  = await (params.length ? stmt.bind(...params) : stmt).first();
  return res || null;
}

export async function dbRun(db, sql, params = []) {
  const stmt = db.prepare(sql);
  return params.length ? stmt.bind(...params).run() : stmt.run();
}

// ── Audit log ─────────────────────────────────────────────────
export async function auditLog(db, action, userId, role, details = '') {
  try {
    await dbRun(db,
      'INSERT INTO audit_log (id,action,user_id,role,details,ts) VALUES (?,?,?,?,?,?)',
      [uid(), action, userId || 'system', role || 'system', details, new Date().toISOString()]
    );
  } catch (_) {}
}

// ── Email via Resend API ──────────────────────────────────────
export async function sendMail(apiKey, to, subject, html) {
  if (!apiKey) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'PharmaDist Pro <onboarding@resend.dev>', to: [to], subject, html }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch { return false; }
}

// ── WhatsApp send ─────────────────────────────────────────────
export async function sendWhatsApp(accessToken, phoneNumberId, to, message) {
  if (!accessToken || !phoneNumberId) return;
  try {
    await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (_) {}
}

// ── JSON response helpers ─────────────────────────────────────
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });

export const err = (msg, status = 400) => json({ ok: false, msg }, status);

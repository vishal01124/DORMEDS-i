// PharmaDist Pro — Cloudflare Worker v5.0
// Hono router | Cloudflare D1 | JWT (Web Crypto) | Resend API
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { dbGet, dbRun, hash, uid } from './utils.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerDataRoutes } from './routes/data.js';
import { registerOperationsRoutes } from './routes/operations.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';

const app = new Hono();

// ── CORS ──────────────────────────────────────────────────────
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://pharmadist-app.pages.dev',
      'https://pharmadist-pro.pages.dev',
      'https://dormeds.pages.dev',
      'https://vishal01124.github.io',
      'http://localhost:5000',
      'http://localhost:3000',
      'http://127.0.0.1:5000',
    ];
    if (!origin || allowed.some(o => origin.startsWith(o))) return origin || '*';
    // Allow any *.pages.dev preview URLs
    if (origin.endsWith('.pages.dev')) return origin;
    return null;
  },
  allowMethods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

// ── DB seed / init (runs on every cold start) ─────────────────
async function ensureAdminSeeded(env) {
  try {
    const ADMIN_EMAIL    = (env.ADMIN_EMAIL    || 'admin@pharmadist.com').toLowerCase().trim();
    const ADMIN_PASSWORD = (env.ADMIN_PASSWORD  || 'admin123').trim();
    // Only seed if no admin exists at all
    const existing = await dbGet(env.DB, 'SELECT id FROM admins WHERE id=?', ['admin']);
    if (!existing) {
      const pw = await hash(ADMIN_PASSWORD);
      await dbRun(env.DB,
        'INSERT INTO admins (id,name,email,pass_hash,created_at,is_super) VALUES (?,?,?,?,?,1)',
        ['admin', 'Admin', ADMIN_EMAIL, pw, new Date().toISOString()]
      );
    }
    // Ensure dist_info row exists
    const dist = await dbGet(env.DB, 'SELECT id FROM dist_info WHERE id=1');
    if (!dist) {
      await dbRun(env.DB,
        'INSERT INTO dist_info VALUES (1,?,?,?,?,?,?,?,?)',
        ['PharmaDist Pro','100 Industrial Area, Pune, MH 411057','+91 20 1234 5678','+91 99887 76655','support@pharmadist.com','27ABCDE1234F1Z5','MH-DIST-2020-001',null]
      );
    }
  } catch (_) {}
}

// ── Register all route modules ────────────────────────────────
registerAuthRoutes(app);
registerDataRoutes(app);
registerOperationsRoutes(app);
registerAnalyticsRoutes(app);

// ── Catch-all: serve static content note ─────────────────────
// Static files are served by Cloudflare Pages automatically.
// This worker only handles /api/* routes.
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ ok: false, msg: 'API route not found.' }, 404);
  }
  // For non-API paths, return a redirect hint
  return c.json({ ok: false, msg: 'Use Cloudflare Pages for static content.' }, 404);
});

// ── Worker export ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // Seed admin on cold start (non-blocking)
    ctx.waitUntil(ensureAdminSeeded(env));
    return app.fetch(request, env, ctx);
  },

  // ── Cron: scheduled alerts (replaces setInterval) ────────────
  // Add to wrangler.toml: [triggers] crons = ["0 2 * * *"]
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledAlerts(env));
  },
};

// ── Scheduled alerts (Cron Triggers) ─────────────────────────
async function runScheduledAlerts(env) {
  const db = env.DB;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // 1. Bills due in 3 days
  const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
  const in3Str = in3.toISOString().slice(0, 10);
  const dueBills = await (async () => {
    try { return await db.prepare("SELECT * FROM bills WHERE status='unpaid' AND due=?").bind(in3Str).all().then(r => r.results); }
    catch { return []; }
  })();
  for (const bill of dueBills) {
    const nid = 'n' + uid();
    await dbRun(db, 'INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)',
      [nid, 'payment', `⚠️ Bill ${bill.id} for ${bill.ph_name} (₹${bill.amt}) due in 3 days (${bill.due})`, todayStr, 0, 1, null]);
    const pnid = 'n' + uid();
    await dbRun(db, 'INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)',
      [pnid, 'payment', `⏰ Your bill ${bill.id} of ₹${bill.amt} is due in 3 days. Please pay on time.`, todayStr, 0, 0, bill.ph_id]);
  }

  // 2. Near-expiry distributor stock (30 days)
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);
  const nearExpiry = await (async () => {
    try { return await db.prepare('SELECT * FROM dist_stock WHERE expiry>? AND expiry<=? AND stock>0').bind(todayStr, in30Str).all().then(r => r.results); }
    catch { return []; }
  })();
  for (const item of nearExpiry) {
    const nid = 'n' + uid();
    await dbRun(db, 'INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)',
      [nid, 'expiry', `⚠️ ${item.name} expires on ${item.expiry} (${item.stock} units)`, todayStr, 0, 1, null]);
  }

  // 3. Low distributor stock
  const lowStock = await (async () => {
    try { return await db.prepare('SELECT * FROM dist_stock WHERE stock<=min_stock AND stock>0').all().then(r => r.results); }
    catch { return []; }
  })();
  for (const item of lowStock) {
    const nid = 'n' + uid();
    await dbRun(db, 'INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)',
      [nid, 'stock', `🔴 Low stock: ${item.name} — only ${item.stock} units left (min: ${item.min_stock})`, todayStr, 0, 1, null]);
  }
}

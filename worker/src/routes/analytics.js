// Analytics, audit-log, WhatsApp webhook, health routes
import { dbGet, dbAll, dbRun, auditLog, parseJSON, sendWhatsApp, uid, json, err } from '../utils.js';
import { authMiddleware, adminMiddleware } from '../middleware.js';

export function registerAnalyticsRoutes(app) {

  // ── Health ─────────────────────────────────────────────────────
  app.get('/api/health', (c) => json({
    ok: true, version: '5.0-cloudflare',
    email: c.env.RESEND_API_KEY ? '✅ Resend API' : '❌ not configured',
    jwt: c.env.JWT_SECRET ? '✅ custom secret set' : '⚠️ default secret!',
    db: '✅ Cloudflare D1',
  }));

  // ── Audit log ──────────────────────────────────────────────────
  app.get('/api/audit-log', authMiddleware, adminMiddleware, async (c) =>
    json(await dbAll(c.env.DB, 'SELECT * FROM audit_log ORDER BY ts DESC LIMIT 200')));

  // ── Admin analytics ────────────────────────────────────────────
  app.get('/api/admin/analytics', authMiddleware, adminMiddleware, async (c) => {
    const db = c.env.DB;
    const [tp,ap,pp,sp,tr,pr,ps,bs,to2,td,as2,tl] = await Promise.all([
      dbGet(db,'SELECT COUNT(*) as c FROM pharmacies'),
      dbGet(db,"SELECT COUNT(*) as c FROM pharmacies WHERE status='active'"),
      dbGet(db,"SELECT COUNT(*) as c FROM pharmacies WHERE status='pending'"),
      dbGet(db,"SELECT COUNT(*) as c FROM pharmacies WHERE status='suspended'"),
      dbGet(db,"SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE status='paid'"),
      dbGet(db,"SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE status='unpaid'"),
      dbGet(db,"SELECT COUNT(*) as c FROM pharmacies WHERE plan='1500'"),
      dbGet(db,"SELECT COUNT(*) as c FROM pharmacies WHERE plan='1000'"),
      dbGet(db,"SELECT COUNT(*) as c FROM orders WHERE type='inventory'"),
      dbGet(db,'SELECT COUNT(*) as c FROM drugs'),
      dbGet(db,'SELECT COUNT(*) as c FROM sessions WHERE revoked=0'),
      dbGet(db,"SELECT COUNT(*) as c FROM audit_log WHERE action='LOGIN_SUCCESS'"),
    ]);
    return json({
      totalPharmacies: +tp.c, activePharmacies: +ap.c, pendingPharmacies: +pp.c,
      suspendedPharmacies: +sp.c, totalRevenue: +tr.t, pendingRevenue: +pr.t,
      premiumSubs: +ps.c, basicSubs: +bs.c, totalOrders: +to2.c,
      totalDrugs: +td.c, activeSessions: +as2.c, totalLogins: +tl.c,
    });
  });

  // ── Revenue chart ──────────────────────────────────────────────
  app.get('/api/analytics/revenue', authMiddleware, adminMiddleware, async (c) => {
    const db = c.env.DB; const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const label  = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const row    = await dbGet(db, "SELECT COALESCE(SUM(amt),0) as rev FROM bills WHERE status='paid' AND date LIKE ?", [`${prefix}%`]);
      const payRow = await dbGet(db, "SELECT COALESCE(SUM(amount),0) as pay FROM payments WHERE date LIKE ?", [`${prefix}%`]);
      months.push({ label, revenue: +(+row.rev + +payRow.pay).toFixed(2) });
    }
    return json(months);
  });

  // ── Top medicines ──────────────────────────────────────────────
  app.get('/api/analytics/top-medicines', authMiddleware, adminMiddleware, async (c) => {
    const ords = await dbAll(c.env.DB, "SELECT drugs FROM orders WHERE type='inventory' AND status IN ('approved','delivered')");
    const totals = {};
    for (const ord of ords) {
      for (const d of parseJSON(ord.drugs)) {
        if (d.name) totals[d.name] = (totals[d.name] || 0) + (d.qty || 0);
      }
    }
    return json(Object.entries(totals).map(([name, qty]) => ({ name, qty })).sort((a,b)=>b.qty-a.qty).slice(0,8));
  });

  // ── Top pharmacies ─────────────────────────────────────────────
  app.get('/api/analytics/top-pharmacies', authMiddleware, adminMiddleware, async (c) => {
    const rows = await dbAll(c.env.DB, "SELECT ph_id,ph_name,COALESCE(SUM(amt),0) as total FROM bills WHERE status='paid' GROUP BY ph_id,ph_name ORDER BY total DESC LIMIT 8");
    return json(rows.map(r => ({ phId: r.ph_id, name: r.ph_name, total: +r.total })));
  });

  // ── Orders trend ───────────────────────────────────────────────
  app.get('/api/analytics/orders-trend', authMiddleware, adminMiddleware, async (c) => {
    const db = c.env.DB; const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const label  = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const row = await dbGet(db, "SELECT COUNT(*) as cnt FROM orders WHERE type='inventory' AND date LIKE ?", [`${prefix}%`]);
      months.push({ label, orders: +row.cnt });
    }
    return json(months);
  });

  // ── Admin change password ──────────────────────────────────────
  app.post('/api/admin/change-password', authMiddleware, adminMiddleware, async (c) => {
    const { hash } = await import('../utils.js');
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) return err('Both passwords required.');
    if (newPassword.length < 8) return err('Min 8 characters.');
    const admin = await dbGet(c.env.DB, 'SELECT * FROM admins WHERE id=?', [c.get('user').id]);
    if (!admin || admin.pass_hash !== await hash(currentPassword)) return err('Current password is incorrect.', 401);
    await dbRun(c.env.DB, 'UPDATE admins SET pass_hash=? WHERE id=?', [await hash(newPassword), c.get('user').id]);
    await auditLog(c.env.DB, 'ADMIN_PASSWORD_CHANGED', c.get('user').id, 'admin', '');
    return json({ ok: true, msg: 'Password changed successfully!' });
  });


  // ── WhatsApp webhook ───────────────────────────────────────────
  app.get('/api/whatsapp/webhook', (c) => {
    const url = new URL(c.req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const WA_TOKEN = c.env.WA_VERIFY_TOKEN || 'pharmadist_wa_token';
    if (mode === 'subscribe' && token === WA_TOKEN)
      return new Response(challenge, { status: 200 });
    return new Response('Forbidden', { status: 403 });
  });

  app.post('/api/whatsapp/webhook', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    // Acknowledge immediately
    const response = new Response('', { status: 200 });
    // Process async (don't await, return early)
    processWAMessage(c.env, body).catch(() => {});
    return response;
  });

  app.post('/api/whatsapp/send', authMiddleware, adminMiddleware, async (c) => {
    const { to, message } = await c.req.json();
    if (!to || !message) return err('to and message required.');
    await sendWhatsApp(c.env.WA_ACCESS_TOKEN, c.env.WA_PHONE_ID, to, message);
    return json({ ok: true });
  });
}

// ── WA message processor ────────────────────────────────────────
async function processWAMessage(env, body) {
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg || msg.type !== 'text') return;
  const from = msg.from;
  const text = msg.text?.body || '';
  const ph = await dbGet(env.DB, 'SELECT * FROM pharmacies WHERE wa_number=?', [from]);
  if (!ph) { await sendWhatsApp(env.WA_ACCESS_TOKEN, env.WA_PHONE_ID, from, '❌ Your number is not registered.'); return; }
  const lower = text.toLowerCase();
  if (!lower.startsWith('order:') && !lower.startsWith('order ')) {
    await sendWhatsApp(env.WA_ACCESS_TOKEN, env.WA_PHONE_ID, from, `👋 Hi ${ph.name}! Send: *Order: MedicineName x Qty* to place an order.`);
    return;
  }
  const items = parseWAOrder(text);
  if (!items.length) { await sendWhatsApp(env.WA_ACCESS_TOKEN, env.WA_PHONE_ID, from, '❌ Format: *Order: Paracetamol x 100, Metformin x 200*'); return; }
  const oid = 'ORD-WA-' + uid();
  const date = new Date().toISOString().slice(0, 10);
  const drugs = JSON.stringify(items.map(i => ({ name: i.name, qty: i.qty, up: 0, tot: 0 })));
  await dbRun(env.DB, 'INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [oid, 'inventory', ph.id, ph.name, drugs, 0, 0, 0, date, 'pending', 'paid', 'Via WhatsApp', 0, '', null, null]);
  const nid = 'n' + uid();
  await dbRun(env.DB, 'INSERT INTO notifs VALUES (?,?,?,?,?,?,?)',
    [nid, 'order', `WhatsApp order from ${ph.name}: ${items.map(i=>i.name+' x'+i.qty).join(', ')}`, date, 0, 1, null]);
  const itemList = items.map((i, n) => `${n+1}. ${i.name} × ${i.qty}`).join('\n');
  await sendWhatsApp(env.WA_ACCESS_TOKEN, env.WA_PHONE_ID, from, `✅ *Order Received!*\nID: ${oid}\n\n${itemList}\n\nWe will confirm shortly!`);
}

function parseWAOrder(text) {
  const body = text.replace(/^order[:\s]+/i, '');
  return body.split(',').map(part => {
    const m = part.trim().match(/^(.+?)\s+[x×]\s*(\d+)$/i) || part.trim().match(/^(.+?)\s+(\d+)$/);
    return m ? { name: m[1].trim(), qty: parseInt(m[2]) } : null;
  }).filter(Boolean);
}

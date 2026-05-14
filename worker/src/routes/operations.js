// Orders, bills, returns, tickets, notifications, chat, products, quotations, payments
import { uid, dbGet, dbAll, dbRun, auditLog, parseJSON, json, err } from '../utils.js';
import { authMiddleware, adminMiddleware } from '../middleware.js';

// SSE clients map (in-memory, per Worker isolate)
const sseClients = new Map();

export function ssePush(userId, event, data) {
  const clients = sseClients.get(userId);
  if (clients) clients.forEach(ctrl => {
    try { ctrl.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  });
}

export function sseBroadcastAdmin(event, data) {
  sseClients.forEach((clients, uid) => {
    clients.forEach(ctrl => {
      if (ctrl._role === 'admin') {
        try { ctrl.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
      }
    });
  });
}

export function registerOperationsRoutes(app) {

  // ── SSE ────────────────────────────────────────────────────────
  app.get('/api/sse', async (c) => {
    const token = c.req.query('token') || (c.req.header('authorization') || '').replace('Bearer ', '');
    if (!token) return new Response('Unauthorized', { status: 401 });
    try {
      const { verifyJWT } = await import('../utils.js');
      const JWT_SECRET = c.env.JWT_SECRET || 'pharmadist_jwt_secret_2026_change_in_production!';
      const user = await verifyJWT(token, JWT_SECRET);
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const ctrl = {
        _role: user.role,
        enqueue: (chunk) => writer.write(encoder.encode(chunk)),
        close: () => writer.close(),
      };
      if (!sseClients.has(user.id)) sseClients.set(user.id, new Set());
      sseClients.get(user.id).add(ctrl);
      ctrl.enqueue('event: connected\ndata: {"ok":true}\n\n');
      // Heartbeat
      const hb = setInterval(() => {
        try { ctrl.enqueue(': heartbeat\n\n'); } catch { clearInterval(hb); }
      }, 25000);
      c.req.raw.signal?.addEventListener('abort', () => {
        clearInterval(hb);
        sseClients.get(user.id)?.delete(ctrl);
        if (sseClients.get(user.id)?.size === 0) sseClients.delete(user.id);
        writer.close().catch(() => {});
      });
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch { return new Response('Unauthorized', { status: 401 }); }
  });

  // ── Orders ─────────────────────────────────────────────────────
  app.get('/api/orders', authMiddleware, async (c) => {
    const phId = c.req.query('phId'); const type = c.req.query('type');
    let sql = 'SELECT * FROM orders'; const params = []; const conds = [];
    if (phId) { conds.push('ph_id=?'); params.push(phId); }
    if (type) { conds.push('type=?');  params.push(type); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY date DESC';
    const rows = await dbAll(c.env.DB, sql, params);
    return json(rows.map(r => ({ ...r, drugs: parseJSON(r.drugs), billed: !!r.billed, phId: r.ph_id, phName: r.ph_name })));
  });

  app.post('/api/orders', authMiddleware, async (c) => {
    const d = await c.req.json(); const oid = 'ORD-' + uid();
    await dbRun(c.env.DB, 'INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [oid, d.type, d.phId, d.phName, JSON.stringify(d.drugs||[]), d.sub||0, d.gst||0, d.tot||0,
       d.date||'', d.status||'pending', d.del||'paid', d.notes||'', 0, d.cust||'', null, null]);
    return json({ ok: true, id: oid });
  });

  app.get('/api/orders/:oid', authMiddleware, async (c) => {
    const r = await dbGet(c.env.DB, 'SELECT * FROM orders WHERE id=?', [c.req.param('oid')]);
    if (!r) return err('Not found', 404);
    return json({ ...r, drugs: parseJSON(r.drugs), billed: !!r.billed });
  });

  app.put('/api/orders/:oid', authMiddleware, async (c) => {
    const d = await c.req.json(); const oid = c.req.param('oid'); const db = c.env.DB;
    if ('status'       in d) await dbRun(db, 'UPDATE orders SET status=? WHERE id=?', [d.status, oid]);
    if ('billed'       in d) await dbRun(db, 'UPDATE orders SET billed=? WHERE id=?', [d.billed ? 1 : 0, oid]);
    if ('dispatch_date'in d) await dbRun(db, 'UPDATE orders SET dispatch_date=? WHERE id=?', [d.dispatch_date, oid]);
    if ('challan_no'   in d) await dbRun(db, 'UPDATE orders SET challan_no=? WHERE id=?', [d.challan_no, oid]);
    return json({ ok: true });
  });

  app.post('/api/orders/:oid/dispatch', authMiddleware, adminMiddleware, async (c) => {
    const oid = c.req.param('oid'); const db = c.env.DB;
    const ord = await dbGet(db, 'SELECT * FROM orders WHERE id=?', [oid]);
    if (!ord) return err('Order not found.', 404);
    const challanNo = 'CHN-' + Date.now().toString(36).toUpperCase();
    const dispatchDate = new Date().toISOString().slice(0, 10);
    await dbRun(db, "UPDATE orders SET status='dispatched',dispatch_date=?,challan_no=? WHERE id=?", [dispatchDate, challanNo, oid]);
    await auditLog(db, 'ORDER_DISPATCHED', c.get('user').id, 'admin', `${oid} → ${challanNo}`);
    const nid = 'n' + uid();
    await dbRun(db, 'INSERT INTO notifs VALUES (?,?,?,?,?,?,?)',
      [nid, 'order', `Your order ${oid} has been dispatched! Challan: ${challanNo}`, dispatchDate, 0, 0, ord.ph_id]);
    ssePush(ord.ph_id, 'notif', { type: 'order', msg: `Order ${oid} dispatched — Challan: ${challanNo}`, ph: ord.ph_id });
    sseBroadcastAdmin('notif', { type: 'order', msg: `Order ${oid} dispatched to ${ord.ph_name}` });
    return json({ ok: true, challanNo, dispatchDate });
  });

  // ── Bills ──────────────────────────────────────────────────────
  app.get('/api/bills', authMiddleware, async (c) => {
    const phId = c.req.query('phId');
    const rows = phId
      ? await dbAll(c.env.DB, 'SELECT * FROM bills WHERE ph_id=? ORDER BY date DESC', [phId])
      : await dbAll(c.env.DB, 'SELECT * FROM bills ORDER BY date DESC');
    return json(rows.map(r => ({ ...r, phId: r.ph_id, phName: r.ph_name, ordId: r.ord_id })));
  });

  app.post('/api/bills', authMiddleware, async (c) => {
    const d = await c.req.json(); const bid = 'BILL-' + uid();
    await dbRun(c.env.DB, 'INSERT INTO bills VALUES (?,?,?,?,?,?,?,?,?,?)',
      [bid, d.phId, d.phName, d.ordId||'MANUAL', d.amt, d.date, d.due, 'unpaid', d.type||'bulk', null]);
    return json({ ok: true, id: bid });
  });

  app.put('/api/bills/:bid', authMiddleware, async (c) => {
    const d = await c.req.json(); const bid = c.req.param('bid');
    if (d.status === 'paid') {
      await dbRun(c.env.DB, "UPDATE bills SET status='paid',paid=? WHERE id=?", [d.paid||'', bid]);
    } else if (d.status === 'pending_verification') {
      const utrNote = `UTR:${d.utr||''}|METHOD:${d.payMethod||'UPI'}`;
      await dbRun(c.env.DB, "UPDATE bills SET status='pending_verification',paid=? WHERE id=?", [utrNote, bid]);
    }
    return json({ ok: true });
  });

  // ── Returns ────────────────────────────────────────────────────
  app.get('/api/returns', authMiddleware, async (c) => {
    const phId = c.req.query('phId');
    const rows = phId
      ? await dbAll(c.env.DB, 'SELECT * FROM returns WHERE ph_id=? ORDER BY date DESC', [phId])
      : await dbAll(c.env.DB, 'SELECT * FROM returns ORDER BY date DESC');
    return json(rows.map(r => ({ ...r, drugs: parseJSON(r.drugs), phId: r.ph_id, phName: r.ph_name })));
  });

  app.post('/api/returns', authMiddleware, async (c) => {
    const d = await c.req.json(); const rid = 'RET-' + uid();
    await dbRun(c.env.DB, 'INSERT INTO returns VALUES (?,?,?,?,?,?,?,?,?)',
      [rid, d.phId, d.phName, d.reason, JSON.stringify(d.drugs||[]), d.date, 'pending', d.notes||'', '']);
    return json({ ok: true, id: rid });
  });

  app.put('/api/returns/:rid', authMiddleware, async (c) => {
    const d = await c.req.json();
    await dbRun(c.env.DB, 'UPDATE returns SET status=?,anote=? WHERE id=?', [d.status, d.anote||'', c.req.param('rid')]);
    return json({ ok: true });
  });

  // ── Tickets ────────────────────────────────────────────────────
  app.get('/api/tickets', authMiddleware, async (c) => {
    const phId = c.req.query('phId');
    const rows = phId
      ? await dbAll(c.env.DB, 'SELECT * FROM tickets WHERE ph_id=? ORDER BY date DESC', [phId])
      : await dbAll(c.env.DB, 'SELECT * FROM tickets ORDER BY date DESC');
    return json(rows.map(r => ({ ...r, msgs: parseJSON(r.msgs), phId: r.ph_id, phName: r.ph_name })));
  });

  app.post('/api/tickets', authMiddleware, async (c) => {
    const d = await c.req.json(); const tid = 'TKT-' + uid();
    await dbRun(c.env.DB, 'INSERT INTO tickets VALUES (?,?,?,?,?,?,?,?)',
      [tid, d.phId, d.phName, d.subject, d.type||'other', d.date, 'open', JSON.stringify(d.msgs||[])]);
    return json({ ok: true, id: tid });
  });

  app.put('/api/tickets/:tid', authMiddleware, async (c) => {
    const d = await c.req.json(); const tid = c.req.param('tid'); const db = c.env.DB;
    if ('msgs'   in d) await dbRun(db, 'UPDATE tickets SET msgs=? WHERE id=?', [JSON.stringify(d.msgs), tid]);
    if ('status' in d) await dbRun(db, 'UPDATE tickets SET status=? WHERE id=?', [d.status, tid]);
    return json({ ok: true });
  });

  // ── Notifications ──────────────────────────────────────────────
  app.get('/api/notifs', authMiddleware, async (c) => {
    const role = c.req.query('role'); const phId = c.req.query('phId');
    const rows = role === 'admin'
      ? await dbAll(c.env.DB, 'SELECT * FROM notifs WHERE admin=1 ORDER BY date DESC')
      : await dbAll(c.env.DB, 'SELECT * FROM notifs WHERE admin=0 AND (ph IS NULL OR ph=?) ORDER BY date DESC', [phId]);
    return json(rows.map(r => ({ ...r, read: !!r.read, admin: !!r.admin })));
  });

  app.post('/api/notifs', authMiddleware, async (c) => {
    const d = await c.req.json(); const nid = 'n' + uid();
    await dbRun(c.env.DB, 'INSERT INTO notifs VALUES (?,?,?,?,?,?,?)',
      [nid, d.type, d.msg, d.date||'', 0, d.admin ? 1 : 0, d.ph||null]);
    return json({ ok: true, id: nid });
  });

  app.post('/api/notifs/read-all', authMiddleware, async (c) => {
    const d = await c.req.json(); const db = c.env.DB;
    if (d.role === 'admin') await dbRun(db, 'UPDATE notifs SET read=1 WHERE admin=1');
    else await dbRun(db, 'UPDATE notifs SET read=1 WHERE ph=? OR ph IS NULL', [d.phId||null]);
    return json({ ok: true });
  });

  // ── Chat ───────────────────────────────────────────────────────
  app.get('/api/chats', authMiddleware, async (c) =>
    json(await dbAll(c.env.DB, 'SELECT * FROM chats ORDER BY id')));

  app.post('/api/chats', authMiddleware, async (c) => {
    const d = await c.req.json();
    await dbRun(c.env.DB, 'INSERT INTO chats(from_role,text,time) VALUES (?,?,?)', [d.from, d.text, d.time]);
    return json({ ok: true });
  });

  // ── Products ───────────────────────────────────────────────────
  app.get('/api/products', async (c) => {
    const category = c.req.query('category'); const search = c.req.query('search');
    let sql = 'SELECT * FROM products'; const params = []; const conds = [];
    if (category && category !== 'all') { params.push(category); conds.push('category=?'); }
    if (search) { params.push(`%${search.toLowerCase()}%`); conds.push('LOWER(name) LIKE ?'); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    return json(await dbAll(c.env.DB, sql, params));
  });

  app.post('/api/products', authMiddleware, adminMiddleware, async (c) => {
    const { name, category, price, stock, expiry_date } = await c.req.json();
    if (!name || !category || price == null || stock == null || !expiry_date)
      return err('All fields are required.');
    const pid = 'prod_' + uid();
    await dbRun(c.env.DB, 'INSERT INTO products (id,name,category,price,stock,expiry_date,created_at) VALUES (?,?,?,?,?,?,?)',
      [pid, name.trim(), category.trim(), parseFloat(price), parseInt(stock), expiry_date, new Date().toISOString()]);
    await auditLog(c.env.DB, 'PRODUCT_CREATED', c.get('user').id, 'admin', name);
    return json({ ok: true, id: pid });
  });

  app.put('/api/products/:pid', authMiddleware, adminMiddleware, async (c) => {
    const { name, category, price, stock, expiry_date } = await c.req.json();
    await dbRun(c.env.DB, 'UPDATE products SET name=?,category=?,price=?,stock=?,expiry_date=? WHERE id=?',
      [name.trim(), category.trim(), parseFloat(price), parseInt(stock), expiry_date, c.req.param('pid')]);
    await auditLog(c.env.DB, 'PRODUCT_UPDATED', c.get('user').id, 'admin', c.req.param('pid'));
    return json({ ok: true });
  });

  app.delete('/api/products/:pid', authMiddleware, adminMiddleware, async (c) => {
    await dbRun(c.env.DB, 'DELETE FROM products WHERE id=?', [c.req.param('pid')]);
    await auditLog(c.env.DB, 'PRODUCT_DELETED', c.get('user').id, 'admin', c.req.param('pid'));
    return json({ ok: true });
  });

  // ── Quotations ─────────────────────────────────────────────────
  app.get('/api/quotations', authMiddleware, async (c) => {
    const rows = await dbAll(c.env.DB, 'SELECT * FROM quotations ORDER BY created_at DESC');
    return json(rows.map(r => ({ ...r, items: parseJSON(r.items), phId: r.ph_id, phName: r.ph_name })));
  });

  app.post('/api/quotations', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json(); const db = c.env.DB;
    if (!d.phId || !d.items?.length) return err('Pharmacy and at least one item are required.');
    const ph = await dbGet(db, 'SELECT name FROM pharmacies WHERE id=?', [d.phId]);
    if (!ph) return err('Pharmacy not found.', 404);
    const qid = 'QUO-' + uid();
    await dbRun(db, 'INSERT INTO quotations VALUES (?,?,?,?,?,?,?,?)',
      [qid, d.phId, ph.name, JSON.stringify(d.items), d.validUntil||'', d.status||'draft', d.note||'', new Date().toISOString()]);
    await auditLog(db, 'QUOTATION_CREATED', c.get('user').id, 'admin', `${qid} for ${ph.name}`);
    return json({ ok: true, id: qid });
  });

  app.put('/api/quotations/:qid', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json();
    await dbRun(c.env.DB, 'UPDATE quotations SET status=?,note=? WHERE id=?', [d.status, d.note||'', c.req.param('qid')]);
    return json({ ok: true });
  });

  app.delete('/api/quotations/:qid', authMiddleware, adminMiddleware, async (c) => {
    await dbRun(c.env.DB, 'DELETE FROM quotations WHERE id=?', [c.req.param('qid')]);
    await auditLog(c.env.DB, 'QUOTATION_DELETED', c.get('user').id, 'admin', c.req.param('qid'));
    return json({ ok: true });
  });

  // ── Payments ───────────────────────────────────────────────────
  app.post('/api/payments', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json(); const db = c.env.DB;
    if (!d.phId || !d.amount || !d.date) return err('phId, amount and date are required.');
    const pid = 'PAY-' + uid();
    const ph = await dbGet(db, 'SELECT name FROM pharmacies WHERE id=?', [d.phId]);
    if (!ph) return err('Pharmacy not found.', 404);
    await dbRun(db, 'INSERT INTO payments (id,ph_id,ph_name,amount,method,ref,note,date,recorded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [pid, d.phId, ph.name, +d.amount, d.method||'cash', d.ref||'', d.note||'', d.date, c.get('user').id, new Date().toISOString()]);
    const unpaid = await dbAll(db, "SELECT * FROM bills WHERE ph_id=? AND status='unpaid' ORDER BY date ASC", [d.phId]);
    let remaining = +d.amount;
    for (const bill of unpaid) {
      if (remaining <= 0) break;
      if (bill.amt <= remaining) {
        await dbRun(db, "UPDATE bills SET status='paid',paid=? WHERE id=?", [d.date, bill.id]);
        remaining -= bill.amt;
      }
    }
    await auditLog(db, 'PAYMENT_RECORDED', c.get('user').id, 'admin', `${ph.name}: ₹${d.amount}`);
    return json({ ok: true, id: pid });
  });

  app.get('/api/payments', authMiddleware, adminMiddleware, async (c) => {
    const rows = await dbAll(c.env.DB, 'SELECT * FROM payments ORDER BY date DESC LIMIT 200');
    return json(rows.map(r => ({ ...r, phId: r.ph_id, phName: r.ph_name })));
  });

  app.get('/api/payments/:phId', authMiddleware, adminMiddleware, async (c) => {
    const rows = await dbAll(c.env.DB, 'SELECT * FROM payments WHERE ph_id=? ORDER BY date DESC', [c.req.param('phId')]);
    return json(rows.map(r => ({ ...r, phId: r.ph_id, phName: r.ph_name })));
  });

  app.delete('/api/payments/:pid', authMiddleware, adminMiddleware, async (c) => {
    await dbRun(c.env.DB, 'DELETE FROM payments WHERE id=?', [c.req.param('pid')]);
    await auditLog(c.env.DB, 'PAYMENT_DELETED', c.get('user').id, 'admin', c.req.param('pid'));
    return json({ ok: true });
  });

  // ── Ledger summary ─────────────────────────────────────────────
  app.get('/api/ledger/summary', authMiddleware, adminMiddleware, async (c) => {
    const db = c.env.DB;
    const pharmacies = await dbAll(db, "SELECT id,name FROM pharmacies WHERE status='active'");
    const result = [];
    for (const ph of pharmacies) {
      const totalBilled = await dbGet(db, 'SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE ph_id=?', [ph.id]);
      const totalPaid   = await dbGet(db, "SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE ph_id=? AND status='paid'", [ph.id]);
      const manualPaid  = await dbGet(db, 'SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE ph_id=?', [ph.id]);
      result.push({ phId: ph.id, name: ph.name,
        totalBilled: +totalBilled.t, totalPaid: +totalPaid.t,
        manualPayments: +manualPaid.t,
        outstanding: Math.max(0, +totalBilled.t - +totalPaid.t) });
    }
    result.sort((a, b) => b.outstanding - a.outstanding);
    return json(result);
  });
}

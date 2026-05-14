// Pharmacies, drugs, dist-info, dist-stock, admin team routes
import { uid, hash, dbGet, dbAll, dbRun, auditLog, parseJSON, sendMail, json, err } from '../utils.js';
import { authMiddleware, adminMiddleware } from '../middleware.js';

export function registerDataRoutes(app) {

  // ── Distributor public info ──────────────────────────────────
  app.get('/api/dist', async (c) => {
    const row = await dbGet(c.env.DB, 'SELECT * FROM dist_info WHERE id=1');
    return json(row || {});
  });

  app.put('/api/dist', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json();
    await dbRun(c.env.DB, 'UPDATE dist_info SET name=?,address=?,phone=?,mobile=?,email=?,gst=?,license=? WHERE id=1',
      [d.name, d.address, d.phone, d.mobile, d.email, d.gst, d.license]);
    return json({ ok: true });
  });

  app.get('/api/dist-settings', authMiddleware, async (c) => {
    const d = await dbGet(c.env.DB, 'SELECT * FROM dist_info WHERE id=1');
    return json(d || {});
  });

  app.post('/api/dist-settings', authMiddleware, adminMiddleware, async (c) => {
    const b = await c.req.json();
    await dbRun(c.env.DB,
      'UPDATE dist_info SET name=COALESCE(?,name),address=COALESCE(?,address),phone=COALESCE(?,phone),email=COALESCE(?,email),upi=COALESCE(?,upi),gst=COALESCE(?,gst),license=COALESCE(?,license) WHERE id=1',
      [b.name||null, b.address||null, b.phone||null, b.email||null, b.upi||null, b.gst||null, b.license||null]);
    const updated = await dbGet(c.env.DB, 'SELECT * FROM dist_info WHERE id=1');
    await auditLog(c.env.DB, 'DIST_SETTINGS_UPDATED', c.get('user').id, 'admin', 'UPI: '+b.upi);
    return json({ ok: true, settings: updated });
  });

  // ── Distributor Stock ─────────────────────────────────────────
  app.get('/api/dist-stock', authMiddleware, adminMiddleware, async (c) => {
    return json(await dbAll(c.env.DB, 'SELECT * FROM dist_stock ORDER BY created_at DESC'));
  });

  app.post('/api/dist-stock', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json(); const id = 'STK-' + uid();
    await dbRun(c.env.DB, 'INSERT INTO dist_stock VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, d.name, d.category||'General', d.mfr||'', d.price||0, d.mrp||0, d.stock||0, d.min_stock||10, d.unit||'Strip', d.expiry||'', new Date().toISOString()]);
    return json({ ok: true, id });
  });

  app.put('/api/dist-stock/:sid', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json();
    await dbRun(c.env.DB, 'UPDATE dist_stock SET name=?,category=?,mfr=?,price=?,mrp=?,stock=?,min_stock=?,unit=?,expiry=? WHERE id=?',
      [d.name, d.category, d.mfr, d.price, d.mrp, d.stock, d.min_stock, d.unit, d.expiry, c.req.param('sid')]);
    return json({ ok: true });
  });

  app.delete('/api/dist-stock/:sid', authMiddleware, adminMiddleware, async (c) => {
    await dbRun(c.env.DB, 'DELETE FROM dist_stock WHERE id=?', [c.req.param('sid')]);
    return json({ ok: true });
  });

  // ── Admin Team ────────────────────────────────────────────────
  app.get('/api/admins', authMiddleware, adminMiddleware, async (c) => {
    return json(await dbAll(c.env.DB, 'SELECT id,name,email,created_at,is_super FROM admins ORDER BY created_at'));
  });

  app.post('/api/admins', authMiddleware, adminMiddleware, async (c) => {
    const user = c.get('user');
    if (!user.isSuper) return err('Only the super admin can create new admins.', 403);
    const { name, email, password } = await c.req.json();
    if (!name || !email || !password) return err('Name, email and password are required.');
    if (password.length < 8) return err('Password must be at least 8 characters.');
    const em = email.trim().toLowerCase();
    const existing = await dbGet(c.env.DB, 'SELECT id FROM admins WHERE email=?', [em]);
    if (existing) return err('An admin with this email already exists.', 409);
    const aid = 'adm' + uid();
    await dbRun(c.env.DB, 'INSERT INTO admins (id,name,email,pass_hash,created_at,is_super) VALUES (?,?,?,?,?,?)',
      [aid, name.trim(), em, await hash(password), new Date().toISOString(), 0]);
    await auditLog(c.env.DB, 'ADMIN_CREATED', user.id, 'admin', `${name} (${em})`);
    return json({ ok: true, id: aid, msg: `Admin account created for ${name}.` });
  });

  app.delete('/api/admins/:aid', authMiddleware, adminMiddleware, async (c) => {
    const user = c.get('user'); const aid = c.req.param('aid');
    if (!user.isSuper) return err('Only the super admin can delete admins.', 403);
    if (aid === user.id) return err('You cannot delete your own account.');
    const adm = await dbGet(c.env.DB, 'SELECT * FROM admins WHERE id=?', [aid]);
    if (!adm) return err('Admin not found.', 404);
    if (adm.is_super) return err('Cannot delete the super admin account.');
    await dbRun(c.env.DB, 'DELETE FROM admins WHERE id=?', [aid]);
    await dbRun(c.env.DB, 'UPDATE sessions SET revoked=1 WHERE user_id=?', [aid]);
    await auditLog(c.env.DB, 'ADMIN_DELETED', user.id, 'admin', adm.email);
    return json({ ok: true, msg: 'Admin account removed.' });
  });

  // ── Pharmacies ────────────────────────────────────────────────
  app.get('/api/pharmacies', authMiddleware, async (c) => {
    const rows = await dbAll(c.env.DB, 'SELECT * FROM pharmacies ORDER BY joined DESC');
    const result = rows.map(r => ({ ...r, docs: parseJSON(r.docs), waived: !!r.waived, planExpiry: r.plan_expiry, phId: r.id }));
    result.forEach(r => delete r.pass_hash);
    return json(result);
  });

  app.post('/api/pharmacies', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json(); const pid = 'ph' + uid(); const db = c.env.DB;
    const pw = d.password || 'pharma123';
    await dbRun(db, 'INSERT INTO pharmacies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [pid, d.name, d.address||'', d.license||'', d.contact||'', d.email,
       await hash(pw), d.plan||null, d.planExpiry||null,
       d.waived ? 1 : 0, d.status||'active', d.joined||new Date().toISOString().slice(0,10),
       JSON.stringify(d.docs||[]), d.ph_type||'retail', d.gstin||null, d.wa_number||null]);
    await auditLog(db, 'PHARMACY_CREATED', c.get('user').id, 'admin', `${d.name} (${d.email})`);
    const dist = await dbGet(db, 'SELECT * FROM dist_info WHERE id=1');
    const APP_URL = c.env.APP_URL || 'https://pharmadist-pro.pages.dev';
    const welcomeHtml = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#0E1826;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#6C63FF,#00D4FF);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:8px 0 4px">Welcome to PharmaDist Pro!</h1>
      </div>
      <div style="padding:32px;color:#E8F0FE">
        <p>Hi <strong>${d.name}</strong>,</p>
        <p style="color:#7B9CC4">Your account has been created. Login with:<br><strong>Email:</strong> ${d.email}<br><strong>Password:</strong> ${pw}</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${APP_URL}" style="padding:14px 32px;background:linear-gradient(135deg,#6C63FF,#00D4FF);color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Login Now</a>
        </div>
      </div>
    </div>`;
    await sendMail(c.env.RESEND_API_KEY, d.email, `Welcome to ${dist?.name||'PharmaDist Pro'}`, welcomeHtml);
    return json({ ok: true, id: pid });
  });

  app.get('/api/pharmacies/:pid', authMiddleware, async (c) => {
    const r = await dbGet(c.env.DB, 'SELECT * FROM pharmacies WHERE id=?', [c.req.param('pid')]);
    if (!r) return err('Not found', 404);
    const result = { ...r, docs: parseJSON(r.docs), waived: !!r.waived };
    delete result.pass_hash;
    return json(result);
  });

  app.put('/api/pharmacies/:pid', authMiddleware, adminMiddleware, async (c) => {
    const d = await c.req.json(); const pid = c.req.param('pid'); const db = c.env.DB;
    await dbRun(db, 'UPDATE pharmacies SET name=?,address=?,license=?,contact=?,email=?,plan=?,plan_expiry=?,waived=?,status=?,docs=? WHERE id=?',
      [d.name, d.address, d.license, d.contact, d.email, d.plan||null, d.planExpiry||null, d.waived ? 1 : 0, d.status, JSON.stringify(d.docs||[]), pid]);
    if (d.password) await dbRun(db, 'UPDATE pharmacies SET pass_hash=? WHERE id=?', [await hash(d.password), pid]);
    await auditLog(db, 'PHARMACY_UPDATED', c.get('user').id, 'admin', pid);
    return json({ ok: true });
  });

  app.delete('/api/pharmacies/:pid', authMiddleware, adminMiddleware, async (c) => {
    await dbRun(c.env.DB, 'DELETE FROM pharmacies WHERE id=?', [c.req.param('pid')]);
    await auditLog(c.env.DB, 'PHARMACY_DELETED', c.get('user').id, 'admin', c.req.param('pid'));
    return json({ ok: true });
  });

  app.post('/api/pharmacies/:pid/waive', authMiddleware, adminMiddleware, async (c) => {
    const pid = c.req.param('pid');
    const row = await dbGet(c.env.DB, 'SELECT waived FROM pharmacies WHERE id=?', [pid]);
    if (!row) return err('Not found', 404);
    const newVal = row.waived ? 0 : 1;
    await dbRun(c.env.DB, 'UPDATE pharmacies SET waived=? WHERE id=?', [newVal, pid]);
    return json({ ok: true, waived: !!newVal });
  });

  app.post('/api/pharmacies/:pid/docs', authMiddleware, async (c) => {
    const d = await c.req.json(); const pid = c.req.param('pid');
    const row = await dbGet(c.env.DB, 'SELECT docs FROM pharmacies WHERE id=?', [pid]);
    const docs = parseJSON(row?.docs);
    docs.push({ id: 'doc' + uid(), name: d.name, date: d.date||'', size: d.size||'' });
    await dbRun(c.env.DB, 'UPDATE pharmacies SET docs=? WHERE id=?', [JSON.stringify(docs), pid]);
    return json({ ok: true, docs });
  });

  app.patch('/api/pharmacies/:pid/type', authMiddleware, adminMiddleware, async (c) => {
    const { ph_type, gstin, wa_number } = await c.req.json();
    await dbRun(c.env.DB, 'UPDATE pharmacies SET ph_type=COALESCE(?,ph_type),gstin=COALESCE(?,gstin),wa_number=COALESCE(?,wa_number) WHERE id=?',
      [ph_type||null, gstin||null, wa_number||null, c.req.param('pid')]);
    return json({ ok: true });
  });

  // ── Drugs ─────────────────────────────────────────────────────
  app.get('/api/drugs', authMiddleware, async (c) => {
    const phId = c.req.query('phId');
    const rows = phId
      ? await dbAll(c.env.DB, 'SELECT * FROM drugs WHERE ph_id=?', [phId])
      : await dbAll(c.env.DB, 'SELECT * FROM drugs');
    return json(rows.map(r => ({ ...r, phId: r.ph_id, min: r.min_qty })));
  });

  app.post('/api/drugs', authMiddleware, async (c) => {
    const d = await c.req.json(); const did = 'g' + uid();
    await dbRun(c.env.DB, 'INSERT INTO drugs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [did, d.phId, d.name, d.gen||'', d.cat||'Other', d.mfr||'', d.batch||'', d.qty, d.min||50, d.price||0, d.mrp||0, d.exp, d.bc||'']);
    return json({ ok: true, id: did });
  });

  app.put('/api/drugs/:did', authMiddleware, async (c) => {
    const d = await c.req.json();
    await dbRun(c.env.DB, 'UPDATE drugs SET name=?,cat=?,qty=?,min_qty=?,price=?,mrp=?,batch=?,exp=?,gen=?,mfr=?,bc=? WHERE id=?',
      [d.name, d.cat, d.qty, d.min, d.price, d.mrp, d.batch, d.exp, d.gen, d.mfr, d.bc, c.req.param('did')]);
    return json({ ok: true });
  });

  app.delete('/api/drugs/:did', authMiddleware, async (c) => {
    await dbRun(c.env.DB, 'DELETE FROM drugs WHERE id=?', [c.req.param('did')]);
    return json({ ok: true });
  });
}

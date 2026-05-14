// Auth routes: login, register, forgot/reset password, logout, sessions, me
import { uid, hash, signJWT, dbGet, dbAll, dbRun, auditLog, sendMail, json, err } from '../utils.js';
import { authMiddleware } from '../middleware.js';

export function registerAuthRoutes(app) {

  // ── Login ────────────────────────────────────────────────────
  app.post('/api/login', async (c) => {
    const body = await c.req.json();
    const { role, email = '', password = '', rememberMe = false, device = 'Web Browser' } = body;
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    if (!em || !pw) return err('Email and password are required.');
    const db = c.env.DB;
    const JWT_SECRET = c.env.JWT_SECRET || 'pharmadist_jwt_secret_2026_change_in_production!';

    let userData;
    if (role === 'admin') {
      const pwHash = await hash(pw);
      const adm = await dbGet(db, 'SELECT * FROM admins WHERE email=?', [em]);
      if (!adm || adm.pass_hash !== pwHash) {
        await auditLog(db, 'LOGIN_FAILED', em, 'admin', 'Wrong credentials');
        return err('Invalid admin credentials.', 401);
      }
      userData = { id: adm.id, name: adm.name, email: adm.email, role: 'admin', init: adm.name[0].toUpperCase(), isSuper: !!adm.is_super };
    } else {
      const ph = await dbGet(db, 'SELECT * FROM pharmacies WHERE email=? AND pass_hash=?', [em, await hash(pw)]);
      if (!ph) { await auditLog(db, 'LOGIN_FAILED', em, 'pharmacy', 'Wrong credentials'); return err('Invalid email or password.', 401); }
      if (ph.status === 'suspended') return err('Account suspended. Please contact support.', 403);
      if (ph.status === 'pending')   return err('Account pending admin approval.', 403);
      userData = { id: ph.id, name: ph.name, email: ph.email, role: 'pharmacy', init: ph.name[0], phId: ph.id };
    }

    const tokenId  = uid();
    const expiresIn = rememberMe ? '30d' : '8h';
    const token    = await signJWT({ ...userData, jti: tokenId }, JWT_SECRET, expiresIn);
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 0.34) * 86400000).toISOString();
    const ip = c.req.header('cf-connecting-ip') || 'unknown';

    await dbRun(db,
      'INSERT INTO sessions (token_id,user_id,role,device,ip,created_at,expires_at,last_seen) VALUES (?,?,?,?,?,?,?,?)',
      [tokenId, userData.id, userData.role, device, ip, new Date().toISOString(), expiresAt, new Date().toISOString()]
    );
    await auditLog(db, 'LOGIN_SUCCESS', userData.id, userData.role, `Device: ${device}`);
    return json({ ok: true, token, role: userData.role, user: userData, expiresIn });
  });

  // ── Register ─────────────────────────────────────────────────
  app.post('/api/register', async (c) => {
    const { name, email, password, contact, address, license, plan } = await c.req.json();
    const em = (email || '').trim().toLowerCase();
    if (!name || !em || !password) return err('Name, email and password are required.');
    if (password.length < 8)       return err('Password must be at least 8 characters.');
    if (!/\S+@\S+\.\S+/.test(em)) return err('Invalid email address.');
    const db = c.env.DB;
    const existing = await dbGet(db, 'SELECT id FROM pharmacies WHERE email=?', [em]);
    if (existing) return err('An account with this email already exists.', 409);
    const pid = 'ph' + uid();
    await dbRun(db,
      'INSERT INTO pharmacies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [pid, name.trim(), address || '', license || '', contact || '', em, await hash(password),
       plan || null, plan ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) : null,
       0, 'pending', new Date().toISOString().slice(0, 10), '[]', 'retail', null, null]
    );
    await auditLog(db, 'REGISTER', pid, 'pharmacy', `${name} (${em})`);
    return json({ ok: true, msg: 'Registration successful! Your account is pending admin approval.' });
  });

  // ── Forgot password ───────────────────────────────────────────
  app.post('/api/forgot-password', async (c) => {
    const { email } = await c.req.json();
    if (!email) return err('Email is required.');
    const em = email.trim().toLowerCase();
    const db = c.env.DB;
    const APP_URL = c.env.APP_URL || 'https://pharmadist-pro.pages.dev';

    let user = await dbGet(db, 'SELECT id, name FROM pharmacies WHERE email=?', [em]);
    let userType = 'pharmacy';
    if (!user) { user = await dbGet(db, 'SELECT id, name FROM admins WHERE email=?', [em]); userType = 'admin'; }
    if (!user) return json({ ok: true, msg: 'If that email is registered, a reset link has been sent.' });

    const resetToken = uid() + uid();
    const expiresAt  = new Date(Date.now() + 3600000).toISOString();
    await dbRun(db, 'DELETE FROM password_resets WHERE email=?', [em]);
    await dbRun(db, 'INSERT INTO password_resets (email,token,expires_at,created_at,user_type) VALUES (?,?,?,?,?)',
      [em, resetToken, expiresAt, new Date().toISOString(), userType]);
    await auditLog(db, 'PASSWORD_RESET_REQUEST', user.id, userType, em);

    const resetLink = `${APP_URL}/?reset=${resetToken}`;
    const emailHtml = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#0E1826;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#6C63FF,#00D4FF);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:8px 0 4px;font-size:1.5rem">PharmaDist Pro</h1>
        <p style="color:rgba(255,255,255,.8);margin:0">Password Reset Request</p>
      </div>
      <div style="padding:32px;color:#E8F0FE">
        <p>Hi <strong>${user.name}</strong>,</p>
        <p style="color:#7B9CC4">Click below to reset your password. Link expires in <strong>1 hour</strong>.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6C63FF,#00D4FF);color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Reset Password</a>
        </div>
        <p style="font-size:.8rem;color:#4A6080">Or copy: <a href="${resetLink}" style="color:#6C63FF">${resetLink}</a></p>
      </div>
    </div>`;

    const sent = await sendMail(c.env.RESEND_API_KEY, em, 'Reset your PharmaDist Pro password', emailHtml);
    if (sent) return json({ ok: true, msg: `Reset link sent to ${em}. Check your inbox.` });
    return json({ ok: true, resetToken, msg: 'Email service unavailable. Use the token below.' });
  });

  // ── Reset password ────────────────────────────────────────────
  app.post('/api/reset-password', async (c) => {
    const { token, password } = await c.req.json();
    if (!token || !password) return err('Token and new password are required.');
    if (password.length < 8)  return err('Password must be at least 8 characters.');
    const db = c.env.DB;
    const reset = await dbGet(db, 'SELECT * FROM password_resets WHERE token=? AND used=0', [token]);
    if (!reset) return err('Invalid or already-used reset token.');
    if (new Date(reset.expires_at) < new Date()) return err('Reset token has expired. Request a new one.');
    const userType = reset.user_type || 'pharmacy';
    const pw = await hash(password);
    if (userType === 'admin') await dbRun(db, 'UPDATE admins SET pass_hash=? WHERE email=?', [pw, reset.email]);
    else await dbRun(db, 'UPDATE pharmacies SET pass_hash=? WHERE email=?', [pw, reset.email]);
    await dbRun(db, 'UPDATE password_resets SET used=1 WHERE token=?', [token]);
    const tbl = userType === 'admin' ? 'admins' : 'pharmacies';
    const user = await dbGet(db, `SELECT id FROM ${tbl} WHERE email=?`, [reset.email]);
    if (user) await dbRun(db, 'UPDATE sessions SET revoked=1 WHERE user_id=?', [user.id]);
    await auditLog(db, 'PASSWORD_RESET_SUCCESS', reset.email, userType, '');
    return json({ ok: true, msg: 'Password reset successfully! Please sign in.' });
  });

  // ── Logout ────────────────────────────────────────────────────
  app.post('/api/logout', authMiddleware, async (c) => {
    const user = c.get('user');
    await dbRun(c.env.DB, 'UPDATE sessions SET revoked=1 WHERE token_id=?', [user.jti]);
    await auditLog(c.env.DB, 'LOGOUT', user.id, user.role, '');
    return json({ ok: true });
  });

  app.post('/api/logout-all', authMiddleware, async (c) => {
    const user = c.get('user');
    await dbRun(c.env.DB, 'UPDATE sessions SET revoked=1 WHERE user_id=?', [user.id]);
    await auditLog(c.env.DB, 'LOGOUT_ALL', user.id, user.role, 'All sessions revoked');
    return json({ ok: true });
  });

  // ── Me / sessions ─────────────────────────────────────────────
  app.get('/api/me', authMiddleware, (c) => json({ ok: true, user: c.get('user') }));

  app.get('/api/sessions', authMiddleware, async (c) => {
    const user = c.get('user');
    const rows = await dbAll(c.env.DB, 'SELECT * FROM sessions WHERE user_id=? AND revoked=0 ORDER BY created_at DESC', [user.id]);
    return json(rows.map(s => ({ ...s, isCurrent: s.token_id === user.jti })));
  });

  app.delete('/api/sessions/:sid', authMiddleware, async (c) => {
    const user = c.get('user');
    const s = await dbGet(c.env.DB, 'SELECT * FROM sessions WHERE id=? AND user_id=?', [Number(c.req.param('sid')), user.id]);
    if (!s) return err('Session not found.', 404);
    await dbRun(c.env.DB, 'UPDATE sessions SET revoked=1 WHERE id=?', [Number(c.req.param('sid'))]);
    return json({ ok: true });
  });

  // ── Change password ───────────────────────────────────────────
  app.post('/api/change-password', authMiddleware, async (c) => {
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) return err('Both fields are required.');
    if (newPassword.length < 8) return err('New password must be at least 8 characters.');
    const user = c.get('user'); const db = c.env.DB;
    if (user.role === 'admin') {
      const adm = await dbGet(db, 'SELECT * FROM admins WHERE id=? AND pass_hash=?', [user.id, await hash(currentPassword)]);
      if (!adm) return err('Current password is incorrect.');
      await dbRun(db, 'UPDATE admins SET pass_hash=? WHERE id=?', [await hash(newPassword), user.id]);
      return json({ ok: true, msg: 'Admin password changed successfully.' });
    }
    const ph = await dbGet(db, 'SELECT * FROM pharmacies WHERE id=? AND pass_hash=?', [user.phId, await hash(currentPassword)]);
    if (!ph) return err('Current password is incorrect.');
    await dbRun(db, 'UPDATE pharmacies SET pass_hash=? WHERE id=?', [await hash(newPassword), user.phId]);
    return json({ ok: true, msg: 'Password changed successfully.' });
  });
}

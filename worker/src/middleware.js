// Auth + Admin middleware for Hono
import { verifyJWT } from './utils.js';
import { dbGet } from './utils.js';

// Auth middleware — sets c.set('user', payload)
export async function authMiddleware(c, next) {
  const auth = c.req.header('authorization') || '';
  const tokenParam = new URL(c.req.url).searchParams.get('token');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : tokenParam;
  if (!token) return c.json({ ok: false, msg: 'Authentication required. Please sign in.' }, 401);
  try {
    const JWT_SECRET = c.env.JWT_SECRET || 'pharmadist_jwt_secret_2026_change_in_production!';
    const decoded = await verifyJWT(token, JWT_SECRET);
    // Check session not revoked
    const session = await dbGet(c.env.DB,
      'SELECT id FROM sessions WHERE token_id=? AND revoked=0', [decoded.jti]);
    if (!session) return c.json({ ok: false, msg: 'Session expired or revoked. Please sign in again.' }, 401);
    // Refresh last_seen
    await c.env.DB.prepare('UPDATE sessions SET last_seen=? WHERE token_id=?')
      .bind(new Date().toISOString(), decoded.jti).run();
    c.set('user', decoded);
    await next();
  } catch (e) {
    return c.json({ ok: false, msg: 'Invalid or expired token. Please sign in again.' }, 401);
  }
}

// Admin-only middleware
export async function adminMiddleware(c, next) {
  if (c.get('user')?.role !== 'admin')
    return c.json({ ok: false, msg: 'Admin access required.' }, 403);
  await next();
}

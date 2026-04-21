// ─────────────────────────────────────────────────────────────
//  PharmaDist Pro – Secure Backend Server v2.0
//  JWT Auth | Rate Limiting | Helmet | Audit Logging | SaaS
//  Uses sql.js (pure JS SQLite — no native compilation)
//  Run: node server.js
// ─────────────────────────────────────────────────────────────

'use strict';

const express     = require('express');
const cors        = require('cors');
const initSqlJs   = require('sql.js');
const fs          = require('fs');
const crypto      = require('crypto');
const path        = require('path');
const jwt         = require('jsonwebtoken');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const app     = express();
const PORT    = 5000;
const DB_PATH = path.join(__dirname, 'pharmadist.db');

// ── JWT Config ────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'pharmadist_jwt_secret_2026_change_in_production!';

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// ── Rate Limiters ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: 'Too many attempts. Please wait 15 minutes and try again.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/forgot-password', authLimiter);
app.use('/api/reset-password', authLimiter);

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── Helpers ───────────────────────────────────────────────────
const uid       = () => crypto.randomBytes(8).toString('hex');
const hash      = (pw) => crypto.createHash('sha256').update(pw).digest('hex');
const parseJSON = (val) => {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return val || [];
};

// ─────────────────────────────────────────────────────────────
// sql.js wrapper — provides a better-sqlite3-like synchronous API
// ─────────────────────────────────────────────────────────────
let db;
let _saveTimer = null;

function saveDB() {
  if (!db) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) { console.error('DB save error:', e); }
  }, 200);
}

// Convert sql.js result to array of objects
function rows(stmt) {
  const result = [];
  const cols = stmt.getColumnNames();
  while (stmt.step()) {
    const row = stmt.get();
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    result.push(obj);
  }
  stmt.free();
  return result;
}

// Query helper: returns array of row objects
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const r = rows(stmt);
  return r;
}

// Query helper: returns first row or undefined
function dbGet(sql, params = []) {
  const r = dbAll(sql, params);
  return r.length ? r[0] : undefined;
}

// Execute helper: run INSERT/UPDATE/DELETE
function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// ── Audit Logger ──────────────────────────────────────────────
function auditLog(action, userId, role, details = '') {
  try {
    dbRun('INSERT INTO audit_log (id,action,user_id,role,details,ts) VALUES (?,?,?,?,?,?)',
      [uid(), action, userId || 'system', role || 'system', details, new Date().toISOString()]);
  } catch (_) {}
}

// ── Auth Middleware ───────────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, msg: 'Authentication required. Please sign in.' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = dbGet('SELECT id FROM sessions WHERE token_id=? AND revoked=0', [decoded.jti]);
    if (!session) return res.status(401).json({ ok: false, msg: 'Session expired or revoked. Please sign in again.' });
    dbRun('UPDATE sessions SET last_seen=? WHERE token_id=?', [new Date().toISOString(), decoded.jti]);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, msg: 'Invalid or expired token. Please sign in again.' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, msg: 'Admin access required.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────
//  INIT DB & SEED
// ─────────────────────────────────────────────────────────────
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pharmacies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      license TEXT,
      contact TEXT,
      email TEXT UNIQUE,
      pass_hash TEXT,
      plan TEXT,
      plan_expiry TEXT,
      waived INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      joined TEXT,
      docs TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS dist_info (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT, address TEXT, phone TEXT, mobile TEXT,
      email TEXT, gst TEXT, license TEXT
    );

    CREATE TABLE IF NOT EXISTS drugs (
      id TEXT PRIMARY KEY,
      ph_id TEXT, name TEXT, gen TEXT, cat TEXT, mfr TEXT,
      batch TEXT, qty INTEGER, min_qty INTEGER,
      price REAL, mrp REAL, exp TEXT, bc TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      type TEXT, ph_id TEXT, ph_name TEXT,
      drugs TEXT, sub REAL, gst REAL, tot REAL,
      date TEXT, status TEXT, del TEXT,
      notes TEXT, billed INTEGER DEFAULT 0, cust TEXT
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      ph_id TEXT, ph_name TEXT, ord_id TEXT,
      amt REAL, date TEXT, due TEXT,
      status TEXT, type TEXT, paid TEXT
    );

    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      ph_id TEXT, ph_name TEXT, reason TEXT,
      drugs TEXT, date TEXT, status TEXT,
      notes TEXT, anote TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      ph_id TEXT, ph_name TEXT, subject TEXT,
      type TEXT, date TEXT, status TEXT,
      msgs TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS notifs (
      id TEXT PRIMARY KEY,
      type TEXT, msg TEXT, date TEXT,
      read INTEGER DEFAULT 0,
      admin INTEGER DEFAULT 0,
      ph TEXT
    );

    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_role TEXT, text TEXT, time TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      device TEXT,
      ip TEXT,
      created_at TEXT,
      expires_at TEXT,
      revoked INTEGER DEFAULT 0,
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT,
      user_id TEXT,
      role TEXT,
      details TEXT,
      ts TEXT
    );
  `);

  // ── Seed dist info ───────────────────────────────────────
  const distExists = dbGet('SELECT 1 as x FROM dist_info');
  if (!distExists) {
    dbRun('INSERT INTO dist_info VALUES (1,?,?,?,?,?,?,?)',
      ['PharmaDist Pro','100 Industrial Area, Pune, MH 411057',
       '+91 20 1234 5678','+91 99887 76655',
       'support@pharmadist.com','27ABCDE1234F1Z5','MH-DIST-2020-001']);
  }

  // ── Seed pharmacies ──────────────────────────────────────
  const phExists = dbGet('SELECT 1 as x FROM pharmacies');
  if (!phExists) {
    dbRun('INSERT OR IGNORE INTO pharmacies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ph1','City Pharma','45 MG Road, Bengaluru, KA 560001',
      'KAR-PH-2024-001','+91 98765 43210','citypharma@demo.com',
      hash('pharmacy123'),'1500','2026-12-31',0,'active','2024-01-15',
      '[{"id":"d1","name":"Drug License 2024.pdf","date":"2024-01-15","size":"245 KB"}]']);

    dbRun('INSERT OR IGNORE INTO pharmacies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ph2','HealthPlus Pharmacy','12 Park Street, Kolkata, WB 700016',
      'WB-PH-2024-042','+91 97654 32109','healthplus@demo.com',
      hash('health123'),'1000','2026-11-30',0,'active','2024-03-20',
      '[{"id":"d2","name":"Pharmacy License.pdf","date":"2024-03-20","size":"320 KB"}]']);

    dbRun('INSERT OR IGNORE INTO pharmacies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ph3','MediCare Pharma','78 Anna Nagar, Chennai, TN 600040',
      'TN-PH-2024-115','+91 96543 21098','medicare@demo.com',
      hash('medi123'),null,null,0,'pending','2024-06-01','[]']);

    // ── Seed drugs ─────────────────────────────────────────
    const drugData = [
      ['g1','ph1','Paracetamol 500mg','Acetaminophen','B2024001',500,100,'Analgesic','Sun Pharma',2.50,3.50,'2026-08-01','8901234567890'],
      ['g2','ph1','Amoxicillin 250mg','Amoxicillin','B2024002',35,50,'Antibiotic','Cipla',8.00,12.00,'2026-05-15','8901234568901'],
      ['g3','ph1','Metformin 500mg','Metformin HCL','B2024003',200,80,'Antidiabetic','Mankind',3.50,5.00,'2027-01-31','8901234569012'],
      ['g4','ph1','Atorvastatin 10mg','Atorvastatin','B2024004',15,60,'Statin',"Dr. Reddy's",12.00,18.00,'2026-06-30','8901234560123'],
      ['g5','ph1','Omeprazole 20mg','Omeprazole','B2024005',300,100,'PPI','Torrent Pharma',4.00,6.00,'2026-04-30','8901234561234'],
      ['g6','ph1','Cetirizine 10mg','Cetirizine','B2024006',450,100,'Antihistamine','Zydus',1.50,2.50,'2027-03-01','8901234562345'],
      ['g7','ph2','Azithromycin 500mg','Azithromycin','B2024101',80,50,'Antibiotic','Pfizer',45.00,65.00,'2026-09-30','8901234563456'],
      ['g8','ph2','Losartan 50mg','Losartan Potassium','B2024102',20,40,'Antihypertensive','Novartis',18.00,25.00,'2026-07-31','8901234564567'],
    ];
    drugData.forEach(d => dbRun('INSERT OR IGNORE INTO drugs (id,ph_id,name,gen,batch,qty,min_qty,cat,mfr,price,mrp,exp,bc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', d));

    // ── Seed orders ────────────────────────────────────────
    dbRun('INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ORD-001','inventory','ph1','City Pharma','[{"name":"Paracetamol 500mg","qty":500,"up":2.50,"tot":1250},{"name":"Metformin 500mg","qty":200,"up":3.50,"tot":700}]',1950,97.50,2047.50,'2026-04-01','delivered','free','',1,'']);

    dbRun('INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ORD-002','inventory','ph2','HealthPlus Pharmacy','[{"name":"Azithromycin 500mg","qty":100,"up":45.00,"tot":4500}]',4500,225,4725,'2026-04-05','approved','paid','',1,'']);

    dbRun('INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ORD-003','inventory','ph1','City Pharma','[{"name":"Amoxicillin 250mg","qty":100,"up":8.00,"tot":800},{"name":"Atorvastatin 10mg","qty":100,"up":12.00,"tot":1200}]',2000,100,2100,'2026-04-10','pending','paid','Urgent',0,'']);

    dbRun('INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ORD-004','customer','ph1','City Pharma','[{"name":"Paracetamol 500mg","qty":10,"up":3.50,"tot":35}]',35,1.75,36.75,'2026-04-12','delivered','','',0,'Priya Sharma']);

    dbRun('INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['ORD-005','customer','ph1','City Pharma','[{"name":"Cetirizine 10mg","qty":5,"up":2.50,"tot":12.50}]',12.50,0.63,13.13,'2026-04-14','pending','','',0,'Rahul Verma']);

    // ── Seed bills ─────────────────────────────────────────
    dbRun('INSERT OR IGNORE INTO bills VALUES (?,?,?,?,?,?,?,?,?,?)',
      ['BILL-001','ph1','City Pharma','ORD-001',2047.50,'2026-04-01','2026-04-16','paid','bulk','2026-04-05']);
    dbRun('INSERT OR IGNORE INTO bills VALUES (?,?,?,?,?,?,?,?,?,?)',
      ['BILL-002','ph2','HealthPlus Pharmacy','ORD-002',4725,'2026-04-05','2026-04-20','unpaid','bulk',null]);
    dbRun('INSERT OR IGNORE INTO bills VALUES (?,?,?,?,?,?,?,?,?,?)',
      ['BILL-003','ph1','City Pharma','ORD-003',2100,'2026-04-10','2026-04-25','unpaid','bulk',null]);

    // ── Seed returns ───────────────────────────────────────
    dbRun('INSERT OR IGNORE INTO returns VALUES (?,?,?,?,?,?,?,?,?)',
      ['RET-001','ph1','City Pharma','expired','[{"name":"Omeprazole 20mg","qty":100,"batch":"B2023005"}]','2026-04-15','pending','Batch expired before sale','']);
    dbRun('INSERT OR IGNORE INTO returns VALUES (?,?,?,?,?,?,?,?,?)',
      ['RET-002','ph2','HealthPlus Pharmacy','wrong','[{"name":"Losartan 50mg","qty":30,"batch":"B2024102"}]','2026-04-16','approved','Wrong drug delivered','Will be replaced']);

    // ── Seed tickets ───────────────────────────────────────
    dbRun('INSERT OR IGNORE INTO tickets VALUES (?,?,?,?,?,?,?,?)',
      ['TKT-001','ph1','City Pharma','Payment not reflected','billing','2026-04-14','open',
      '[{"from":"pharmacy","text":"I paid BILL-001 but status still shows unpaid","time":"10:30 AM"}]']);

    // ── Seed notifs ────────────────────────────────────────
    dbRun('INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)', ['n1','order','New order ORD-003 from City Pharma','2026-04-10',0,1,null]);
    dbRun('INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)', ['n2','return','Return RET-001 from City Pharma','2026-04-15',0,1,null]);
    dbRun('INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)', ['n3','expiry','Omeprazole 20mg expiring soon!','2026-04-19',0,0,'ph1']);
    dbRun('INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)', ['n4','stock','Atorvastatin 10mg critically low (15 units)','2026-04-19',0,0,'ph1']);
    dbRun('INSERT OR IGNORE INTO notifs VALUES (?,?,?,?,?,?,?)', ['n5','payment','BILL-003 payment due Apr 25','2026-04-19',0,0,'ph1']);

    // ── Seed chat ──────────────────────────────────────────
    dbRun('INSERT INTO chats(from_role,text,time) VALUES (?,?,?)', ['support','Hello! Welcome to PharmaDist Support. How can we help?','09:00 AM']);
  }

  saveDB();
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC ROUTES (no auth required)
// ─────────────────────────────────────────────────────────────

// Distributor info — public (shown on login page branding)
app.get('/api/dist', (req, res) => {
  const row = dbGet('SELECT * FROM dist_info WHERE id=1');
  res.json(row || {});
});

// ── LOGIN ─────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { role, email = '', password = '', rememberMe = false, device = 'Web Browser' } = req.body;
  const em = email.trim().toLowerCase();
  const pw = password.trim();

  if (!em || !pw) return res.status(400).json({ ok: false, msg: 'Email and password are required.' });

  let userData;

  if (role === 'admin') {
    if (em === 'admin@pharmadist.com' && pw === 'admin123') {
      userData = { id: 'admin', name: 'Admin', email: em, role: 'admin', init: 'AD' };
    } else {
      auditLog('LOGIN_FAILED', em, 'admin', 'Wrong credentials');
      return res.status(401).json({ ok: false, msg: 'Invalid admin credentials.' });
    }
  } else {
    const ph = dbGet('SELECT * FROM pharmacies WHERE email=? AND pass_hash=?', [em, hash(pw)]);
    if (!ph) {
      auditLog('LOGIN_FAILED', em, 'pharmacy', 'Wrong credentials');
      return res.status(401).json({ ok: false, msg: 'Invalid email or password.' });
    }
    if (ph.status === 'suspended') {
      return res.status(403).json({ ok: false, msg: 'Account suspended. Please contact support.' });
    }
    if (ph.status === 'pending') {
      return res.status(403).json({ ok: false, msg: 'Account pending admin approval. Please wait or contact your distributor.' });
    }
    userData = { id: ph.id, name: ph.name, email: ph.email, role: 'pharmacy', init: ph.name[0], phId: ph.id };
  }

  const tokenId = uid();
  const expiresIn = rememberMe ? '30d' : '8h';
  const token = jwt.sign({ ...userData, jti: tokenId }, JWT_SECRET, { expiresIn });

  const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 0.34) * 24 * 3600 * 1000).toISOString();
  dbRun('INSERT INTO sessions (token_id,user_id,role,device,ip,created_at,expires_at,last_seen) VALUES (?,?,?,?,?,?,?,?)',
    [tokenId, userData.id, userData.role, device, req.ip || 'unknown', new Date().toISOString(), expiresAt, new Date().toISOString()]);

  auditLog('LOGIN_SUCCESS', userData.id, userData.role, `Device: ${device}`);
  res.json({ ok: true, token, role: userData.role, user: userData, expiresIn });
});

// ── REGISTER ──────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { name, email, password, contact, address, license, plan } = req.body;
  const em = (email || '').trim().toLowerCase();

  if (!name || !em || !password) return res.status(400).json({ ok: false, msg: 'Name, email and password are required.' });
  if (password.length < 8)       return res.status(400).json({ ok: false, msg: 'Password must be at least 8 characters.' });
  if (!/\S+@\S+\.\S+/.test(em)) return res.status(400).json({ ok: false, msg: 'Invalid email address.' });

  const existing = dbGet('SELECT id FROM pharmacies WHERE email=?', [em]);
  if (existing) return res.status(409).json({ ok: false, msg: 'An account with this email already exists.' });

  const pid = 'ph' + uid();
  dbRun('INSERT INTO pharmacies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [pid, name.trim(), address || '', license || '', contact || '', em, hash(password),
     plan || null, plan ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString('en-CA') : null,
     0, 'pending', new Date().toLocaleDateString('en-CA'), '[]']);

  auditLog('REGISTER', pid, 'pharmacy', `${name} (${em})`);
  res.json({ ok: true, msg: 'Registration successful! Your account is pending admin approval.' });
});

// ── FORGOT PASSWORD ───────────────────────────────────────────
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, msg: 'Email is required.' });
  const em = email.trim().toLowerCase();

  const ph = dbGet('SELECT id, name, email FROM pharmacies WHERE email=?', [em]);
  if (!ph) return res.json({ ok: true, msg: 'If that email is registered, a reset token has been generated.' });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  dbRun('DELETE FROM password_resets WHERE email=?', [em]);
  dbRun('INSERT INTO password_resets (email,token,expires_at,created_at) VALUES (?,?,?,?)', [em, resetToken, expiresAt, new Date().toISOString()]);

  auditLog('PASSWORD_RESET_REQUEST', ph.id, 'pharmacy', em);
  res.json({ ok: true, msg: 'Reset token generated.', resetToken, demoNote: 'Token shown for demo – in production this would be emailed.' });
});

// ── RESET PASSWORD ────────────────────────────────────────────
app.post('/api/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ ok: false, msg: 'Token and new password are required.' });
  if (password.length < 8)  return res.status(400).json({ ok: false, msg: 'Password must be at least 8 characters.' });

  const reset = dbGet('SELECT * FROM password_resets WHERE token=? AND used=0', [token]);
  if (!reset) return res.status(400).json({ ok: false, msg: 'Invalid or already-used reset token.' });
  if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ ok: false, msg: 'Reset token expired. Please request a new one.' });

  dbRun('UPDATE pharmacies SET pass_hash=? WHERE email=?', [hash(password), reset.email]);
  dbRun('UPDATE password_resets SET used=1 WHERE token=?', [token]);

  const ph = dbGet('SELECT id FROM pharmacies WHERE email=?', [reset.email]);
  if (ph) dbRun('UPDATE sessions SET revoked=1 WHERE user_id=?', [ph.id]);

  auditLog('PASSWORD_RESET_SUCCESS', reset.email, 'pharmacy', '');
  res.json({ ok: true, msg: 'Password reset successfully. Please sign in with your new password.' });
});

// ─────────────────────────────────────────────────────────────
//  PROTECTED ROUTES (require JWT)
// ─────────────────────────────────────────────────────────────

// ── LOGOUT ────────────────────────────────────────────────────
app.post('/api/logout', authMiddleware, (req, res) => {
  dbRun('UPDATE sessions SET revoked=1 WHERE token_id=?', [req.user.jti]);
  auditLog('LOGOUT', req.user.id, req.user.role, '');
  res.json({ ok: true });
});

app.post('/api/logout-all', authMiddleware, (req, res) => {
  dbRun('UPDATE sessions SET revoked=1 WHERE user_id=?', [req.user.id]);
  auditLog('LOGOUT_ALL', req.user.id, req.user.role, 'All sessions revoked');
  res.json({ ok: true });
});

// ── ME / VALIDATE TOKEN ───────────────────────────────────────
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── SESSIONS ──────────────────────────────────────────────────
app.get('/api/sessions', authMiddleware, (req, res) => {
  const sessions = dbAll('SELECT * FROM sessions WHERE user_id=? AND revoked=0 ORDER BY created_at DESC', [req.user.id]);
  res.json(sessions.map(s => ({ ...s, isCurrent: s.token_id === req.user.jti })));
});

app.delete('/api/sessions/:sid', authMiddleware, (req, res) => {
  const s = dbGet('SELECT * FROM sessions WHERE id=? AND user_id=?', [Number(req.params.sid), req.user.id]);
  if (!s) return res.status(404).json({ ok: false, msg: 'Session not found.' });
  dbRun('UPDATE sessions SET revoked=1 WHERE id=?', [Number(req.params.sid)]);
  auditLog('SESSION_REVOKED', req.user.id, req.user.role, `Session ${req.params.sid}`);
  res.json({ ok: true });
});

// ── CHANGE PASSWORD ───────────────────────────────────────────
app.post('/api/change-password', authMiddleware, (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ ok: false, msg: 'Admin password is managed by the system.' });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ ok: false, msg: 'Both fields are required.' });
  if (newPassword.length < 8) return res.status(400).json({ ok: false, msg: 'New password must be at least 8 characters.' });

  const ph = dbGet('SELECT * FROM pharmacies WHERE id=? AND pass_hash=?', [req.user.phId, hash(currentPassword)]);
  if (!ph) return res.status(400).json({ ok: false, msg: 'Current password is incorrect.' });

  dbRun('UPDATE pharmacies SET pass_hash=? WHERE id=?', [hash(newPassword), req.user.phId]);
  auditLog('PASSWORD_CHANGED', req.user.id, 'pharmacy', '');
  res.json({ ok: true, msg: 'Password changed successfully.' });
});

// ── AUDIT LOG (admin only) ────────────────────────────────────
app.get('/api/audit-log', authMiddleware, adminMiddleware, (req, res) => {
  const logs = dbAll('SELECT * FROM audit_log ORDER BY ts DESC LIMIT 200');
  res.json(logs);
});

// ── SAAS ANALYTICS (admin only) ──────────────────────────────
app.get('/api/admin/analytics', authMiddleware, adminMiddleware, (req, res) => {
  res.json({
    totalPharmacies:     dbGet("SELECT COUNT(*) as c FROM pharmacies").c,
    activePharmacies:    dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE status='active'").c,
    pendingPharmacies:   dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE status='pending'").c,
    suspendedPharmacies: dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE status='suspended'").c,
    totalRevenue:        dbGet("SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE status='paid'").t,
    pendingRevenue:      dbGet("SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE status='unpaid'").t,
    premiumSubs:         dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE plan='1500'").c,
    basicSubs:           dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE plan='1000'").c,
    totalOrders:         dbGet("SELECT COUNT(*) as c FROM orders WHERE type='inventory'").c,
    totalDrugs:          dbGet("SELECT COUNT(*) as c FROM drugs").c,
    activeSessions:      dbGet('SELECT COUNT(*) as c FROM sessions WHERE revoked=0').c,
    totalLogins:         dbGet("SELECT COUNT(*) as c FROM audit_log WHERE action='LOGIN_SUCCESS'").c,
  });
});

// ── DISTRIBUTOR INFO (protected update) ──────────────────────
app.put('/api/dist', authMiddleware, adminMiddleware, (req, res) => {
  const d = req.body;
  dbRun('UPDATE dist_info SET name=?,address=?,phone=?,mobile=?,email=?,gst=?,license=? WHERE id=1',
    [d.name, d.address, d.phone, d.mobile, d.email, d.gst, d.license]);
  res.json({ ok: true });
});

// ── PHARMACIES ────────────────────────────────────────────────
app.get('/api/pharmacies', authMiddleware, (req, res) => {
  const rows2 = dbAll('SELECT * FROM pharmacies ORDER BY joined DESC');
  const result = rows2.map(r => ({ ...r, docs: parseJSON(r.docs), waived: Boolean(r.waived), planExpiry: r.plan_expiry, phId: r.id }));
  result.forEach(r => delete r.pass_hash);
  res.json(result);
});

app.post('/api/pharmacies', authMiddleware, adminMiddleware, (req, res) => {
  const d = req.body;
  const pid = 'ph' + uid();
  dbRun('INSERT INTO pharmacies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [pid, d.name, d.address||'', d.license||'', d.contact||'', d.email,
     hash(d.password||'pharma123'), d.plan||null, d.planExpiry||null,
     d.waived ? 1 : 0, d.status||'active', d.joined||'', JSON.stringify(d.docs||[])]);
  auditLog('PHARMACY_CREATED', req.user.id, 'admin', `${d.name} (${d.email})`);
  res.json({ ok: true, id: pid });
});

app.get('/api/pharmacies/:pid', authMiddleware, (req, res) => {
  const r = dbGet('SELECT * FROM pharmacies WHERE id=?', [req.params.pid]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const result = { ...r, docs: parseJSON(r.docs), waived: Boolean(r.waived) };
  delete result.pass_hash;
  res.json(result);
});

app.put('/api/pharmacies/:pid', authMiddleware, adminMiddleware, (req, res) => {
  const d = req.body, { pid } = req.params;
  dbRun('UPDATE pharmacies SET name=?,address=?,license=?,contact=?,email=?,plan=?,plan_expiry=?,waived=?,status=?,docs=? WHERE id=?',
    [d.name, d.address, d.license, d.contact, d.email, d.plan||null, d.planExpiry||null, d.waived ? 1 : 0, d.status, JSON.stringify(d.docs||[]), pid]);
  if (d.password) dbRun('UPDATE pharmacies SET pass_hash=? WHERE id=?', [hash(d.password), pid]);
  auditLog('PHARMACY_UPDATED', req.user.id, 'admin', pid);
  res.json({ ok: true });
});

app.delete('/api/pharmacies/:pid', authMiddleware, adminMiddleware, (req, res) => {
  dbRun('DELETE FROM pharmacies WHERE id=?', [req.params.pid]);
  auditLog('PHARMACY_DELETED', req.user.id, 'admin', req.params.pid);
  res.json({ ok: true });
});

app.post('/api/pharmacies/:pid/waive', authMiddleware, adminMiddleware, (req, res) => {
  const row = dbGet('SELECT waived FROM pharmacies WHERE id=?', [req.params.pid]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const newVal = row.waived ? 0 : 1;
  dbRun('UPDATE pharmacies SET waived=? WHERE id=?', [newVal, req.params.pid]);
  res.json({ ok: true, waived: Boolean(newVal) });
});

app.post('/api/pharmacies/:pid/docs', authMiddleware, (req, res) => {
  const d = req.body, { pid } = req.params;
  const row = dbGet('SELECT docs FROM pharmacies WHERE id=?', [pid]);
  const docs = parseJSON(row ? row.docs : '[]');
  docs.push({ id: 'doc' + uid(), name: d.name, date: d.date||'', size: d.size||'' });
  dbRun('UPDATE pharmacies SET docs=? WHERE id=?', [JSON.stringify(docs), pid]);
  res.json({ ok: true, docs });
});

// ── DRUGS ─────────────────────────────────────────────────────
app.get('/api/drugs', authMiddleware, (req, res) => {
  const { phId } = req.query;
  const rows2 = phId ? dbAll('SELECT * FROM drugs WHERE ph_id=?', [phId]) : dbAll('SELECT * FROM drugs');
  res.json(rows2.map(r => ({ ...r, phId: r.ph_id, min: r.min_qty })));
});

app.post('/api/drugs', authMiddleware, (req, res) => {
  const d = req.body, did = 'g' + uid();
  dbRun('INSERT INTO drugs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [did, d.phId, d.name, d.gen||'', d.batch||'', d.qty, d.min||50, d.cat||'Other', d.mfr||'', d.price||0, d.mrp||0, d.exp, d.bc||'']);
  res.json({ ok: true, id: did });
});

app.put('/api/drugs/:did', authMiddleware, (req, res) => {
  const d = req.body, { did } = req.params;
  dbRun('UPDATE drugs SET name=?,cat=?,qty=?,min_qty=?,price=?,mrp=?,batch=?,exp=?,gen=?,mfr=?,bc=? WHERE id=?', [d.name, d.cat, d.qty, d.min, d.price, d.mrp, d.batch, d.exp, d.gen, d.mfr, d.bc, did]);
  res.json({ ok: true });
});

app.delete('/api/drugs/:did', authMiddleware, (req, res) => {
  dbRun('DELETE FROM drugs WHERE id=?', [req.params.did]);
  res.json({ ok: true });
});

// ── ORDERS ────────────────────────────────────────────────────
app.get('/api/orders', authMiddleware, (req, res) => {
  const { phId, type } = req.query;
  let sql = 'SELECT * FROM orders';
  const conds = [], params = [];
  if (phId) { conds.push('ph_id=?'); params.push(phId); }
  if (type) { conds.push('type=?');  params.push(type); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY date DESC';
  const rows2 = dbAll(sql, params);
  res.json(rows2.map(r => ({ ...r, drugs: parseJSON(r.drugs), billed: Boolean(r.billed), phId: r.ph_id, phName: r.ph_name, ordId: null })));
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const d = req.body, oid = 'ORD-' + uid();
  dbRun('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [oid, d.type, d.phId, d.phName, JSON.stringify(d.drugs||[]), d.sub||0, d.gst||0, d.tot||0, d.date||'', d.status||'pending', d.del||'paid', d.notes||'', 0, d.cust||'']);
  res.json({ ok: true, id: oid });
});

app.get('/api/orders/:oid', authMiddleware, (req, res) => {
  const r = dbGet('SELECT * FROM orders WHERE id=?', [req.params.oid]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ ...r, drugs: parseJSON(r.drugs), billed: Boolean(r.billed) });
});

app.put('/api/orders/:oid', authMiddleware, (req, res) => {
  const d = req.body, { oid } = req.params;
  if ('status' in d) dbRun('UPDATE orders SET status=? WHERE id=?', [d.status, oid]);
  if ('billed' in d) dbRun('UPDATE orders SET billed=? WHERE id=?', [d.billed ? 1 : 0, oid]);
  res.json({ ok: true });
});

// ── BILLS ─────────────────────────────────────────────────────
app.get('/api/bills', authMiddleware, (req, res) => {
  const { phId } = req.query;
  const rows2 = phId ? dbAll('SELECT * FROM bills WHERE ph_id=? ORDER BY date DESC', [phId]) : dbAll('SELECT * FROM bills ORDER BY date DESC');
  res.json(rows2.map(r => ({ ...r, phId: r.ph_id, phName: r.ph_name, ordId: r.ord_id })));
});

app.post('/api/bills', authMiddleware, (req, res) => {
  const d = req.body, bid = 'BILL-' + uid();
  dbRun('INSERT INTO bills VALUES (?,?,?,?,?,?,?,?,?,?)', [bid, d.phId, d.phName, d.ordId||'MANUAL', d.amt, d.date, d.due, 'unpaid', d.type||'bulk', null]);
  res.json({ ok: true, id: bid });
});

app.put('/api/bills/:bid', authMiddleware, (req, res) => {
  const d = req.body, { bid } = req.params;
  if (d.status === 'paid') dbRun("UPDATE bills SET status='paid', paid=? WHERE id=?", [d.paid||'', bid]);
  res.json({ ok: true });
});

// ── RETURNS ───────────────────────────────────────────────────
app.get('/api/returns', authMiddleware, (req, res) => {
  const { phId } = req.query;
  const rows2 = phId ? dbAll('SELECT * FROM returns WHERE ph_id=? ORDER BY date DESC', [phId]) : dbAll('SELECT * FROM returns ORDER BY date DESC');
  res.json(rows2.map(r => ({ ...r, drugs: parseJSON(r.drugs), phId: r.ph_id, phName: r.ph_name })));
});

app.post('/api/returns', authMiddleware, (req, res) => {
  const d = req.body, rid = 'RET-' + uid();
  dbRun('INSERT INTO returns VALUES (?,?,?,?,?,?,?,?,?)', [rid, d.phId, d.phName, d.reason, JSON.stringify(d.drugs||[]), d.date, 'pending', d.notes||'', '']);
  res.json({ ok: true, id: rid });
});

app.put('/api/returns/:rid', authMiddleware, (req, res) => {
  const d = req.body, { rid } = req.params;
  dbRun('UPDATE returns SET status=?,anote=? WHERE id=?', [d.status, d.anote||'', rid]);
  res.json({ ok: true });
});

// ── TICKETS ───────────────────────────────────────────────────
app.get('/api/tickets', authMiddleware, (req, res) => {
  const { phId } = req.query;
  const rows2 = phId ? dbAll('SELECT * FROM tickets WHERE ph_id=? ORDER BY date DESC', [phId]) : dbAll('SELECT * FROM tickets ORDER BY date DESC');
  res.json(rows2.map(r => ({ ...r, msgs: parseJSON(r.msgs), phId: r.ph_id, phName: r.ph_name })));
});

app.post('/api/tickets', authMiddleware, (req, res) => {
  const d = req.body, tid = 'TKT-' + uid();
  dbRun('INSERT INTO tickets VALUES (?,?,?,?,?,?,?,?)', [tid, d.phId, d.phName, d.subject, d.type||'other', d.date, 'open', JSON.stringify(d.msgs||[])]);
  res.json({ ok: true, id: tid });
});

app.put('/api/tickets/:tid', authMiddleware, (req, res) => {
  const d = req.body, { tid } = req.params;
  if ('msgs'   in d) dbRun('UPDATE tickets SET msgs=?   WHERE id=?', [JSON.stringify(d.msgs), tid]);
  if ('status' in d) dbRun('UPDATE tickets SET status=? WHERE id=?', [d.status, tid]);
  res.json({ ok: true });
});

// ── NOTIFICATIONS ─────────────────────────────────────────────
app.get('/api/notifs', authMiddleware, (req, res) => {
  const { role, phId } = req.query;
  const rows2 = role === 'admin'
    ? dbAll('SELECT * FROM notifs WHERE admin=1 ORDER BY date DESC')
    : dbAll('SELECT * FROM notifs WHERE admin=0 AND (ph IS NULL OR ph=?) ORDER BY date DESC', [phId]);
  res.json(rows2.map(r => ({ ...r, read: Boolean(r.read), admin: Boolean(r.admin) })));
});

app.post('/api/notifs', authMiddleware, (req, res) => {
  const d = req.body, nid = 'n' + uid();
  dbRun('INSERT INTO notifs VALUES (?,?,?,?,?,?,?)', [nid, d.type, d.msg, d.date||'', 0, d.admin ? 1 : 0, d.ph||null]);
  res.json({ ok: true, id: nid });
});

app.post('/api/notifs/read-all', authMiddleware, (req, res) => {
  const d = req.body;
  if (d.role === 'admin') dbRun('UPDATE notifs SET read=1 WHERE admin=1');
  else dbRun('UPDATE notifs SET read=1 WHERE ph=? OR ph IS NULL', [d.phId||null]);
  res.json({ ok: true });
});

// ── CHAT ──────────────────────────────────────────────────────
app.get('/api/chats', authMiddleware, (req, res) => {
  res.json(dbAll('SELECT * FROM chats ORDER BY id'));
});

app.post('/api/chats', authMiddleware, (req, res) => {
  const d = req.body;
  dbRun('INSERT INTO chats(from_role,text,time) VALUES (?,?,?)', [d.from, d.text, d.time]);
  res.json({ ok: true });
});

// ── SPA Catch-all (must be AFTER all API routes) ──────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ─────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────
async function main() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  initDB();

  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '═'.repeat(52));
    console.log('  🔒 PharmaDist Pro — Secure Server v2.0');
    console.log(`  🌐 http://localhost:${PORT}`);
    console.log('  ✅ JWT Auth  |  Rate Limiting  |  Audit Log');
    console.log('  ⚙️  JWT_SECRET: ' + (process.env.JWT_SECRET ? 'from ENV' : 'default (change in prod!)'));
    console.log('═'.repeat(52) + '\n');
  });

  // Save DB on shutdown
  process.on('SIGINT', () => {
    if (db) { const data = db.export(); fs.writeFileSync(DB_PATH, Buffer.from(data)); }
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    if (db) { const data = db.export(); fs.writeFileSync(DB_PATH, Buffer.from(data)); }
    process.exit(0);
  });
}

main().catch(e => { console.error('Failed to start:', e); process.exit(1); });

// ─────────────────────────────────────────────────────────────
//  PharmaDist Pro – Secure Backend Server v4.0
//  JWT Auth | Rate Limiting | Helmet | Audit | Email | SSE
//  Database: PostgreSQL (via pg driver) | nodemailer
//  Run: node server.js
// ─────────────────────────────────────────────────────────────

'use strict';

const express      = require('express');
const cors         = require('cors');
const crypto       = require('crypto');
const path         = require('path');
const jwt          = require('jsonwebtoken');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const { Pool }     = require('pg');
const nodemailer   = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── PostgreSQL Connection ─────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
});

// ── JWT & Admin Config ───────────────────────────────────────
const JWT_SECRET    = process.env.JWT_SECRET    || 'pharmadist_jwt_secret_2026_change_in_production!';
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL   || 'admin@pharmadist.com';
const ADMIN_PASSWORD= process.env.ADMIN_PASSWORD|| 'admin123';

// Warn if using default JWT secret (security risk in production)
if (JWT_SECRET === 'pharmadist_jwt_secret_2026_change_in_production!') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET! Set JWT_SECRET env var before going live.');
}

// ── Email Config ─────────────────────────────────────────────
// Primary: Resend API (HTTP — works on Railway, no SMTP port issues)
// Fallback: nodemailer SMTP
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@pharmadist.com';
const APP_URL   = process.env.APP_URL   || 'https://web-production-e4fbb.up.railway.app';

// Set up nodemailer as fallback (if SMTP vars set)
let mailer = null;
if (!RESEND_API_KEY && SMTP_HOST && SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    tls: { rejectUnauthorized: false },
  });
  console.log(`📧 Email (SMTP/nodemailer): ${SMTP_USER} via ${SMTP_HOST}:${SMTP_PORT}`);
} else if (RESEND_API_KEY) {
  console.log('📧 Email (Resend API): configured ✅');
} else {
  console.log('ℹ️  Email not configured — password reset returns token in JSON.');
}

async function sendMail(to, subject, html) {
  // Try Resend API first (HTTP — no port blocking)
  if (RESEND_API_KEY) {
    try {
      // Free tier requires using onboarding@resend.dev until a domain is verified
      const fromAddr = 'PharmaDist Pro <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddr, to: [to], subject, html }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (res.ok) { console.log('📧 Resend email sent to', to, '— id:', data.id); return true; }
      console.error('Resend API error:', data);
      return false;
    } catch (e) { console.error('Resend send error:', e.message); return false; }
  }
  // Fallback: nodemailer SMTP
  if (!mailer) return false;
  try {
    const result = await Promise.race([
      mailer.sendMail({ from: `"PharmaDist Pro" <${SMTP_FROM}>`, to, subject, html }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP timeout 12s')), 12000)),
    ]);
    console.log('📧 SMTP email sent to', to, '— id:', result.messageId);
    return true;
  } catch (e) { console.error('SMTP send error:', e.message); return false; }
}



// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS — allow Railway, GitHub Pages, and localhost
const ALLOWED_ORIGINS = [
  'https://web-production-e4fbb.up.railway.app',
  'https://vishal01124.github.io',
  'http://localhost:5000', 'http://localhost:3000', 'http://127.0.0.1:5000',
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',') : []),
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('CORS: origin not allowed: ' + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// ── SSE — Real-time notification clients ──────────────────────
const sseClients = new Map(); // key: userId, value: Set of res objects

function ssePush(userId, event, data) {
  const clients = sseClients.get(userId);
  if (clients) clients.forEach(res => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  });
}
function sseBroadcastAdmin(event, data) {
  sseClients.forEach((clients, uid) => {
    clients.forEach(res => {
      if (res._pharmRole === 'admin') {
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
      }
    });
  });
}

// SSE subscribe endpoint
app.get('/api/sse', authMiddlewareSSE, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res._pharmRole = req.user.role;
  const uid = req.user.id;
  if (!sseClients.has(uid)) sseClients.set(uid, new Set());
  sseClients.get(uid).add(res);
  res.write(`event: connected\ndata: {"ok":true}\n\n`);
  const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(hb); } }, 25000);
  req.on('close', () => {
    clearInterval(hb);
    sseClients.get(uid)?.delete(res);
    if (sseClients.get(uid)?.size === 0) sseClients.delete(uid);
  });
});

// SSE auth middleware (non-blocking — doesn't call next on fail for SSE)
function authMiddlewareSSE(req, res, next) {
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).end();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).end(); }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 50,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: 'Too many attempts. Please wait 15 minutes.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/forgot-password', authLimiter);
app.use('/api/reset-password', authLimiter);

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── Health/debug endpoint (temporary) ─────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: '4.0',
    resend: process.env.RESEND_API_KEY ? '✅ set (hidden)' : '❌ missing',
    smtp: {
      host:    process.env.SMTP_HOST   ? '✅ set (' + process.env.SMTP_HOST + ')' : '❌ missing',
      port:    process.env.SMTP_PORT   ? '✅ set (' + process.env.SMTP_PORT + ')' : '❌ missing (default 587)',
      user:    process.env.SMTP_USER   ? '✅ set (' + process.env.SMTP_USER + ')' : '❌ missing',
      pass:    process.env.SMTP_PASS   ? '✅ set (hidden)' : '❌ missing',
      from:    process.env.SMTP_FROM   ? '✅ set (' + process.env.SMTP_FROM + ')' : '❌ missing',
      mailerReady: mailer !== null ? '✅ mailer created' : '❌ mailer is null',
    },
    jwt:     process.env.JWT_SECRET   ? '✅ custom secret set' : '⚠️ default secret!',
    db:      process.env.DATABASE_URL ? '✅ set' : '❌ missing',
    appUrl:  process.env.APP_URL      || 'not set',
  });
});

// ── Helpers ───────────────────────────────────────────────────
const uid       = () => crypto.randomBytes(8).toString('hex');
const hash      = (pw) => crypto.createHash('sha256').update(pw).digest('hex');
const parseJSON = (val) => {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return val || [];
};

// ── DB Helpers (async) ───────────────────────────────────────
async function dbAll(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}
async function dbGet(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0];
}
async function dbRun(sql, params = []) {
  await pool.query(sql, params);
}

// ── Audit Logger ──────────────────────────────────────────────
async function auditLog(action, userId, role, details = '') {
  try {
    await dbRun(
      'INSERT INTO audit_log (id,action,user_id,role,details,ts) VALUES ($1,$2,$3,$4,$5,$6)',
      [uid(), action, userId || 'system', role || 'system', details, new Date().toISOString()]
    );
  } catch (_) {}
}

// ── Auth Middleware ───────────────────────────────────────────
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ ok: false, msg: 'Authentication required. Please sign in.' });
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = await dbGet(
      'SELECT id FROM sessions WHERE token_id=$1 AND revoked=false', [decoded.jti]
    );
    if (!session)
      return res.status(401).json({ ok: false, msg: 'Session expired or revoked. Please sign in again.' });
    await dbRun('UPDATE sessions SET last_seen=$1 WHERE token_id=$2',
      [new Date().toISOString(), decoded.jti]);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, msg: 'Invalid or expired token. Please sign in again.' });
  }
}

async function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ ok: false, msg: 'Admin access required.' });
  next();
}

// ─────────────────────────────────────────────────────────────
//  INIT DB & SEED
// ─────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
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
      waived BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'active',
      joined TEXT,
      docs TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS dist_info (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT, address TEXT, phone TEXT, mobile TEXT,
      email TEXT, gst TEXT, license TEXT, upi TEXT
    );
    ALTER TABLE dist_info ADD COLUMN IF NOT EXISTS upi TEXT;
    CREATE TABLE IF NOT EXISTS dist_stock (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL, category TEXT DEFAULT 'General',
      mfr TEXT DEFAULT '', price REAL DEFAULT 0, mrp REAL DEFAULT 0,
      stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 10,
      unit TEXT DEFAULT 'Strip', expiry TEXT DEFAULT '', created_at TEXT
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
      notes TEXT, billed BOOLEAN DEFAULT false, cust TEXT
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
      read BOOLEAN DEFAULT false,
      admin BOOLEAN DEFAULT false,
      ph TEXT
    );

    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      from_role TEXT, text TEXT, time TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      token_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      device TEXT,
      ip TEXT,
      created_at TEXT,
      expires_at TEXT,
      revoked BOOLEAN DEFAULT false,
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TEXT,
      user_type TEXT DEFAULT 'pharmacy'
    );
    -- Add user_type column if missing (migration)
    ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'pharmacy';

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT,
      user_id TEXT,
      role TEXT,
      details TEXT,
      ts TEXT
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      created_at TEXT,
      is_super BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      expiry_date TEXT NOT NULL,
      created_at TEXT
    );
  `);

  // Always upsert super admin from env vars — stays in sync when env vars change
  await dbRun(`
    INSERT INTO admins (id, name, email, pass_hash, created_at, is_super)
    VALUES ($1, $2, $3, $4, $5, true)
    ON CONFLICT (id) DO UPDATE SET
      email    = EXCLUDED.email,
      pass_hash= EXCLUDED.pass_hash,
      is_super = true
  `, ['admin', 'Admin', ADMIN_EMAIL.toLowerCase(), hash(ADMIN_PASSWORD), new Date().toISOString()]);
  console.log('✅ Super admin synced:', ADMIN_EMAIL);

  // Seed dist info
  const distExists = await dbGet('SELECT 1 as x FROM dist_info LIMIT 1');
  if (!distExists) {
    await dbRun(
      'INSERT INTO dist_info VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING',
      [1,'PharmaDist Pro','100 Industrial Area, Pune, MH 411057',
       '+91 20 1234 5678','+91 99887 76655',
       'support@pharmadist.com','27ABCDE1234F1Z5','MH-DIST-2020-001',null]
    );
  }

  // Seed pharmacies
  const phExists = await dbGet('SELECT 1 as x FROM pharmacies LIMIT 1');
  if (!phExists) {
    const phData = [
      ['ph1','City Pharma','45 MG Road, Bengaluru, KA 560001','KAR-PH-2024-001','+91 98765 43210','citypharma@demo.com',hash('pharmacy123'),'1500','2026-12-31',false,'active','2024-01-15','[{"id":"d1","name":"Drug License 2024.pdf","date":"2024-01-15","size":"245 KB"}]'],
      ['ph2','HealthPlus Pharmacy','12 Park Street, Kolkata, WB 700016','WB-PH-2024-042','+91 97654 32109','healthplus@demo.com',hash('health123'),'1000','2026-11-30',false,'active','2024-03-20','[{"id":"d2","name":"Pharmacy License.pdf","date":"2024-03-20","size":"320 KB"}]'],
      ['ph3','MediCare Pharma','78 Anna Nagar, Chennai, TN 600040','TN-PH-2024-115','+91 96543 21098','medicare@demo.com',hash('medi123'),null,null,false,'pending','2024-06-01','[]'],
    ];
    for (const p of phData) {
      await dbRun(
        'INSERT INTO pharmacies VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING', p
      );
    }

    // Seed drugs
    const drugData = [
      ['g1','ph1','Paracetamol 500mg','Acetaminophen','Analgesic','Sun Pharma','B2024001',500,100,2.50,3.50,'2026-08-01','8901234567890'],
      ['g2','ph1','Amoxicillin 250mg','Amoxicillin','Antibiotic','Cipla','B2024002',35,50,8.00,12.00,'2026-05-15',''],
      ['g3','ph1','Metformin 500mg','Metformin HCL','Antidiabetic','Mankind','B2024003',200,80,3.50,5.00,'2027-01-31',''],
      ['g4','ph1','Atorvastatin 10mg','Atorvastatin','Statin',"Dr. Reddy's",'B2024004',15,60,12.00,18.00,'2026-06-30',''],
      ['g5','ph1','Omeprazole 20mg','Omeprazole','PPI','Torrent Pharma','B2024005',300,100,4.00,6.00,'2026-04-30',''],
      ['g6','ph1','Cetirizine 10mg','Cetirizine','Antihistamine','Zydus','B2024006',450,100,1.50,2.50,'2027-03-01',''],
      ['g7','ph2','Azithromycin 500mg','Azithromycin','Antibiotic','Pfizer','B2024101',80,50,45.00,65.00,'2026-09-30',''],
      ['g8','ph2','Losartan 50mg','Losartan Potassium','Antihypertensive','Novartis','B2024102',20,40,18.00,25.00,'2026-07-31',''],
    ];
    for (const d of drugData) {
      await dbRun(
        'INSERT INTO drugs (id,ph_id,name,gen,cat,mfr,batch,qty,min_qty,price,mrp,exp,bc) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING', d
      );
    }

    // Seed orders
    const orders = [
      ['ORD-001','inventory','ph1','City Pharma','[{"name":"Paracetamol 500mg","qty":500,"up":2.50,"tot":1250},{"name":"Metformin 500mg","qty":200,"up":3.50,"tot":700}]',1950,97.50,2047.50,'2026-04-01','delivered','free','',true,''],
      ['ORD-002','inventory','ph2','HealthPlus Pharmacy','[{"name":"Azithromycin 500mg","qty":100,"up":45.00,"tot":4500}]',4500,225,4725,'2026-04-05','approved','paid','',true,''],
      ['ORD-003','inventory','ph1','City Pharma','[{"name":"Amoxicillin 250mg","qty":100,"up":8.00,"tot":800},{"name":"Atorvastatin 10mg","qty":100,"up":12.00,"tot":1200}]',2000,100,2100,'2026-04-10','pending','paid','Urgent',false,''],
      ['ORD-004','customer','ph1','City Pharma','[{"name":"Paracetamol 500mg","qty":10,"up":3.50,"tot":35}]',35,1.75,36.75,'2026-04-12','delivered','','',false,'Priya Sharma'],
      ['ORD-005','customer','ph1','City Pharma','[{"name":"Cetirizine 10mg","qty":5,"up":2.50,"tot":12.50}]',12.50,0.63,13.13,'2026-04-14','pending','','',false,'Rahul Verma'],
    ];
    for (const o of orders) {
      await dbRun('INSERT INTO orders VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING', o);
    }

    // Seed bills
    const bills = [
      ['BILL-001','ph1','City Pharma','ORD-001',2047.50,'2026-04-01','2026-04-16','paid','bulk','2026-04-05'],
      ['BILL-002','ph2','HealthPlus Pharmacy','ORD-002',4725,'2026-04-05','2026-04-20','unpaid','bulk',null],
      ['BILL-003','ph1','City Pharma','ORD-003',2100,'2026-04-10','2026-04-25','unpaid','bulk',null],
    ];
    for (const b of bills) {
      await dbRun('INSERT INTO bills VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING', b);
    }

    // Seed returns
    await dbRun("INSERT INTO returns VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      ['RET-001','ph1','City Pharma','expired','[{"name":"Omeprazole 20mg","qty":100,"batch":"B2023005"}]','2026-04-15','pending','Batch expired before sale','']);
    await dbRun("INSERT INTO returns VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      ['RET-002','ph2','HealthPlus Pharmacy','wrong','[{"name":"Losartan 50mg","qty":30,"batch":"B2024102"}]','2026-04-16','approved','Wrong drug delivered','Will be replaced']);

    // Seed tickets
    await dbRun('INSERT INTO tickets VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',
      ['TKT-001','ph1','City Pharma','Payment not reflected','billing','2026-04-14','open',
       '[{"from":"pharmacy","text":"I paid BILL-001 but status still shows unpaid","time":"10:30 AM"}]']);

    // Seed notifs
    const notifs = [
      ['n1','order','New order ORD-003 from City Pharma','2026-04-10',false,true,null],
      ['n2','return','Return RET-001 from City Pharma','2026-04-15',false,true,null],
      ['n3','expiry','Omeprazole 20mg expiring soon!','2026-04-19',false,false,'ph1'],
      ['n4','stock','Atorvastatin 10mg critically low (15 units)','2026-04-19',false,false,'ph1'],
      ['n5','payment','BILL-003 payment due Apr 25','2026-04-19',false,false,'ph1'],
    ];
    for (const n of notifs) {
      await dbRun('INSERT INTO notifs VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', n);
    }

    // Seed chat
    await dbRun("INSERT INTO chats(from_role,text,time) VALUES ($1,$2,$3)",
      ['support','Hello! Welcome to PharmaDist Support. How can we help?','09:00 AM']);
  }

  // Seed products (always seed if table is empty so catalog is never blank)
  const prodExists = await dbGet('SELECT 1 as x FROM products LIMIT 1');
  if (!prodExists) {
    const now = new Date().toISOString();
    const prodData = [
      ['prod_seed_01','Paracetamol 500mg Tablets','Analgesic',3.50,500,'2026-12-31'],
      ['prod_seed_02','Amoxicillin 250mg Capsules','Antibiotic',12.00,200,'2026-09-30'],
      ['prod_seed_03','Metformin 500mg Tablets','Antidiabetic',5.00,350,'2027-03-15'],
      ['prod_seed_04','Atorvastatin 10mg Tablets','Statin',18.00,150,'2026-07-31'],
      ['prod_seed_05','Omeprazole 20mg Capsules','PPI',6.50,80,'2026-05-20'],
      ['prod_seed_06','Cetirizine 10mg Tablets','Antihistamine',2.50,0,'2027-01-10'],
      ['prod_seed_07','Azithromycin 500mg Tablets','Antibiotic',65.00,120,'2026-11-30'],
      ['prod_seed_08','Losartan 50mg Tablets','Antihypertensive',25.00,60,'2026-06-15'],
    ];
    for (const [id,name,category,price,stock,expiry_date] of prodData) {
      await dbRun(
        'INSERT INTO products (id,name,category,price,stock,expiry_date,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
        [id, name, category, price, stock, expiry_date, now]
      );
    }
    console.log('✅ Products seeded (8 sample items)');
  }
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/api/dist', async (req, res) => {
  const row = await dbGet('SELECT * FROM dist_info WHERE id=1');
  res.json(row || {});
});

// ── LOGIN ─────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { role, email = '', password = '', rememberMe = false, device = 'Web Browser' } = req.body;
  const em = email.trim().toLowerCase();
  const pw = password.trim();
  if (!em || !pw) return res.status(400).json({ ok: false, msg: 'Email and password are required.' });

  let userData;
  if (role === 'admin') {
    const adm = await dbGet('SELECT * FROM admins WHERE email=$1', [em]);
    if (!adm || adm.pass_hash !== hash(pw)) {
      await auditLog('LOGIN_FAILED', em, 'admin', 'Wrong credentials');
      return res.status(401).json({ ok: false, msg: 'Invalid admin credentials.' });
    }
    userData = { id: adm.id, name: adm.name, email: adm.email, role: 'admin', init: adm.name[0].toUpperCase(), isSuper: adm.is_super };
  } else {
    const ph = await dbGet('SELECT * FROM pharmacies WHERE email=$1 AND pass_hash=$2', [em, hash(pw)]);
    if (!ph) { await auditLog('LOGIN_FAILED', em, 'pharmacy', 'Wrong credentials'); return res.status(401).json({ ok: false, msg: 'Invalid email or password.' }); }
    if (ph.status === 'suspended') return res.status(403).json({ ok: false, msg: 'Account suspended. Please contact support.' });
    if (ph.status === 'pending')   return res.status(403).json({ ok: false, msg: 'Account pending admin approval.' });
    userData = { id: ph.id, name: ph.name, email: ph.email, role: 'pharmacy', init: ph.name[0], phId: ph.id };
  }

  const tokenId  = uid();
  const expiresIn = rememberMe ? '30d' : '8h';
  const token    = jwt.sign({ ...userData, jti: tokenId }, JWT_SECRET, { expiresIn });
  const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 0.34) * 24 * 3600 * 1000).toISOString();

  await dbRun(
    'INSERT INTO sessions (token_id,user_id,role,device,ip,created_at,expires_at,last_seen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [tokenId, userData.id, userData.role, device, req.ip || 'unknown', new Date().toISOString(), expiresAt, new Date().toISOString()]
  );
  await auditLog('LOGIN_SUCCESS', userData.id, userData.role, `Device: ${device}`);
  res.json({ ok: true, token, role: userData.role, user: userData, expiresIn });
});

// ── REGISTER ──────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password, contact, address, license, plan } = req.body;
  const em = (email || '').trim().toLowerCase();
  if (!name || !em || !password) return res.status(400).json({ ok: false, msg: 'Name, email and password are required.' });
  if (password.length < 8)       return res.status(400).json({ ok: false, msg: 'Password must be at least 8 characters.' });
  if (!/\S+@\S+\.\S+/.test(em)) return res.status(400).json({ ok: false, msg: 'Invalid email address.' });

  const existing = await dbGet('SELECT id FROM pharmacies WHERE email=$1', [em]);
  if (existing) return res.status(409).json({ ok: false, msg: 'An account with this email already exists.' });

  const pid = 'ph' + uid();
  await dbRun(
    'INSERT INTO pharmacies VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
    [pid, name.trim(), address || '', license || '', contact || '', em, hash(password),
     plan || null, plan ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString('en-CA') : null,
     false, 'pending', new Date().toLocaleDateString('en-CA'), '[]']
  );
  await auditLog('REGISTER', pid, 'pharmacy', `${name} (${em})`);
  res.json({ ok: true, msg: 'Registration successful! Your account is pending admin approval.' });
});

// ── FORGOT / RESET PASSWORD ───────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, msg: 'Email is required.' });
  const em = email.trim().toLowerCase();

  // Check pharmacies first, then admins
  let user = await dbGet('SELECT id, name FROM pharmacies WHERE email=$1', [em]);
  let userType = 'pharmacy';
  if (!user) {
    user = await dbGet('SELECT id, name FROM admins WHERE email=$1', [em]);
    userType = 'admin';
  }
  // Always respond the same to prevent email enumeration
  if (!user) return res.json({ ok: true, msg: 'If that email is registered, a reset link has been sent.' });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await dbRun('DELETE FROM password_resets WHERE email=$1', [em]);
  await dbRun('INSERT INTO password_resets (email,token,expires_at,created_at,user_type) VALUES ($1,$2,$3,$4,$5)',
    [em, resetToken, expiresAt, new Date().toISOString(), userType]);
  await auditLog('PASSWORD_RESET_REQUEST', user.id, userType, em);

  const resetLink = `${APP_URL}/?reset=${resetToken}`;
  const emailHtml = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#0E1826;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6C63FF,#00D4FF);padding:32px;text-align:center">
      <div style="font-size:36px">💊</div>
      <h1 style="color:#fff;margin:8px 0 4px;font-size:1.5rem">PharmaDist Pro</h1>
      <p style="color:rgba(255,255,255,.8);margin:0;font-size:.875rem">Password Reset Request</p>
    </div>
    <div style="padding:32px;color:#E8F0FE">
      <p style="margin:0 0 16px">Hi <strong>${user.name}</strong>,</p>
      <p style="margin:0 0 24px;color:#7B9CC4;line-height:1.6">We received a request to reset your ${userType} account password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6C63FF,#00D4FF);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:1rem">Reset Password</a>
      </div>
      <p style="margin:24px 0 0;font-size:.8rem;color:#4A6080">If you didn't request this, ignore this email.</p>
      <p style="margin:8px 0 0;font-size:.8rem;color:#4A6080">Or copy this link: <a href="${resetLink}" style="color:#6C63FF">${resetLink}</a></p>
    </div>
    <div style="background:#080C18;padding:16px;text-align:center;font-size:.75rem;color:#4A6080">
      &copy; 2026 PharmaDist Pro &nbsp;&middot;&nbsp; Automated message.
    </div>
  </div>`;

  const sent = await sendMail(em, 'Reset your PharmaDist Pro password', emailHtml);
  if (sent) {
    res.json({ ok: true, msg: `Reset link sent to ${em}. Check your inbox (and spam folder).` });
  } else {
    // Email not configured — return token so user can reset via UI
    res.json({ ok: true, resetToken, msg: 'Email service unavailable. Use the token below to reset your password.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ ok: false, msg: 'Token and new password are required.' });
  if (password.length < 8)  return res.status(400).json({ ok: false, msg: 'Password must be at least 8 characters.' });
  const reset = await dbGet('SELECT * FROM password_resets WHERE token=$1 AND used=false', [token]);
  if (!reset) return res.status(400).json({ ok: false, msg: 'Invalid or already-used reset token.' });
  if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ ok: false, msg: 'Reset token has expired. Request a new one.' });
  const userType = reset.user_type || 'pharmacy';
  if (userType === 'admin') {
    await dbRun('UPDATE admins SET pass_hash=$1 WHERE email=$2', [hash(password), reset.email]);
  } else {
    await dbRun('UPDATE pharmacies SET pass_hash=$1 WHERE email=$2', [hash(password), reset.email]);
  }
  await dbRun('UPDATE password_resets SET used=true WHERE token=$1', [token]);
  // Revoke all active sessions for this user
  const user = await dbGet(
    userType === 'admin'
      ? 'SELECT id FROM admins WHERE email=$1'
      : 'SELECT id FROM pharmacies WHERE email=$1',
    [reset.email]
  );
  if (user) await dbRun('UPDATE sessions SET revoked=true WHERE user_id=$1', [user.id]);
  await auditLog('PASSWORD_RESET_SUCCESS', reset.email, userType, '');
  res.json({ ok: true, msg: 'Password reset successfully! Please sign in with your new password.' });
});

// ─────────────────────────────────────────────────────────────
//  PROTECTED ROUTES
// ─────────────────────────────────────────────────────────────

app.post('/api/logout', authMiddleware, async (req, res) => {
  await dbRun('UPDATE sessions SET revoked=true WHERE token_id=$1', [req.user.jti]);
  await auditLog('LOGOUT', req.user.id, req.user.role, '');
  res.json({ ok: true });
});

app.post('/api/logout-all', authMiddleware, async (req, res) => {
  await dbRun('UPDATE sessions SET revoked=true WHERE user_id=$1', [req.user.id]);
  await auditLog('LOGOUT_ALL', req.user.id, req.user.role, 'All sessions revoked');
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => res.json({ ok: true, user: req.user }));

app.get('/api/sessions', authMiddleware, async (req, res) => {
  const sessions = await dbAll('SELECT * FROM sessions WHERE user_id=$1 AND revoked=false ORDER BY created_at DESC', [req.user.id]);
  res.json(sessions.map(s => ({ ...s, isCurrent: s.token_id === req.user.jti })));
});

app.delete('/api/sessions/:sid', authMiddleware, async (req, res) => {
  const s = await dbGet('SELECT * FROM sessions WHERE id=$1 AND user_id=$2', [Number(req.params.sid), req.user.id]);
  if (!s) return res.status(404).json({ ok: false, msg: 'Session not found.' });
  await dbRun('UPDATE sessions SET revoked=true WHERE id=$1', [Number(req.params.sid)]);
  await auditLog('SESSION_REVOKED', req.user.id, req.user.role, `Session ${req.params.sid}`);
  res.json({ ok: true });
});

app.post('/api/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ ok: false, msg: 'Both fields are required.' });
  if (newPassword.length < 8) return res.status(400).json({ ok: false, msg: 'New password must be at least 8 characters.' });
  if (req.user.role === 'admin') {
    const adm = await dbGet('SELECT * FROM admins WHERE id=$1 AND pass_hash=$2', [req.user.id, hash(currentPassword)]);
    if (!adm) return res.status(400).json({ ok: false, msg: 'Current password is incorrect.' });
    await dbRun('UPDATE admins SET pass_hash=$1 WHERE id=$2', [hash(newPassword), req.user.id]);
    await auditLog('ADMIN_PASSWORD_CHANGED', req.user.id, 'admin', '');
    return res.json({ ok: true, msg: 'Admin password changed successfully.' });
  }
  const ph = await dbGet('SELECT * FROM pharmacies WHERE id=$1 AND pass_hash=$2', [req.user.phId, hash(currentPassword)]);
  if (!ph) return res.status(400).json({ ok: false, msg: 'Current password is incorrect.' });
  await dbRun('UPDATE pharmacies SET pass_hash=$1 WHERE id=$2', [hash(newPassword), req.user.phId]);
  await auditLog('PASSWORD_CHANGED', req.user.id, 'pharmacy', '');
  res.json({ ok: true, msg: 'Password changed successfully.' });
});

// ── DISTRIBUTOR SETTINGS (DB-backed) ─────────────────────────
app.get('/api/dist-settings', authMiddleware, async (req, res) => {
  const d = await dbGet('SELECT * FROM dist_info WHERE id=1');
  res.json(d || {});
});

app.post('/api/dist-settings', authMiddleware, adminMiddleware, async (req, res) => {
  const b = req.body;
  await dbRun(`UPDATE dist_info SET
    name=COALESCE($1,name), address=COALESCE($2,address), phone=COALESCE($3,phone),
    email=COALESCE($4,email), upi=COALESCE($5,upi), gst=COALESCE($6,gst),
    license=COALESCE($7,license) WHERE id=1`,
    [b.name||null,b.address||null,b.phone||null,b.email||null,b.upi||null,b.gst||null,b.license||null]);
  const updated = await dbGet('SELECT * FROM dist_info WHERE id=1');
  await auditLog('DIST_SETTINGS_UPDATED', req.user.id, 'admin', 'UPI: '+b.upi);
  res.json({ ok: true, settings: updated });
});

// Admin change password
app.post('/api/admin/change-password', authMiddleware, adminMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ ok:false, msg:'Both passwords required.' });
  if (newPassword.length < 8) return res.status(400).json({ ok:false, msg:'Min 8 characters.' });
  const admin = await dbGet('SELECT * FROM admins WHERE id=$1', [req.user.id]);
  if (!admin || admin.pass_hash !== hash(currentPassword)) return res.status(401).json({ ok:false, msg:'Current password is incorrect.' });
  await dbRun('UPDATE admins SET pass_hash=$1 WHERE id=$2', [hash(newPassword), req.user.id]);
  await auditLog('ADMIN_PASSWORD_CHANGED', req.user.id, 'admin', '');
  res.json({ ok:true, msg:'Password changed successfully!' });
});

// ── DISTRIBUTOR STOCK (Inventory) ────────────────────────────
app.get('/api/dist-stock', authMiddleware, adminMiddleware, async (req, res) => {
  const items = await dbAll('SELECT * FROM dist_stock ORDER BY created_at DESC');
  res.json(items || []);
});
app.post('/api/dist-stock', authMiddleware, adminMiddleware, async (req, res) => {
  const d=req.body, id='STK-'+uid();
  await dbRun('INSERT INTO dist_stock VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [id,d.name,d.category||'General',d.mfr||'',d.price||0,d.mrp||0,d.stock||0,d.min_stock||10,d.unit||'Strip',d.expiry||'',new Date().toISOString()]);
  res.json({ ok:true, id });
});
app.put('/api/dist-stock/:sid', authMiddleware, adminMiddleware, async (req, res) => {
  const d=req.body,{sid}=req.params;
  await dbRun('UPDATE dist_stock SET name=$1,category=$2,mfr=$3,price=$4,mrp=$5,stock=$6,min_stock=$7,unit=$8,expiry=$9 WHERE id=$10',
    [d.name,d.category,d.mfr,d.price,d.mrp,d.stock,d.min_stock,d.unit,d.expiry,sid]);
  res.json({ ok:true });
});
app.delete('/api/dist-stock/:sid', authMiddleware, adminMiddleware, async (req, res) => {
  await dbRun('DELETE FROM dist_stock WHERE id=$1',[req.params.sid]);
  res.json({ ok:true });
});


// ── ADMIN TEAM MANAGEMENT ─────────────────────────────────────
// List all admins (super admin only)
app.get('/api/admins', authMiddleware, adminMiddleware, async (req, res) => {
  const admins = await dbAll('SELECT id,name,email,created_at,is_super FROM admins ORDER BY created_at');
  res.json(admins);
});

// Create new admin (super admin only)
app.post('/api/admins', authMiddleware, adminMiddleware, async (req, res) => {
  if (!req.user.isSuper) return res.status(403).json({ ok: false, msg: 'Only the super admin can create new admins.' });
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ ok: false, msg: 'Name, email and password are required.' });
  if (password.length < 8) return res.status(400).json({ ok: false, msg: 'Password must be at least 8 characters.' });
  const em = email.trim().toLowerCase();
  const existing = await dbGet('SELECT id FROM admins WHERE email=$1', [em]);
  if (existing) return res.status(409).json({ ok: false, msg: 'An admin with this email already exists.' });
  const aid = 'adm' + uid();
  await dbRun('INSERT INTO admins (id,name,email,pass_hash,created_at,is_super) VALUES ($1,$2,$3,$4,$5,$6)',
    [aid, name.trim(), em, hash(password), new Date().toISOString(), false]);
  await auditLog('ADMIN_CREATED', req.user.id, 'admin', `${name} (${em})`);
  res.json({ ok: true, id: aid, msg: `Admin account created for ${name}.` });
});

// Delete admin (super admin only, cannot delete self)
app.delete('/api/admins/:aid', authMiddleware, adminMiddleware, async (req, res) => {
  if (!req.user.isSuper) return res.status(403).json({ ok: false, msg: 'Only the super admin can delete admins.' });
  if (req.params.aid === req.user.id) return res.status(400).json({ ok: false, msg: 'You cannot delete your own account.' });
  const adm = await dbGet('SELECT * FROM admins WHERE id=$1', [req.params.aid]);
  if (!adm) return res.status(404).json({ ok: false, msg: 'Admin not found.' });
  if (adm.is_super) return res.status(400).json({ ok: false, msg: 'Cannot delete the super admin account.' });
  await dbRun('DELETE FROM admins WHERE id=$1', [req.params.aid]);
  await dbRun('UPDATE sessions SET revoked=true WHERE user_id=$1', [req.params.aid]);
  await auditLog('ADMIN_DELETED', req.user.id, 'admin', adm.email);
  res.json({ ok: true, msg: 'Admin account removed.' });
});

app.get('/api/audit-log', authMiddleware, adminMiddleware, async (req, res) => {
  const logs = await dbAll('SELECT * FROM audit_log ORDER BY ts DESC LIMIT 200');
  res.json(logs);
});

app.get('/api/admin/analytics', authMiddleware, adminMiddleware, async (req, res) => {
  const [tp,ap,pp,sp,tr,pr,ps,bs,to2,td,as2,tl] = await Promise.all([
    dbGet("SELECT COUNT(*) as c FROM pharmacies"),
    dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE status='active'"),
    dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE status='pending'"),
    dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE status='suspended'"),
    dbGet("SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE status='paid'"),
    dbGet("SELECT COALESCE(SUM(amt),0) as t FROM bills WHERE status='unpaid'"),
    dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE plan='1500'"),
    dbGet("SELECT COUNT(*) as c FROM pharmacies WHERE plan='1000'"),
    dbGet("SELECT COUNT(*) as c FROM orders WHERE type='inventory'"),
    dbGet("SELECT COUNT(*) as c FROM drugs"),
    dbGet('SELECT COUNT(*) as c FROM sessions WHERE revoked=false'),
    dbGet("SELECT COUNT(*) as c FROM audit_log WHERE action='LOGIN_SUCCESS'"),
  ]);
  res.json({
    totalPharmacies: +tp.c, activePharmacies: +ap.c, pendingPharmacies: +pp.c,
    suspendedPharmacies: +sp.c, totalRevenue: +tr.t, pendingRevenue: +pr.t,
    premiumSubs: +ps.c, basicSubs: +bs.c, totalOrders: +to2.c,
    totalDrugs: +td.c, activeSessions: +as2.c, totalLogins: +tl.c,
  });
});

app.put('/api/dist', authMiddleware, adminMiddleware, async (req, res) => {
  const d = req.body;
  await dbRun('UPDATE dist_info SET name=$1,address=$2,phone=$3,mobile=$4,email=$5,gst=$6,license=$7 WHERE id=1',
    [d.name, d.address, d.phone, d.mobile, d.email, d.gst, d.license]);
  res.json({ ok: true });
});

// ── PHARMACIES ────────────────────────────────────────────────
app.get('/api/pharmacies', authMiddleware, async (req, res) => {
  const rows = await dbAll('SELECT * FROM pharmacies ORDER BY joined DESC');
  const result = rows.map(r => ({ ...r, docs: parseJSON(r.docs), waived: Boolean(r.waived), planExpiry: r.plan_expiry, phId: r.id }));
  result.forEach(r => delete r.pass_hash);
  res.json(result);
});

app.post('/api/pharmacies', authMiddleware, adminMiddleware, async (req, res) => {
  const d = req.body, pid = 'ph' + uid();
  const pw = d.password || 'pharma123';
  await dbRun('INSERT INTO pharmacies VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
    [pid, d.name, d.address||'', d.license||'', d.contact||'', d.email,
     hash(pw), d.plan||null, d.planExpiry||null,
     d.waived||false, d.status||'active', d.joined||new Date().toLocaleDateString('en-CA'), JSON.stringify(d.docs||[])]);
  await auditLog('PHARMACY_CREATED', req.user.id, 'admin', `${d.name} (${d.email})`);
  // Send welcome email to pharmacy
  const dist = await dbGet('SELECT * FROM dist_info WHERE id=1');
  const loginUrl = APP_URL;
  const welcomeHtml = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#0E1826;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6C63FF,#00D4FF);padding:32px;text-align:center">
      <div style="font-size:36px">💊</div>
      <h1 style="color:#fff;margin:8px 0 4px;font-size:1.5rem">Welcome to PharmaDist Pro!</h1>
      <p style="color:rgba(255,255,255,.8);margin:0;font-size:.875rem">Your pharmacy account is ready</p>
    </div>
    <div style="padding:32px;color:#E8F0FE">
      <p>Hi <strong>${d.name}</strong>,</p>
      <p style="color:#7B9CC4">Your pharmacy account has been created by <strong>${dist?.name||'PharmaDist Pro'}</strong>. Use the credentials below to sign in:</p>
      <div style="background:#1A2540;border-radius:10px;padding:20px;margin:20px 0;font-family:monospace">
        <div style="margin-bottom:10px"><span style="color:#7B9CC4;font-size:.8rem">EMAIL</span><br><strong style="color:#00D4FF">${d.email}</strong></div>
        <div><span style="color:#7B9CC4;font-size:.8rem">PASSWORD</span><br><strong style="color:#6C63FF">${pw}</strong></div>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6C63FF,#00D4FF);color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Login Now</a>
      </div>
      <p style="font-size:.8rem;color:#4A6080">Please change your password after first login. Contact ${dist?.email||'support'} for help.</p>
    </div>
  </div>`;
  await sendMail(d.email, `Welcome to ${dist?.name||'PharmaDist Pro'} — Your Login Details`, welcomeHtml);
  res.json({ ok: true, id: pid });
});

app.get('/api/pharmacies/:pid', authMiddleware, async (req, res) => {
  const r = await dbGet('SELECT * FROM pharmacies WHERE id=$1', [req.params.pid]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const result = { ...r, docs: parseJSON(r.docs), waived: Boolean(r.waived) };
  delete result.pass_hash;
  res.json(result);
});

app.put('/api/pharmacies/:pid', authMiddleware, adminMiddleware, async (req, res) => {
  const d = req.body, { pid } = req.params;
  await dbRun('UPDATE pharmacies SET name=$1,address=$2,license=$3,contact=$4,email=$5,plan=$6,plan_expiry=$7,waived=$8,status=$9,docs=$10 WHERE id=$11',
    [d.name, d.address, d.license, d.contact, d.email, d.plan||null, d.planExpiry||null, d.waived||false, d.status, JSON.stringify(d.docs||[]), pid]);
  if (d.password) await dbRun('UPDATE pharmacies SET pass_hash=$1 WHERE id=$2', [hash(d.password), pid]);
  await auditLog('PHARMACY_UPDATED', req.user.id, 'admin', pid);
  res.json({ ok: true });
});

app.delete('/api/pharmacies/:pid', authMiddleware, adminMiddleware, async (req, res) => {
  await dbRun('DELETE FROM pharmacies WHERE id=$1', [req.params.pid]);
  await auditLog('PHARMACY_DELETED', req.user.id, 'admin', req.params.pid);
  res.json({ ok: true });
});

app.post('/api/pharmacies/:pid/waive', authMiddleware, adminMiddleware, async (req, res) => {
  const row = await dbGet('SELECT waived FROM pharmacies WHERE id=$1', [req.params.pid]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const newVal = !row.waived;
  await dbRun('UPDATE pharmacies SET waived=$1 WHERE id=$2', [newVal, req.params.pid]);
  res.json({ ok: true, waived: newVal });
});

app.post('/api/pharmacies/:pid/docs', authMiddleware, async (req, res) => {
  const d = req.body, { pid } = req.params;
  const row = await dbGet('SELECT docs FROM pharmacies WHERE id=$1', [pid]);
  const docs = parseJSON(row ? row.docs : '[]');
  docs.push({ id: 'doc' + uid(), name: d.name, date: d.date||'', size: d.size||'' });
  await dbRun('UPDATE pharmacies SET docs=$1 WHERE id=$2', [JSON.stringify(docs), pid]);
  res.json({ ok: true, docs });
});

// ── DRUGS ─────────────────────────────────────────────────────
app.get('/api/drugs', authMiddleware, async (req, res) => {
  const { phId } = req.query;
  const rows = phId ? await dbAll('SELECT * FROM drugs WHERE ph_id=$1', [phId]) : await dbAll('SELECT * FROM drugs');
  res.json(rows.map(r => ({ ...r, phId: r.ph_id, min: r.min_qty })));
});

app.post('/api/drugs', authMiddleware, async (req, res) => {
  const d = req.body, did = 'g' + uid();
  await dbRun('INSERT INTO drugs VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
    [did, d.phId, d.name, d.gen||'', d.cat||'Other', d.mfr||'', d.batch||'', d.qty, d.min||50, d.price||0, d.mrp||0, d.exp, d.bc||'']);
  res.json({ ok: true, id: did });
});

app.put('/api/drugs/:did', authMiddleware, async (req, res) => {
  const d = req.body, { did } = req.params;
  await dbRun('UPDATE drugs SET name=$1,cat=$2,qty=$3,min_qty=$4,price=$5,mrp=$6,batch=$7,exp=$8,gen=$9,mfr=$10,bc=$11 WHERE id=$12',
    [d.name, d.cat, d.qty, d.min, d.price, d.mrp, d.batch, d.exp, d.gen, d.mfr, d.bc, did]);
  res.json({ ok: true });
});

app.delete('/api/drugs/:did', authMiddleware, async (req, res) => {
  await dbRun('DELETE FROM drugs WHERE id=$1', [req.params.did]);
  res.json({ ok: true });
});

// ── ORDERS ────────────────────────────────────────────────────
app.get('/api/orders', authMiddleware, async (req, res) => {
  const { phId, type } = req.query;
  const conds = [], params = [];
  if (phId) { conds.push(`ph_id=$${params.length+1}`); params.push(phId); }
  if (type) { conds.push(`type=$${params.length+1}`);  params.push(type); }
  const where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
  const rows = await dbAll(`SELECT * FROM orders${where} ORDER BY date DESC`, params);
  res.json(rows.map(r => ({ ...r, drugs: parseJSON(r.drugs), billed: Boolean(r.billed), phId: r.ph_id, phName: r.ph_name })));
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  const d = req.body, oid = 'ORD-' + uid();
  await dbRun('INSERT INTO orders VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
    [oid, d.type, d.phId, d.phName, JSON.stringify(d.drugs||[]), d.sub||0, d.gst||0, d.tot||0, d.date||'', d.status||'pending', d.del||'paid', d.notes||'', false, d.cust||'']);
  res.json({ ok: true, id: oid });
});

app.get('/api/orders/:oid', authMiddleware, async (req, res) => {
  const r = await dbGet('SELECT * FROM orders WHERE id=$1', [req.params.oid]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ ...r, drugs: parseJSON(r.drugs), billed: Boolean(r.billed) });
});

app.put('/api/orders/:oid', authMiddleware, async (req, res) => {
  const d = req.body, { oid } = req.params;
  if ('status' in d) await dbRun('UPDATE orders SET status=$1 WHERE id=$2', [d.status, oid]);
  if ('billed' in d) await dbRun('UPDATE orders SET billed=$1 WHERE id=$2', [Boolean(d.billed), oid]);
  res.json({ ok: true });
});

// ── BILLS ─────────────────────────────────────────────────────
app.get('/api/bills', authMiddleware, async (req, res) => {
  const { phId } = req.query;
  const rows = phId
    ? await dbAll('SELECT * FROM bills WHERE ph_id=$1 ORDER BY date DESC', [phId])
    : await dbAll('SELECT * FROM bills ORDER BY date DESC');
  res.json(rows.map(r => ({ ...r, phId: r.ph_id, phName: r.ph_name, ordId: r.ord_id })));
});

app.post('/api/bills', authMiddleware, async (req, res) => {
  const d = req.body, bid = 'BILL-' + uid();
  await dbRun('INSERT INTO bills VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [bid, d.phId, d.phName, d.ordId||'MANUAL', d.amt, d.date, d.due, 'unpaid', d.type||'bulk', null]);
  res.json({ ok: true, id: bid });
});

app.put('/api/bills/:bid', authMiddleware, async (req, res) => {
  const d = req.body, { bid } = req.params;
  if (d.status === 'paid') {
    await dbRun("UPDATE bills SET status='paid', paid=$1 WHERE id=$2", [d.paid||'', bid]);
  } else if (d.status === 'pending_verification') {
    // Store UTR in the paid column temporarily, and update status
    const utrNote = `UTR:${d.utr||''}|METHOD:${d.payMethod||'UPI'}`;
    await dbRun("UPDATE bills SET status='pending_verification', paid=$1 WHERE id=$2", [utrNote, bid]);
  }
  res.json({ ok: true });
});

// ── RETURNS ───────────────────────────────────────────────────
app.get('/api/returns', authMiddleware, async (req, res) => {
  const { phId } = req.query;
  const rows = phId
    ? await dbAll('SELECT * FROM returns WHERE ph_id=$1 ORDER BY date DESC', [phId])
    : await dbAll('SELECT * FROM returns ORDER BY date DESC');
  res.json(rows.map(r => ({ ...r, drugs: parseJSON(r.drugs), phId: r.ph_id, phName: r.ph_name })));
});

app.post('/api/returns', authMiddleware, async (req, res) => {
  const d = req.body, rid = 'RET-' + uid();
  await dbRun('INSERT INTO returns VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [rid, d.phId, d.phName, d.reason, JSON.stringify(d.drugs||[]), d.date, 'pending', d.notes||'', '']);
  res.json({ ok: true, id: rid });
});

app.put('/api/returns/:rid', authMiddleware, async (req, res) => {
  const d = req.body, { rid } = req.params;
  await dbRun('UPDATE returns SET status=$1,anote=$2 WHERE id=$3', [d.status, d.anote||'', rid]);
  res.json({ ok: true });
});

// ── TICKETS ───────────────────────────────────────────────────
app.get('/api/tickets', authMiddleware, async (req, res) => {
  const { phId } = req.query;
  const rows = phId
    ? await dbAll('SELECT * FROM tickets WHERE ph_id=$1 ORDER BY date DESC', [phId])
    : await dbAll('SELECT * FROM tickets ORDER BY date DESC');
  res.json(rows.map(r => ({ ...r, msgs: parseJSON(r.msgs), phId: r.ph_id, phName: r.ph_name })));
});

app.post('/api/tickets', authMiddleware, async (req, res) => {
  const d = req.body, tid = 'TKT-' + uid();
  await dbRun('INSERT INTO tickets VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [tid, d.phId, d.phName, d.subject, d.type||'other', d.date, 'open', JSON.stringify(d.msgs||[])]);
  res.json({ ok: true, id: tid });
});

app.put('/api/tickets/:tid', authMiddleware, async (req, res) => {
  const d = req.body, { tid } = req.params;
  if ('msgs'   in d) await dbRun('UPDATE tickets SET msgs=$1 WHERE id=$2', [JSON.stringify(d.msgs), tid]);
  if ('status' in d) await dbRun('UPDATE tickets SET status=$1 WHERE id=$2', [d.status, tid]);
  res.json({ ok: true });
});

// ── NOTIFICATIONS ─────────────────────────────────────────────
app.get('/api/notifs', authMiddleware, async (req, res) => {
  const { role, phId } = req.query;
  const rows = role === 'admin'
    ? await dbAll('SELECT * FROM notifs WHERE admin=true ORDER BY date DESC')
    : await dbAll('SELECT * FROM notifs WHERE admin=false AND (ph IS NULL OR ph=$1) ORDER BY date DESC', [phId]);
  res.json(rows.map(r => ({ ...r, read: Boolean(r.read), admin: Boolean(r.admin) })));
});

app.post('/api/notifs', authMiddleware, async (req, res) => {
  const d = req.body, nid = 'n' + uid();
  await dbRun('INSERT INTO notifs VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [nid, d.type, d.msg, d.date||'', false, Boolean(d.admin), d.ph||null]);
  res.json({ ok: true, id: nid });
});

app.post('/api/notifs/read-all', authMiddleware, async (req, res) => {
  const d = req.body;
  if (d.role === 'admin') await dbRun('UPDATE notifs SET read=true WHERE admin=true');
  else await dbRun('UPDATE notifs SET read=true WHERE ph=$1 OR ph IS NULL', [d.phId||null]);
  res.json({ ok: true });
});

// ── CHAT ──────────────────────────────────────────────────────
app.get('/api/chats', authMiddleware, async (req, res) => {
  res.json(await dbAll('SELECT * FROM chats ORDER BY id'));
});

app.post('/api/chats', authMiddleware, async (req, res) => {
  const d = req.body;
  await dbRun('INSERT INTO chats(from_role,text,time) VALUES ($1,$2,$3)', [d.from, d.text, d.time]);
  res.json({ ok: true });
});

// ── PRODUCTS ──────────────────────────────────────────────────
// Public: anyone can read products
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = 'SELECT * FROM products';
    const params = [];
    const conds = [];
    if (category && category !== 'all') {
      params.push(category);
      conds.push(`category=$${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conds.push(`LOWER(name) LIKE $${params.length}`);
    }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/products error:', e.message);
    res.status(500).json({ ok: false, msg: 'Database error' });
  }
});

// Admin: create product
app.post('/api/products', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, category, price, stock, expiry_date } = req.body;
    if (!name || !category || price == null || stock == null || !expiry_date)
      return res.status(400).json({ ok: false, msg: 'All fields are required.' });
    const pid = 'prod_' + uid();
    await dbRun(
      'INSERT INTO products (id,name,category,price,stock,expiry_date,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [pid, name.trim(), category.trim(), parseFloat(price), parseInt(stock), expiry_date, new Date().toISOString()]
    );
    await auditLog('PRODUCT_CREATED', req.user.id, 'admin', name);
    res.json({ ok: true, id: pid });
  } catch (e) {
    console.error('POST /api/products error:', e.message);
    res.status(500).json({ ok: false, msg: 'Database error' });
  }
});

// Admin: update product
app.put('/api/products/:pid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, category, price, stock, expiry_date } = req.body;
    await dbRun(
      'UPDATE products SET name=$1,category=$2,price=$3,stock=$4,expiry_date=$5 WHERE id=$6',
      [name.trim(), category.trim(), parseFloat(price), parseInt(stock), expiry_date, req.params.pid]
    );
    await auditLog('PRODUCT_UPDATED', req.user.id, 'admin', req.params.pid);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/products error:', e.message);
    res.status(500).json({ ok: false, msg: 'Database error' });
  }
});

// Admin: delete product
app.delete('/api/products/:pid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await dbRun('DELETE FROM products WHERE id=$1', [req.params.pid]);
    await auditLog('PRODUCT_DELETED', req.user.id, 'admin', req.params.pid);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/products error:', e.message);
    res.status(500).json({ ok: false, msg: 'Database error' });
  }
});

// ── Catch-all ─────────────────────────────────────────────────
// Static files are handled by express.static above.
// This fallback sends the root index.html.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ─────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────
async function main() {
  // Test DB connection
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
  } catch (e) {
    console.error('❌ DB connection failed:', e.message);
    process.exit(1);
  }

  await initDB();

  app.listen(PORT, '0.0.0.0', () => {
    const line = '═'.repeat(54);
    console.log('\n' + line);
    console.log('  🔒 PharmaDist Pro — Secure Server v4.0');
    console.log(`  🌐 http://localhost:${PORT}`);
    console.log('  ✅ PostgreSQL | JWT Auth | Rate Limiting | SSE');
    console.log('  📧 Email: ' + (mailer ? 'SMTP configured ✅' : 'not configured (demo mode)'));
    console.log('  🔒 JWT_SECRET: ' + (process.env.JWT_SECRET ? 'from ENV ✅' : 'DEFAULT ⚠️  (set in prod!)'));
    console.log('  🗄️  DB: ' + (process.env.DATABASE_URL ? 'Railway PostgreSQL ✅' : 'LOCAL — set DATABASE_URL'));
    console.log(line + '\n');
  });

  // ── Supabase Keep-Alive ────────────────────────────────────────
  // Pings Supabase every 3 days to prevent free-tier project pause.
  // Set SUPABASE_URL and SUPABASE_ANON_KEY env vars in Railway.
  const SUPABASE_URL      = process.env.SUPABASE_URL      || '';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
  const PING_INTERVAL_MS  = 3 * 24 * 60 * 60 * 1000; // 3 days

  async function pingSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('ℹ️  Supabase keep-alive: SUPABASE_URL / SUPABASE_ANON_KEY not set — skipping.');
      return;
    }
    try {
      // Simple lightweight REST query — reads at most 1 row from any table
      const url = `${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(15000),
      });
      console.log(`💓 Supabase keep-alive ping — status: ${res.status} — ${new Date().toISOString()}`);
    } catch (err) {
      console.warn('⚠️  Supabase keep-alive ping failed:', err.message);
    }
  }

  // Ping immediately on startup, then every 3 days
  pingSupabase();
  setInterval(pingSupabase, PING_INTERVAL_MS);
  console.log('💓 Supabase keep-alive scheduler started (every 3 days)');

  // ── Render Self-Ping Keep-Alive ───────────────────────────────
  // Render free tier sleeps after 15 min of inactivity.
  // This pings own /api/health every 10 min to stay awake 24/7.
  // Set RENDER_SELF_URL = https://pharmadist-pro.onrender.com in env vars.
  const RENDER_SELF_URL  = process.env.RENDER_SELF_URL || '';
  const SELF_PING_MS     = 10 * 60 * 1000; // 10 minutes

  async function selfPing() {
    if (!RENDER_SELF_URL) return; // only runs on Render
    try {
      const r = await fetch(`${RENDER_SELF_URL}/api/health`, {
        signal: AbortSignal.timeout(10000),
      });
      console.log(`🔄 Render self-ping — status: ${r.status} — ${new Date().toISOString()}`);
    } catch (e) {
      console.warn('⚠️  Render self-ping failed:', e.message);
    }
  }

  if (RENDER_SELF_URL) {
    setInterval(selfPing, SELF_PING_MS);
    console.log('🔄 Render self-ping keep-alive started (every 10 min) →', RENDER_SELF_URL);
  }
}

main().catch(e => { console.error('Failed to start:', e); process.exit(1); });


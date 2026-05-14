-- PharmaDist Pro — D1 (SQLite) Schema
-- Run: wrangler d1 execute pharmadist-db --file=schema.sql --remote

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
  docs TEXT DEFAULT '[]',
  ph_type TEXT DEFAULT 'retail',
  gstin TEXT,
  wa_number TEXT
);

CREATE TABLE IF NOT EXISTS dist_info (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT, address TEXT, phone TEXT, mobile TEXT,
  email TEXT, gst TEXT, license TEXT, upi TEXT
);

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
  notes TEXT, billed INTEGER DEFAULT 0, cust TEXT,
  dispatch_date TEXT, challan_no TEXT
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
  created_at TEXT,
  user_type TEXT DEFAULT 'pharmacy'
);

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
  is_super INTEGER DEFAULT 0
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

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  ph_id TEXT NOT NULL,
  ph_name TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'cash',
  ref TEXT DEFAULT '',
  note TEXT DEFAULT '',
  date TEXT NOT NULL,
  recorded_by TEXT DEFAULT 'admin',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  ph_id TEXT,
  ph_name TEXT,
  items TEXT,
  valid_until TEXT,
  status TEXT DEFAULT 'draft',
  note TEXT DEFAULT '',
  created_at TEXT
);

-- Seed dist_info
INSERT OR IGNORE INTO dist_info VALUES (
  1,'PharmaDist Pro','100 Industrial Area, Pune, MH 411057',
  '+91 20 1234 5678','+91 99887 76655',
  'support@pharmadist.com','27ABCDE1234F1Z5','MH-DIST-2020-001',NULL
);

-- Seed chat
INSERT OR IGNORE INTO chats(from_role,text,time) VALUES
  ('support','Hello! Welcome to PharmaDist Support. How can we help?','09:00 AM');

-- Seed products
INSERT OR IGNORE INTO products VALUES ('prod_seed_01','Paracetamol 500mg Tablets','Analgesic',3.50,500,'2026-12-31','2026-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO products VALUES ('prod_seed_02','Amoxicillin 250mg Capsules','Antibiotic',12.00,200,'2026-09-30','2026-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO products VALUES ('prod_seed_03','Metformin 500mg Tablets','Antidiabetic',5.00,350,'2027-03-15','2026-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO products VALUES ('prod_seed_04','Atorvastatin 10mg Tablets','Statin',18.00,150,'2026-07-31','2026-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO products VALUES ('prod_seed_05','Omeprazole 20mg Capsules','PPI',6.50,80,'2026-05-20','2026-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO products VALUES ('prod_seed_06','Cetirizine 10mg Tablets','Antihistamine',2.50,0,'2027-01-10','2026-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO products VALUES ('prod_seed_07','Azithromycin 500mg Tablets','Antibiotic',65.00,120,'2026-11-30','2026-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO products VALUES ('prod_seed_08','Losartan 50mg Tablets','Antihypertensive',25.00,60,'2026-06-15','2026-01-01T00:00:00.000Z');

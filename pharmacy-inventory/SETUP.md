# PharmInv — Pharmacy Inventory System

## ⚡ Quick Start

Go to: **https://web-production-e4fbb.up.railway.app/pharmacy-inventory/**  
Or locally: open `pharmacy-inventory/index.html`

---

## Step 1: Create Supabase Tables

Go to your Supabase project → **SQL Editor** → paste and run:

```sql
-- Drop old table if upgrading
DROP TABLE IF EXISTS products CASCADE;

-- Products table (full schema with all fields)
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Other',
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  expiry_date DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (allow anon access for demo)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON products
  FOR ALL USING (true) WITH CHECK (true);
```

> **For Admin Login:** Go to **Supabase → Authentication → Users** and create an admin user with email + password. Use those credentials on the admin login page.

---

## Step 2: Supabase RLS for Admin-Only Writes (Optional - More Secure)

If you want to restrict writes to authenticated users only:

```sql
-- Drop the permissive policy
DROP POLICY IF EXISTS "Allow all for anon" ON products;

-- Public can only read
CREATE POLICY "Public can read"    ON products FOR SELECT USING (true);

-- Only authenticated users can write
CREATE POLICY "Auth can insert"    ON products FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth can update"    ON products FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "Auth can delete"    ON products FOR DELETE  USING (auth.role() = 'authenticated');
```

---

## Step 3: Seed Sample Data (Optional)

```sql
INSERT INTO products (name, category, price, stock, expiry_date) VALUES
  ('Paracetamol 500mg',    'Analgesic',         2.50,  500, '2026-12-01'),
  ('Amoxicillin 250mg',    'Antibiotic',         8.00,   35, '2026-05-10'),
  ('Metformin 500mg',      'Antidiabetic',       3.50,  200, '2027-01-31'),
  ('Atorvastatin 10mg',    'Cardiovascular',    12.00,    8, '2026-06-30'),
  ('Omeprazole 20mg',      'Gastrointestinal',   4.00,  300, '2026-04-28'),
  ('Cetirizine 10mg',      'Antihistamine',      1.50,  450, '2027-03-01'),
  ('Azithromycin 500mg',   'Antibiotic',        45.00,   80, '2026-09-30'),
  ('Vitamin D3 1000IU',    'Vitamin/Supplement', 5.00,    0, '2027-06-01');
```

---

## File Structure

```
pharmacy-inventory/
├── index.html          ← Landing page (choose portal)
├── admin.html          ← Admin panel (requires Supabase Auth login)
├── user.html           ← Pharmacy staff view (no login)
├── style.css           ← Shared styles
├── admin.js            ← Admin logic
├── user.js             ← User/staff logic
├── supabase-config.js  ← Supabase credentials (already configured)
└── SETUP.md            ← This file
```

---

## Features

| Feature                          | Admin | Pharmacy Staff |
|----------------------------------|:-----:|:--------------:|
| Secure Login (Supabase Auth)     | ✅    | ❌ (no login)  |
| Add Product (name/cat/price/stock/expiry) | ✅ | ❌     |
| Edit Product                     | ✅    | ❌             |
| Delete Product                   | ✅    | ❌             |
| View all products                | ✅    | ✅             |
| Search by name / category        | ✅    | ✅             |
| Filter by category               | ✅    | ✅             |
| Filter by stock/expiry status    | ✅    | ✅             |
| Stats dashboard                  | ✅    | ✅             |
| Low stock highlight (≤10 units)  | ✅    | ✅             |
| Near-expiry warning (≤30 days)   | ✅    | ✅             |
| Expired / Out of Stock alerts    | ✅    | ✅             |
| Responsive (mobile + desktop)    | ✅    | ✅             |

---

## Stock & Expiry Thresholds

| Threshold      | Value     | Configurable in           |
|----------------|-----------|---------------------------|
| Low stock      | ≤ 10 units | `admin.js` & `user.js` line 4 |
| Near expiry    | ≤ 30 days  | `admin.js` & `user.js` line 5 |

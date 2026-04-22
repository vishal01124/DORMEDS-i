const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:SaCnffbRJGuLCFzKFFrwHgstQEDeyvUY@shinkansen.proxy.rlwy.net:19969/railway',
  ssl: { rejectUnauthorized: false }
});

const hash = pw => crypto.createHash('sha256').update(pw).digest('hex');
const uid  = () => crypto.randomBytes(8).toString('hex');

// ── CHANGE THESE TO WHAT YOU WANT ─────────────────────────────
const NEW_ADMIN = {
  name:     'Admin 2',
  email:    'admin2@dormed.com',   // change if needed
  password: 'DORMEDS2@2026'        // change if needed
};
// ──────────────────────────────────────────────────────────────

async function run() {
  await pool.query('SELECT 1');
  console.log('✅ Connected to Railway PostgreSQL\n');

  // List ALL current admins first
  const { rows: before } = await pool.query('SELECT id, name, email, is_super, created_at FROM admins ORDER BY created_at');
  console.log('📋 Current admins in DB:');
  before.forEach(r => console.log(`  [${r.is_super ? 'SUPER' : 'admin'}] ${r.name} <${r.email}> (id: ${r.id})`));

  // Upsert the new admin (creates if not exists, resets password if exists)
  const aid = 'adm' + uid();
  await pool.query(
    `INSERT INTO admins(id,name,email,pass_hash,created_at,is_super)
     VALUES($1,$2,$3,$4,$5,false)
     ON CONFLICT(email) DO UPDATE SET
       pass_hash = EXCLUDED.pass_hash,
       name = EXCLUDED.name`,
    [aid, NEW_ADMIN.name, NEW_ADMIN.email.toLowerCase().trim(), hash(NEW_ADMIN.password.trim()), new Date().toISOString()]
  );
  console.log('\n✅ Admin upserted successfully!');

  // Confirm final state
  const { rows: after } = await pool.query('SELECT id, name, email, is_super FROM admins ORDER BY created_at');
  console.log('\n📋 Final admins in DB:');
  after.forEach(r => console.log(`  [${r.is_super ? 'SUPER' : 'admin'}] ${r.name} <${r.email}>`));

  console.log('\n🔐 Login details for new admin:');
  console.log('   URL:     ', 'https://vishal01124.github.io/DORMEDS-i/');
  console.log('   Tab:      Admin (not Pharmacy!)');
  console.log('   Email:   ', NEW_ADMIN.email);
  console.log('   Password:', NEW_ADMIN.password);

  await pool.end();
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });

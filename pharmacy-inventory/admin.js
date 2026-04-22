// ─────────────────────────────────────────────────────────────
//  admin.js — Full Admin Panel Logic
//  Features: Supabase Auth login, Add/Edit/Delete products,
//            Stock & expiry alerts, Search & filter, Stats
// ─────────────────────────────────────────────────────────────

'use strict';

// ── Constants ─────────────────────────────────────────────────
const LOW_STOCK_THRESHOLD   = 10;   // items
const EXPIRY_WARN_DAYS      = 30;   // days

// ── State ─────────────────────────────────────────────────────
let allProducts  = [];
let editingId    = null;
let deleteTarget = null;

// ── DOM refs ──────────────────────────────────────────────────
const loginGate    = document.getElementById('login-gate');
const dashboard    = document.getElementById('dashboard');
const loginForm    = document.getElementById('login-form');
const loginError   = document.getElementById('login-error');
const loginBtn     = document.getElementById('login-btn');

const productForm  = document.getElementById('product-form');
const cancelBtn    = document.getElementById('cancel-btn');
const formHeading  = document.getElementById('form-heading');
const submitLabel  = document.getElementById('submit-label');
const submitBtn    = document.getElementById('submit-btn');

const prodName     = document.getElementById('prod-name');
const prodCat      = document.getElementById('prod-category');
const prodPrice    = document.getElementById('prod-price');
const prodStock    = document.getElementById('prod-stock');
const prodExpiry   = document.getElementById('prod-expiry');

const productsContainer = document.getElementById('products-container');
const adminSearch  = document.getElementById('admin-search');
const filterCat    = document.getElementById('admin-filter-cat');
const filterStatus = document.getElementById('admin-filter-status');

const editModal  = document.getElementById('edit-modal');
const editForm   = document.getElementById('edit-form');
const deleteModal  = document.getElementById('delete-modal');
const deleteMsg    = document.getElementById('delete-msg');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// ── Helpers ───────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function daysUntilExpiry(dateStr) {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function getProductStatus(p) {
  const days = daysUntilExpiry(p.expiry_date);
  if (days <= 0)                  return 'expired';
  if (days <= EXPIRY_WARN_DAYS)   return 'expiring';
  if (p.stock === 0)              return 'outofstock';
  if (p.stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'instock';
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = {
    success: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:   '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info:    '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    warning: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icons[type] || ''} <span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ── AUTH ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard(session.user);
  }

  // Auth state changes
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showDashboard(session.user);
    } else {
      showLogin();
    }
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  loginError.style.display = 'none';
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Signing in…';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="10 17 15 12 10 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="15" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Sign In`;

  if (error) {
    loginError.textContent = error.message === 'Invalid login credentials'
      ? '❌ Invalid email or password. Please try again.'
      : `❌ ${error.message}`;
    loginError.style.display = 'block';
    return;
  }

  if (data.session) {
    showDashboard(data.session.user);
  }
});

async function adminLogout() {
  await supabase.auth.signOut();
  showLogin();
  toast('Signed out successfully.', 'info');
}

function showLogin() {
  loginGate.style.display = 'flex';
  dashboard.style.display = 'none';
}

function showDashboard(user) {
  loginGate.style.display = 'none';
  dashboard.style.display = 'block';
  const emailEl = document.getElementById('admin-email-display');
  if (emailEl) emailEl.textContent = user.email;
  loadProducts();
}

// ── LOAD PRODUCTS ─────────────────────────────────────────────
async function loadProducts() {
  productsContainer.innerHTML = '<div class="loader"><div class="spinner"></div> Loading products…</div>';

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    productsContainer.innerHTML = `<div class="empty-state"><p>⚠️ Failed to load products: ${escHtml(error.message)}</p></div>`;
    toast('Failed to load products', 'error');
    return;
  }

  allProducts = data || [];
  populateCategoryFilter(filterCat, allProducts);
  updateAdminStats();
  adminFilter();
}

// ── STATS ─────────────────────────────────────────────────────
function updateAdminStats() {
  const instock  = allProducts.filter(p => getProductStatus(p) === 'instock').length;
  const low      = allProducts.filter(p => getProductStatus(p) === 'low').length;
  const out      = allProducts.filter(p => getProductStatus(p) === 'outofstock').length;
  const expiring = allProducts.filter(p => ['expiring','expired'].includes(getProductStatus(p))).length;

  document.getElementById('stat-total').textContent    = allProducts.length;
  document.getElementById('stat-instock').textContent  = instock;
  document.getElementById('stat-lowstock').textContent = low;
  document.getElementById('stat-outstock').textContent = out;
  document.getElementById('stat-expiry').textContent   = expiring;
}

// ── FILTER ────────────────────────────────────────────────────
function adminFilter() {
  const q   = (adminSearch.value || '').trim().toLowerCase();
  const cat = filterCat.value;
  const sts = filterStatus.value;

  const filtered = allProducts.filter(p => {
    const matchQ   = !q || p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q);
    const matchCat = !cat || p.category === cat;
    const matchSts = !sts || getProductStatus(p) === sts;
    return matchQ && matchCat && matchSts;
  });

  renderProducts(filtered);
}

function populateCategoryFilter(sel, products) {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escHtml(c)}"${c===cur?' selected':''}>${escHtml(c)}</option>`).join('');
}

// ── RENDER TABLE ──────────────────────────────────────────────
function renderProducts(list) {
  if (list.length === 0) {
    productsContainer.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>${allProducts.length === 0 ? 'No products yet. Add your first product above!' : 'No products match your filters.'}</p>
      </div>`;
    return;
  }

  const rows = list.map((p, i) => {
    const status = getProductStatus(p);
    const days   = daysUntilExpiry(p.expiry_date);
    const statusMeta = {
      instock:    { label: 'In Stock',    cls: 'badge-instock'    },
      low:        { label: 'Low Stock',   cls: 'badge-low'        },
      outofstock: { label: 'Out of Stock',cls: 'badge-outofstock' },
      expiring:   { label: `Expiring in ${days}d`, cls: 'badge-expiry' },
      expired:    { label: 'Expired',     cls: 'badge-expired'    },
    }[status];

    let rowCls = '';
    if (status === 'low')        rowCls = 'row-low';
    if (status === 'outofstock') rowCls = 'row-out';
    if (status === 'expiring')   rowCls = 'row-expiring';
    if (status === 'expired')    rowCls = 'row-expired';

    return `
      <tr class="${rowCls}" data-id="${p.id}">
        <td class="col-num">${i + 1}</td>
        <td><strong>${escHtml(p.name)}</strong></td>
        <td><span class="category-pill">${escHtml(p.category || '—')}</span></td>
        <td class="price-cell">₹${parseFloat(p.price).toFixed(2)}</td>
        <td class="${p.stock <= LOW_STOCK_THRESHOLD ? 'stock-low' : ''}">
          ${p.stock}
          ${p.stock <= LOW_STOCK_THRESHOLD && p.stock > 0 ? '<span class="stock-warn-icon" title="Low stock">⚠️</span>' : ''}
        </td>
        <td class="${days <= EXPIRY_WARN_DAYS ? 'expiry-warn' : ''}">
          ${formatDate(p.expiry_date)}
          ${days <= EXPIRY_WARN_DAYS && days > 0 ? `<span class="expiry-warn-icon" title="${days} days left">⏰</span>` : ''}
          ${days <= 0 ? '<span class="expiry-warn-icon" title="Expired">🚫</span>' : ''}
        </td>
        <td><span class="badge ${statusMeta.cls}">${statusMeta.label}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-sm btn-edit" onclick="openEditModal('${p.id}')">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Edit
            </button>
            <button class="btn btn-sm btn-delete" onclick="openDeleteModal('${p.id}', '${escHtml(p.name).replace(/'/g,"\\'")}')">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Delete
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  productsContainer.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th>Product Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Expiry Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="table-footer">${list.length} product${list.length !== 1 ? 's' : ''} shown</div>`;
}

// ── ADD PRODUCT ───────────────────────────────────────────────
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name     = prodName.value.trim();
  const category = prodCat.value;
  const price    = parseFloat(prodPrice.value);
  const stock    = parseInt(prodStock.value, 10);
  const expiry   = prodExpiry.value;

  if (!name || !category || isNaN(price) || isNaN(stock) || !expiry) {
    toast('Please fill in all required fields.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Saving…';

  if (editingId) {
    // Update existing
    const { error } = await supabase
      .from('products')
      .update({ name, category, price, stock, expiry_date: expiry })
      .eq('id', editingId);

    submitBtn.disabled = false;
    resetSubmitBtn();

    if (error) { toast('Failed to update product: ' + error.message, 'error'); return; }
    toast(`"${name}" updated successfully!`);
    cancelEdit();
  } else {
    // Insert new
    const { error } = await supabase
      .from('products')
      .insert([{ name, category, price, stock, expiry_date: expiry }]);

    submitBtn.disabled = false;
    resetSubmitBtn();

    if (error) { toast('Failed to add product: ' + error.message, 'error'); return; }
    toast(`"${name}" added successfully!`);
    productForm.reset();
  }

  loadProducts();
});

function resetSubmitBtn() {
  submitBtn.innerHTML = `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg> <span id="submit-label">${editingId ? 'Update Product' : 'Add Product'}</span>`;
}

// ── EDIT (inline form) ────────────────────────────────────────
function openEditModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingId = id;

  document.getElementById('edit-name').value     = p.name;
  document.getElementById('edit-category').value = p.category || '';
  document.getElementById('edit-price').value    = p.price;
  document.getElementById('edit-stock').value    = p.stock;
  document.getElementById('edit-expiry').value   = p.expiry_date || '';

  editModal.style.display = 'flex';
}

function closeEditModal() {
  editModal.style.display = 'none';
  editingId = null;
}

editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id       = editingId;
  const name     = document.getElementById('edit-name').value.trim();
  const category = document.getElementById('edit-category').value;
  const price    = parseFloat(document.getElementById('edit-price').value);
  const stock    = parseInt(document.getElementById('edit-stock').value, 10);
  const expiry   = document.getElementById('edit-expiry').value;

  if (!name || !category || isNaN(price) || isNaN(stock) || !expiry) {
    toast('Please fill in all fields.', 'error'); return;
  }

  const saveBtn = editForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const { error } = await supabase
    .from('products')
    .update({ name, category, price, stock, expiry_date: expiry })
    .eq('id', id);

  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Changes';

  if (error) { toast('Failed to update: ' + error.message, 'error'); return; }
  toast(`"${name}" updated!`);
  closeEditModal();
  loadProducts();
});

// ── DELETE ────────────────────────────────────────────────────
function openDeleteModal(id, name) {
  deleteTarget = id;
  deleteMsg.innerHTML = `Are you sure you want to delete <strong>"${escHtml(name)}"</strong>? This action cannot be undone.`;
  deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  deleteTarget = null;
}

deleteModal.addEventListener('click', e => { if (e.target === deleteModal) closeDeleteModal(); });

confirmDeleteBtn.addEventListener('click', async () => {
  if (!deleteTarget) return;
  const id   = deleteTarget;
  const prod = allProducts.find(p => p.id === id);

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Deleting…';

  const { error } = await supabase.from('products').delete().eq('id', id);

  confirmDeleteBtn.disabled = false;
  confirmDeleteBtn.textContent = 'Delete';

  if (error) { toast('Failed to delete: ' + error.message, 'error'); closeDeleteModal(); return; }
  toast(`"${prod?.name || 'Product'}" deleted.`, 'info');
  closeDeleteModal();
  loadProducts();
});

// ── CANCEL inline edit ────────────────────────────────────────
function cancelEdit() {
  editingId = null;
  formHeading.textContent = 'Add New Product';
  submitBtn.innerHTML = `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg> Add Product`;
  cancelBtn.style.display = 'none';
  productForm.reset();
}

// ── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEditModal();
    closeDeleteModal();
  }
});

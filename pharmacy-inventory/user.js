// ─────────────────────────────────────────────────────────────
//  user.js — Pharmacy Staff View
//  Features: Browse products, stock/expiry status, search/filter
// ─────────────────────────────────────────────────────────────

'use strict';

// ── Constants ─────────────────────────────────────────────────
const LOW_STOCK_THRESHOLD = 10;
const EXPIRY_WARN_DAYS    = 30;

// ── State ─────────────────────────────────────────────────────
let allProducts = [];

// ── DOM refs ──────────────────────────────────────────────────
const productsContainer = document.getElementById('products-container');
const searchInput       = document.getElementById('search-input');
const resultsCount      = document.getElementById('results-count');
const filterCat         = document.getElementById('filter-cat');
const filterStatus      = document.getElementById('filter-status');

// ── Helpers ───────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function daysUntilExpiry(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function getProductStatus(p) {
  const days = daysUntilExpiry(p.expiry_date);
  if (days <= 0)                      return 'expired';
  if (days <= EXPIRY_WARN_DAYS)       return 'expiring';
  if (p.stock === 0)                  return 'outofstock';
  if (p.stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'instock';
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = {
    success: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:   '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info:    '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icons[type] || ''} <span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
});

// ── Load Products ─────────────────────────────────────────────
async function loadProducts() {
  productsContainer.innerHTML = '<div class="loader"><div class="spinner"></div> Loading products…</div>';

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    productsContainer.innerHTML = `<div class="empty-state"><p>⚠️ Failed to load products: ${escHtml(error.message)}</p></div>`;
    toast('Failed to load products', 'error');
    return;
  }

  allProducts = data || [];

  // Update last-updated
  const lu = document.getElementById('last-updated');
  if (lu) lu.textContent = 'Last updated: ' + new Date().toLocaleTimeString('en-IN');

  populateCategoryFilter();
  updateUserStats();
  showAlertBanners();
  filterProducts();
}

// ── Stats ─────────────────────────────────────────────────────
function updateUserStats() {
  const instock  = allProducts.filter(p => getProductStatus(p) === 'instock').length;
  const low      = allProducts.filter(p => getProductStatus(p) === 'low').length;
  const out      = allProducts.filter(p => getProductStatus(p) === 'outofstock').length;
  const expiring = allProducts.filter(p => ['expiring','expired'].includes(getProductStatus(p))).length;

  document.getElementById('u-stat-total').textContent  = allProducts.length;
  document.getElementById('u-stat-instock').textContent = instock;
  document.getElementById('u-stat-low').textContent     = low;
  document.getElementById('u-stat-out').textContent     = out;
  document.getElementById('u-stat-expiry').textContent  = expiring;
}

// ── Alert Banners ─────────────────────────────────────────────
function showAlertBanners() {
  const container = document.getElementById('alert-banners');
  if (!container) return;

  const lowItems     = allProducts.filter(p => getProductStatus(p) === 'low');
  const outItems     = allProducts.filter(p => getProductStatus(p) === 'outofstock');
  const expiringItems= allProducts.filter(p => getProductStatus(p) === 'expiring');
  const expiredItems = allProducts.filter(p => getProductStatus(p) === 'expired');

  let html = '';

  if (expiredItems.length > 0) {
    html += `<div class="alert-banner alert-expired">
      🚫 <strong>${expiredItems.length} product${expiredItems.length>1?'s':''} have expired</strong>:
      ${expiredItems.slice(0,3).map(p=>`<em>${escHtml(p.name)}</em>`).join(', ')}
      ${expiredItems.length>3?`and ${expiredItems.length-3} more…`:''}
    </div>`;
  }

  if (expiringItems.length > 0) {
    html += `<div class="alert-banner alert-expiring">
      ⏰ <strong>${expiringItems.length} product${expiringItems.length>1?'s':''} expiring within 30 days</strong>:
      ${expiringItems.slice(0,3).map(p=>`<em>${escHtml(p.name)}</em> (${daysUntilExpiry(p.expiry_date)}d)`).join(', ')}
      ${expiringItems.length>3?`and ${expiringItems.length-3} more…`:''}
    </div>`;
  }

  if (outItems.length > 0) {
    html += `<div class="alert-banner alert-out">
      ❌ <strong>${outItems.length} product${outItems.length>1?'s':''} out of stock</strong>:
      ${outItems.slice(0,3).map(p=>`<em>${escHtml(p.name)}</em>`).join(', ')}
      ${outItems.length>3?`and ${outItems.length-3} more…`:''}
    </div>`;
  }

  if (lowItems.length > 0) {
    html += `<div class="alert-banner alert-low">
      ⚠️ <strong>${lowItems.length} product${lowItems.length>1?'s':''} running low</strong>:
      ${lowItems.slice(0,3).map(p=>`<em>${escHtml(p.name)}</em> (${p.stock} left)`).join(', ')}
      ${lowItems.length>3?`and ${lowItems.length-3} more…`:''}
    </div>`;
  }

  container.innerHTML = html;
}

// ── Category Filter ───────────────────────────────────────────
function populateCategoryFilter() {
  const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
  const cur  = filterCat.value;
  filterCat.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escHtml(c)}"${c===cur?' selected':''}>${escHtml(c)}</option>`).join('');
}

// ── Filter + Render ───────────────────────────────────────────
function filterProducts() {
  const q   = (searchInput.value || '').trim().toLowerCase();
  const cat = filterCat.value;
  const sts = filterStatus.value;

  const filtered = allProducts.filter(p => {
    const matchQ   = !q || p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q);
    const matchCat = !cat || p.category === cat;
    const matchSts = !sts || getProductStatus(p) === sts;
    return matchQ && matchCat && matchSts;
  });

  if (q || cat || sts) {
    resultsCount.textContent = `Showing ${filtered.length} of ${allProducts.length} product${allProducts.length!==1?'s':''}`;
    resultsCount.style.display = 'block';
  } else {
    resultsCount.style.display = 'none';
  }

  renderProducts(filtered);
}

// ── Render Cards ──────────────────────────────────────────────
function renderProducts(list) {
  if (list.length === 0) {
    productsContainer.innerHTML = `
      <div class="empty-state">
        <svg width="56" height="56" fill="none" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>${allProducts.length === 0 ? 'No products available yet. Check back later!' : 'No products match your search or filters.'}</p>
      </div>`;
    return;
  }

  const cards = list.map(p => {
    const status = getProductStatus(p);
    const days   = daysUntilExpiry(p.expiry_date);

    const statusConfig = {
      instock:    { label: 'In Stock',    cls: 'status-instock',    icon: '✅' },
      low:        { label: `Low Stock (${p.stock})`, cls: 'status-low', icon: '⚠️' },
      outofstock: { label: 'Out of Stock',cls: 'status-out',         icon: '❌' },
      expiring:   { label: `Expires in ${days}d`, cls: 'status-expiring', icon: '⏰' },
      expired:    { label: 'Expired',     cls: 'status-expired',     icon: '🚫' },
    }[status];

    const cardCls = status === 'low' ? 'product-card card-low' :
                    status === 'outofstock' ? 'product-card card-out' :
                    status === 'expiring'   ? 'product-card card-expiring' :
                    status === 'expired'    ? 'product-card card-expired' :
                    'product-card';

    const expiryWarning = days <= EXPIRY_WARN_DAYS
      ? `<div class="expiry-tag ${days<=0?'expiry-tag-expired':days<=7?'expiry-tag-critical':'expiry-tag-warn'}">
          ${days <= 0 ? '🚫 Expired' : `⏰ Expires ${formatDate(p.expiry_date)}`}
         </div>`
      : '';

    return `
      <div class="${cardCls}">
        <div class="product-card-top">
          <div class="product-card-cat">${escHtml(p.category || 'General')}</div>
          <div class="product-card-status ${statusConfig.cls}">
            ${statusConfig.icon} ${statusConfig.label}
          </div>
        </div>
        <div class="product-card-name">${escHtml(p.name)}</div>
        ${expiryWarning}
        <div class="product-card-details">
          <div class="product-card-price-wrap">
            <div class="product-card-price-label">Price</div>
            <div class="product-card-price">₹${parseFloat(p.price).toFixed(2)}</div>
          </div>
          <div class="product-card-stock-wrap">
            <div class="product-card-price-label">Stock</div>
            <div class="product-card-stock ${p.stock <= LOW_STOCK_THRESHOLD ? 'stock-critical' : ''}">
              ${p.stock} units
            </div>
          </div>
        </div>
        <div class="product-card-expiry-row">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/></svg>
          Exp: ${formatDate(p.expiry_date)}
        </div>
      </div>`;
  }).join('');

  productsContainer.innerHTML = `<div class="products-grid">${cards}</div>`;
}

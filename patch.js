const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// ─── Fix 5: WhatsApp share button in vBill ─────────────────────
// Using regex to replace the print button section in vBill
code = code.replace(
  /'<button class="btn btn-s" onclick="A\.closeModal\(\)">Close<\/button><button class="btn btn-s" onclick="A\.printBill\('/g,
  '\'<button class="btn btn-s" onclick="A.closeModal()">Close</button><button class="btn btn-sm btn-s" onclick="A.shareBillWA(\''
);
code = code.replace(
  /A\.shareBillWA\('(.+?)'\)'><span class="material-icons-round">print/g,
  (m, id) => `A.shareBillWA('${id}')"><span class="material-icons-round">share</span>WhatsApp</button><button class="btn btn-s" onclick="A.printBill('${id}')"><span class="material-icons-round">print`
);
console.log('Fix 5 (WhatsApp):', code.includes('shareBillWA') ? 'OK' : 'FAIL');

// ─── Add shareBillWA function ─────────────────────────────────────
const oldPrintBill = '  printBill(id){';
const newShareBill = `  shareBillWA(id){
    const b=this.data.bills.find(b=>b.id===id);if(!b)return;
    const txt='\u{1F48A} *PharmaDist Pro \u2014 Bill '+b.id+'*\\n\u2022 Pharmacy: '+b.phName+'\\n\u2022 Amount: \u20b9'+this.fmt(b.amt)+'\\n\u2022 Due: '+b.due+'\\n\u2022 Status: '+(b.status==='paid'?'\u2705 PAID':'\u274c UNPAID')+'\\n\\nPay via UPI: '+this.data.dist.upi+'\\nLogin: '+window.location.origin;
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  },
  printBill(id){`;
code = code.replace(oldPrintBill, newShareBill);
console.log('shareBillWA fn:', code.includes('shareBillWA(id)') ? 'OK' : 'FAIL');

// ─── Fix 4: Add changeAdminPw function ───────────────────────────
const oldPwStrength = "  pwStrength(pw,fillId='ps-fill'){";
const newChangePw = `  async changeAdminPw(){
    const cur=Q('#cp-cur')?.value,np=Q('#cp-new')?.value,cf=Q('#cp-cf')?.value;
    if(!cur||!np||!cf){this.toast('Fill all fields','err');return;}
    if(np!==cf){this.toast('Passwords do not match','err');return;}
    if(np.length<8){this.toast('Min 8 characters','err');return;}
    const res=await apiPost('/admin/change-password',{currentPassword:cur,newPassword:np});
    if(res?.ok){this.toast('\u2714 Password changed!','ok');Q('#cp-cur').value='';Q('#cp-new').value='';Q('#cp-cf').value='';}
    else{this.toast(res?.msg||'Failed \u2013 wrong current password','err');}
  },
  pwStrength(pw,fillId='ps-fill'){`;
code = code.replace(oldPwStrength, newChangePw);
console.log('Fix 4 (changeAdminPw):', code.includes('changeAdminPw') ? 'OK' : 'FAIL');

// ─── Fix 4: Add change-password card to admin rProfile ──────────────
const marker = 'style="vertical-align:middle;margin-right:6px;font-size:18px">storefront</span>Distributor Settings';
if(code.includes(marker)){
  code = code.replace(marker,
    'style="vertical-align:middle;margin-right:6px;font-size:18px">lock_reset</span>Change Password</h3></div><div class="cb">' +
    '<div class="fr"><div class="fg"><label>Current Password</label><input id="cp-cur" type="password" autocorrect="off" autocapitalize="none" placeholder="Current password"></div>' +
    '<div class="fg"><label>New Password</label><input id="cp-new" type="password" autocorrect="off" autocapitalize="none" placeholder="Min 8 chars" oninput="A.pwStrength(this.value,\'cp-fill\')"></div></div>' +
    '<div id="ps-bar-cp" style="height:4px;border-radius:2px;background:var(--bdr);margin:-12px 0 14px;overflow:hidden"><div id="cp-fill" style="height:100%;width:0;transition:width .3s,background .3s"></div></div>' +
    '<div class="fg"><label>Confirm New Password</label><input id="cp-cf" type="password" autocorrect="off" autocapitalize="none" placeholder="Repeat new password"></div>' +
    '<button class="btn btn-p" onclick="A.changeAdminPw()"><span class="material-icons-round">lock</span>Change Password</button></div></div>' +
    '<div class="card" style="margin-top:14px"><div class="ch"><h3><span class="material-icons-round" ' +
    'style="vertical-align:middle;margin-right:6px;font-size:18px">storefront</span>Distributor Settings'
  );
  console.log('Fix 4 (cp card):', code.includes('cp-cur') ? 'OK' : 'FAIL');
} else {
  console.log('Fix 4 (cp card): FAIL - marker not found');
}

// ─── Fix 7: Add inventory to admin nav ───────────────────────────
code = code.replace(
  "return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'dist-inventory',i:'inventory_2',l:'My Stock'},{p:'pharmacies'",
  "return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'pharmacies'"
);
// Check if dist-inventory nav already added by previous patch
if(!code.includes("p:'dist-inventory'")) {
  code = code.replace(
    "return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'pharmacies'",
    "return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'dist-inventory',i:'inventory_2',l:'My Stock'},{p:'pharmacies'"
  );
  console.log('Fix 7 (nav):', code.includes("p:'dist-inventory'") ? 'OK' : 'FAIL');
} else {
  console.log('Fix 7 (nav): already present');
}

// ─── Fix 7: Handle dist-inventory page routing ────────────────────
if(!code.includes("p==='dist-inventory'")){
  code = code.replace(
    "if(p==='analytics'){this.setHT('Analytics');pc.innerHTML=this.rAnalytics();",
    "if(p==='dist-inventory'){this.setHT('My Stock');pc.innerHTML=await this.rDistInventory();return;}\n    if(p==='analytics'){this.setHT('Analytics');pc.innerHTML=this.rAnalytics();"
  );
  console.log('Fix 7 (routing):', code.includes("p==='dist-inventory'") ? 'OK' : 'FAIL');
} else {
  console.log('Fix 7 (routing): already present');
}

// ─── Fix 7: Add rDistInventory function ──────────────────────────
if(!code.includes('rDistInventory')){
  const insertBefore = "  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  //  SAAS ANALYTICS PAGE (Admin Only)\n  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  rAnalytics(){";
  const distInvFns = `  async rDistInventory(){
    const res=await apiGet('/dist-stock');
    if(res)this.data.distStock=res;
    const items=this.data.distStock||[];
    const low=items.filter(i=>i.stock<=i.min_stock);
    return '<div class="ph"><div class="pt"><h1>My Stock</h1><p>Distributor inventory \u2014 drugs you supply to pharmacies.</p></div>' +
    '<button class="btn btn-p" onclick="A.addStockModal()"><span class="material-icons-round">add</span>Add Item</button> ' +
    '<button class="btn btn-s" onclick="A.nav(\'dist-inventory\')"><span class="material-icons-round">refresh</span>Refresh</button></div>' +
    (low.length>0?'<div class="card" style="margin-bottom:14px;border-color:rgba(255,71,87,.3)"><div class="ch"><h3 style="color:var(--err)"><span class="material-icons-round">warning</span> Low Stock</h3><span class="badge b-err">'+low.length+' items</span></div><div class="cb">'+low.map(i=>'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bdr)"><span>'+i.name+'</span><span style="color:var(--err);font-weight:700">'+i.stock+' '+i.unit+' left</span></div>').join('')+'</div></div>':'') +
    '<div class="card">' + (items.length===0?'<div class="empty"><span class="material-icons-round">inventory_2</span><h3>No items yet</h3></div>':
    '<div class="tw"><table><thead><tr><th>Name</th><th>Cat</th><th>Mfr</th><th>Price</th><th>MRP</th><th>Stock</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
    items.map(i=>'<tr><td><strong>'+i.name+'</strong></td><td>'+i.category+'</td><td>'+(i.mfr||'-')+'</td><td>\u20b9'+this.fmt(i.price)+'</td><td>\u20b9'+this.fmt(i.mrp)+'</td>'+
    '<td style="color:'+(i.stock<=i.min_stock?'var(--err)':'var(--ok)')+'">'+i.stock+' '+i.unit+'</td><td>'+(i.expiry||'-')+'</td>'+
    '<td>'+(i.stock===0?'<span class="badge b-err">Out</span>':i.stock<=i.min_stock?'<span class="badge b-warn">Low</span>':'<span class="badge b-ok">OK</span>')+'</td>'+
    '<td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.editStockModal(\''+i.id+'\')"><span class="material-icons-round">edit</span></button>'+
    '<button class="btn btn-sm btn-er" onclick="A.delStock(\''+i.id+'\')"><span class="material-icons-round">delete</span></button></div></td></tr>').join('')+
    '</tbody></table></div>') + '</div>';
  },
  addStockModal(){
    this.showModal('Add Stock Item',
    '<div class="fr"><div class="fg"><label>Drug Name *</label><input id="si-name" placeholder="e.g. Paracetamol 500mg"></div>' +
    '<div class="fg"><label>Category</label><select id="si-cat"><option>Analgesic</option><option>Antibiotic</option><option>Antacid</option><option>Vitamin</option><option>Antidiabetic</option><option>General</option></select></div></div>' +
    '<div class="fr"><div class="fg"><label>Manufacturer</label><input id="si-mfr" placeholder="e.g. Sun Pharma"></div>' +
    '<div class="fg"><label>Unit</label><select id="si-unit"><option>Strip</option><option>Bottle</option><option>Box</option><option>Vial</option></select></div></div>' +
    '<div class="fr"><div class="fg"><label>Price (₹) *</label><input id="si-price" type="number" min="0" step="0.01" placeholder="0.00"></div>' +
    '<div class="fg"><label>MRP (₹)</label><input id="si-mrp" type="number" min="0" step="0.01" placeholder="0.00"></div></div>' +
    '<div class="fr"><div class="fg"><label>Stock Qty *</label><input id="si-stock" type="number" min="0" placeholder="0"></div>' +
    '<div class="fg"><label>Min Alert</label><input id="si-min" type="number" min="0" placeholder="10"></div></div>' +
    '<div class="fg"><label>Expiry Date</label><input id="si-exp" type="date"></div>',
    '<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveStock()"><span class="material-icons-round">add</span>Add Item</button>');
  },
  async saveStock(){
    const name=(Q('#si-name')?.value||'').trim(),price=parseFloat(Q('#si-price')?.value),stock=parseInt(Q('#si-stock')?.value);
    if(!name||isNaN(price)||isNaN(stock)){this.toast('Fill required fields','err');return;}
    const res=await apiPost('/dist-stock',{name,category:Q('#si-cat')?.value,mfr:(Q('#si-mfr')?.value||'').trim(),unit:Q('#si-unit')?.value,price,mrp:parseFloat(Q('#si-mrp')?.value)||price,stock,min_stock:parseInt(Q('#si-min')?.value)||10,expiry:Q('#si-exp')?.value});
    if(res?.ok){this.closeModal();this.toast('Item added!','ok');this.nav('dist-inventory');}else{this.toast('Failed to add item','err');}
  },
  editStockModal(id){
    const i=(this.data.distStock||[]).find(s=>s.id===id);if(!i)return;
    this.showModal('Edit: '+i.name,
    '<div class="fr"><div class="fg"><label>Name *</label><input id="si-name" value="'+i.name+'"></div>' +
    '<div class="fg"><label>Category</label><input id="si-cat" value="'+i.category+'"></div></div>' +
    '<div class="fr"><div class="fg"><label>Manufacturer</label><input id="si-mfr" value="'+(i.mfr||'')+'"></div>' +
    '<div class="fg"><label>Unit</label><input id="si-unit" value="'+(i.unit||'Strip')+'"></div></div>' +
    '<div class="fr"><div class="fg"><label>Price (₹)</label><input id="si-price" type="number" value="'+i.price+'"></div>' +
    '<div class="fg"><label>MRP (₹)</label><input id="si-mrp" type="number" value="'+i.mrp+'"></div></div>' +
    '<div class="fr"><div class="fg"><label>Stock Qty</label><input id="si-stock" type="number" value="'+i.stock+'"></div>' +
    '<div class="fg"><label>Min Stock</label><input id="si-min" type="number" value="'+i.min_stock+'"></div></div>' +
    '<div class="fg"><label>Expiry</label><input id="si-exp" type="date" value="'+(i.expiry||'')+'"></div>',
    '<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.updateStock(\''+id+'\')">Update</button>');
  },
  async updateStock(id){
    const name=(Q('#si-name')?.value||'').trim();if(!name){this.toast('Name required','err');return;}
    const res=await apiPut('/dist-stock/'+id,{name,category:(Q('#si-cat')?.value||'').trim(),mfr:(Q('#si-mfr')?.value||'').trim(),unit:(Q('#si-unit')?.value||'').trim(),price:parseFloat(Q('#si-price')?.value)||0,mrp:parseFloat(Q('#si-mrp')?.value)||0,stock:parseInt(Q('#si-stock')?.value)||0,min_stock:parseInt(Q('#si-min')?.value)||10,expiry:Q('#si-exp')?.value});
    if(res?.ok){const item=(this.data.distStock||[]).find(s=>s.id===id);if(item){item.name=name;item.stock=parseInt(Q('#si-stock')?.value)||0;}this.closeModal();this.toast('Updated!','ok');this.nav('dist-inventory');}else{this.toast('Update failed','err');}
  },
  async delStock(id){
    if(!confirm('Delete this stock item?'))return;
    const res=await apiDel('/dist-stock/'+id);
    if(res?.ok){this.data.distStock=(this.data.distStock||[]).filter(s=>s.id!==id);this.toast('Deleted','warn');this.nav('dist-inventory');}else{this.toast('Delete failed','err');}
  },

  `;
  const analyticsIdx = code.indexOf(insertBefore);
  if(analyticsIdx > -1){
    code = code.slice(0, analyticsIdx) + distInvFns + code.slice(analyticsIdx);
    console.log('Fix 7 (rDistInventory):', 'OK');
  } else {
    console.log('Fix 7 (rDistInventory): FAIL - anchor not found');
  }
} else {
  console.log('Fix 7 (rDistInventory): already present');
}

fs.writeFileSync('app.js', code, 'utf8');
console.log('\nAll patches done!');

// ============================================================
//  PharmaDist Pro — Frontend App (Dual Mode)
//  Server Mode: Full JWT auth via backend API
//  Demo Mode:   localStorage (GitHub Pages / offline)
// ============================================================

// ── 🔧 BACKEND SERVER URL ─────────────────────────────────────
//  Render  (primary, FREE forever): https://pharmdist-pro.onrender.com
//  Railway (backup, expires ~25d):  https://web-production-e4fbb.up.railway.app
const RAILWAY_URL = 'https://pharmdist-pro.onrender.com';
// ─────────────────────────────────────────────────────────────

const API = (() => {
  const loc = window.location;
  // Localhost → use local server
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1')
    return loc.origin + '/api';
  // GitHub Pages → use Railway if configured, else demo mode
  if (RAILWAY_URL) return RAILWAY_URL.replace(/\/$/, '') + '/api';
  return null;  // → demo mode
})();
let _demoMode = false;

// Demo credentials — active when backend is offline/sleeping
const DEMO_CREDS = {
  admin: { email:'admin@pharmadist.com', pw:'admin123', user:{id:'adm1',name:'Admin',email:'admin@pharmadist.com',role:'admin',init:'A',isSuper:true} },
  ph1:   { email:'citypharma@demo.com', pw:'pharmacy123', user:{id:'ph1',name:'City Pharma',email:'citypharma@demo.com',role:'pharmacy',init:'C',phId:'ph1'} },
  ph2:   { email:'healthplus@demo.com', pw:'health123', user:{id:'ph2',name:'HealthPlus Pharmacy',email:'healthplus@demo.com',role:'pharmacy',init:'H',phId:'ph2'} },
};

const DEMO_SEED = {
  dist:{name:'PharmaDist Pro',address:'100 Industrial Area, Pune, MH 411057',phone:'+91 20 1234 5678',mobile:'+91 99887 76655',email:'support@pharmadist.com',gst:'27ABCDE1234F1Z5',license:'MH-DIST-2020-001',upi:'pharmadist@okicici'},
  pharmacies:[
    {id:'ph1',name:'City Pharma',address:'45 MG Road, Bengaluru',license:'KAR-PH-2024-001',contact:'+91 98765 43210',email:'citypharma@demo.com',plan:'1500',planExpiry:'2026-12-31',waived:false,status:'active',joined:'2024-01-15',docs:[{id:'d1',name:'Drug License 2024.pdf',date:'2024-01-15',size:'245 KB'}]},
    {id:'ph2',name:'HealthPlus Pharmacy',address:'12 Park Street, Kolkata',license:'WB-PH-2024-042',contact:'+91 97654 32109',email:'healthplus@demo.com',plan:'1000',planExpiry:'2026-11-30',waived:false,status:'active',joined:'2024-03-20',docs:[]},
    {id:'ph3',name:'MediCare Pharma',address:'78 Anna Nagar, Chennai',license:'TN-PH-2024-115',contact:'+91 96543 21098',email:'medicare@demo.com',plan:null,planExpiry:null,waived:false,status:'pending',joined:'2024-06-01',docs:[]}
  ],
  drugs:[
    {id:'g1',phId:'ph1',name:'Paracetamol 500mg',gen:'Acetaminophen',cat:'Analgesic',mfr:'Sun Pharma',batch:'B2024001',qty:500,min:100,price:2.50,mrp:3.50,exp:'2026-08-01',bc:'8901234567890'},
    {id:'g2',phId:'ph1',name:'Amoxicillin 250mg',gen:'Amoxicillin',cat:'Antibiotic',mfr:'Cipla',batch:'B2024002',qty:35,min:50,price:8.00,mrp:12.00,exp:'2026-05-15',bc:''},
    {id:'g3',phId:'ph1',name:'Metformin 500mg',gen:'Metformin HCL',cat:'Antidiabetic',mfr:'Mankind',batch:'B2024003',qty:200,min:80,price:3.50,mrp:5.00,exp:'2027-01-31',bc:''},
    {id:'g4',phId:'ph1',name:'Atorvastatin 10mg',gen:'Atorvastatin',cat:'Statin',mfr:"Dr. Reddy's",batch:'B2024004',qty:15,min:60,price:12.00,mrp:18.00,exp:'2026-06-30',bc:''},
    {id:'g5',phId:'ph1',name:'Omeprazole 20mg',gen:'Omeprazole',cat:'PPI',mfr:'Torrent',batch:'B2024005',qty:300,min:100,price:4.00,mrp:6.00,exp:'2026-04-30',bc:''},
    {id:'g6',phId:'ph1',name:'Cetirizine 10mg',gen:'Cetirizine',cat:'Antihistamine',mfr:'Zydus',batch:'B2024006',qty:450,min:100,price:1.50,mrp:2.50,exp:'2027-03-01',bc:''},
    {id:'g7',phId:'ph2',name:'Azithromycin 500mg',gen:'Azithromycin',cat:'Antibiotic',mfr:'Pfizer',batch:'B2024101',qty:80,min:50,price:45.00,mrp:65.00,exp:'2026-09-30',bc:''},
    {id:'g8',phId:'ph2',name:'Losartan 50mg',gen:'Losartan Potassium',cat:'Antihypertensive',mfr:'Novartis',batch:'B2024102',qty:20,min:40,price:18.00,mrp:25.00,exp:'2026-07-31',bc:''}
  ],
  orders:[
    {id:'ORD-001',type:'inventory',phId:'ph1',phName:'City Pharma',drugs:[{name:'Paracetamol 500mg',qty:500,up:2.50,tot:1250},{name:'Metformin 500mg',qty:200,up:3.50,tot:700}],sub:1950,gst:97.50,tot:2047.50,date:'2026-04-01',status:'delivered',del:'free',notes:'',billed:true,cust:''},
    {id:'ORD-002',type:'inventory',phId:'ph2',phName:'HealthPlus Pharmacy',drugs:[{name:'Azithromycin 500mg',qty:100,up:45.00,tot:4500}],sub:4500,gst:225,tot:4725,date:'2026-04-05',status:'approved',del:'paid',notes:'',billed:true,cust:''},
    {id:'ORD-003',type:'inventory',phId:'ph1',phName:'City Pharma',drugs:[{name:'Amoxicillin 250mg',qty:100,up:8.00,tot:800},{name:'Atorvastatin 10mg',qty:100,up:12.00,tot:1200}],sub:2000,gst:100,tot:2100,date:'2026-04-10',status:'pending',del:'paid',notes:'Urgent',billed:false,cust:''},
    {id:'ORD-004',type:'customer',phId:'ph1',phName:'City Pharma',drugs:[{name:'Paracetamol 500mg',qty:10,up:3.50,tot:35}],sub:35,gst:1.75,tot:36.75,date:'2026-04-12',status:'delivered',del:'',notes:'',billed:false,cust:'Priya Sharma'},
    {id:'ORD-005',type:'customer',phId:'ph1',phName:'City Pharma',drugs:[{name:'Cetirizine 10mg',qty:5,up:2.50,tot:12.50}],sub:12.50,gst:0.63,tot:13.13,date:'2026-04-14',status:'pending',del:'',notes:'',billed:false,cust:'Rahul Verma'}
  ],
  bills:[
    {id:'BILL-001',phId:'ph1',phName:'City Pharma',ordId:'ORD-001',amt:2047.50,date:'2026-04-01',due:'2026-04-16',status:'paid',type:'bulk',paid:'2026-04-05'},
    {id:'BILL-002',phId:'ph2',phName:'HealthPlus Pharmacy',ordId:'ORD-002',amt:4725,date:'2026-04-05',due:'2026-04-20',status:'unpaid',type:'bulk',paid:null},
    {id:'BILL-003',phId:'ph1',phName:'City Pharma',ordId:'ORD-003',amt:2100,date:'2026-04-10',due:'2026-04-25',status:'unpaid',type:'bulk',paid:null}
  ],
  returns:[
    {id:'RET-001',phId:'ph1',phName:'City Pharma',reason:'expired',drugs:[{name:'Omeprazole 20mg',qty:100,batch:'B2023005'}],date:'2026-04-15',status:'pending',notes:'Batch expired before sale',anote:''},
    {id:'RET-002',phId:'ph2',phName:'HealthPlus Pharmacy',reason:'wrong',drugs:[{name:'Losartan 50mg',qty:30,batch:'B2024102'}],date:'2026-04-16',status:'approved',notes:'Wrong drug delivered',anote:'Will be replaced'}
  ],
  tickets:[{id:'TKT-001',phId:'ph1',phName:'City Pharma',subject:'Payment not reflected',type:'billing',date:'2026-04-14',status:'open',msgs:[{from:'pharmacy',text:'I paid BILL-001 but still shows unpaid',time:'10:30 AM'}]}],
  notifs:[
    {id:'n1',type:'order',msg:'New order ORD-003 from City Pharma',date:'2026-04-10',read:false,admin:true,ph:null},
    {id:'n2',type:'return',msg:'Return RET-001 from City Pharma',date:'2026-04-15',read:false,admin:true,ph:null},
    {id:'n3',type:'expiry',msg:'Omeprazole 20mg expiring soon!',date:'2026-04-19',read:false,admin:false,ph:'ph1'},
    {id:'n4',type:'stock',msg:'Atorvastatin 10mg critically low (15 units)',date:'2026-04-19',read:false,admin:false,ph:'ph1'}
  ],
  chats:[{from:'support',text:'Hello! Welcome to PharmaDist Support.',time:'09:00 AM'}]
};
function demoSave(){if(_demoMode)localStorage.setItem('pd_data',JSON.stringify(A.data));}
function demoLoad(){try{const s=localStorage.getItem('pd_data');if(s)return JSON.parse(s);}catch{}return JSON.parse(JSON.stringify(DEMO_SEED));}

// API helper — auto-injects Bearer JWT token, handles 401 session expiry
async function apiFetch(path, opts={}) {
  if (_demoMode) return null;
  try {
    const token = (typeof A !== 'undefined' && A._token) || localStorage.getItem('pd_token');
    const headers = {'Content-Type':'application/json', ...(token ? {'Authorization':'Bearer '+token} : {})};
    const res = await fetch(API + path, {
      headers,
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401 && typeof A !== 'undefined' && A.st?.user) {
      localStorage.removeItem('pd_token'); localStorage.removeItem('pd_user');
      A._token = null; A.st.user = null; A.st.role = null; A.st.page = 'login';
      A.render(); A.toast('Session expired. Please sign in again.','warn'); return null;
    }
    return await res.json();
  } catch(e) {
    console.error('API error:', path, e);
    return null;
  }
}
async function apiGet(path) { return apiFetch(path); }
async function apiPost(path, body) { return apiFetch(path, {method:'POST', body}); }
async function apiPut(path, body) { return apiFetch(path, {method:'PUT', body}); }
async function apiDel(path) { return apiFetch(path, {method:'DELETE'}); }

const A = {
  _token: null,
  _lmode: 'signin',
  _sse: null,
  st:{user:null,role:null,page:'login',params:{},filt:{},charts:{}},
  data:{pharmacies:[],drugs:[],orders:[],bills:[],returns:[],tickets:[],notifs:[],chats:[],dist:{},products:[]},

  async init(){
    // Try connecting to server
    if (API) {
      try {
      const resp = await fetch(API + '/dist', {signal: AbortSignal.timeout(6000)});
        if (resp.ok) { const d = await resp.json(); if(d&&d.name){this.data.dist=d; _demoMode=false;} else _demoMode=true; }
        else _demoMode = true;
      } catch { _demoMode = true; }
    } else { _demoMode = true; }

    if (_demoMode) {
      console.log('%c🔸 Demo Mode — server offline, using localStorage','color:#FFB547;font-weight:bold');
      const d = demoLoad(); Object.assign(this.data, d);
    }

    // Restore session
    const savedToken = localStorage.getItem('pd_token');
    const savedUser  = localStorage.getItem('pd_user');
    if (savedToken && savedUser) {
      this._token = savedToken;
      if (_demoMode) {
        this.st.user = JSON.parse(savedUser);
        this.st.role = this.st.user.role;
        this.st.page = 'dashboard';
      } else {
        try {
          const me = await apiGet('/me');
          if (me?.ok) {
            this.st.user = JSON.parse(savedUser);
            this.st.role = this.st.user.role;
            this.st.page = 'dashboard';
            await this.loadAll();
            this.connectSSE();
          } else {
            localStorage.removeItem('pd_token'); localStorage.removeItem('pd_user');
            this._token = null;
          }
        } catch { localStorage.removeItem('pd_token'); localStorage.removeItem('pd_user'); this._token = null; }
      }
    }
    this.render();
  },

  // Real-time SSE connection
  connectSSE(){
    if (!API || _demoMode || !this._token) return;
    if (this._sse) { try { this._sse.close(); } catch(_){} }
    const url = API + '/sse?token=' + encodeURIComponent(this._token);
    const es = new EventSource(url);
    this._sse = es;
    es.addEventListener('connected', () => {
      console.log('%c🔔 SSE connected — real-time notifications active','color:#00D48E');
      this.requestNotifPerm();
    });
    es.addEventListener('notif', e => {
      try {
        const n = JSON.parse(e.data);
        this.data.notifs.unshift(n);
        this.toast(n.msg, n.type === 'stock' || n.type === 'expiry' ? 'warn' : 'ok');
        this.showBrowserNotif('PharmaDist Pro', n.msg);
        const dot = Q('.ndot'); if (dot) dot.style.display = 'block';
      } catch(_){}
    });
    es.addEventListener('order', e => {
      try {
        const d = JSON.parse(e.data);
        this.toast('New order from ' + (d.phName || 'pharmacy'), 'ok', d.id);
        this.showBrowserNotif('New Order Received', 'From ' + (d.phName || 'pharmacy') + ' · ' + d.id);
      } catch(_){}
    });
    es.onerror = () => {
      es.close();
      if (this._token) setTimeout(() => this.connectSSE(), 10000);
    };
  },

  requestNotifPerm(){
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },
  showBrowserNotif(title, body){
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: '/favicon.ico' }); } catch(_){}
    }
  },

  disconnectSSE(){
    if (this._sse) { try { this._sse.close(); } catch(_){} this._sse = null; }
  },

  async loadAll(){
    if (_demoMode) return;
    const [phs, ords, bills, rets, tks, notifs, chats] = await Promise.all([
      apiGet('/pharmacies'),
      apiGet('/orders'),
      apiGet('/bills'),
      apiGet('/returns'),
      apiGet('/tickets'),
      apiGet('/notifs?role='+this.st.role+(this.st.user?.phId?'&phId='+this.st.user.phId:'')),
      apiGet('/chats')
    ]);
    if (phs) this.data.pharmacies = phs;
    if (ords) this.data.orders = ords;
    if (bills) this.data.bills = bills;
    if (rets) this.data.returns = rets;
    if (tks) this.data.tickets = tks;
    if (notifs) this.data.notifs = notifs;
    if (chats) this.data.chats = chats.map(c=>({from:c.from_role,text:c.text,time:c.time}));
    if (this.st.role === 'pharmacy' && this.st.user?.phId) {
      const drugs = await apiGet('/drugs?phId='+this.st.user.phId);
      if (drugs) this.data.drugs = drugs;
    } else {
      const drugs = await apiGet('/drugs');
      if (drugs) this.data.drugs = drugs;
    }
    // Load public products catalog
    const prods = await apiGet('/products');
    if (prods) this.data.products = prods;
  },

  save(){ demoSave(); },

  async login(role){
    const em = Q('#lem')?.value.trim(), pw = Q('#lpw')?.value.trim();
    const rem = Q('#lrm')?.checked ?? false;
    if (!em || !pw) { this.toast('Enter email and password','err'); return; }
    const btn=Q('#lbtn');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="material-icons-round spin">autorenew</span>Signing in…';}

    if (_demoMode) {
      const match = Object.values(DEMO_CREDS).find(c => c.email === em.toLowerCase() && c.pw === pw);
      if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">login</span>Sign In';}
      if (!match) { this.toast('Invalid credentials','err'); return; }
      this._token = 'demo_' + Date.now();
      localStorage.setItem('pd_token', this._token);
      localStorage.setItem('pd_user', JSON.stringify(match.user));
      this.st.user = match.user; this.st.role = match.user.role; this.st.page = 'dashboard';
      this.render();
      this.toast('Welcome, '+match.user.name+'! 👋','ok');
      return;
    }

    // Try login with selected role first
    let res = await apiPost('/login', {role, email:em, password:pw, rememberMe:rem, device:'Web Browser'});

    // If selected role fails, auto-try the other role (helps admins who click wrong tab)
    if (!res?.ok && res?.msg?.toLowerCase().includes('invalid')) {
      const otherRole = role === 'admin' ? 'pharmacy' : 'admin';
      const res2 = await apiPost('/login', {role:otherRole, email:em, password:pw, rememberMe:rem, device:'Web Browser'});
      if (res2?.ok) {
        res = res2;
        // Correct the tab UI to match actual role
        this._lr = otherRole;
        Q('#tab-a')?.classList.toggle('active', otherRole==='admin');
        Q('#tab-p')?.classList.toggle('active', otherRole==='pharmacy');
      }
    }

    if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">login</span>Sign In';}
    if (!res) { this.toast('Server error – is the backend running?','err'); return; }
    if (res.ok) {
      this._token = res.token;
      localStorage.setItem('pd_token', res.token);
      localStorage.setItem('pd_user', JSON.stringify(res.user));
      this.st.user = res.user;
      this.st.role = res.role;
      this.st.page = 'dashboard';
      this.toast('Loading data…','ok');
      await this.loadAll();
      this.connectSSE();
      this.render();
      this.toast('Welcome back, '+res.user.name+'! 👋','ok');
    } else {
      // Give a helpful error message
      const hint = role==='admin'
        ? 'Make sure the Admin tab is selected and you are using the admin email & password.'
        : 'Make sure the Pharmacy tab is selected and your account is approved.';
      this.toast(res.msg || 'Invalid credentials','err',hint);
    }
  },

  logout(){
    // Fire logout API in background — don't wait for it or block on it
    try { apiPost('/logout',{}).catch(()=>{}); } catch(_){}
    // Disconnect SSE
    this.disconnectSSE();
    // Immediately clear local state
    localStorage.removeItem('pd_token'); localStorage.removeItem('pd_user');
    this._token = null;
    this.killCharts(); this.closeModal();
    const np = Q('#np'); if (np) np.classList.remove('open');
    this.st.user=null; this.st.role=null; this.st.page='login';
    this.st.filt={}; this.st.params={};
    this.data={pharmacies:[],drugs:[],orders:[],bills:[],returns:[],tickets:[],notifs:[],chats:[],dist:this.data.dist,products:[]};
    this.render();
    this.toast('Signed out successfully.','ok');
  },

  nav(p){this.killCharts();this.closeModal();this.st.page=p;this.renderPage();QA('.ni').forEach(e=>e.classList.toggle('active',e.dataset.page===p));if(window.innerWidth<900)this.closeSidebar();},
  setState(k,v){const keys=k.split('.');let o=this;for(let i=0;i<keys.length-1;i++)o=o[keys[i]];o[keys[keys.length-1]]=v;},
  killCharts(){Object.values(this.st.charts).forEach(c=>{try{c.destroy();}catch{}});this.st.charts={};},


  
  render(){
    const app=Q('#app');
    if(this.st.page==='login'){app.innerHTML=this.rLogin();this.attachLogin();}
    else{app.innerHTML=this.rShell();this.renderPage();this.updateNDot();}
  },
  renderPage(){
    const el=Q('#pc');if(!el)return;
    const pg=this.st.page,role=this.st.role;
    const mp={
      admin:{dashboard:()=>this.rAdminDash(),pharmacies:()=>this.rPharmacies(),'dist-inventory':()=>'<div class="loading-page" style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:14px"><span class="material-icons-round" style="font-size:48px;color:var(--acc);animation:spin 1s linear infinite">refresh</span><p style="color:var(--mute)">Loading stock...</p></div>',documentation:()=>this.rAdminDocs(),orders:()=>this.rAdminOrders(),quotations:()=>this.rQuotations(),subscriptions:()=>this.rSubs(),billing:()=>this.rAdminBilling(),returns:()=>this.rAdminReturns(),support:()=>this.rAdminSupport(),analytics:()=>this.rAnalytics(),audit:()=>this.rAudit(),admins:()=>this.rAdminTeam(),products:()=>this.rAdminProducts(),profile:()=>this.rProfile()},
      pharmacy:{dashboard:()=>this.rPhDash(),inventory:()=>this.rInventory(),catalog:()=>this.rPhCatalog(),orders:()=>this.rPhOrders(),documentation:()=>this.rPhDocs(),billing:()=>this.rPhBilling(),subscriptions:()=>this.rPhSubs(),returns:()=>this.rPhReturns(),support:()=>this.rPhSupport(),profile:()=>this.rProfile()}
    };
    el.innerHTML=(mp[role]?.[pg]||mp[role]?.dashboard)();
    setTimeout(()=>{
      if(pg==='dashboard'){role==='admin'?this.chartAdmin():this.chartPh();}
      if(pg==='profile')this.loadSessions();
      if(pg==='analytics'&&role==='admin')this.loadAnalytics();
      if(pg==='audit'&&role==='admin')this.loadAudit();
      if(pg==='admins'&&role==='admin')this.loadAdminTeam();
      if(pg==='products'&&role==='admin')this.loadAdminProducts();
      if(pg==='dist-inventory'&&role==='admin')this.loadDistInventory();
      if(pg==='quotations'&&role==='admin')this.loadQuotations();
      if(pg==='catalog'&&role==='pharmacy')this.loadPhCatalog();
    },50);
  },

  rLogin(){
    const m=this._lmode||'signin';
    return`<div class="login-page"><div class="lbg"></div>
    <div class="lsplit">
      <div class="lbrand">
        <div class="lbrand-logo"><span class="material-icons-round">local_pharmacy</span></div>
        <h1 class="lbrand-title">PharmaDist<br><span>Pro</span></h1>
        <p class="lbrand-sub">Complete B2B Distributor–Pharmacy Management Platform</p>
        <div class="lbrand-feats">
          <div><span class="material-icons-round">lock</span>Secure JWT Authentication</div>
          <div><span class="material-icons-round">inventory_2</span>Smart Inventory Management</div>
          <div><span class="material-icons-round">sync</span>Real-time Order Sync</div>
          <div><span class="material-icons-round">receipt_long</span>Automated Billing & GST</div>
          <div><span class="material-icons-round">bar_chart</span>SaaS Analytics Dashboard</div>
        </div>
        <div class="lbrand-version">v2.0 — Secure Edition</div>
      </div>
      <div class="lcard">
        ${m==='signin'?this._rSignIn():m==='register'?this._rRegister():this._rForgot()}
      </div>
    </div></div>`;
  },
  setLmode(m){this._lmode=m;Q('#app').innerHTML=this.rLogin();this.attachLogin();},
  _rSignIn(){const dm=_demoMode;return`<div class="llogo"><div class="licon"><span class="material-icons-round">local_pharmacy</span></div><div><div class="lh">Welcome Back</div><span class="ls">Sign in to PharmaDist Pro</span></div></div><div class="ltabs"><button class="ltab active" id="tab-a" onclick="A.setRole('admin')"><span class="material-icons-round">admin_panel_settings</span>Admin</button><button class="ltab" id="tab-p" onclick="A.setRole('pharmacy')"><span class="material-icons-round">storefront</span>Pharmacy</button></div><div id="role-hint" style="font-size:.75rem;color:var(--acc);margin:-6px 0 10px;padding:5px 10px;background:rgba(108,99,255,.1);border-radius:6px;display:flex;align-items:center;gap:5px"><span class="material-icons-round" style="font-size:14px">admin_panel_settings</span>Signing in as <strong>Admin</strong> &mdash; use your admin email &amp; password</div>${_demoMode?"<div style=\"padding:10px 12px;background:rgba(255,181,71,.1);border:1px solid rgba(255,181,71,.35);border-radius:8px;margin-bottom:14px;font-size:.78rem\"><div style=\"font-weight:700;color:var(--warn);margin-bottom:6px\">⚠ Offline Demo Mode</div><div style=\"color:var(--txt2);margin-bottom:3px\"><strong style=\"color:var(--txt)\">Admin:</strong> admin@pharmadist.com / admin123</div><div style=\"color:var(--txt2);margin-bottom:3px\"><strong style=\"color:var(--txt)\">Pharmacy 1:</strong> citypharma@demo.com / pharmacy123</div><div style=\"color:var(--txt2)\"><strong style=\"color:var(--txt)\">Pharmacy 2:</strong> healthplus@demo.com / health123</div></div>":""}<div class="fg"><label>Email Address</label><input id="lem" type="email" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Enter your email" autocomplete="email"></div><div class="fg pwrap"><label>Password</label><input id="lpw" type="password" placeholder="Enter your password" autocomplete="current-password" autocorrect="off" autocapitalize="none" spellcheck="false" onkeypress="if(event.key==='Enter')A.login(A._lr||'admin')"><button class="pw-toggle" onclick="A.togglePw('lpw',this)"><span class="material-icons-round">visibility</span></button></div><div class="lrow"><label class="lcheck"><input type="checkbox" id="lrm"> <span>Remember me for 30 days</span></label><button class="link-btn" onclick="A.setLmode('forgot')">Forgot password?</button></div><button class="btn btn-p btn-lg" id="lbtn" style="width:100%;justify-content:center" onclick="A.login(A._lr||'admin')"><span class="material-icons-round">login</span>Sign In</button><div style="text-align:center;margin-top:16px;font-size:.875rem;color:var(--mute)">New pharmacy? <button class="link-btn" onclick="A.setLmode('register')">Create an account →</button></div>` ;},
  _rRegister(){return`<div class="llogo"><div class="licon" style="background:linear-gradient(135deg,#00D48E,#0099FF)"><span class="material-icons-round">storefront</span></div><div><div class="lh">Create Account</div><span class="ls">Register your pharmacy</span></div></div>
    <div class="fg"><label>Pharmacy Name *</label><input id="rn" placeholder="e.g. City MediCenter" autocomplete="organization"></div>
    <div class="fg"><label>Email Address *</label><input id="rem2" type="email" placeholder="pharmacy@email.com" autocomplete="email"></div>
    <div class="fg pwrap"><label>Password * <span style="font-size:.72rem;color:var(--mute)">(min 8 chars)</span></label><input id="rpw" type="password" placeholder="Create a strong password" oninput="A.pwStrength(this.value,'ps-fill')" autocomplete="new-password"><button class="pw-toggle" onclick="A.togglePw('rpw',this)"><span class="material-icons-round">visibility</span></button></div>
    <div id="ps-bar" style="height:4px;border-radius:2px;background:var(--bdr);margin:-12px 0 14px;overflow:hidden"><div id="ps-fill" style="height:100%;width:0;transition:all .3s;border-radius:2px"></div></div>
    <div class="fr"><div class="fg"><label>Contact</label><input id="rc2" type="tel" placeholder="+91 XXXXX XXXXX"></div><div class="fg"><label>License No.</label><input id="rl2" placeholder="e.g. KAR-PH-001"></div></div>
    <div class="fg"><label>Plan</label><select id="rplan"><option value="">No Plan (Request Trial)</option><option value="1000">Basic – ₹1000/mo (Paid Delivery)</option><option value="1500">Premium – ₹1500/mo (Free Delivery)</option></select></div>
    <button class="btn btn-p btn-lg" id="rbtn" style="width:100%;justify-content:center;margin-top:4px" onclick="A.register()"><span class="material-icons-round">person_add</span>Create Account</button>
    <div style="text-align:center;margin-top:14px;font-size:.875rem;color:var(--mute)">Already registered? <button class="link-btn" onclick="A.setLmode('signin')">Sign in →</button></div>`;},
  _rForgot(){return`<div class="llogo"><div class="licon" style="background:linear-gradient(135deg,#FFB547,#FF6B35)"><span class="material-icons-round">lock_reset</span></div><div><div class="lh">Reset Password</div><span class="ls">Enter your pharmacy email</span></div></div>
    <div id="forgot-form"><div class="fg"><label>Email Address</label><input id="fem" type="email" placeholder="your@pharmacy.com" autocomplete="email"></div>
    <button class="btn btn-p btn-lg" style="width:100%;justify-content:center" onclick="A.forgotPassword()"><span class="material-icons-round">send</span>Send Reset Token</button></div>
    <div id="reset-form" style="display:none"><div id="reset-hint"></div>
    <div class="ai info" style="margin-bottom:14px"><span class="material-icons-round ai-icon">key</span><div class="ai-txt"><strong>Reset Token (Demo Mode)</strong><span>In production this is emailed. Copy the token below and paste it.</span></div></div>
    <div id="rtoken-wrap"><div class="fg"><label>Reset Token</label><textarea id="rtoken" style="font-family:monospace;font-size:.75rem;resize:none;min-height:60px" placeholder="Paste token here…"></textarea></div>
    <div class="fg pwrap"><label>New Password</label><input id="rnpw" type="password" placeholder="Min. 8 characters" oninput="A.pwStrength(this.value,'ps-fill2')"><button class="pw-toggle" onclick="A.togglePw('rnpw',this)"><span class="material-icons-round">visibility</span></button></div>
    <div id="ps-bar2" style="height:4px;border-radius:2px;background:var(--bdr);margin:-12px 0 14px;overflow:hidden"><div id="ps-fill2" style="height:100%;width:0;transition:all .3s;border-radius:2px"></div></div>
    <button class="btn btn-ok btn-lg" style="width:100%;justify-content:center" onclick="A.resetPassword()"><span class="material-icons-round">lock_reset</span>Reset Password</button></div>
    <div style="text-align:center;margin-top:16px"><button class="link-btn" onclick="A.setLmode('signin')">← Back to Sign In</button></div>`;},
  _lr:'admin',
  attachLogin(){Q('#lpw')?.addEventListener('keypress',e=>{if(e.key==='Enter')this.login(this._lr);});},
  setRole(r){
    this._lr=r;
    Q('#tab-a')?.classList.toggle('active',r==='admin');
    Q('#tab-p')?.classList.toggle('active',r==='pharmacy');
    const hint=Q('#role-hint');
    if(hint){
      if(r==='admin')hint.innerHTML='<span class="material-icons-round" style="font-size:14px">admin_panel_settings</span>Signing in as <strong>Admin</strong> — use your admin email &amp; password';
      else hint.innerHTML='<span class="material-icons-round" style="font-size:14px">storefront</span>Signing in as <strong>Pharmacy</strong> — use your pharmacy email &amp; password';
    }
  },
  fillDemo(r){this.setRole(r);},

  rShell(){
    const a=this.st.role==='admin';
    const nav=a?this.navAdmin():this.navPh();
    const uc=this.getNotifs().filter(n=>!n.read).length;
    return`<div class="shell">
    <aside class="sidebar" id="sb"><div class="sl"><div class="si"><span class="material-icons-round">local_pharmacy</span></div><div class="slt"><h2>PharmaDist Pro</h2><span>${a?'Distributor Panel':'Pharmacy Panel'}</span></div></div>
    <nav class="snav">${nav}</nav>
    <div class="sf"><div class="su"><div class="sav">${this.st.user.init}</div><div class="sui"><div class="name">${this.st.user.name}</div><div class="role">${a?'Distributor Admin':'Pharmacy Manager'}</div></div><button title="Logout" style="background:none;border:none;cursor:pointer;color:var(--mute);padding:4px" onclick="A.logout()"><span class="material-icons-round" style="font-size:17px">logout</span></button></div></div></aside>
    <header class="hdr"><button class="hib" id="mb" onclick="A.toggleSb()"><span class="material-icons-round">menu</span></button><div class="htitle" id="ht">Dashboard</div><div class="hsrch"><span class="material-icons-round si-icon">search</span><input type="text" placeholder="Search..."></div>
    <div class="hact"><button class="hib" onclick="A.toggleNP()" title="Notifications" style="position:relative"><span class="material-icons-round">notifications</span>${uc>0?'<span class="ndot"></span>':''}</button><button class="hib btn-er" onclick="A.logout()" title="Logout"><span class="material-icons-round">logout</span></button></div></header>
    <main class="main" id="pc"></main></div>`;
  },

  navAdmin(){
    const d=this.data;const po=d.orders.filter(o=>o.type==='inventory'&&o.status==='pending').length;const pr=d.returns.filter(r=>r.status==='pending').length;const ub=d.bills.filter(b=>b.status==='unpaid').length;
    const isSuper=this.st.user?.isSuper;
    return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'dist-inventory',i:'inventory_2',l:'My Stock'},{p:'pharmacies',i:'storefront',l:'Pharmacies'}])+this.navSec('Catalog',[{p:'products',i:'inventory_2',l:'Products Catalog'}])+this.navSec('Operations',[{p:'documentation',i:'description',l:'Documentation'},{p:'orders',i:'shopping_cart',l:'Orders',b:po||undefined},{p:'quotations',i:'request_quote',l:'Quotations'}])+this.navSec('Finance',[{p:'subscriptions',i:'card_membership',l:'Subscriptions'},{p:'billing',i:'receipt_long',l:'Billing',b:ub||undefined},{p:'returns',i:'assignment_return',l:'Returns',b:pr||undefined}])+this.navSec('Help',[{p:'support',i:'support_agent',l:'Support'}])+this.navSec('Admin',[{p:'analytics',i:'bar_chart',l:'SaaS Analytics'},{p:'audit',i:'security',l:'Audit Log'},...(isSuper?[{p:'admins',i:'supervised_user_circle',l:'Admin Team'}]:[]),{p:'profile',i:'manage_accounts',l:'My Account'}]);
  },
  navPh(){
    const phId=this.st.user.phId;const d=this.data;
    const ls=d.drugs.filter(g=>g.phId===phId&&g.qty<=g.min).length;const po=d.orders.filter(o=>o.phId===phId&&o.type==='inventory'&&o.status==='pending').length;const ub=d.bills.filter(b=>b.phId===phId&&b.status==='unpaid').length;
    return this.navSec('Overview',[{p:'dashboard',i:'dashboard',l:'Dashboard'},{p:'inventory',i:'inventory_2',l:'Inventory',b:ls||undefined}])+this.navSec('Catalog',[{p:'catalog',i:'store',l:'Product Catalog'}])+this.navSec('Operations',[{p:'orders',i:'shopping_cart',l:'Orders',b:po||undefined},{p:'documentation',i:'description',l:'Documentation'}])+this.navSec('Finance',[{p:'billing',i:'receipt_long',l:'Billing',b:ub||undefined},{p:'subscriptions',i:'card_membership',l:'Subscription'},{p:'returns',i:'assignment_return',l:'Returns'}])+this.navSec('Help',[{p:'support',i:'support_agent',l:'Support'}])+this.navSec('Account',[{p:'profile',i:'manage_accounts',l:'My Account'}]);
  },
  navSec(label,items){return`<div class="snl">${label}</div>${items.map(it=>`<a class="ni${this.st.page===it.p?' active':''}" data-page="${it.p}" onclick="A.nav('${it.p}');A.setHT('${it.l}')">${'<span class="material-icons-round">'+it.i+'</span>'}<span class="nil">${it.l}</span>${it.b?'<span class="nb">'+it.b+'</span>':''}</a>`).join('')}`;},
  setHT(t){const e=Q('#ht');if(e)e.textContent=t;},
  toggleSb(){Q('#sb')?.classList.toggle('open');Q('#sov')?.classList.toggle('vis');},
  closeSidebar(){Q('#sb')?.classList.remove('open');Q('#sov')?.classList.remove('vis');},

  getNotifs(){const r=this.st.role,ph=this.st.user?.phId;return this.data.notifs.filter(n=>r==='admin'?n.admin:!n.admin&&(!n.ph||n.ph===ph));},
  updateNDot(){const c=this.getNotifs().filter(n=>!n.read).length;const d=Q('.ndot');if(d)d.style.display=c>0?'block':'none';},
  toggleNP(){
    const np=Q('#np');const open=np.classList.contains('open');
    if(open){np.classList.remove('open');return;}
    const allNs=this.getNotifs();
    const cats=['all','order','payment','stock','expiry','return'];
    const fcat=this.st._nCat||'all';
    const ns=fcat==='all'?allNs:allNs.filter(n=>n.type===fcat);
    const typeIcon={order:'shopping_cart',payment:'payments',stock:'inventory',expiry:'event_busy',return:'assignment_return',default:'notifications'};
    np.innerHTML=`<div class="nph"><h3>Notifications <span class="badge b-err">${allNs.filter(n=>!n.read).length}</span></h3><div style="display:flex;gap:6px"><button class="btn btn-sm btn-s" onclick="A.markAllRead()">Mark read</button><button class="btn btn-sm btn-s" onclick="A.toggleNP()"><span class="material-icons-round" style="font-size:17px">close</span></button></div></div>
    <div style="display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid var(--bdr);overflow-x:auto;flex-shrink:0">${cats.map(c=>`<button onclick="A.st._nCat='${c}';A.toggleNP();A.toggleNP()" style="flex-shrink:0;padding:4px 11px;border-radius:99px;border:1px solid ${fcat===c?'var(--acc)':'var(--bdr)'};background:${fcat===c?'rgba(108,99,255,.15)':'transparent'};color:${fcat===c?'var(--acc)':'var(--mute)'};font-size:.72rem;font-weight:600;cursor:pointer;font-family:inherit">${c.charAt(0).toUpperCase()+c.slice(1)}${c==='all'?'':` (${allNs.filter(n=>n.type===c).length})`}</button>`).join('')}</div>
    <div class="nl2">${ns.length===0?'<div class="empty"><span class="material-icons-round">notifications_none</span><h3>No notifications</h3></div>':ns.map(n=>`<div class="nitem${n.read?'':' unread'}" onclick="A.markRead('${n.id}')"><div class="nt ${n.type}"><span class="material-icons-round" style="font-size:14px">${typeIcon[n.type]||typeIcon.default}</span>${n.type}</div><div class="nm">${n.msg}</div><div class="nd">${n.date}</div></div>`).join('')}</div>`;
    np.classList.add('open');
  },
  async markAllRead(){this.getNotifs().forEach(n=>n.read=true);await apiPost('/notifs/read-all',{role:this.st.role,phId:this.st.user?.phId});this.toggleNP();this.updateNDot();},
  markRead(id){const n=this.data.notifs.find(n=>n.id===id);if(n)n.read=true;},
  async addNotif(type,msg,admin,ph=null){const n={id:'n'+Date.now(),type,msg,date:new Date().toLocaleDateString('en-IN'),read:false,admin,ph};this.data.notifs.unshift(n);await apiPost('/notifs',{type,msg,admin,ph,date:n.date});this.updateNDot();},

  toast(msg,type='ok',sub=''){
    const icons={ok:'check_circle',err:'error',warn:'warning'};
    const t=document.createElement('div');t.className=`toast ${type}`;
    t.innerHTML=`<span class="material-icons-round">${icons[type]||'info'}</span><div class="ttxt"><strong>${msg}</strong>${sub?`<span>${sub}</span>`:''}</div>`;
    Q('#toast').appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(38px)';setTimeout(()=>t.remove(),280);},3000);
  },
  showModal(title,body,foot='',size=''){
    Q('#mc').innerHTML=`<div class="mo" onclick="event.target===this&&A.closeModal()"><div class="mdl${size?' '+size:''}"><div class="mh"><h2>${title}</h2><button class="btn btn-icon btn-s" onclick="A.closeModal()"><span class="material-icons-round">close</span></button></div><div class="mb2">${body}</div>${foot?`<div class="mf">${foot}</div>`:''}</div></div>`;
  },
  closeModal(){Q('#mc').innerHTML='';},

  fmt(n){return(+n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});},
  sbadge(s){const m={active:'b-ok Active',pending:'b-warn Pending',delivered:'b-ok Delivered',approved:'b-info Approved',dispatched:'b-info Dispatched',pending__ord:'b-warn Pending',rejected:'b-err Rejected',paid:'b-ok Paid',unpaid:'b-err Unpaid',pending_verification:'b-warn Verifying',open:'b-warn Open',closed:'b-ok Closed',suspended:'b-err Suspended'};const k=s==='pending'?'b-warn Pending':m[s]||'b-gray '+s;const[cls,...rest]=k.split(' ');return`<span class="badge ${cls}">${rest.join(' ')}</span>`;},

  // ===== ADMIN DASHBOARD =====
  rAdminDash(){
    const d=this.data;const tr=d.bills.filter(b=>b.status==='paid').reduce((s,b)=>s+b.amt,0);const tu=d.bills.filter(b=>b.status==='unpaid').reduce((s,b)=>s+b.amt,0);const ap=d.pharmacies.filter(p=>p.status==='active').length;const po=d.orders.filter(o=>o.type==='inventory'&&o.status==='pending').length;
    return`<div class="ph"><div class="pt"><h1>Distributor Dashboard</h1><p>Overview of your distribution network.</p></div><div class="pa"><button class="btn btn-s" onclick="A.addPharmacyModal()"><span class="material-icons-round">add</span>Add Pharmacy</button><button class="btn btn-p" onclick="A.nav('orders')"><span class="material-icons-round">shopping_cart</span>View Orders</button></div></div>
    <div class="sg"><div class="sc p"><div class="sic p"><span class="material-icons-round">storefront</span></div><div><div class="sv">${d.pharmacies.length}</div><div class="sl2">Total Pharmacies</div><div class="scc up">↑ ${ap} Active</div></div></div><div class="sc c"><div class="sic c"><span class="material-icons-round">currency_rupee</span></div><div><div class="sv">₹${this.fmt(tr)}</div><div class="sl2">Total Revenue</div><div class="scc up">+₹${this.fmt(tu)} pending</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">pending_actions</span></div><div><div class="sv">${po}</div><div class="sl2">Pending Orders</div><div class="scc">${d.orders.filter(o=>o.type==='inventory').length} total</div></div></div><div class="sc g"><div class="sic r"><span class="material-icons-round">assignment_return</span></div><div><div class="sv">${d.returns.filter(r=>r.status==='pending').length}</div><div class="sl2">Pending Returns</div><div class="scc">${d.returns.length} total</div></div></div></div>
    <div class="cr"><div class="card"><div class="ch"><h3>Revenue Overview</h3><span class="badge b-ok">Live</span></div><div class="cc"><canvas id="rc"></canvas></div></div><div class="card"><div class="ch"><h3>Orders by Status</h3></div><div class="cc"><canvas id="oc"></canvas></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px"><div class="card"><div class="ch"><h3>Recent Orders</h3><button class="btn btn-sm btn-s" onclick="A.nav('orders')">View All</button></div><div class="tw"><table><thead><tr><th>ID</th><th>Pharmacy</th><th>Total</th><th>Status</th></tr></thead><tbody>${d.orders.filter(o=>o.type==='inventory').slice(0,5).map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td>${o.phName}</td><td>₹${this.fmt(o.tot)}</td><td>${this.sbadge(o.status)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><div class="ch"><h3>Alerts</h3><span class="badge b-err">${po+d.returns.filter(r=>r.status==='pending').length} Actions</span></div><div class="cb"><div class="al">${po>0?`<div class="ai warning"><span class="material-icons-round ai-icon">shopping_cart</span><div class="ai-txt"><strong>${po} Pending Order(s)</strong><span>Review and approve incoming orders</span></div><button class="btn btn-sm btn-warn" onclick="A.nav('orders')">View</button></div>`:''}<div class="ai info"><span class="material-icons-round ai-icon">people</span><div class="ai-txt"><strong>${ap} Active Pharmacies</strong><span>₹${this.fmt(tu)} pending collection</span></div></div></div></div></div></div>
    <div class="card"><div class="ch"><h3>Pharmacy Overview</h3><button class="btn btn-sm btn-s" onclick="A.nav('pharmacies')">Manage All</button></div><div class="tw"><table><thead><tr><th>Name</th><th>License</th><th>Contact</th><th>Plan</th><th>Status</th><th>Actions</th></tr></thead><tbody>${d.pharmacies.map(p=>`<tr><td>${p.name}</td><td style="font-family:monospace;font-size:.8rem">${p.license}</td><td>${p.contact}</td><td>${p.plan?`<span class="badge b-acc">₹${p.plan}/mo</span>`:'<span class="badge b-gray">None</span>'}</td><td>${this.sbadge(p.status)}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.phDetail('${p.id}')">View</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
  },
  chartAdmin(){
    const d=this.data;const c1=Q('#rc')?.getContext('2d');
    if(c1)this.st.charts.r=new Chart(c1,{type:'line',data:{labels:['Nov','Dec','Jan','Feb','Mar','Apr'],datasets:[{label:'Revenue',data:[45000,62000,78000,55000,89000,Math.round(d.bills.filter(b=>b.status==='paid').reduce((s,b)=>s+b.amt,0))],borderColor:'#6C63FF',backgroundColor:'rgba(108,99,255,.12)',borderWidth:2,fill:true,tension:.4,pointBackgroundColor:'#6C63FF'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}},y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4',callback:v=>'₹'+v}}}}});
    const c2=Q('#oc')?.getContext('2d');if(c2){const inv=d.orders.filter(o=>o.type==='inventory');this.st.charts.o=new Chart(c2,{type:'doughnut',data:{labels:['Pending','Approved','Delivered'],datasets:[{data:[inv.filter(o=>o.status==='pending').length,inv.filter(o=>o.status==='approved').length,inv.filter(o=>o.status==='delivered').length],backgroundColor:['#FFB547','#3B82F6','#00D48E'],borderColor:'#0E1826',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7B9CC4',padding:16}}},cutout:'65%'}});}
  },

  // ===== ADMIN PHARMACIES =====
  rPharmacies(){
    const d=this.data;return`<div class="ph"><div class="pt"><h1>Pharmacies</h1><p>All registered pharmacies.</p></div><button class="btn btn-p" onclick="A.addPharmacyModal()"><span class="material-icons-round">add</span>Register</button></div>
    <div class="fb"><button class="fbtn active" onclick="A.fph(this,'all')">All (${d.pharmacies.length})</button><button class="fbtn" onclick="A.fph(this,'active')">Active (${d.pharmacies.filter(p=>p.status==='active').length})</button><button class="fbtn" onclick="A.fph(this,'pending')">Pending (${d.pharmacies.filter(p=>p.status==='pending').length})</button></div>
    <div class="phg" id="phg">${d.pharmacies.map(p=>this.phCard(p)).join('')}</div>`;
  },
  phCard(p){return`<div class="phcard" data-s="${p.status}"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><div class="pha">${p.name[0]}</div><div style="flex:1"><div style="font-weight:700;color:var(--txt)">${p.name}</div><div style="font-size:.72rem;color:var(--mute);font-family:monospace">${p.license}</div></div><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${this.sbadge(p.status)}${p.ph_type==='hospital'?'<span class="badge b-info" style="font-size:.62rem">🏥 Hospital</span>':''}</div></div><div class="phdet"><div><span class="material-icons-round">location_on</span>${p.address}</div><div><span class="material-icons-round">phone</span>${p.contact}</div><div><span class="material-icons-round">email</span>${p.email}</div><div><span class="material-icons-round">calendar_today</span>Joined ${p.joined}</div></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--bdr)"><div>${p.plan?`<span class="badge b-acc">₹${p.plan}/mo</span>${p.waived?'<span class="badge b-ok" style="margin-left:4px">Waived</span>':''}`: '<span class="badge b-gray">No Plan</span>'}</div><div style="display:flex;gap:6px"><button class="btn btn-sm btn-s" onclick="A.phDetail('${p.id}')">View</button><button class="btn btn-sm btn-p" onclick="A.editPhModal('${p.id}')">Edit</button></div></div></div>`;},
  fph(btn,s){QA('.fbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');QA('.phcard').forEach(c=>{c.style.display=(s==='all'||c.dataset.s===s)?'':'none';});},

  addPharmacyModal(){
    this.showModal('Register New Pharmacy',`<div class="fr"><div class="fg"><label>Pharmacy Name *</label><input id="pn" placeholder="Name"></div><div class="fg"><label>License Number *</label><input id="pl" placeholder="e.g. KAR-PH-2024-001"></div></div><div class="fg"><label>Address</label><textarea id="pa" placeholder="Full address"></textarea></div><div class="fr"><div class="fg"><label>Contact *</label><input id="pc2" type="tel" placeholder="+91 XXXXX XXXXX"></div><div class="fg"><label>Email *</label><input id="pe" type="email" placeholder="pharmacy@email.com"></div></div><div class="fr"><div class="fg"><label>Password</label><input id="pp" value="pharma123"></div><div class="fg"><label>Plan</label><select id="pplan"><option value="">No Plan</option><option value="1000">₹1000/mo – Paid Delivery</option><option value="1300">₹1500/mo – Free Delivery</option></select></div></div><div class="upl" onclick="this.querySelector('input').click()"><span class="material-icons-round">upload_file</span><p>Upload Past Bills</p><p><span>Browse files</span></p><input type="file" multiple accept=".pdf,.jpg,.png" style="display:none"></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.savePharmacy()"><span class="material-icons-round">save</span>Register</button>`);
  },
  async savePharmacy(){
    const name=Q('#pn')?.value.trim(),lic=Q('#pl')?.value.trim(),cont=Q('#pc2')?.value.trim(),em=Q('#pe')?.value.trim();
    if(!name||!lic||!cont||!em){this.toast('Fill all required fields','err');return;}
    const res=await apiPost('/pharmacies',{name,license:lic,address:Q('#pa')?.value.trim()||'',contact:cont,email:em,password:Q('#pp')?.value||'pharma123',plan:Q('#pplan')?.value||null,planExpiry:Q('#pplan')?.value?'2026-12-31':null,status:'active',joined:new Date().toLocaleDateString('en-CA'),docs:[]});if(res?.ok){const phs=await apiGet('/pharmacies');if(phs)this.data.pharmacies=phs;}this.closeModal();this.toast(name+' registered!','ok');this.nav('pharmacies');
  },
  editPhModal(id){
    const p=this.data.pharmacies.find(ph=>ph.id===id);if(!p)return;
    this.showModal('Edit: '+p.name,`<div class="fr"><div class="fg"><label>Name</label><input id="en" value="${p.name}"></div><div class="fg"><label>License</label><input id="el" value="${p.license}"></div></div><div class="fg"><label>Address</label><textarea id="ea">${p.address}</textarea></div><div class="fr"><div class="fg"><label>Contact</label><input id="ec" value="${p.contact}"></div><div class="fg"><label>Email</label><input id="ee" value="${p.email}"></div></div><div class="fr"><div class="fg"><label>Status</label><select id="es"><option value="active"${p.status==='active'?' selected':''}>Active</option><option value="pending"${p.status==='pending'?' selected':''}>Pending</option><option value="suspended"${p.status==='suspended'?' selected':''}>Suspended</option></select></div><div class="fg"><label>Plan</label><select id="ep2"><option value="">No Plan</option><option value="1000"${p.plan==='1000'?' selected':''}>₹1000/mo – Paid Delivery</option><option value="1300"${p.plan==='1300'?' selected':''}>₹1500/mo – Free Delivery</option></select></div></div><div class="fg" style="flex-direction:row;align-items:center;gap:10px;border:1px solid var(--bdr);padding:12px;border-radius:var(--rs);background:var(--inp)"><input type="checkbox" id="ew"${p.waived?' checked':''} style="width:auto"><label for="ew" style="margin-bottom:0;cursor:pointer">Waive subscription fee</label></div>`,
    `<button class="btn btn-er btn-sm" onclick="A.delPh('${id}')">Delete</button><button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.updPh('${id}')">Update</button>`);
  },
  async updPh(id){
    const p=this.data.pharmacies.find(ph=>ph.id===id);if(!p)return;
    const updated={
      name:Q('#en').value.trim(),
      license:Q('#el').value.trim(),
      address:Q('#ea').value.trim(),
      contact:Q('#ec').value.trim(),
      email:Q('#ee').value.trim(),
      status:Q('#es').value,
      plan:Q('#ep2').value||null,
      planExpiry:Q('#ep2').value?'2026-12-31':null,
      waived:Q('#ew').checked,
      docs:p.docs||[]
    };
    const res=await apiPut('/pharmacies/'+id, updated);
    if(res?.ok){
      Object.assign(p, updated);
      this.save();
      this.closeModal();
      this.toast('✔ '+updated.name+' updated — Status: '+updated.status,'ok');
      this.nav('pharmacies');
    } else {
      this.toast('Failed to update – server error','err');
    }
  },
  delPh(id){if(!confirm('Delete pharmacy?'))return;this.data.pharmacies=this.data.pharmacies.filter(p=>p.id!==id);this.save();this.closeModal();this.toast('Deleted','warn');this.nav('pharmacies');},
  phDetail(id){
    const p=this.data.pharmacies.find(ph=>ph.id===id);if(!p)return;const bills=this.data.bills.filter(b=>b.phId===id);const spent=bills.filter(b=>b.status==='paid').reduce((s,b)=>s+b.amt,0);
    this.showModal(p.name+' – Details',`<div class="ic" style="margin-bottom:16px"><div class="icg"><div class="if"><label>Name</label><span>${p.name}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${p.license}</span></div><div class="if"><label>Contact</label><span>${p.contact}</span></div><div class="if"><label>Email</label><span>${p.email}</span></div><div class="if" style="grid-column:1/-1"><label>Address</label><span>${p.address}</span></div><div class="if"><label>Plan</label><span>${p.plan?`₹${p.plan}/mo${p.waived?' (Waived)':''}`:'-'}</span></div><div class="if"><label>Status</label><span>${this.sbadge(p.status)}</span></div></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px"><div class="sc c" style="flex-direction:column;text-align:center;padding:14px"><div class="sv">${this.data.orders.filter(o=>o.phId===id&&o.type==='inventory').length}</div><div class="sl2">Orders</div></div><div class="sc g" style="flex-direction:column;text-align:center;padding:14px"><div class="sv">₹${this.fmt(spent)}</div><div class="sl2">Spent</div></div><div class="sc o" style="flex-direction:column;text-align:center;padding:14px"><div class="sv">${bills.filter(b=>b.status==='unpaid').length}</div><div class="sl2">Unpaid Bills</div></div></div><h4 style="margin-bottom:10px;color:var(--txt2)">Documents</h4>${p.docs.length>0?p.docs.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:6px"><span class="material-icons-round" style="color:var(--err)">picture_as_pdf</span><span style="flex:1;font-size:.875rem;color:var(--txt)">${d.name}</span><span style="font-size:.72rem;color:var(--mute)">${d.size} · ${d.date}</span></div>`).join(''):'<p style="color:var(--mute)">No documents yet</p>'}`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button><button class="btn btn-p" onclick="A.closeModal();A.editPhModal('${id}')">Edit</button>`,'mdl-lg');
  },

  // ===== ADMIN DOCS =====
  rAdminDocs(){
    const d=this.data;return`<div class="ph"><div class="pt"><h1>Documentation</h1><p>Pharmacy registration documents & bills.</p></div><button class="btn btn-p" onclick="A.addPharmacyModal()"><span class="material-icons-round">add</span>Register Pharmacy</button></div>
    ${d.pharmacies.map(p=>`<div class="card" style="margin-bottom:14px"><div class="ch"><div style="display:flex;align-items:center;gap:10px"><div class="pha" style="width:34px;height:34px;font-size:.9rem;border-radius:9px">${p.name[0]}</div><div><div style="font-weight:700;color:var(--txt)">${p.name}</div><div style="font-size:.72rem;color:var(--mute)">${p.license} · ${p.address}</div></div></div><div style="display:flex;gap:7px;align-items:center">${this.sbadge(p.status)}<button class="btn btn-sm btn-s" onclick="A.addDocModal('${p.id}')"><span class="material-icons-round">upload_file</span>Upload</button></div></div><div class="cb"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px"><div class="if"><label>Pharmacy Name</label><span>${p.name}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${p.license}</span></div><div class="if"><label>Contact</label><span>${p.contact}</span></div><div class="if"><label>Email</label><span>${p.email}</span></div><div class="if" style="grid-column:1/-1"><label>Address</label><span>${p.address}</span></div></div><div style="padding-top:10px;border-top:1px solid var(--bdr)"><div style="font-size:.8rem;font-weight:600;color:var(--mute);margin-bottom:8px">Documents</div>${p.docs.length>0?`<div style="display:flex;flex-wrap:wrap;gap:7px">${p.docs.map(doc=>`<div style="display:flex;align-items:center;gap:7px;padding:7px 11px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs)"><span class="material-icons-round" style="font-size:17px;color:var(--err)">picture_as_pdf</span><span style="font-size:.8rem;color:var(--txt)">${doc.name}</span><span style="font-size:.72rem;color:var(--mute)">${doc.size}</span></div>`).join('')}</div>`:'<div style="color:var(--mute);font-size:.875rem">No documents</div>'}</div></div></div>`).join('')}`;
  },
  addDocModal(phId){
    this.showModal('Upload Document',`<div class="fg"><label>Document Name</label><input id="dn" placeholder="e.g. Drug License 2024.pdf"></div><div class="upl" onclick="document.getElementById('df').click()"><span class="material-icons-round">cloud_upload</span><p>PDF, JPG or PNG</p><p><span>Click to browse</span></p><input type="file" id="df" accept=".pdf,.jpg,.png" style="display:none" onchange="Q('#dfn').textContent=this.files[0]?.name||''"></div><div id="dfn" style="font-size:.8rem;color:var(--acc);margin-top:7px"></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveDoc('${phId}')">Upload</button>`);
  },
  async saveDoc(phId){const name=Q('#dn')?.value.trim();if(!name){this.toast('Enter document name','err');return;}const p=this.data.pharmacies.find(ph=>ph.id===phId);if(!p)return;p.docs.push({id:'doc'+Date.now(),name,date:new Date().toLocaleDateString('en-CA'),size:Math.floor(Math.random()*400+100)+' KB'});this.save();this.closeModal();this.toast('Uploaded!','ok');this.nav('documentation');},

  // ===== ADMIN ORDERS =====
  rAdminOrders(){
    const ords=this.data.orders.filter(o=>o.type==='inventory');const f=this.st.filt.ao||'all';const list=f==='all'?ords:ords.filter(o=>o.status===f);
    return`<div class="ph"><div class="pt"><h1>Pharmacy Orders</h1><p>Bulk orders placed by pharmacies.</p></div><button class="btn btn-p" onclick="A.newOrderModal()"><span class="material-icons-round">add</span>New Order</button></div>
    <div class="fb">${['all','pending','approved','dispatched','delivered'].map(s=>`<button class="fbtn${f===s?' active':''}" onclick="A.setState('st.filt.ao','${s}');A.nav('orders')">${s.charAt(0).toUpperCase()+s.slice(1)} (${s==='all'?ords.length:ords.filter(o=>o.status===s).length})</button>`).join('')}</div>
    ${list.length===0?'<div class="empty"><span class="material-icons-round">shopping_cart</span><h3>No orders found</h3></div>':''}
    ${list.length>0?`<div class="card"><div class="tw"><table><thead><tr><th>Order ID</th><th>Pharmacy</th><th>Drugs</th><th>Date</th><th>Total</th><th>Challan</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}${o.id.includes('WA')?'<span class="badge b-ok" style="margin-left:4px;font-size:.6rem">WA</span>':''}</td><td>${o.phName}</td><td><div style="max-width:180px">${o.drugs.map(d=>`<div style="font-size:.8rem">${d.name} <span style="color:var(--acc)">×${d.qty}</span></div>`).join('')}</div></td><td>${o.date}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(o.tot)}</td><td style="font-family:monospace;font-size:.72rem;color:var(--mute)">${o.challan_no||'—'}</td><td>${this.sbadge(o.status)}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.vOrder('${o.id}')">View</button>${o.status==='pending'?`<button class="btn btn-sm btn-ok" onclick="A.approveOrd('${o.id}')">Approve</button>`:''}${o.status==='approved'?`<button class="btn btn-sm btn-p" onclick="A.dispatchOrd('${o.id}')"><span class="material-icons-round" style="font-size:14px">local_shipping</span>Dispatch</button>`:''}${o.status==='dispatched'?`<button class="btn btn-sm btn-ok" onclick="A.deliverOrd('${o.id}')">Delivered</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></div>`:''}`;
  },
  async approveOrd(id){const o=this.data.orders.find(o=>o.id===id);if(!o)return;await apiPut('/orders/'+id,{status:'approved'});o.status='approved';this.addNotif('order','Order '+id+' approved!',false,o.phId);this.showBrowserNotif('Order Approved','Order '+id+' has been approved');this.toast(id+' approved!','ok');this.nav('orders');},
  async dispatchOrd(id){
    const o=this.data.orders.find(o=>o.id===id);if(!o)return;
    const res=await apiPost('/orders/'+id+'/dispatch',{});
    if(res?.ok){
      o.status='dispatched';
      o.challan_no=res.challanNo;
      o.dispatch_date=res.dispatchDate;
      this.showModal('📦 Order Dispatched!',`
        <div style="text-align:center;padding:20px 0">
          <span class="material-icons-round" style="font-size:56px;color:var(--ok)">local_shipping</span>
          <div style="font-size:1.1rem;font-weight:700;margin:12px 0 4px">Order ${id} dispatched</div>
          <div style="color:var(--mute);margin-bottom:16px">Pharmacy has been notified</div>
          <div style="background:rgba(108,99,255,.1);border:1px solid rgba(108,99,255,.25);border-radius:10px;padding:16px">
            <div style="font-size:.75rem;color:var(--mute);margin-bottom:4px">CHALLAN NUMBER</div>
            <div style="font-family:monospace;font-size:1.2rem;font-weight:800;color:var(--acc);letter-spacing:1px">${res.challanNo}</div>
            <div style="font-size:.75rem;color:var(--mute);margin-top:8px">Dispatch Date: ${res.dispatchDate}</div>
          </div>
        </div>`,
        `<button class="btn btn-s" onclick="A.closeModal()">Close</button><button class="btn btn-ok" onclick="A.closeModal();A.nav('orders')">View Orders</button>`);
    } else { this.toast('Dispatch failed','err'); }
  },
  async deliverOrd(id){const o=this.data.orders.find(o=>o.id===id);if(!o)return;await apiPut('/orders/'+id,{status:'delivered'});o.status='delivered';if(!o.billed){await this.genBill(id,true);}this.addNotif('order','Order '+id+' delivered!',false,o.phId);this.showBrowserNotif('Order Delivered','Order '+id+' has been delivered');this.toast(id+' delivered!','ok');this.nav('orders');},
  async genBill(ordId,silent=false){const o=this.data.orders.find(o=>o.id===ordId);if(!o||o.billed)return;const b={id:'BILL-'+Date.now(),phId:o.phId,phName:o.phName,ordId,amt:o.tot,date:new Date().toLocaleDateString('en-CA'),due:new Date(Date.now()+15*864e5).toLocaleDateString('en-CA'),status:'unpaid',type:'bulk',paid:null};this.data.bills.push(b);o.billed=true;this.save();if(!silent){this.addNotif('payment','Bill '+b.id+' – ₹'+this.fmt(b.amt),false,o.phId);this.toast('Bill generated!','ok');}},
  vOrder(id){
    const o=this.data.orders.find(o=>o.id===id);if(!o)return;
    // Status timeline
    const steps=['pending','approved','dispatched','delivered'];
    const si=steps.indexOf(o.status);
    const timeline=`<div style="display:flex;align-items:center;justify-content:center;gap:0;margin:16px 0;padding:14px;background:var(--inp);border-radius:var(--r)">
      ${steps.map((s,i)=>{
        const done=i<=si;const icons={pending:'receipt',approved:'check_circle',dispatched:'local_shipping',delivered:'done_all'};
        return`<div style="display:flex;flex-direction:column;align-items:center;flex:1">
          <div style="width:36px;height:36px;border-radius:50%;background:${done?'var(--acc)':'rgba(255,255,255,.05)'};border:2px solid ${done?'var(--acc)':'var(--bdr)'};display:flex;align-items:center;justify-content:center;transition:.3s">
            <span class="material-icons-round" style="font-size:17px;color:${done?'#fff':'var(--mute)'}">${icons[s]}</span>
          </div>
          <div style="font-size:.65rem;color:${done?'var(--txt)':'var(--mute)'};margin-top:5px;font-weight:${done?700:400};text-transform:capitalize">${s}</div>
        </div>
        ${i<steps.length-1?`<div style="height:2px;flex:1;background:${i<si?'var(--acc)':'var(--bdr)'};margin-bottom:18px"></div>`:''}`;
      }).join('')}
    </div>`;
    this.showModal('Order – '+o.id,`
      ${timeline}
      ${o.challan_no?`<div style="background:rgba(0,212,142,.07);border:1px solid rgba(0,212,142,.25);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span class="material-icons-round" style="color:var(--ok)">local_shipping</span>
        <div><div style="font-size:.7rem;color:var(--mute)">Challan No</div><div style="font-family:monospace;font-weight:700;color:var(--ok)">${o.challan_no}</div></div>
        <div style="margin-left:auto"><div style="font-size:.7rem;color:var(--mute)">Dispatched</div><div style="font-size:.82rem">${o.dispatch_date||'—'}</div></div>
      </div>`:''}
      <div class="ic" style="margin-bottom:14px"><div class="icg">
        <div class="if"><label>Order ID</label><span style="font-family:monospace">${o.id}</span></div>
        <div class="if"><label>Date</label><span>${o.date}</span></div>
        <div class="if"><label>Pharmacy</label><span>${o.phName}</span></div>
        <div class="if"><label>Status</label><span>${this.sbadge(o.status)}</span></div>
        <div class="if"><label>Delivery</label><span>${o.del==='free'?'Free':'Paid'}</span></div>
        <div class="if"><label>Notes</label><span>${o.notes||'—'}</span></div>
      </div></div>
      <table><thead><tr><th>Drug</th><th>Qty</th><th>Unit ₹</th><th>Total ₹</th></tr></thead><tbody>
        ${o.drugs.map(d=>`<tr><td>${d.name}</td><td>${d.qty}</td><td>₹${(d.up||0).toFixed(2)}</td><td>₹${(d.tot||0).toFixed(2)}</td></tr>`).join('')}
        <tr><td colspan="3" style="text-align:right;font-weight:700">Subtotal</td><td>₹${(o.sub||0).toFixed(2)}</td></tr>
        <tr><td colspan="3" style="text-align:right;font-weight:700">GST (5%)</td><td>₹${(o.gst||0).toFixed(2)}</td></tr>
        <tr><td colspan="3" style="text-align:right;font-weight:800;color:var(--txt)">Total</td><td style="font-weight:800;color:var(--acc)">₹${this.fmt(o.tot)}</td></tr>
      </tbody></table>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button>
     ${o.status==='pending'?`<button class="btn btn-ok" onclick="A.closeModal();A.approveOrd('${o.id}')">Approve</button>`:''}
     ${o.status==='approved'?`<button class="btn btn-p" onclick="A.closeModal();A.dispatchOrd('${o.id}')"><span class="material-icons-round">local_shipping</span>Dispatch</button>`:''}
     ${o.status==='dispatched'?`<button class="btn btn-ok" onclick="A.closeModal();A.deliverOrd('${o.id}')">Mark Delivered</button>`:''}
     ${!o.billed&&o.status!=='pending'?`<button class="btn btn-s" onclick="A.genBill('${o.id}')">Generate Bill</button>`:''}`);
  },

  newOrderModal(){
    this.showModal('Create Order for Pharmacy',`
      <div class="fg"><label>Pharmacy</label><select id="no-ph">${this.data.pharmacies.filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${p.name}${p.ph_type==='hospital'?' 🏥':''}</option>`).join('')}</select></div>
      <div class="fg"><label>Notes</label><input id="no-notes" placeholder="e.g. Urgent, handle with care"></div>
      <div style="font-size:.75rem;color:var(--mute);margin:10px 0 6px">For pharmacy-placed orders, ask pharmacy to log in and place order directly.</div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.nav('quotations')"><span class="material-icons-round">description</span>Create Quotation Instead</button>`);
  },


  // ===== ADMIN SUBSCRIPTIONS =====
  rSubs(){
    const d=this.data;return`<div class="ph"><div class="pt"><h1>Subscriptions</h1><p>Manage pharmacy subscription plans.</p></div></div>
    <div class="plans"><div class="plan"><div style="font-size:.8rem;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:7px">Basic Plan</div><div class="pp"><sup>₹</sup>1000</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>Paid Delivery</li><li><span class="material-icons-round">check_circle</span>Order Tracking</li><li><span class="material-icons-round">check_circle</span>Priority Support</li></ul><div style="font-size:.8rem;color:var(--mute)">${d.pharmacies.filter(p=>p.plan==='1000').length} subscribed</div></div><div class="plan feat"><div style="font-size:.8rem;font-weight:700;color:var(--acc);text-transform:uppercase;margin-bottom:7px">Premium Plan</div><div class="pp" style="color:var(--acc)"><sup>₹</sup>1500</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>FREE Delivery</li><li><span class="material-icons-round">check_circle</span>Priority Processing</li><li><span class="material-icons-round">check_circle</span>Dedicated Support</li><li><span class="material-icons-round">check_circle</span>Analytics</li></ul><div style="font-size:.8rem;color:var(--mute)">${d.pharmacies.filter(p=>p.plan==='1500').length} subscribed</div></div></div>
    <div class="card"><div class="ch"><h3>Pharmacy Subscriptions</h3></div><div class="tw"><table><thead><tr><th>Pharmacy</th><th>Plan</th><th>Expiry</th><th>Waived</th><th>Status</th><th>Actions</th></tr></thead><tbody>${d.pharmacies.map(p=>`<tr><td>${p.name}</td><td>${p.plan?`<span class="badge b-acc">₹${p.plan}/mo</span>`:'<span class="badge b-gray">None</span>'}</td><td>${p.planExpiry||'—'}</td><td>${p.waived?'<span class="badge b-ok">Yes</span>':'—'}</td><td>${this.sbadge(p.status)}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.editPhModal('${p.id}')">Manage</button><button class="btn btn-sm ${p.waived?'btn-warn':'btn-ok'}" onclick="A.toggleWaive('${p.id}')">${p.waived?'Remove Waive':'Waive Fee'}</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
  },
  async toggleWaive(id){const res=await apiPost('/pharmacies/'+id+'/waive',{});const p=this.data.pharmacies.find(ph=>ph.id===id);if(p&&res)p.waived=res.waived;this.toast(p?.waived?'Fee waived for '+p?.name:'Waiver removed','ok');this.nav('subscriptions');},

  // ===== ADMIN BILLING =====
  rAdminBilling(){
    const b=this.data.bills;const tp=b.filter(x=>x.status==='paid').reduce((s,x)=>s+x.amt,0);const tu=b.filter(x=>x.status==='unpaid').reduce((s,x)=>s+x.amt,0);
    return`<div class="ph"><div class="pt"><h1>Billing</h1><p>All pharmacy bills and payments.</p></div><button class="btn btn-p" onclick="A.newBillModal()"><span class="material-icons-round">add</span>Create Bill</button></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr)"><div class="sc g"><div class="sic g"><span class="material-icons-round">check_circle</span></div><div><div class="sv">₹${this.fmt(tp)}</div><div class="sl2">Collected</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">pending_actions</span></div><div><div class="sv">₹${this.fmt(tu)}</div><div class="sl2">Pending</div></div></div><div class="sc p"><div class="sic p"><span class="material-icons-round">receipt_long</span></div><div><div class="sv">${b.length}</div><div class="sl2">Total Bills</div></div></div></div>
    <div class="card"><div class="ch"><h3>All Bills</h3><select onchange="A.fBills(this.value)" style="padding:5px 11px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);color:var(--txt);font-family:inherit"><option value="all">All</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></div><div class="tw"><table id="bt"><thead><tr><th>Bill ID</th><th>Pharmacy</th><th>Order</th><th>Amount</th><th>Date</th><th>Due</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>${b.map(x=>`<tr data-s="${x.status}"><td style="font-family:monospace;font-size:.8rem">${x.id}</td><td>${x.phName}</td><td style="font-family:monospace;font-size:.8rem">${x.ordId}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(x.amt)}</td><td>${x.date}</td><td>${x.due}</td><td><span class="badge b-gray">${x.type}</span></td><td>${x.status==='paid'?'<span class="badge b-ok">Paid</span>':'<span class="badge b-err">Unpaid</span>'}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.vBill('${x.id}')">View</button>${x.status==='unpaid'?`<button class="btn btn-sm btn-ok" onclick="A.markPaid('${x.id}')">Mark Paid</button>`:''}${x.status==='pending_verification'?`<button class="btn btn-sm btn-warn" onclick="A.vBill('${x.id}')">Verify UTR</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></div>`;
  },
  fBills(s){QA('#bt tbody tr').forEach(r=>{r.style.display=(s==='all'||r.dataset.s===s)?'':'none';});},
  async markPaid(id){const b=this.data.bills.find(b=>b.id===id);if(!b)return;const paid=new Date().toLocaleDateString('en-CA');await apiPut('/bills/'+id,{status:'paid',paid});b.status='paid';b.paid=paid;this.toast('Bill '+id+' marked paid!','ok');this.nav('billing');},
  newBillModal(){
    this.showModal('Create Manual Bill',`<div class="fg"><label>Pharmacy</label><select id="nb-ph">${this.data.pharmacies.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div><div class="fr"><div class="fg"><label>Amount (₹)</label><input id="nb-amt" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="fg"><label>Type</label><select id="nb-type"><option value="individual">Individual</option><option value="bulk">Bulk</option></select></div></div><div class="fr"><div class="fg"><label>Bill Date</label><input id="nb-d" type="date" value="${new Date().toLocaleDateString('en-CA')}"></div><div class="fg"><label>Due Date</label><input id="nb-due" type="date" value="${new Date(Date.now()+15*864e5).toLocaleDateString('en-CA')}"></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveManualBill()">Create</button>`);
  },
  async saveManualBill(){
    const phId=Q('#nb-ph')?.value,amt=parseFloat(Q('#nb-amt')?.value);
    if(!phId||!amt){this.toast('Fill required fields','err');return;}
    const ph=this.data.pharmacies.find(p=>p.id===phId);
    if(!ph){this.toast('Pharmacy not found','err');return;}
    const bill={phId,phName:ph.name,ordId:'MANUAL',amt,date:Q('#nb-d').value,due:Q('#nb-due').value,type:Q('#nb-type').value||'bulk'};
    const res=await apiPost('/bills',bill);
    if(res?.ok){
      bill.id=res.id;bill.status='unpaid';bill.paid=null;
      this.data.bills.push(bill);
      this.save();
      this.closeModal();
      this.addNotif('payment','Bill '+res.id+' created for '+ph.name+' \u2013 \u20b9'+this.fmt(amt),false,phId);
      this.toast('Bill created!','ok',res.id);
      this.nav('billing');
    } else {
      this.toast('Failed to create bill \u2013 server error','err');
    }
  },
  // HSN code + GST rate by category
  _hsnMap:{
    'Analgesic':{hsn:'3004',gst:12},'Antibiotic':{hsn:'3004',gst:12},'Antidiabetic':{hsn:'3004',gst:12},
    'Antihypertensive':{hsn:'3004',gst:12},'Antihistamine':{hsn:'3004',gst:12},'Statin':{hsn:'3004',gst:12},
    'PPI':{hsn:'3004',gst:12},'Antifungal':{hsn:'3004',gst:12},'Antiviral':{hsn:'3004',gst:12},
    'Vitamin':{hsn:'2106',gst:18},'Other':{hsn:'3004',gst:12}
  },

  vBill(id){
    const b=this.data.bills.find(b=>b.id===id);if(!b)return;
    const d=this.data.dist;
    const ph=this.data.pharmacies.find(p=>p.id===b.phId)||{};
    // Get order drugs for line items
    const ord=this.data.orders.find(o=>o.id===b.ordId);
    const items=ord?.drugs||[];
    // Build GST summary
    const gstGroups={};
    items.forEach(item=>{
      const cat=item.cat||item.category||'Other';
      const {hsn,gst:rate}=this._hsnMap[cat]||{hsn:'3004',gst:12};
      const taxable=(item.up||item.price||0)*item.qty;
      const cgst=taxable*(rate/2)/100;
      const sgst=taxable*(rate/2)/100;
      if(!gstGroups[rate])gstGroups[rate]={rate,taxable:0,cgst:0,sgst:0};
      gstGroups[rate].taxable+=taxable;
      gstGroups[rate].cgst+=cgst;
      gstGroups[rate].sgst+=sgst;
    });
    const taxable=items.reduce((s,i)=>s+(i.up||0)*i.qty,0)||b.amt/1.05;
    const totalGST=b.amt-taxable;
    const body=`<div style="font-family:Inter,Arial,sans-serif;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--r);padding:22px" id="inv-body-${b.id}">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--acc)">
        <div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--acc)">${d.name||'PharmaDist Pro'}</div>
          <div style="font-size:.78rem;color:var(--txt2);margin-top:3px">${d.address||'—'}</div>
          <div style="font-size:.78rem;color:var(--txt2);margin-top:2px">📞 ${d.phone||d.mobile||'—'} &nbsp;|&nbsp; 📧 ${d.email||'—'}</div>
          ${d.gst?`<div style="font-size:.78rem;color:var(--txt2);margin-top:2px">GSTIN: <strong style="color:var(--acc)">${d.gst}</strong></div>`:''}
          ${d.license?`<div style="font-size:.78rem;color:var(--txt2);margin-top:2px">Drug License: ${d.license}</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-size:1.1rem;font-weight:800;letter-spacing:1px;color:var(--txt)">TAX INVOICE</div>
          <div style="font-family:monospace;color:var(--acc);font-size:.9rem;margin-top:4px">${b.id}</div>
          <div style="margin-top:8px">${b.status==='paid'?'<span class="badge b-ok" style="font-size:.85rem">✔ PAID</span>':b.status==='pending_verification'?'<span class="badge b-warn" style="font-size:.85rem">⏳ VERIFYING</span>':'<span class="badge b-err" style="font-size:.85rem">✗ UNPAID</span>'}</div>
        </div>
      </div>
      <!-- Billed To + Dates -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div style="background:rgba(108,99,255,.06);border-radius:8px;padding:12px">
          <div style="font-size:.68rem;color:var(--mute);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Bill To</div>
          <div style="font-weight:700;color:var(--txt)">${b.phName}</div>
          ${ph.address?`<div style="font-size:.78rem;color:var(--txt2);margin-top:3px">${ph.address}</div>`:''}
          ${ph.contact?`<div style="font-size:.78rem;color:var(--txt2);margin-top:2px">📞 ${ph.contact}</div>`:''}
          ${ph.license?`<div style="font-size:.78rem;color:var(--acc);margin-top:2px;font-family:monospace">DL: ${ph.license}</div>`:''}
        </div>
        <div style="background:rgba(108,99,255,.06);border-radius:8px;padding:12px">
          <div style="font-size:.68rem;color:var(--mute);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Invoice Details</div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:5px"><span style="color:var(--mute)">Invoice Date</span><strong>${b.date||'—'}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:5px"><span style="color:var(--mute)">Due Date</span><strong style="color:${b.status!=='paid'?'var(--err)':'var(--ok)'}">${b.due||'—'}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:5px"><span style="color:var(--mute)">Order Ref</span><code style="font-size:.75rem">${b.ordId||'MANUAL'}</code></div>
          ${b.paid?`<div style="display:flex;justify-content:space-between;font-size:.82rem"><span style="color:var(--mute)">Paid On</span><strong style="color:var(--ok)">${b.paid}</strong></div>`:''}
        </div>
      </div>
      <!-- Line Items -->
      ${items.length>0?`
      <div style="margin-bottom:14px">
        <div style="font-size:.72rem;color:var(--mute);font-weight:700;margin-bottom:7px;text-transform:uppercase">Items</div>
        <table style="width:100%;border-collapse:collapse;font-size:.82rem">
          <thead>
            <tr style="background:rgba(255,255,255,.03)">
              <th style="padding:7px 9px;text-align:left;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr);white-space:nowrap">#</th>
              <th style="padding:7px 9px;text-align:left;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr)">Drug Name</th>
              <th style="padding:7px 9px;text-align:center;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr)">HSN</th>
              <th style="padding:7px 9px;text-align:center;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr)">Qty</th>
              <th style="padding:7px 9px;text-align:right;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr)">Unit ₹</th>
              <th style="padding:7px 9px;text-align:center;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr)">GST%</th>
              <th style="padding:7px 9px;text-align:right;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr)">Taxable ₹</th>
              <th style="padding:7px 9px;text-align:right;color:var(--mute);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--bdr)">Total ₹</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item,i)=>{
              const cat=item.cat||item.category||'Other';
              const {hsn,gst:rate}=this._hsnMap[cat]||{hsn:'3004',gst:12};
              const up=item.up||item.price||0;
              const taxableAmt=up*item.qty;
              const gstAmt=taxableAmt*rate/100;
              const total=taxableAmt+gstAmt;
              return`<tr><td style="padding:8px 9px;border-bottom:1px solid var(--bdr);color:var(--mute)">${i+1}</td>
                <td style="padding:8px 9px;border-bottom:1px solid var(--bdr);font-weight:600;color:var(--txt)">${item.name}</td>
                <td style="padding:8px 9px;border-bottom:1px solid var(--bdr);text-align:center;font-family:monospace;font-size:.75rem;color:var(--mute)">${hsn}</td>
                <td style="padding:8px 9px;border-bottom:1px solid var(--bdr);text-align:center;color:var(--txt)">${item.qty}</td>
                <td style="padding:8px 9px;border-bottom:1px solid var(--bdr);text-align:right">₹${up.toFixed(2)}</td>
                <td style="padding:8px 9px;border-bottom:1px solid var(--bdr);text-align:center"><span class="badge b-gray" style="font-size:.68rem">${rate}%</span></td>
                <td style="padding:8px 9px;border-bottom:1px solid var(--bdr);text-align:right">₹${taxableAmt.toFixed(2)}</td>
                <td style="padding:8px 9px;border-bottom:1px solid var(--bdr);text-align:right;font-weight:700;color:var(--txt)">₹${(taxableAmt+(taxableAmt*rate/100)).toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`:''}
      <!-- GST Summary + Totals -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div style="background:rgba(108,99,255,.05);border-radius:8px;padding:12px">
          <div style="font-size:.72rem;color:var(--mute);font-weight:700;margin-bottom:8px;text-transform:uppercase">GST Breakup</div>
          ${(()=>{const gv=Object.values(gstGroups);if(gv.length>0)return gv.map(g=>('<div style="display:flex;justify-content:space-between;font-size:.8rem;padding:4px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--mute)">CGST @'+g.rate/2+'%</span><span>\u20b9'+g.cgst.toFixed(2)+'</span></div><div style="display:flex;justify-content:space-between;font-size:.8rem;padding:4px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--mute)">SGST @'+g.rate/2+'%</span><span>\u20b9'+g.sgst.toFixed(2)+'</span></div>')).join('');return '<div style="display:flex;justify-content:space-between;font-size:.8rem;padding:4px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--mute)">CGST @2.5%</span><span>\u20b9'+(totalGST/2).toFixed(2)+'</span></div><div style="display:flex;justify-content:space-between;font-size:.8rem;padding:4px 0"><span style="color:var(--mute)">SGST @2.5%</span><span>\u20b9'+(totalGST/2).toFixed(2)+'</span></div>';})()}
          <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:6px 0;margin-top:4px;font-weight:700;border-top:1px solid var(--bdr)">
            <span>Total Tax</span><span style="color:var(--warn)">₹${totalGST.toFixed(2)}</span>
          </div>
        </div>
        <div style="background:linear-gradient(135deg,rgba(108,99,255,.1),rgba(0,212,255,.08));border:1px solid rgba(108,99,255,.25);border-radius:8px;padding:12px;display:flex;flex-direction:column;justify-content:center">
          <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:4px 0"><span style="color:var(--mute)">Taxable Value</span><span>₹${taxable.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:4px 0"><span style="color:var(--mute)">Total GST</span><span>₹${totalGST.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:1.2rem;font-weight:800;padding:8px 0 0;border-top:1px solid rgba(108,99,255,.3);margin-top:6px">
            <span style="color:var(--txt)">Grand Total</span><span style="color:var(--acc)">₹${this.fmt(b.amt)}</span>
          </div>
        </div>
      </div>
      <!-- UPI hint -->
      ${d.upi&&b.status!=='paid'?`<div style="background:rgba(0,212,142,.06);border:1px solid rgba(0,212,142,.25);border-radius:8px;padding:10px 14px;font-size:.8rem;display:flex;align-items:center;gap:8px"><span class="material-icons-round" style="font-size:18px;color:var(--ok)">qr_code</span><span>Pay via UPI: <strong>${d.upi}</strong> · Submit UTR after payment</span></div>`:''}
      <!-- Footer -->
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--bdr);font-size:.72rem;color:var(--mute);text-align:center">This is a computer-generated invoice and does not require a physical signature. ${d.name||'PharmaDist Pro'}</div>
    </div>`;
    const foot=`<button class="btn btn-s" onclick="A.closeModal()">Close</button>
      <button class="btn btn-sm btn-s" onclick="A.shareBillWA('${b.id}')"><span class="material-icons-round">share</span>WhatsApp</button>
      <button class="btn btn-s" onclick="A.printBill('${b.id}')"><span class="material-icons-round">print</span>Print / PDF</button>
      ${b.status==='unpaid'?`<button class="btn btn-ok" onclick="A.closeModal();A.markPaid('${b.id}')">Mark Paid</button>`:''}
      ${b.status==='pending_verification'?`<button class="btn btn-ok" onclick="A.closeModal();A.verifyPayment('${b.id}')"><span class="material-icons-round">verified</span>Confirm Payment</button>`:''}`;
    this.showModal('GST Invoice – '+b.id,body,foot,'mdl-lg');
  },

  printBill(id){
    const el=Q('#inv-body-'+id);if(!el)return;
    const w=window.open('','_blank','width=860,height=700');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Invoice ${id}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter',Arial,sans-serif;background:#fff;color:#111;padding:32px;max-width:860px;margin:0 auto}
        .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:99px;font-size:.72rem;font-weight:700}
        table{width:100%;border-collapse:collapse;font-size:.82rem}
        th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb}
        th{font-size:.7rem;text-transform:uppercase;color:#6b7280;font-weight:700}
        @media print{body{padding:16px}@page{margin:12mm}}
      </style>
    </head><body>
      ${el.outerHTML.replace(/var\(--[^)]+\)/g,'#111').replace(/background:[^;]+;/g,'').replace(/color:var[^;]+;/g,'color:#111;')}
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
    w.document.close();
  },






  // ===== ADMIN RETURNS =====
  rAdminReturns(){
    const rets=this.data.returns;const f=this.st.filt.ar||'all';const list=f==='all'?rets:rets.filter(r=>r.status===f);
    return`<div class="ph"><div class="pt"><h1>Return Requests</h1><p>Pharmacy drug return requests.</p></div></div>
    <div class="fb">${['all','pending','approved','rejected'].map(s=>`<button class="fbtn${f===s?' active':''}" onclick="A.setState('st.filt.ar','${s}');A.nav('returns')">${s.charAt(0).toUpperCase()+s.slice(1)} (${s==='all'?rets.length:rets.filter(r=>r.status===s).length})</button>`).join('')}</div>
    ${list.length===0?'<div class="empty"><span class="material-icons-round">assignment_return</span><h3>No returns found</h3></div>':''}
    ${list.map(r=>`<div class="card" style="margin-bottom:14px"><div class="ch"><div><span style="font-family:monospace;font-size:.875rem;color:var(--acc)">${r.id}</span><span style="margin-left:10px;font-size:.875rem;color:var(--mute)">from ${r.phName}</span></div><div style="display:flex;gap:7px;align-items:center"><span class="badge ${r.reason==='expired'?'b-err':r.reason==='damaged'?'b-warn':'b-info'}">${r.reason}</span>${this.sbadge(r.status)}</div></div><div class="cb"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px"><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:7px">DRUGS</div>${r.drugs.map(d=>`<div style="display:flex;justify-content:space-between;padding:7px;background:var(--inp);border-radius:var(--rs);margin-bottom:4px"><span style="color:var(--txt)">${d.name}</span><span style="color:var(--acc)">×${d.qty}</span>${d.batch?`<span style="color:var(--mute);font-size:.72rem">${d.batch}</span>`:''}</div>`).join('')}</div><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:4px">Notes</div><p style="font-size:.875rem">${r.notes}</p>${r.anote?`<div style="margin-top:7px;padding:7px;background:var(--okL);border-radius:var(--rs);color:var(--ok);font-size:.8rem">Admin: ${r.anote}</div>`:''}</div></div>${r.status==='pending'?`<div style="display:flex;gap:7px;align-items:flex-end;border-top:1px solid var(--bdr);padding-top:14px"><div style="flex:1"><label style="font-size:.72rem;color:var(--mute);display:block;margin-bottom:4px">Admin Note</label><input id="an-${r.id}" placeholder="Note for pharmacy…" style="margin-bottom:0"></div><button class="btn btn-ok" onclick="A.procRet('${r.id}','approved')"><span class="material-icons-round">check</span>Approve</button><button class="btn btn-er" onclick="A.procRet('${r.id}','rejected')"><span class="material-icons-round">close</span>Reject</button></div>`:''}</div></div>`).join('')}`;
  },
  async procRet(id,status){const r=this.data.returns.find(r=>r.id===id);if(!r)return;const anote=Q('#an-'+id)?.value||'';await apiPut('/returns/'+id,{status,anote});r.status=status;r.anote=anote;this.addNotif('return','Return '+id+' '+status,false,r.phId);this.toast('Return '+status+'!',status==='approved'?'ok':'warn');this.nav('returns');},

  // ===== ADMIN SUPPORT =====
  rAdminSupport(){
    const d=this.data;const tks=d.tickets;
    return`<div class="ph"><div class="pt"><h1>Support Center</h1><p>Manage pharmacy support tickets.</p></div></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:22px"><div class="card cb" style="text-align:center;border-color:var(--info)"><span class="material-icons-round" style="font-size:34px;color:var(--info)">phone</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${d.dist.phone}</div><div style="color:var(--mute);font-size:.8rem">Call Support</div><a href="tel:${d.dist.phone}" class="btn btn-p" style="margin-top:10px;display:inline-flex">Call Now</a></div><div class="card cb" style="text-align:center;border-color:var(--ok)"><span class="material-icons-round" style="font-size:34px;color:var(--ok)">email</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${d.dist.email}</div><div style="color:var(--mute);font-size:.8rem">Email Support</div><a href="mailto:${d.dist.email}" class="btn btn-ok" style="margin-top:10px;display:inline-flex">Send Email</a></div><div class="card cb" style="text-align:center;border-color:var(--acc)"><span class="material-icons-round" style="font-size:34px;color:var(--acc)">chat</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">Live Chat</div><div style="color:var(--mute);font-size:.8rem">Chat Support</div><button class="btn btn-p" style="margin-top:10px" onclick="A.chatModal(false)">Open Chat</button></div></div>
    <div class="card"><div class="ch"><h3>Support Tickets</h3><span class="badge b-warn">${tks.filter(t=>t.status==='open').length} Open</span></div>${tks.length===0?'<div class="empty"><span class="material-icons-round">support_agent</span><h3>No tickets</h3></div>':`<div class="tw"><table><thead><tr><th>ID</th><th>Pharmacy</th><th>Subject</th><th>Type</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${tks.map(t=>`<tr><td style="font-family:monospace">${t.id}</td><td>${t.phName}</td><td>${t.subject}</td><td>${t.type}</td><td>${t.date}</td><td>${t.status==='open'?'<span class="badge b-warn">Open</span>':'<span class="badge b-ok">Closed</span>'}</td><td><button class="btn btn-sm btn-s" onclick="A.vTicket('${t.id}')">Respond</button></td></tr>`).join('')}</tbody></table></div>`}</div>`;
  },
  vTicket(id){
    const t=this.data.tickets.find(t=>t.id===id);if(!t)return;
    this.showModal('Ticket – '+t.id,`<div style="margin-bottom:12px"><span class="badge b-gray">${t.type}</span><span style="margin-left:7px;font-size:.8rem;color:var(--mute)">from ${t.phName} · ${t.date}</span></div><div class="chat"><div class="chatm" id="tmsg">${t.msgs.map(m=>`<div class="cmsg ${m.from==='support'?'sent':'recv'}"><div>${m.text}</div><div class="ct">${m.time}</div></div>`).join('')}</div><div class="chatin"><input type="text" id="tr" placeholder="Reply…" onkeypress="if(event.key==='Enter')A.replyTk('${id}')"><button class="btn btn-p" onclick="A.replyTk('${id}')"><span class="material-icons-round">send</span></button></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button>${t.status==='open'?`<button class="btn btn-ok" onclick="A.closeTk('${id}')">Close Ticket</button>`:''}`);
    setTimeout(()=>{const m=Q('#tmsg');if(m)m.scrollTop=m.scrollHeight;},100);
  },
  replyTk(id){const t=this.data.tickets.find(t=>t.id===id);const inp=Q('#tr');if(!t||!inp?.value.trim())return;const msg={from:'support',text:inp.value.trim(),time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};t.msgs.push(msg);inp.value='';this.save();const m=Q('#tmsg');if(m){m.innerHTML+=`<div class="cmsg sent"><div>${msg.text}</div><div class="ct">${msg.time}</div></div>`;m.scrollTop=m.scrollHeight;}},
  closeTk(id){const t=this.data.tickets.find(t=>t.id===id);if(t)t.status='closed';this.save();this.closeModal();this.toast('Ticket closed','ok');this.nav('support');},
  chatModal(fromPh){
    this.showModal('Live Chat Support',`<div class="chat" style="height:360px"><div class="chatm" id="cm">${this.data.chats.map(m=>`<div class="cmsg ${m.from==='support'?'sent':'recv'}"><div>${m.text}</div><div class="ct">${m.time}</div></div>`).join('')}</div><div class="chatin"><input type="text" id="ci" placeholder="Type message…" onkeypress="if(event.key==='Enter')A.sendChat(${fromPh})"><button class="btn btn-p" onclick="A.sendChat(${fromPh})"><span class="material-icons-round">send</span></button></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Close</button>`);
    setTimeout(()=>{const m=Q('#cm');if(m)m.scrollTop=m.scrollHeight;},100);
  },
  sendChat(fromPh){
    const inp=Q('#ci');if(!inp?.value.trim())return;
    const msg={from:fromPh?'pharmacy':'support',text:inp.value.trim(),time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};
    this.data.chats.push(msg);this.save();inp.value='';
    const m=Q('#cm');if(m){m.innerHTML+=`<div class="cmsg ${fromPh?'recv':'sent'}"><div>${msg.text}</div><div class="ct">${msg.time}</div></div>`;m.scrollTop=m.scrollHeight;}
    if(fromPh){setTimeout(()=>{const r={from:'support',text:"Thank you! Our team will respond shortly. For urgent help call "+this.data.dist.phone,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};this.data.chats.push(r);this.save();const m2=Q('#cm');if(m2){m2.innerHTML+=`<div class="cmsg sent"><div>${r.text}</div><div class="ct">${r.time}</div></div>`;m2.scrollTop=m2.scrollHeight;}},1500);}
  },

  // ===== PHARMACY DASHBOARD =====
  rPhDash(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);const today=new Date();
    const exp=drugs.filter(d=>{const e=new Date(d.exp);return e>today&&(e-today)/864e5<=30;});const expired=drugs.filter(d=>new Date(d.exp)<today);const low=drugs.filter(d=>d.qty<=d.min);
    const ords=this.data.orders.filter(o=>o.phId===phId);const bills=this.data.bills.filter(b=>b.phId===phId);const ph=this.data.pharmacies.find(p=>p.id===phId);
    // Onboarding checklist for new pharmacies
    const isNew=ords.length===0||!ph?.plan;
    const checks=[{done:!!ph?.name,label:'Profile Complete',icon:'person',action:"A.nav('profile')"},{done:!!ph?.plan,label:'Subscription Active',icon:'card_membership',action:"A.nav('subscriptions')"},{done:ords.length>0,label:'First Order Placed',icon:'shopping_cart',action:"A.nav('catalog')"},{done:drugs.length>0,label:'Inventory Added',icon:'inventory_2',action:"A.nav('inventory')"}];
    const checklist=isNew?`<div class="card" style="margin-bottom:22px;border-color:rgba(108,99,255,.4);background:linear-gradient(135deg,rgba(108,99,255,.06),var(--card))"><div class="ch"><h3 style="color:var(--acc)">🚀 Getting Started</h3><span class="badge b-acc">${checks.filter(c=>c.done).length}/${checks.length} Done</span></div><div class="cb"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">${checks.map(c=>`<div onclick="${c.action}" style="display:flex;align-items:center;gap:10px;padding:12px;background:${c.done?'rgba(0,212,142,.08)':'var(--inp)'};border:1px solid ${c.done?'var(--ok)':'var(--bdr)'};border-radius:10px;cursor:pointer;transition:.2s" onmouseenter="this.style.borderColor='var(--acc)'" onmouseleave="this.style.borderColor='${c.done?'var(--ok)':'var(--bdr)'}'"><span class="material-icons-round" style="color:${c.done?'var(--ok)':'var(--mute)'}">${c.done?'check_circle':c.icon}</span><span style="font-size:.875rem;font-weight:600;color:${c.done?'var(--ok)':'var(--txt2)'}">${c.label}</span></div>`).join('')}</div></div></div>`:'';
    return`<div class="ph"><div class="pt"><h1>${ph?.name||'Dashboard'}</h1><p>Welcome back! Here's your pharmacy overview.</p></div><div class="pa"><button class="btn btn-s" onclick="A.nav('catalog')"><span class="material-icons-round">store</span>Product Catalog</button><button class="btn btn-p" onclick="A.nav('catalog')"><span class="material-icons-round">shopping_cart</span>Order from Catalog</button></div></div>
    ${checklist}
    <div class="sg"><div class="sc p"><div class="sic p"><span class="material-icons-round">medication</span></div><div><div class="sv">${drugs.length}</div><div class="sl2">Total Drugs</div><div class="scc up">${drugs.reduce((s,d)=>s+d.qty,0)} units</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">warning</span></div><div><div class="sv">${low.length}</div><div class="sl2">Low Stock</div><div class="scc dn">${expired.length} Expired</div></div></div><div class="sc g"><div class="sic g"><span class="material-icons-round">shopping_cart</span></div><div><div class="sv">${ords.filter(o=>o.type==='inventory').length}</div><div class="sl2">Inventory Orders</div><div class="scc">${ords.filter(o=>o.type==='inventory'&&o.status==='pending').length} Pending</div></div></div><div class="sc c"><div class="sic c"><span class="material-icons-round">receipt_long</span></div><div><div class="sv">₹${this.fmt(bills.filter(b=>b.status==='unpaid').reduce((s,b)=>s+b.amt,0))}</div><div class="sl2">Outstanding Bills</div><div class="scc">${bills.filter(b=>b.status==='unpaid').length} bills</div></div></div></div>
    ${(exp.length>0||low.length>0||expired.length>0)?`<div class="card" style="margin-bottom:22px;border-color:rgba(255,181,71,.4)"><div class="ch" style="border-color:rgba(255,181,71,.2)"><h3 style="color:var(--warn)">⚠️ Smart Alerts</h3><span class="badge b-warn">${exp.length+low.length+expired.length} Issues</span></div><div class="cb"><div class="al">${expired.map(d=>`<div class="ai danger"><span class="material-icons-round ai-icon">error</span><div class="ai-txt"><strong>${d.name} – EXPIRED</strong><span>Expiry: ${d.exp} · Qty: ${d.qty}</span></div><button class="btn btn-sm btn-er" onclick="A.returnModal()">Return</button></div>`).join('')}${exp.map(d=>{const days=Math.round((new Date(d.exp)-today)/864e5);return`<div class="ai warning"><span class="material-icons-round ai-icon">schedule</span><div class="ai-txt"><strong>${d.name} – Expiring in ${days} days</strong><span>Expiry: ${d.exp} · Qty: ${d.qty}</span></div><button class="btn btn-sm btn-warn" onclick="A.returnModal()">Return</button></div>`}).join('')}${low.map(d=>`<div class="ai danger"><span class="material-icons-round ai-icon">inventory_2</span><div class="ai-txt"><strong>${d.name} – Low Stock (${d.qty} left)</strong><span>Min: ${d.min} units</span></div><button class="btn btn-sm btn-p" onclick="A.placeOrderModal()">Reorder</button></div>`).join('')}</div></div></div>`:''}
    <div class="cr"><div class="card"><div class="ch"><h3>Sales Overview</h3></div><div class="cc"><canvas id="sc2"></canvas></div></div><div class="card"><div class="ch"><h3>Inventory by Category</h3></div><div class="cc"><canvas id="ic2"></canvas></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="card"><div class="ch"><h3>Recent Orders</h3><button class="btn btn-sm btn-s" onclick="A.nav('orders')">View All</button></div><div class="tw"><table><thead><tr><th>ID</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>${ords.slice(-5).reverse().map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td><span class="badge ${o.type==='inventory'?'b-acc':'b-info'}">${o.type}</span></td><td>₹${this.fmt(o.tot)}</td><td>${this.sbadge(o.status)}</td></tr>`).join('')}</tbody></table></div></div><div class="card"><div class="ch"><h3>Distributor Info</h3></div><div class="cb"><div class="ic"><div class="icg"><div class="if"><label>Company</label><span>${this.data.dist.name}</span></div><div class="if"><label>Phone</label><span>${this.data.dist.mobile}</span></div><div class="if"><label>Email</label><span>${this.data.dist.email}</span></div><div class="if"><label>Address</label><span>${this.data.dist.address}</span></div></div></div></div></div></div>`;
  },
  chartPh(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);const ords=this.data.orders.filter(o=>o.phId===phId&&o.type==='customer');
    const c1=Q('#sc2')?.getContext('2d');if(c1)this.st.charts.s=new Chart(c1,{type:'bar',data:{labels:['Nov','Dec','Jan','Feb','Mar','Apr'],datasets:[{label:'Sales',data:[8200,12400,9800,14200,11600,Math.round(ords.reduce((s,o)=>s+o.tot,0))],backgroundColor:'rgba(108,99,255,.7)',borderColor:'#6C63FF',borderWidth:1,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}},y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}}}}});
    const c2=Q('#ic2')?.getContext('2d');if(c2){const cats={};drugs.forEach(d=>{cats[d.cat]=(cats[d.cat]||0)+d.qty;});this.st.charts.i=new Chart(c2,{type:'doughnut',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:['#6C63FF','#00D4FF','#00D48E','#FFB547','#FF4757','#3B82F6'],borderColor:'#0E1826',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7B9CC4'}}},cutout:'60%'}});}
  },

  // ===== PHARMACY INVENTORY =====
  rInventory(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);const today=new Date();const srch=this.st.filt.is||'';
    const filtered=drugs.filter(d=>!srch||d.name.toLowerCase().includes(srch.toLowerCase())||d.gen.toLowerCase().includes(srch.toLowerCase())||d.cat.toLowerCase().includes(srch.toLowerCase()));
    const ds=d=>{const e=new Date(d.exp);if(e<today)return'expired';if((e-today)/864e5<=30)return'expiring';if(d.qty<=d.min)return'low';return'ok';};
    return`<div class="ph"><div class="pt"><h1>Drug Inventory</h1><p>Manage all drugs in your pharmacy.</p></div><div class="pa"><button class="btn btn-s" onclick="A.exportCSV()" title="Export to CSV"><span class="material-icons-round">download</span>Export</button><button class="btn btn-s" onclick="A.openScanner()"><span class="material-icons-round">qr_code_scanner</span>Scan</button><button class="btn btn-sync" onclick="A.importSoftwareModal()" title="Import from Marg, Busy, Winpharm, Tally…"><span class="material-icons-round">sync</span>Sync from Software</button><button class="btn btn-p" onclick="A.addDrugModal()"><span class="material-icons-round">add</span>Add Drug</button></div></div>
    <div class="fb" style="justify-content:space-between"><div style="display:flex;gap:7px"><button class="fbtn active" onclick="A.fInv(this,'all')">All (${drugs.length})</button><button class="fbtn" onclick="A.fInv(this,'low')">Low Stock (${drugs.filter(d=>d.qty<=d.min).length})</button><button class="fbtn" onclick="A.fInv(this,'expiring')">Expiring (${drugs.filter(d=>{const e=new Date(d.exp);return e>today&&(e-today)/864e5<=30;}).length})</button><button class="fbtn" onclick="A.fInv(this,'expired')">Expired (${drugs.filter(d=>new Date(d.exp)<today).length})</button></div><div style="position:relative;max-width:240px"><span class="material-icons-round si-icon" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--mute);font-size:18px;pointer-events:none">search</span><input type="text" placeholder="Search drugs…" value="${srch}" oninput="A.setState('st.filt.is',this.value);A.nav('inventory')" style="padding-left:36px"></div></div>
    <div class="card"><div class="tw"><table id="invt"><thead><tr><th>Drug Name</th><th>Generic</th><th>Category</th><th>Quantity</th><th>Batch</th><th>MRP</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filtered.map(d=>{const s=ds(d);const days=Math.round((new Date(d.exp)-today)/864e5);return`<tr class="inv-${s==='expired'?'exp':s==='expiring'?'soon':s==='low'?'low':''}" data-ds="${s}"><td style="font-weight:700">${d.name}</td><td style="color:var(--mute)">${d.gen}</td><td><span class="badge b-gray">${d.cat}</span></td><td style="color:${d.qty<=d.min?'var(--err)':'var(--txt)'};font-weight:700">${d.qty}${d.qty<=d.min?' ⚠️':''}</td><td style="font-family:monospace;font-size:.8rem">${d.batch}</td><td>₹${d.mrp.toFixed(2)}</td><td style="color:${s==='expired'?'var(--err)':s==='expiring'?'var(--warn)':'var(--txt2)'}">${d.exp}${s==='expiring'?` (${days}d)`:s==='expired'?' ⚠️':''}</td><td>${s==='expired'?'<span class="badge b-err">Expired</span>':s==='expiring'?'<span class="badge b-warn">Expiring</span>':s==='low'?'<span class="badge b-err">Low Stock</span>':'<span class="badge b-ok">In Stock</span>'}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.editDrugModal('${d.id}')">Edit</button><button class="btn btn-sm btn-er" onclick="A.delDrug('${d.id}')">Delete</button></div></td></tr>`;}).join('')}${filtered.length===0?`<tr><td colspan="9"><div class="empty"><span class="material-icons-round">search_off</span><h3>No drugs found</h3></div></td></tr>`:''}</tbody></table></div></div>`;
  },
  fInv(btn,s){QA('.fbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');QA('#invt tbody tr').forEach(r=>{r.style.display=(s==='all'||r.dataset.ds===s)?'':'none';});},

  // ===== SMART INVENTORY SYNC (Import from Software) =====
  importSoftwareModal(){
    this.showModal('🔄 Sync Inventory from Software',`
      <div style="text-align:center;padding:6px 0 18px">
        <div style="font-size:.82rem;color:var(--mute);margin-bottom:14px">Supports Marg ERP, Busy, Winpharm, Tally, Gofrugal and any CSV/Excel export</div>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:18px">
          ${['Marg ERP','Busy','Winpharm','Tally','Gofrugal','Excel/CSV'].map(s=>`<span style="padding:4px 12px;border-radius:99px;border:1px solid var(--bdr);font-size:.72rem;color:var(--mute);font-weight:600">${s}</span>`).join('')}
        </div>
      </div>

      <!-- Drag & Drop Zone -->
      <div id="sync-drop" onclick="Q('#sync-file').click()" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');A.handleSyncFile(event.dataTransfer.files[0])"
        style="border:2px dashed var(--bdr);border-radius:14px;padding:32px;text-align:center;cursor:pointer;transition:.25s;background:rgba(108,99,255,.04)" onmouseenter="this.style.borderColor='var(--acc)'" onmouseleave="this.style.borderColor='var(--bdr)'">
        <span class="material-icons-round" style="font-size:42px;color:var(--acc);display:block;margin-bottom:10px">upload_file</span>
        <div style="font-weight:700;color:var(--txt);margin-bottom:4px">Drop your CSV / Excel file here</div>
        <div style="font-size:.78rem;color:var(--mute)">or <span style="color:var(--acc);text-decoration:underline">click to browse</span></div>
        <input type="file" id="sync-file" accept=".csv,.xlsx,.xls,.txt" style="display:none" onchange="A.handleSyncFile(this.files[0])">
      </div>

      <!-- Divider -->
      <div style="display:flex;align-items:center;gap:10px;margin:14px 0">
        <div style="flex:1;height:1px;background:var(--bdr)"></div>
        <span style="font-size:.75rem;color:var(--mute)">OR PASTE DATA</span>
        <div style="flex:1;height:1px;background:var(--bdr)"></div>
      </div>

      <!-- Paste area -->
      <textarea id="sync-paste" placeholder="Paste CSV data here (Name, Quantity, Batch, Expiry, MRP, Category)&#10;Example:&#10;Paracetamol 500mg,100,B2024001,2026-12-31,12.50,Analgesic&#10;Amoxicillin 250mg,200,B2024002,2026-06-30,45.00,Antibiotic"
        style="min-height:110px;font-family:monospace;font-size:.78rem;resize:vertical" oninput="A.syncPreviewPaste()"></textarea>

      <!-- Preview area -->
      <div id="sync-preview" style="margin-top:12px"></div>
    `,`<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" id="sync-import-btn" onclick="A.runSyncImport()" style="display:none"><span class="material-icons-round">download_done</span>Import All to Inventory</button>`,'mdl-lg');
  },

  handleSyncFile(file){
    if(!file)return;
    const ext=file.name.split('.').pop().toLowerCase();
    if(!['csv','txt','xlsx','xls'].includes(ext)){this.toast('Please upload a CSV or Excel file','err');return;}
    const reader=new FileReader();
    reader.onload=e=>{
      const text=e.target.result;
      Q('#sync-paste').value=text;
      this.syncPreviewPaste();
    };
    reader.readAsText(file);
    const drop=Q('#sync-drop');
    if(drop)drop.innerHTML=`<span class="material-icons-round" style="font-size:32px;color:var(--ok);display:block;margin-bottom:8px">check_circle</span><div style="font-weight:700;color:var(--ok)">${file.name}</div><div style="font-size:.75rem;color:var(--mute)">${(file.size/1024).toFixed(1)} KB — Parsing...</div>`;
  },

  _parseSyncCSV(text){
    // Auto-detect delimiter
    const delim=text.includes('\t')?'\t':text.includes(';')?';':',';
    const lines=text.trim().split('\n').filter(l=>l.trim());
    if(!lines.length)return[];
    // Detect if first row is a header
    const firstLower=lines[0].toLowerCase();
    const hasHeader=firstLower.includes('name')||firstLower.includes('drug')||firstLower.includes('item')||firstLower.includes('product')||firstLower.includes('medicine');
    const dataLines=hasHeader?lines.slice(1):lines;
    const cats=['Analgesic','Antibiotic','Antidiabetic','Antihypertensive','Antihistamine','Statin','PPI','Antifungal','Antiviral','Vitamin'];
    const today=new Date().toLocaleDateString('en-CA');

    return dataLines.map(line=>{
      const cols=line.split(delim).map(c=>c.trim().replace(/^["']|["']$/g,''));
      // Smart column detection — try to find which column is what
      const name=cols[0]||'Unknown Drug';
      const qty=parseInt(cols.find(c=>/^\d+$/.test(c.trim())))||0;
      // Find expiry — look for date pattern
      const expCol=cols.find(c=>/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(c));
      let exp=today;
      if(expCol){
        // Normalize date to YYYY-MM-DD
        const parts=expCol.split(/[-\/]/);
        if(parts.length===3){
          if(parts[0].length===4)exp=expCol.replace(/\//g,'-');
          else if(parts[2].length===4)exp=`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
          else if(parts[2].length===2)exp=`20${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }
      // Batch no
      const batchCol=cols.find(c=>/^[A-Z]{1,3}[\-\/]?\d{4,}/i.test(c)&&c!==name);
      const batch=batchCol||('B'+Date.now().toString().slice(-6));
      // MRP — look for decimal price
      const mrpCol=cols.find(c=>/^\d+(\.\d{1,2})?$/.test(c)&&parseFloat(c)<10000&&parseFloat(c)>0);
      const mrp=parseFloat(mrpCol)||0;
      // Category — check if any col matches known categories
      const catCol=cols.find(c=>cats.some(cat=>c.toLowerCase().includes(cat.toLowerCase())));
      const cat=catCol?cats.find(cat=>catCol.toLowerCase().includes(cat.toLowerCase()))||'Other':'Other';
      return{name,qty,exp,batch,mrp,cat,gen:'',mfr:'',min:50,price:mrp*.8};
    }).filter(d=>d.name&&d.name!=='Unknown Drug'&&d.qty>0);
  },

  syncPreviewPaste(){
    const text=Q('#sync-paste')?.value||'';
    if(!text.trim()){Q('#sync-preview').innerHTML='';if(Q('#sync-import-btn'))Q('#sync-import-btn').style.display='none';return;}
    const rows=this._parseSyncCSV(text);
    this._syncRows=rows;
    const el=Q('#sync-preview');
    if(!el)return;
    if(!rows.length){
      el.innerHTML=`<div style="padding:12px;background:rgba(255,71,87,.08);border:1px solid var(--err);border-radius:8px;font-size:.82rem;color:var(--err)">⚠️ Could not parse data. Make sure it's CSV format: Name, Qty, Batch, Expiry, MRP</div>`;
      if(Q('#sync-import-btn'))Q('#sync-import-btn').style.display='none';
      return;
    }
    el.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;color:var(--ok)"><span class="material-icons-round" style="vertical-align:middle;font-size:18px">check_circle</span> ${rows.length} drugs detected — Preview</div>
        <span class="badge b-ok">${rows.length} items ready</span>
      </div>
      <div style="max-height:220px;overflow-y:auto;border-radius:10px;border:1px solid var(--bdr)">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--inp)">${['Drug Name','Qty','Batch','Expiry','MRP ₹','Category'].map(h=>`<th style="padding:8px 10px;font-size:.72rem;font-weight:700;color:var(--mute);text-align:left;white-space:nowrap">${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r,i)=>`<tr style="border-top:1px solid var(--bdr);background:${i%2===0?'transparent':'rgba(255,255,255,.02)'}">
            <td style="padding:7px 10px;font-weight:600;color:var(--txt);font-size:.82rem">${r.name}</td>
            <td style="padding:7px 10px;color:${r.qty>0?'var(--ok)':'var(--err)'};font-weight:700">${r.qty}</td>
            <td style="padding:7px 10px;font-family:monospace;font-size:.75rem;color:var(--mute)">${r.batch}</td>
            <td style="padding:7px 10px;font-size:.8rem">${r.exp}</td>
            <td style="padding:7px 10px;font-weight:600">₹${r.mrp.toFixed(2)}</td>
            <td style="padding:7px 10px"><span class="badge b-gray" style="font-size:.65rem">${r.cat}</span></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    const btn=Q('#sync-import-btn');if(btn)btn.style.display='inline-flex';
  },

  async runSyncImport(){
    const rows=this._syncRows||[];
    if(!rows.length){this.toast('No data to import','err');return;}
    const btn=Q('#sync-import-btn');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="material-icons-round spin">autorenew</span>Importing...';}
    const phId=this.st.user.phId;
    let ok=0,fail=0;
    for(const r of rows){
      const drug={phId,name:r.name,gen:r.gen||'',cat:r.cat||'Other',mfr:r.mfr||'',batch:r.batch,qty:r.qty,min:r.min||50,price:r.price||r.mrp*.8,mrp:r.mrp,exp:r.exp,bc:''};
      // Check if drug with same name already exists — update qty if yes
      const existing=this.data.drugs.find(d=>d.phId===phId&&d.name.toLowerCase()===drug.name.toLowerCase());
      if(existing){
        existing.qty=drug.qty;existing.mrp=drug.mrp;existing.batch=drug.batch;existing.exp=drug.exp;
        const res=await apiPut('/drugs/'+existing.id,existing);
        if(res?.ok||_demoMode)ok++;else fail++;
      } else {
        const res=await apiPost('/drugs',drug);
        if(res?.ok||_demoMode){drug.id=res?.id||'d'+Date.now()+ok;this.data.drugs.push(drug);ok++;}else fail++;
      }
    }
    this.closeModal();
    this.toast(`✅ Sync complete! ${ok} drugs imported${fail>0?`, ${fail} failed`:''}`, ok>0?'ok':'err', `Inventory updated from software`);
    this.nav('inventory');
  },


  addDrugModal(pre={}){
    const cats=['Analgesic','Antibiotic','Antidiabetic','Antihypertensive','Antihistamine','Statin','PPI','Antifungal','Antiviral','Vitamin','Other'];
    this.showModal('Add Drug',`<div class="fr"><div class="fg"><label>Drug Name *</label><input id="dn2" placeholder="e.g. Paracetamol 500mg" value="${pre.name||''}"></div><div class="fg"><label>Generic Name</label><input id="dg" placeholder="Generic name" value="${pre.gen||''}"></div></div><div class="fr"><div class="fg"><label>Category</label><select id="dc">${cats.map(c=>`<option value="${c}"${pre.cat===c?' selected':''}>${c}</option>`).join('')}</select></div><div class="fg"><label>Manufacturer</label><input id="dm" placeholder="e.g. Sun Pharma" value="${pre.mfr||''}"></div></div><div class="fr"><div class="fg"><label>Quantity *</label><input id="dq" type="number" min="0" placeholder="0" value="${pre.qty||''}"></div><div class="fg"><label>Min Stock</label><input id="dms" type="number" min="0" placeholder="50" value="${pre.min||50}"></div></div><div class="fr"><div class="fg"><label>Purchase Price ₹</label><input id="dp" type="number" min="0" step="0.01" placeholder="0.00" value="${pre.price||''}"></div><div class="fg"><label>MRP ₹</label><input id="dmp" type="number" min="0" step="0.01" placeholder="0.00" value="${pre.mrp||''}"></div></div><div class="fr"><div class="fg"><label>Batch No.</label><input id="db" placeholder="e.g. B2024001" value="${pre.batch||''}"></div><div class="fg"><label>Expiry Date *</label><input id="de" type="date" value="${pre.exp||''}"></div></div><div class="fg"><label>Barcode</label><input id="dbc" placeholder="Barcode number" value="${pre.bc||''}"></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveDrug()"><span class="material-icons-round">save</span>Add Drug</button>`);
  },
  async saveDrug(){
    const name=Q('#dn2')?.value.trim(),qty=parseInt(Q('#dq')?.value),exp=Q('#de')?.value;
    if(!name||!qty||!exp){this.toast('Fill required fields (*)','err');return;}
    const drug={phId:this.st.user.phId,name,gen:Q('#dg')?.value||'',cat:Q('#dc')?.value,mfr:Q('#dm')?.value||'',qty,min:parseInt(Q('#dms')?.value)||50,price:parseFloat(Q('#dp')?.value)||0,mrp:parseFloat(Q('#dmp')?.value)||0,batch:Q('#db')?.value||'AUTO'+Date.now(),exp,bc:Q('#dbc')?.value||''};const res=await apiPost('/drugs',drug);if(res?.ok){drug.id=res.id;this.data.drugs.push(drug);}this.closeModal();this.toast(name+' added!','ok');this.nav('inventory');
  },
  editDrugModal(id){
    const d=this.data.drugs.find(d=>d.id===id);if(!d)return;const cats=['Analgesic','Antibiotic','Antidiabetic','Antihypertensive','Antihistamine','Statin','PPI','Antifungal','Antiviral','Vitamin','Other'];
    this.showModal('Edit Drug – '+d.name,`<div class="fr"><div class="fg"><label>Name</label><input id="ed1" value="${d.name}"></div><div class="fg"><label>Category</label><select id="ed2">${cats.map(c=>`<option value="${c}"${d.cat===c?' selected':''}>${c}</option>`).join('')}</select></div></div><div class="fr"><div class="fg"><label>Quantity</label><input id="ed3" type="number" value="${d.qty}" min="0"></div><div class="fg"><label>Min Stock</label><input id="ed4" type="number" value="${d.min}" min="0"></div></div><div class="fr"><div class="fg"><label>Purchase ₹</label><input id="ed5" type="number" value="${d.price}" step="0.01"></div><div class="fg"><label>MRP ₹</label><input id="ed6" type="number" value="${d.mrp}" step="0.01"></div></div><div class="fr"><div class="fg"><label>Batch</label><input id="ed7" value="${d.batch}"></div><div class="fg"><label>Expiry</label><input id="ed8" type="date" value="${d.exp}"></div></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.updDrug('${id}')">Update</button>`);
  },
  updDrug(id){const d=this.data.drugs.find(d=>d.id===id);if(!d)return;d.name=Q('#ed1').value;d.cat=Q('#ed2').value;d.qty=parseInt(Q('#ed3').value);d.min=parseInt(Q('#ed4').value);d.price=parseFloat(Q('#ed5').value);d.mrp=parseFloat(Q('#ed6').value);d.batch=Q('#ed7').value;d.exp=Q('#ed8').value;this.save();this.closeModal();this.toast('Updated!','ok');this.nav('inventory');},
  delDrug(id){const d=this.data.drugs.find(d=>d.id===id);if(!confirm('Delete '+d?.name+'?'))return;this.data.drugs=this.data.drugs.filter(d=>d.id!==id);this.save();this.toast('Drug removed','warn');this.nav('inventory');},
  openScanner(){
    this.showModal('Barcode Scanner',`<p style="color:var(--txt2);text-align:center;margin-bottom:14px">Point camera at barcode or enter manually</p><div class="scan-wrap" id="sw"><video id="bvideo" autoplay muted playsinline></video><div class="scan-ovl"><div class="scan-frame"><div class="scan-line"></div></div></div></div><div style="text-align:center;margin:14px 0;color:var(--mute);font-size:.8rem">— or enter manually —</div><div style="display:flex;gap:7px"><input id="mbc" type="text" placeholder="Enter barcode number" style="flex:1"><button class="btn btn-p" onclick="A.lookupBC(Q('#mbc').value)">Lookup</button></div><div id="br" style="margin-top:10px"></div>`,
    `<button class="btn btn-s" onclick="A.stopScan();A.closeModal()">Close</button>`,'mdl-sm');
    this.startScan();
  },
  startScan(){
    const v=Q('#bvideo');if(!v)return;
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'environment'}}).then(s=>{this._stream=s;v.srcObject=s;}).catch(()=>{const w=Q('#sw');if(w)w.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:160px;color:var(--mute)"><div style="text-align:center"><span class="material-icons-round" style="font-size:40px">no_photography</span><p style="margin-top:6px">Camera unavailable. Use manual entry.</p></div></div>';});
  },
  stopScan(){if(this._stream){this._stream.getTracks().forEach(t=>t.stop());this._stream=null;}},
  lookupBC(bc){const drug=this.data.drugs.find(d=>d.bc===bc);const el=Q('#br');if(drug){if(el)el.innerHTML=`<div class="ai info"><span class="material-icons-round ai-icon">check_circle</span><div class="ai-txt"><strong>${drug.name}</strong><span>Qty: ${drug.qty} · Exp: ${drug.exp}</span></div></div>`;}else{if(el)el.innerHTML=`<div class="ai warning"><span class="material-icons-round ai-icon">info</span><div class="ai-txt"><strong>Not found</strong><span>Barcode: ${bc}</span></div><button class="btn btn-sm btn-p" onclick="A.stopScan();A.closeModal();A.addDrugModal({bc:'${bc}'})">Add Drug</button></div>`;}},

  // ===== PHARMACY ORDERS =====
  rPhOrders(){
    const phId=this.st.user.phId;const all=this.data.orders.filter(o=>o.phId===phId);const t=this.st.filt.ot||'inventory';
    return`<div class="ph"><div class="pt"><h1>Orders</h1><p>Inventory and customer orders.</p></div><div class="pa"><button class="btn btn-p" onclick="A.placeOrderModal()"><span class="material-icons-round">add</span>Order from Distributor</button><button class="btn btn-s" onclick="A.custOrderModal()"><span class="material-icons-round">person</span>Sell to Customer</button></div></div>
    <div class="tabs"><button class="tab${t==='inventory'?' active':''}" onclick="A.setState('st.filt.ot','inventory');A.nav('orders')">Inventory Orders (${all.filter(o=>o.type==='inventory').length})</button><button class="tab${t==='customer'?' active':''}" onclick="A.setState('st.filt.ot','customer');A.nav('orders')">Customer Orders (${all.filter(o=>o.type==='customer').length})</button></div>
    ${t==='inventory'?this.rInvOrds(all.filter(o=>o.type==='inventory')):this.rCustOrds(all.filter(o=>o.type==='customer'))}`;
  },
  rInvOrds(ords){if(!ords.length)return`<div class="empty"><span class="material-icons-round">shopping_cart</span><h3>No inventory orders</h3><button class="btn btn-p" onclick="A.placeOrderModal()" style="margin-top:14px">Order Now</button></div>`;return`<div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Drugs</th><th>Date</th><th>Total</th><th>Delivery</th><th>Status</th><th>Actions</th></tr></thead><tbody>${ords.map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td>${o.drugs.map(d=>d.name+' ×'+d.qty).join(', ')}</td><td>${o.date}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(o.tot)}</td><td>${o.del==='free'?'<span class="badge b-ok">Free</span>':'<span class="badge b-gray">Paid</span>'}</td><td>${this.sbadge(o.status)}</td><td><button class="btn btn-sm btn-s" onclick="A.vOrder('${o.id}')">Details</button></td></tr>`).join('')}</tbody></table></div></div>`;},
  rCustOrds(ords){if(!ords.length)return`<div class="empty"><span class="material-icons-round">person</span><h3>No customer orders</h3></div>`;return`<div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Customer</th><th>Drugs</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${ords.map(o=>`<tr><td style="font-family:monospace;font-size:.8rem">${o.id}</td><td>${o.cust||'—'}</td><td>${o.drugs.map(d=>d.name).join(', ')}</td><td>${o.date}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(o.tot)}</td><td>${this.sbadge(o.status)}</td><td><button class="btn btn-sm btn-s" onclick="A.vOrder('${o.id}')">View</button></td></tr>`).join('')}</tbody></table></div></div>`;},

  placeOrderModal(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const del=ph?.plan==='1500'?'free':'paid';
    this.showModal('Order from Distributor',`<div class="ic" style="margin-bottom:14px"><div style="font-size:.875rem;color:var(--txt2)"><strong>Distributor:</strong> ${this.data.dist.name} &nbsp;|&nbsp; <strong>Plan:</strong> ${ph?.plan?`₹${ph.plan}/mo (${del==='free'?'Free':'Paid'} delivery)`:'No plan'}</div></div><div id="oi"><div class="fr" style="margin-bottom:7px"><div class="fg" style="margin-bottom:0"><label>Drug Name</label><input type="text" class="odn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:90px"><label>Qty</label><input type="number" class="odq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:100px"><label>Price/unit ₹</label><input type="number" class="odp" min="0" step="0.01" placeholder="0.00"></div></div></div><button class="btn btn-s btn-sm" onclick="A.addOI()" style="margin-top:7px;margin-bottom:14px"><span class="material-icons-round">add</span>Add Drug</button><div class="fg"><label>Delivery</label><select id="od">${del==='free'?'<option value="free">Free Delivery (Your Plan)</option>':'<option value="paid">Paid Delivery</option><option value="free">Free Delivery (+₹300)</option>'}</select></div><div class="fg"><label>Notes</label><textarea id="on" placeholder="Special instructions…"></textarea></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.submitInvOrd()"><span class="material-icons-round">send</span>Place Order</button>`,'mdl-lg');
  },
  addOI(){const c=Q('#oi');const r=document.createElement('div');r.className='fr';r.style.marginBottom='7px';r.innerHTML='<div class="fg" style="margin-bottom:0"><input type="text" class="odn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:90px"><input type="number" class="odq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:100px"><input type="number" class="odp" min="0" step="0.01" placeholder="0.00"></div>';c?.appendChild(r);},
  async submitInvOrd(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const names=QA('.odn'),qtys=QA('.odq'),prices=QA('.odp');const drugs=[];
    names.forEach((n,i)=>{if(n.value&&qtys[i]?.value){const q=parseInt(qtys[i].value),p=parseFloat(prices[i]?.value)||0;drugs.push({name:n.value,qty:q,up:p,tot:q*p});}});
    if(!drugs.length){this.toast('Add at least one drug','err');return;}
    const sub=drugs.reduce((s,d)=>s+d.tot,0),gst=sub*.05,tot=sub+gst;
    const ord={id:'ORD-'+Date.now(),type:'inventory',phId:ph.id,phName:ph.name,drugs,sub,gst,tot,date:new Date().toLocaleDateString('en-CA'),status:'pending',del:Q('#od')?.value||'paid',notes:Q('#on')?.value||'',billed:false};
    const res=await apiPost('/orders',ord);if(res?.ok){ord.id=res.id;this.data.orders.push(ord);this.addNotif('order','New order from '+ph.name+': '+ord.id,true);}this.closeModal();this.toast('Order placed!','ok',drugs.length+' items · ₹'+this.fmt(tot));this.nav('orders');
  },
  custOrderModal(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId&&d.qty>0);
    this.showModal('Sell to Customer',`<div class="fr"><div class="fg"><label>Customer Name</label><input id="cn" placeholder="Customer name"></div><div class="fg"><label>Phone</label><input id="cp" type="tel" placeholder="+91…"></div></div><div id="coi"><div class="fr" style="margin-bottom:7px"><div class="fg" style="margin-bottom:0"><label>Drug</label><select class="cds" onchange="A.upCp(this)"><option value="">Select drug</option>${drugs.map(d=>`<option value="${d.id}" data-p="${d.mrp}" data-max="${d.qty}">${d.name} (${d.qty} left)</option>`).join('')}</select></div><div class="fg" style="margin-bottom:0;max-width:80px"><label>Qty</label><input type="number" class="cq" min="1" value="1" placeholder="1"></div><div class="fg" style="margin-bottom:0;max-width:90px"><label>Price ₹</label><input type="number" class="cpr" min="0" step="0.01" placeholder="0.00"></div></div></div><button class="btn btn-s btn-sm" onclick="A.addCI()" style="margin-top:7px"><span class="material-icons-round">add</span>Add Drug</button>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-ok" onclick="A.submitCustOrd()"><span class="material-icons-round">sell</span>Process Sale</button>`,'mdl-lg');
  },
  upCp(sel){const o=sel.options[sel.selectedIndex];const r=sel.closest('.fr');if(r){const p=r.querySelector('.cpr');if(p&&o.dataset.p)p.value=o.dataset.p;}},
  addCI(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId&&d.qty>0);const c=Q('#coi');const r=document.createElement('div');r.className='fr';r.style.marginBottom='7px';
    r.innerHTML=`<div class="fg" style="margin-bottom:0"><select class="cds" onchange="A.upCp(this)"><option value="">Select</option>${drugs.map(d=>`<option value="${d.id}" data-p="${d.mrp}" data-max="${d.qty}">${d.name} (${d.qty} left)</option>`).join('')}</select></div><div class="fg" style="margin-bottom:0;max-width:80px"><input type="number" class="cq" min="1" value="1"></div><div class="fg" style="margin-bottom:0;max-width:90px"><input type="number" class="cpr" min="0" step="0.01"></div>`;c?.appendChild(r);
  },
  async submitCustOrd(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const items=[];
    QA('.cds').forEach((sel,i)=>{const qtys=QA('.cq'),prices=QA('.cpr');if(sel.value&&qtys[i]?.value){const drug=this.data.drugs.find(d=>d.id===sel.value);const qty=parseInt(qtys[i].value);const price=parseFloat(prices[i]?.value)||drug?.mrp||0;if(drug&&qty>0){if(qty>drug.qty){this.toast('Not enough stock for '+drug.name,'err');return;}items.push({drugId:sel.value,name:drug.name,qty,up:price,tot:qty*price});}}});
    if(!items.length){this.toast('Add at least one drug','err');return;}
    items.forEach(item=>{const drug=this.data.drugs.find(d=>d.id===item.drugId);if(drug)drug.qty-=item.qty;});
    const sub=items.reduce((s,i)=>s+i.tot,0),gst=sub*.05,tot=sub+gst;
    const ord={id:'ORD-'+Date.now(),type:'customer',phId:ph.id,phName:ph.name,cust:Q('#cn')?.value||'Walk-in',drugs:items.map(i=>({name:i.name,qty:i.qty,up:i.up,tot:i.tot})),sub,gst,tot,date:new Date().toLocaleDateString('en-CA'),status:'delivered',notes:''};
    this.data.orders.push(ord);this.save();this.closeModal();this.toast('Sale processed! Inventory updated.','ok','₹'+this.fmt(tot));this.nav('orders');
  },

  // ===== PHARMACY DOCS =====
  rPhDocs(){
    const phId=this.st.user.phId;const ph=this.data.pharmacies.find(p=>p.id===phId);const bills=this.data.bills.filter(b=>b.phId===phId);const dist=this.data.dist;
    return`<div class="ph"><div class="pt"><h1>Documentation</h1><p>Procurement bills and distributor info.</p></div><button class="btn btn-p" onclick="A.addDocModal('${phId}')"><span class="material-icons-round">upload_file</span>Upload Document</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px"><div class="card"><div class="ch"><h3>Distributor Contact</h3></div><div class="cb"><div class="ic"><div class="icg"><div class="if"><label>Company</label><span>${dist.name}</span></div><div class="if"><label>Phone</label><span><a href="tel:${dist.mobile}" style="color:var(--acc)">${dist.mobile}</a></span></div><div class="if"><label>Email</label><span><a href="mailto:${dist.email}" style="color:var(--acc)">${dist.email}</a></span></div><div class="if"><label>Address</label><span>${dist.address}</span></div><div class="if"><label>GST</label><span style="font-family:monospace">${dist.gst}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${dist.license}</span></div></div></div></div></div>
    <div class="card"><div class="ch"><h3>Your Registration Info</h3></div><div class="cb"><div class="ic"><div class="icg"><div class="if"><label>Pharmacy Name</label><span>${ph?.name}</span></div><div class="if"><label>License</label><span style="font-family:monospace">${ph?.license}</span></div><div class="if"><label>Contact</label><span>${ph?.contact}</span></div><div class="if"><label>Email</label><span>${ph?.email}</span></div><div class="if" style="grid-column:1/-1"><label>Address</label><span>${ph?.address}</span></div></div></div></div></div></div>
    <div class="card"><div class="ch"><h3>Uploaded Documents</h3></div><div class="cb">${ph?.docs?.length>0?ph.docs.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:7px"><span class="material-icons-round" style="color:var(--err)">picture_as_pdf</span><span style="flex:1;font-size:.875rem;color:var(--txt)">${d.name}</span><span style="font-size:.72rem;color:var(--mute)">${d.size} · ${d.date}</span></div>`).join(''):'<p style="color:var(--mute)">No documents uploaded yet.</p>'}</div></div>
    <div class="card" style="margin-top:14px"><div class="ch"><h3>Procurement Bills from Distributor</h3></div><div class="tw"><table><thead><tr><th>Bill ID</th><th>Order</th><th>Amount</th><th>Date</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bills.map(b=>`<tr><td style="font-family:monospace;font-size:.8rem">${b.id}</td><td style="font-family:monospace;font-size:.8rem">${b.ordId}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(b.amt)}</td><td>${b.date}</td><td>${b.due}</td><td>${b.status==='paid'?'<span class="badge b-ok">Paid</span>':'<span class="badge b-err">Unpaid</span>'}</td><td>${b.status==='unpaid'?`<button class="btn btn-sm btn-ok" onclick="A.payBill('${b.id}')">Pay Now</button>`:''}</td></tr>`).join('')}${bills.length===0?'<tr><td colspan="7" style="text-align:center;color:var(--mute);padding:20px">No bills yet</td></tr>':''}</tbody></table></div></div>`;
  },

  // ===== PHARMACY BILLING =====
  rPhBilling(){
    const phId=this.st.user.phId;const bills=this.data.bills.filter(b=>b.phId===phId);const paid=bills.filter(b=>b.status==='paid');const unpaid=bills.filter(b=>b.status==='unpaid');
    return`<div class="ph"><div class="pt"><h1>Billing</h1><p>Your bills and payment history.</p></div></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr)"><div class="sc g"><div class="sic g"><span class="material-icons-round">check_circle</span></div><div><div class="sv">${paid.length}</div><div class="sl2">Bills Paid</div></div></div><div class="sc o"><div class="sic o"><span class="material-icons-round">pending_actions</span></div><div><div class="sv">${unpaid.length}</div><div class="sl2">Unpaid Bills</div><div class="scc dn">₹${this.fmt(unpaid.reduce((s,b)=>s+b.amt,0))} due</div></div></div><div class="sc p"><div class="sic p"><span class="material-icons-round">receipt_long</span></div><div><div class="sv">₹${this.fmt(paid.reduce((s,b)=>s+b.amt,0))}</div><div class="sl2">Total Paid</div></div></div></div>
    ${unpaid.length>0?`<div class="card" style="margin-bottom:14px;border-color:rgba(255,71,87,.3)"><div class="ch" style="border-color:rgba(255,71,87,.2)"><h3 style="color:var(--err)">⚠️ Unpaid Bills</h3><span class="badge b-err">₹${this.fmt(unpaid.reduce((s,b)=>s+b.amt,0))} due</span></div><div class="cb"><div class="al">${unpaid.map(b=>`<div class="ai danger"><span class="material-icons-round ai-icon">receipt_long</span><div class="ai-txt"><strong>${b.id} – ₹${this.fmt(b.amt)}</strong><span>Due: ${b.due}</span></div><button class="btn btn-sm btn-ok" onclick="A.payBill('${b.id}')">Pay Now</button></div>`).join('')}</div></div></div>`:''}
    <div class="card"><div class="ch"><h3>All Bills</h3></div><div class="tw"><table><thead><tr><th>Bill ID</th><th>Order</th><th>Amount</th><th>Date</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bills.map(b=>`<tr><td style="font-family:monospace;font-size:.8rem">${b.id}</td><td style="font-family:monospace;font-size:.8rem">${b.ordId}</td><td style="font-weight:700;color:var(--txt)">₹${this.fmt(b.amt)}</td><td>${b.date}</td><td>${b.due}</td><td>${b.status==='paid'?'<span class="badge b-ok">Paid</span>':'<span class="badge b-err">Unpaid</span>'}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.vBill('${b.id}')">View</button>${b.status==='unpaid'?`<button class="btn btn-sm btn-ok" onclick="A.payBill('${b.id}')">Pay</button>`:''}</div></td></tr>`).join('')}${bills.length===0?'<tr><td colspan="7" style="text-align:center;color:var(--mute);padding:20px">No bills yet</td></tr>':''}</tbody></table></div></div>`;
  },
  payBill(id){
    const b=this.data.bills.find(b=>b.id===id);if(!b)return;
    const upi=this.data.dist.upi||'pharmadist@upi';
    const pn=encodeURIComponent(this.data.dist.name||'PharmaDist');
    const note=encodeURIComponent('Bill '+b.id);
    const amt=encodeURIComponent((+b.amt).toFixed(2));
    const upiUrl='upi://pay?pa='+encodeURIComponent(upi)+'&pn='+pn+'&am='+amt+'&cu=INR&tn='+note;
    const qrUrl='https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data='+encodeURIComponent(upiUrl);
    const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const rupee='\u20b9';
    const body='<div style="text-align:center;padding:4px 0 10px">'
      +'<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(108,99,255,.12);border:1px solid rgba(108,99,255,.3);border-radius:10px;padding:8px 18px;margin-bottom:12px"><span class="material-icons-round" style="color:var(--acc)">currency_rupee</span><span style="font-size:1.4rem;font-weight:800;color:var(--acc)">'+rupee+this.fmt(b.amt)+'</span><span style="font-size:.78rem;color:var(--mute)">'+b.id+'</span></div>'
      +(isMobile?'':'<br><img src="'+qrUrl+'" alt="UPI QR" style="width:180px;height:180px;border-radius:12px;border:3px solid var(--acc);background:#fff;padding:4px"><br>')
      +'<br><a href="'+upiUrl+'" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:linear-gradient(135deg,#00D48E,#1a73e8);color:#fff;font-weight:700;font-size:.95rem;padding:13px 32px;border-radius:10px;margin:8px 0 12px;box-shadow:0 4px 18px rgba(0,180,120,.4);font-family:inherit"><span class="material-icons-round">open_in_new</span>Open UPI App</a>'
      +'<div style="margin-bottom:8px;background:var(--inp);border-radius:8px;padding:8px 14px;display:inline-flex;align-items:center;gap:10px"><div><div style="font-size:.68rem;color:var(--mute);margin-bottom:2px">UPI ID</div><div style="font-family:monospace;font-weight:700;color:var(--acc)">'+upi+'</div></div><button class="btn btn-sm btn-s" onclick="navigator.clipboard.writeText(\''+upi+'\').then(()=>A.toast(\'Copied!\',\'ok\'))"><span class="material-icons-round" style="font-size:16px">content_copy</span></button></div></div>'
      +'<div style="margin-bottom:10px;padding:10px;background:rgba(255,181,71,.08);border:1px solid rgba(255,181,71,.3);border-radius:8px;font-size:.8rem;color:var(--warn)">After paying, enter UTR below and click Submit UTR.</div>'
      +'<div class="fg"><label>UTR / Transaction Reference *</label><input id="ptr" placeholder="12-digit UTR or UPI Ref No." style="font-family:monospace"></div>'
      +'<div class="fg"><label>Payment Method</label><select id="pm"><option value="UPI">UPI (GPay/PhonePe/Paytm)</option><option value="NEFT">NEFT/RTGS</option><option value="IMPS">IMPS</option><option value="Cash">Cash</option></select></div>';
    const foot='<button class="btn btn-s" onclick="A.closeModal()">Cancel</button>'
      +'<button class="btn btn-ok" onclick="A.submitUTR('+JSON.stringify(id)+')"><span class="material-icons-round">send</span>Submit UTR</button>';
    this.showModal('Pay via UPI',body,foot);
  },
  async submitUTR(id){
    const utr=(Q('#ptr')?.value||'').trim();const pm=Q('#pm')?.value||'UPI';
    if(!utr){this.toast('Enter UTR/Reference number','err');return;}
    const b=this.data.bills.find(b=>b.id===id);if(!b)return;
    await apiPut('/bills/'+id,{status:'pending_verification',utr,payMethod:pm});
    b.status='pending_verification';b.utr=utr;b.payMethod=pm;
    this.addNotif('payment','Payment UTR submitted for '+id+' – please verify',true);
    this.closeModal();
    this.toast('UTR submitted!','ok','Admin will verify and confirm your payment');
    this.nav('billing');
  },
  async confirmPay(id){const b=this.data.bills.find(b=>b.id===id);if(!b)return;const paid=new Date().toLocaleDateString('en-CA');await apiPut('/bills/'+id,{status:'paid',paid});b.status='paid';b.paid=paid;this.closeModal();this.toast('Payment confirmed!','ok','Bill '+id+' marked as paid');this.nav('billing');},
  async verifyPayment(id){
    const b=this.data.bills.find(b=>b.id===id);if(!b)return;
    const paid=new Date().toLocaleDateString('en-CA');
    await apiPut('/bills/'+id,{status:'paid',paid});
    b.status='paid';b.paid=paid;
    this.addNotif('payment','Payment for '+id+' verified ✔',false,b.phId);
    this.showBrowserNotif('Payment Verified','Bill '+id+' payment confirmed');
    this.toast('Payment verified!','ok',id);this.nav('billing');
  },

  // ===== PHARMACY SUBSCRIPTIONS =====
  rPhSubs(){
    const phId=this.st.user.phId;const ph=this.data.pharmacies.find(p=>p.id===phId);
    return`<div class="ph"><div class="pt"><h1>Subscription</h1><p>Your current plan and billing.</p></div></div>
    ${ph?.plan?`<div class="card" style="margin-bottom:22px;border-color:var(--acc);background:linear-gradient(135deg,rgba(108,99,255,.1),var(--card))"><div class="cb" style="display:flex;align-items:center;gap:20px"><div style="flex:1"><div style="font-size:.8rem;color:var(--acc);font-weight:700;text-transform:uppercase;margin-bottom:4px">Active Plan</div><div style="font-size:2rem;font-weight:800;color:var(--txt)">₹${ph.plan}<span style="font-size:1rem;color:var(--mute)">/month</span></div><div style="color:var(--txt2);margin-top:4px">${ph.plan==='1500'?'Free delivery on all orders':'Paid delivery on orders'}</div><div style="font-size:.8rem;color:var(--mute);margin-top:4px">Expires: ${ph.planExpiry}</div>${ph.waived?'<div style="margin-top:8px"><span class="badge b-ok">Fee Waived by Admin</span></div>':''}</div><span class="material-icons-round" style="font-size:64px;color:var(--accL);color:rgba(108,99,255,.3)">verified</span></div></div>`:'<div class="card" style="margin-bottom:22px;border-color:var(--err)"><div class="cb" style="text-align:center;padding:32px"><span class="material-icons-round" style="font-size:48px;color:var(--mute)">card_membership</span><h3 style="margin-top:10px;color:var(--txt)">No Active Subscription</h3><p style="margin-top:4px">Choose a plan to start ordering</p></div></div>'}
    <div class="plans"><div class="plan"><div style="font-size:.8rem;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:7px">Basic</div><div class="pp"><sup>₹</sup>1000</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>Paid Delivery</li><li><span class="material-icons-round">check_circle</span>Order Tracking</li><li><span class="material-icons-round">check_circle</span>Support Access</li></ul><button class="btn btn-s" style="width:100%;justify-content:center" onclick="A.subscribePlan('1000')">${ph?.plan==='1000'?'✓ Current Plan':'Choose Plan'}</button></div><div class="plan feat"><div style="font-size:.8rem;font-weight:700;color:var(--acc);text-transform:uppercase;margin-bottom:7px">Premium</div><div class="pp" style="color:var(--acc)"><sup>₹</sup>1500</div><div class="per">per month</div><ul class="pf"><li><span class="material-icons-round">check_circle</span>Unlimited Orders</li><li><span class="material-icons-round">check_circle</span>FREE Delivery</li><li><span class="material-icons-round">check_circle</span>Priority Processing</li><li><span class="material-icons-round">check_circle</span>Dedicated Support</li></ul><button class="btn btn-p" style="width:100%;justify-content:center" onclick="A.subscribePlan('1500')">${ph?.plan==='1500'?'✓ Current Plan':'Upgrade to Premium'}</button></div></div>`;
  },
  async subscribePlan(plan){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);if(!ph)return;if(ph.plan===plan){this.toast('Already on this plan','warn');return;}await apiPut('/pharmacies/'+ph.id,{...ph,plan,planExpiry:'2027-04-19'});ph.plan=plan;ph.planExpiry='2027-04-19';this.toast('Plan updated to ₹'+plan+'/mo!','ok');this.nav('subscriptions');
  },

  // ===== PHARMACY RETURNS =====
  rPhReturns(){
    const phId=this.st.user.phId;const rets=this.data.returns.filter(r=>r.phId===phId);
    return`<div class="ph"><div class="pt"><h1>Returns</h1><p>Request returns for expired, damaged, or wrong drugs.</p></div><button class="btn btn-p" onclick="A.returnModal()"><span class="material-icons-round">add</span>New Return</button></div>
    ${rets.length===0?'<div class="empty"><span class="material-icons-round">assignment_return</span><h3>No return requests yet</h3></div>':''}
    ${rets.map(r=>`<div class="card" style="margin-bottom:14px"><div class="ch"><div><span style="font-family:monospace;font-size:.875rem;color:var(--acc)">${r.id}</span></div><div style="display:flex;gap:7px;align-items:center"><span class="badge ${r.reason==='expired'?'b-err':r.reason==='damaged'?'b-warn':'b-info'}">${r.reason}</span>${this.sbadge(r.status)}</div></div><div class="cb"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:7px">DRUGS</div>${r.drugs.map(d=>`<div style="display:flex;justify-content:space-between;padding:7px;background:var(--inp);border-radius:var(--rs);margin-bottom:4px"><span style="color:var(--txt)">${d.name}</span><span style="color:var(--acc)">×${d.qty}</span></div>`).join('')}</div><div><div style="font-size:.72rem;color:var(--mute);margin-bottom:4px">Notes</div><p style="font-size:.875rem">${r.notes}</p>${r.anote?`<div style="margin-top:7px;padding:7px;background:var(--okL);border-radius:var(--rs);color:var(--ok);font-size:.8rem">📋 Admin: ${r.anote}</div>`:''}</div></div></div></div>`).join('')}`;
  },
  returnModal(){
    const phId=this.st.user.phId;const drugs=this.data.drugs.filter(d=>d.phId===phId);
    this.showModal('New Return Request',`<div class="fg"><label>Return Reason *</label><select id="rr"><option value="expired">Expired Drugs</option><option value="damaged">Damaged Drugs</option><option value="wrong">Wrong Drugs Delivered</option></select></div><div id="ri"><div class="fr" style="margin-bottom:7px"><div class="fg" style="margin-bottom:0"><label>Drug Name</label><input type="text" class="rdn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:80px"><label>Qty</label><input type="number" class="rdq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:110px"><label>Batch No.</label><input type="text" class="rdb" placeholder="Batch"></div></div></div><button class="btn btn-s btn-sm" onclick="A.addRI()" style="margin-top:7px;margin-bottom:14px"><span class="material-icons-round">add</span>Add Drug</button><div class="fg"><label>Notes</label><textarea id="rn" placeholder="Describe the issue…"></textarea></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.submitReturn()"><span class="material-icons-round">send</span>Submit Return</button>`);
  },
  addRI(){const c=Q('#ri');const r=document.createElement('div');r.className='fr';r.style.marginBottom='7px';r.innerHTML='<div class="fg" style="margin-bottom:0"><input type="text" class="rdn" placeholder="Drug name"></div><div class="fg" style="margin-bottom:0;max-width:80px"><input type="number" class="rdq" min="1" placeholder="0"></div><div class="fg" style="margin-bottom:0;max-width:110px"><input type="text" class="rdb" placeholder="Batch"></div>';c?.appendChild(r);},
  async submitReturn(){
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);const drugs=[];
    QA('.rdn').forEach((n,i)=>{const q=QA('.rdq')[i]?.value,b=QA('.rdb')[i]?.value;if(n.value&&q)drugs.push({name:n.value,qty:parseInt(q),batch:b||''});});
    if(!drugs.length){this.toast('Add at least one drug','err');return;}
    const ret={id:'RET-'+Date.now(),phId:ph.id,phName:ph.name,reason:Q('#rr').value,drugs,date:new Date().toLocaleDateString('en-CA'),status:'pending',notes:Q('#rn')?.value||'',anote:''};
    const res=await apiPost('/returns',ret);if(res?.ok){ret.id=res.id;this.data.returns.push(ret);this.addNotif('return','Return request from '+ph.name,true);}this.closeModal();this.toast('Return request submitted!','ok');this.nav('returns');
  },

  // ===== PHARMACY SUPPORT =====
  rPhSupport(){
    const dist=this.data.dist;
    return`<div class="ph"><div class="pt"><h1>Support</h1><p>Get help from the distributor team.</p></div></div>
    <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:22px"><div class="card cb" style="text-align:center;border-color:var(--info)"><span class="material-icons-round" style="font-size:34px;color:var(--info)">phone</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${dist.mobile}</div><div style="color:var(--mute);font-size:.8rem">Call Support</div><a href="tel:${dist.mobile}" class="btn btn-p" style="margin-top:10px;display:inline-flex">Call Now</a></div><div class="card cb" style="text-align:center;border-color:var(--ok)"><span class="material-icons-round" style="font-size:34px;color:var(--ok)">email</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">${dist.email}</div><div style="color:var(--mute);font-size:.8rem">Email Support</div><a href="mailto:${dist.email}" class="btn btn-ok" style="margin-top:10px;display:inline-flex">Send Email</a></div><div class="card cb" style="text-align:center;border-color:var(--acc)"><span class="material-icons-round" style="font-size:34px;color:var(--acc)">chat</span><div style="font-weight:700;font-size:1.1rem;margin-top:7px">Live Chat</div><div style="color:var(--mute);font-size:.8rem">Chat with Support</div><button class="btn btn-p" style="margin-top:10px" onclick="A.chatModal(true)">Start Chat</button></div></div>
    <div class="card"><div class="ch"><h3>Submit a Support Ticket</h3></div><div class="cb"><div class="fr"><div class="fg"><label>Subject</label><input id="ts" placeholder="Brief description of issue"></div><div class="fg"><label>Type</label><select id="tt"><option value="billing">Billing</option><option value="order">Order</option><option value="delivery">Delivery</option><option value="technical">Technical</option><option value="other">Other</option></select></div></div><div class="fg"><label>Description</label><textarea id="td" placeholder="Describe your issue in detail…" style="min-height:100px"></textarea></div><button class="btn btn-p" onclick="A.submitTicket()"><span class="material-icons-round">send</span>Submit Ticket</button></div></div>`;
  },
  async submitTicket(){
    const sub=Q('#ts')?.value.trim();if(!sub){this.toast('Enter subject','err');return;}const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);
    const tk={phId:ph.id,phName:ph.name,subject:sub,type:Q('#tt')?.value||'other',date:new Date().toLocaleDateString('en-IN'),status:'open',msgs:[{from:'pharmacy',text:Q('#td')?.value||sub,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}]};const res=await apiPost('/tickets',tk);if(res?.ok){tk.id=res.id;this.data.tickets.push(tk);}this.toast('Ticket submitted! We\'ll respond shortly.','ok');this.nav('support');
  },


  // ===== QUOTATIONS (Feature 6 — Hospital Module) =====
  rQuotations(){
    return`<div class="ph"><div class="pt"><h1>Quotations</h1><p>Create price quotations for hospital & retail pharmacies.</p></div><button class="btn btn-p" onclick="A.quotationModal()"><span class="material-icons-round">add</span>New Quotation</button></div>
    <div class="card" id="quo-wrap"><div class="cb" style="text-align:center;padding:40px"><span class="material-icons-round" style="font-size:48px;color:var(--acc);animation:spin 1s linear infinite">autorenew</span><p style="color:var(--mute);margin-top:10px">Loading quotations...</p></div></div>`;
  },
  async loadQuotations(){
    const rows=await apiGet('/quotations');
    const el=Q('#quo-wrap');if(!el)return;
    if(!rows||!rows.length){el.innerHTML='<div class="empty"><span class="material-icons-round">request_quote</span><h3>No quotations yet</h3><p>Create your first quotation for a pharmacy</p></div>';return;}
    el.innerHTML=`<div class="tw"><table><thead><tr><th>ID</th><th>Pharmacy</th><th>Items</th><th>Valid Until</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(q=>`<tr>
        <td style="font-family:monospace;font-size:.8rem">${q.id}</td>
        <td>${q.ph_name}</td>
        <td style="font-size:.8rem">${(q.items||[]).slice(0,3).map(i=>i.name+(i.qty?` ×${i.qty}`:'')).join(', ')}${q.items?.length>3?'…':''}</td>
        <td>${q.valid_until||'—'}</td>
        <td>${this.sbadge(q.status||'draft')}</td>
        <td><div class="ta">
          <button class="btn btn-sm btn-s" onclick="A.vQuotation(${JSON.stringify(q).replace(/"/g,"'")})">View</button>
          <button class="btn btn-sm btn-ok" onclick="A.convertQuoToOrder('${q.id}','${q.ph_id}','${q.ph_name}')">→ Order</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  },
  quotationModal(){
    const phs=this.data.pharmacies.filter(p=>p.status==='active');
    this.showModal('Create Quotation',`
      <div class="fg"><label>Pharmacy</label><select id="q-ph">${phs.map(p=>`<option value="${p.id}">${p.name}${p.ph_type==='hospital'?' 🏥':''}</option>`).join('')}</select></div>
      <div class="fg"><label>Valid Until</label><input id="q-vd" type="date" value="${new Date(Date.now()+30*864e5).toLocaleDateString('en-CA')}"></div>
      <div style="font-size:.75rem;color:var(--mute);margin-bottom:6px;font-weight:600">ITEMS</div>
      <div id="q-items">
        <div class="q-item fr" style="margin-bottom:6px">
          <div class="fg" style="margin-bottom:0"><input class="q-name" placeholder="Medicine name"></div>
          <div class="fg" style="margin-bottom:0;max-width:70px"><input class="q-qty" type="number" min="1" placeholder="Qty"></div>
          <div class="fg" style="margin-bottom:0;max-width:90px"><input class="q-price" type="number" min="0" step="0.01" placeholder="₹/unit"></div>
        </div>
      </div>
      <button class="btn btn-sm btn-s" onclick="A.addQuoItem()" style="margin-top:6px"><span class="material-icons-round">add</span>Add Item</button>
      <div class="fg" style="margin-top:12px"><label>Note</label><input id="q-note" placeholder="Special terms, discounts..."></div>`,
    `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveQuotation()"><span class="material-icons-round">save</span>Save Quotation</button>`);
  },
  addQuoItem(){
    const c=Q('#q-items');const d=document.createElement('div');d.className='q-item fr';d.style.marginBottom='6px';
    d.innerHTML='<div class="fg" style="margin-bottom:0"><input class="q-name" placeholder="Medicine name"></div><div class="fg" style="margin-bottom:0;max-width:70px"><input class="q-qty" type="number" min="1" placeholder="Qty"></div><div class="fg" style="margin-bottom:0;max-width:90px"><input class="q-price" type="number" min="0" step="0.01" placeholder="₹/unit"></div>';
    c?.appendChild(d);
  },
  async saveQuotation(){
    const phId=Q('#q-ph')?.value;const vd=Q('#q-vd')?.value;const note=Q('#q-note')?.value||'';
    const items=[];
    QA('.q-name').forEach((n,i)=>{const qty=QA('.q-qty')[i]?.value;const price=QA('.q-price')[i]?.value;if(n.value)items.push({name:n.value.trim(),qty:parseInt(qty)||0,price:parseFloat(price)||0});});
    if(!phId||!items.length){this.toast('Select pharmacy and add at least one item','err');return;}
    const res=await apiPost('/quotations',{phId,items,validUntil:vd,note,status:'sent'});
    if(res?.ok){this.toast('Quotation created!','ok');this.closeModal();this.nav('quotations');}
    else this.toast('Failed to create quotation','err');
  },
  vQuotation(q){
    const body=`<div class="ic" style="margin-bottom:14px"><div class="icg">
      <div class="if"><label>ID</label><span style="font-family:monospace">${q.id||q.i}</span></div>
      <div class="if"><label>Pharmacy</label><span>${q.ph_name||q.ph_n}</span></div>
      <div class="if"><label>Valid Until</label><span>${q.valid_until||q.v||'—'}</span></div>
      <div class="if"><label>Status</label><span>${this.sbadge(q.status||'draft')}</span></div>
    </div></div>
    <table><thead><tr><th>Medicine</th><th>Qty</th><th>Unit ₹</th><th>Total ₹</th></tr></thead><tbody>
      ${(q.items||[]).map(i=>`<tr><td>${i.name}</td><td>${i.qty||'—'}</td><td>₹${(i.price||0).toFixed(2)}</td><td>₹${((i.qty||0)*(i.price||0)).toFixed(2)}</td></tr>`).join('')}
      <tr><td colspan="3" style="text-align:right;font-weight:800">Total</td><td style="font-weight:800;color:var(--acc)">₹${this.fmt((q.items||[]).reduce((s,i)=>s+(i.qty||0)*(i.price||0),0))}</td></tr>
    </tbody></table>
    ${q.note?`<div style="margin-top:12px;padding:10px;background:var(--inp);border-radius:8px;font-size:.82rem">${q.note}</div>`:''}`;
    this.showModal('Quotation '+(q.id||q.i),body,`<button class="btn btn-s" onclick="A.closeModal()">Close</button>`,'mdl-lg');
  },
  async convertQuoToOrder(qId,phId,phName){
    if(!confirm('Convert this quotation to an order?'))return;
    const quo=await apiGet('/quotations');
    const q=quo?.find(x=>x.id===qId);if(!q)return;
    const drugs=(q.items||[]).map(i=>({name:i.name,qty:i.qty||1,up:i.price||0,tot:(i.qty||1)*(i.price||0)}));
    const sub=drugs.reduce((s,i)=>s+i.tot,0);
    const gst=sub*0.05;const tot=sub+gst;
    const res=await apiPost('/orders',{type:'inventory',phId,phName,drugs,sub,gst:Math.round(gst*100)/100,tot:Math.round(tot*100)/100,date:new Date().toLocaleDateString('en-CA'),status:'pending',notes:'From Quotation '+qId});
    if(res?.ok){this.toast('Order created from quotation!','ok');const ords=await apiGet('/orders');if(ords)this.data.orders=ords;this.nav('orders');}
    else this.toast('Failed to create order','err');
  },

  // ═══════════════════════════════════════════════════════════
  //  SECURE AUTH — Register / Forgot Password / Reset
  // ═══════════════════════════════════════════════════════════
  async register(){
    const name=Q('#rn')?.value.trim(),em=Q('#rem2')?.value.trim(),pw=Q('#rpw')?.value;
    const cont=Q('#rc2')?.value.trim(),lic=Q('#rl2')?.value.trim(),plan=Q('#rplan')?.value;
    if(!name||!em||!pw){this.toast('Name, email and password are required','err');return;}
    if(pw.length<8){this.toast('Password must be at least 8 characters','err');return;}
    const btn=Q('#rbtn');if(btn){btn.disabled=true;btn.innerHTML='<span class="material-icons-round spin">autorenew</span>Creating…';}
    const res=await apiPost('/register',{name,email:em,password:pw,contact:cont,license:lic,plan});
    if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">person_add</span>Create Account';}
    if(!res){this.toast('Server error','err');return;}
    if(res.ok){this.toast('Account created! Awaiting admin approval.','ok');this.setLmode('signin');}
    else{this.toast(res.msg||'Registration failed','err');}
  },

  async forgotPassword(){
    const em=Q('#fem')?.value.trim();
    if(!em){this.toast('Enter your email address','err');return;}
    const btn=Q('#fpbtn');if(btn){btn.disabled=true;btn.textContent='Sending...';}
    const res=await apiPost('/forgot-password',{email:em});
    if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">email</span>Send Reset Link';}
    if(!res){this.toast('Server error - try again','err');return;}
    const ff=Q('#forgot-form'),rf=Q('#reset-form');
    const hint=Q('#reset-hint');
    if(res.resetToken){
      if(ff)ff.style.display='none';if(rf)rf.style.display='block';
      if(Q('#rtoken'))Q('#rtoken').value=res.resetToken;
      if(hint)hint.innerHTML='<div style="padding:12px;background:rgba(255,181,71,.1);border:1px solid rgba(255,181,71,.4);border-radius:8px;font-size:.8rem;color:var(--warn);margin-bottom:14px"><strong>Email could not be sent</strong> - Copy the token above into the field and set your new password.</div>';
      this.toast('Use the token shown to reset your password','warn');
    } else if(res.ok){
      if(ff)ff.style.display='none';if(rf)rf.style.display='block';
      const tw=Q('#rtoken-wrap');if(tw)tw.style.display='none';
      if(hint)hint.innerHTML='<div style="padding:12px;background:rgba(0,212,142,.08);border:1px solid rgba(0,212,142,.3);border-radius:8px;font-size:.8rem;color:var(--ok);margin-bottom:14px">\u2714 Reset link sent to <strong>'+em+'</strong> - Check your inbox and click the link in the email.</div>';
      this.toast('Reset link sent to '+em,'ok');
    }
  },

  async resetPassword(){
    const token=Q('#rtoken')?.value.trim(),pw=Q('#rnpw')?.value;
    if(!token||!pw){this.toast('Enter token and new password','err');return;}
    if(pw.length<8){this.toast('Password must be at least 8 characters','err');return;}
    const res=await apiPost('/reset-password',{token,password:pw});
    if(!res){this.toast('Server error','err');return;}
    if(res.ok){this.toast('Password reset! Please sign in.','ok');this.setLmode('signin');}
    else{this.toast(res.msg||'Reset failed','err');}
  },

  async changeAdminPw(){
    const cur=Q('#cp-cur')?.value,np=Q('#cp-new')?.value,cf=Q('#cp-cf')?.value;
    if(!cur||!np||!cf){this.toast('Fill all fields','err');return;}
    if(np!==cf){this.toast('Passwords do not match','err');return;}
    if(np.length<8){this.toast('Min 8 characters','err');return;}
    const res=await apiPost('/admin/change-password',{currentPassword:cur,newPassword:np});
    if(res?.ok){this.toast('✔ Password changed!','ok');Q('#cp-cur').value='';Q('#cp-new').value='';Q('#cp-cf').value='';}
    else{this.toast(res?.msg||'Failed – wrong current password','err');}
  },
  pwStrength(pw,fillId='ps-fill'){
    const fill=Q('#'+fillId);if(!fill)return;
    let s=0;
    if(pw.length>=8)s++;if(pw.length>=12)s++;
    if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
    const cols=['#FF4757','#FF4757','#FFB547','#00D48E','#6C63FF'];
    fill.style.width=(s/5*100)+'%';fill.style.background=cols[s-1]||'var(--bdr)';
  },

  togglePw(id,btn){
    const inp=Q('#'+id);if(!inp)return;
    if(inp.type==='password'){inp.type='text';btn.innerHTML='<span class="material-icons-round">visibility_off</span>';}
    else{inp.type='password';btn.innerHTML='<span class="material-icons-round">visibility</span>';}
  },

  // ═══════════════════════════════════════════════════════════
  //  PROFILE / ACCOUNT SETTINGS PAGE
  // ═══════════════════════════════════════════════════════════
  rProfile(){
    const u=this.st.user,isAdmin=this.st.role==='admin';
    return`<div class="ph"><div class="pt"><h1>Account Settings</h1><p>Manage your security, active sessions, and preferences.</p></div></div>
    <div class="pgrid">
    <div class="card"><div class="ch"><h3>Profile Info</h3></div><div class="cb">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
    <div class="sav" style="width:56px;height:56px;font-size:1.5rem;flex-shrink:0">${u.init}</div>
    <div><div style="font-weight:700;font-size:1.05rem;color:var(--txt)">${u.name}</div><div style="color:var(--mute);font-size:.8rem;margin-top:2px">${u.email}</div><div style="margin-top:7px"><span class="badge ${isAdmin?'b-acc':'b-ok'} ">${isAdmin?'Distributor Admin':'Pharmacy Manager'}</span></div></div></div>
    <div class="if" style="display:block;margin-bottom:10px"><label>Email</label><span style="font-family:monospace;font-size:.875rem">${u.email}</span></div>
    <div class="if" style="display:block"><label>Role</label><span>${isAdmin?'System Administrator':'Pharmacy User'}</span></div>
    </div></div>
    ${!isAdmin?`<div class="card"><div class="ch"><h3>Change Password</h3></div><div class="cb">
    <div class="fg"><label>Current Password</label><input type="password" id="cpp" placeholder="Current password"></div>
    <div class="fg pwrap"><label>New Password</label><input type="password" id="npp" placeholder="Min. 8 characters" oninput="A.pwStrength(this.value,'ps-fill')"><button class="pw-toggle" onclick="A.togglePw('npp',this)"><span class="material-icons-round">visibility</span></button></div>
    <div id="ps-bar" style="height:4px;border-radius:2px;background:var(--bdr);margin:-12px 0 14px;overflow:hidden"><div id="ps-fill" style="height:100%;width:0;transition:all .3s;border-radius:2px"></div></div>
    <div class="fg"><label>Confirm New Password</label><input type="password" id="cpp2" placeholder="Repeat new password"></div>
    <button class="btn btn-p" onclick="A.changePassword()"><span class="material-icons-round">lock</span>Update Password</button>
    </div></div>`:`<div class="card"><div class="ch"><h3>Admin Security</h3></div><div class="cb">
    <div class="ai info" style="margin-bottom:14px"><span class="material-icons-round ai-icon">admin_panel_settings</span><div class="ai-txt"><strong>System Administrator</strong><span>Admin credentials are managed by the server configuration.</span></div></div>
    <div style="padding:12px;background:var(--inp);border-radius:var(--rs);border:1px solid var(--bdr)"><div style="font-size:.72rem;color:var(--mute);margin-bottom:4px;text-transform:uppercase">Security Tip</div><div style="font-size:.8rem;color:var(--txt2)">Set <code style="background:rgba(108,99,255,.15);padding:1px 6px;border-radius:4px">JWT_SECRET</code> environment variable before deploying to production.</div></div>
    </div></div>`}
    </div>
    ${isAdmin?`<div class="card" style="margin-top:14px"><div class="ch"><h3><span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px">lock_reset</span>Change Password</h3></div><div class="cb"><div class="fr"><div class="fg"><label>Current Password</label><input id="cp-cur" type="password" autocorrect="off" autocapitalize="none" placeholder="Current password"></div><div class="fg"><label>New Password</label><input id="cp-new" type="password" autocorrect="off" autocapitalize="none" placeholder="Min 8 chars" oninput="A.pwStrength(this.value,'cp-fill')"></div></div><div id="ps-bar-cp" style="height:4px;border-radius:2px;background:var(--bdr);margin:-12px 0 14px;overflow:hidden"><div id="cp-fill" style="height:100%;width:0;transition:width .3s,background .3s"></div></div><div class="fg"><label>Confirm New Password</label><input id="cp-cf" type="password" autocorrect="off" autocapitalize="none" placeholder="Repeat new password"></div><button class="btn btn-p" onclick="A.changeAdminPw()"><span class="material-icons-round">lock</span>Change Password</button></div></div><div class="card" style="margin-top:14px"><div class="ch"><h3><span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px">storefront</span>Distributor Settings</h3><span class="badge b-ok">Admin Only</span></div><div class="cb"><div class="fr"><div class="fg"><label>Company Name</label><input id="ds-name" value="${this.data.dist.name||''}"></div><div class="fg"><label>Phone / Support</label><input id="ds-phone" value="${this.data.dist.phone||''}"></div></div><div class="fr"><div class="fg"><label>Email</label><input id="ds-email" value="${this.data.dist.email||''}"></div><div class="fg"><label>UPI ID <span style='color:var(--acc);font-size:.75rem'>★ For QR payments</span></label><input id="ds-upi" placeholder="e.g. yourname@okicici" value="${this.data.dist.upi||''}"></div></div><div class="fr"><div class="fg"><label>GST Number</label><input id="ds-gst" value="${this.data.dist.gst||''}"></div><div class="fg"><label>License No.</label><input id="ds-lic" value="${this.data.dist.license||''}"></div></div><div class="fg"><label>Address</label><textarea id="ds-addr" style="min-height:60px">${this.data.dist.address||''}</textarea></div><button class="btn btn-p" onclick="A.saveDistSettings()"><span class="material-icons-round">save</span>Save Settings</button></div></div>`:''}
    <div class="card" style="margin-top:14px"><div class="ch"><h3><span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px">devices</span>Active Sessions</h3><button class="btn btn-sm btn-er" onclick="A.logoutAll()"><span class="material-icons-round">logout</span>Sign Out All Devices</button></div><div class="cb" id="sessions-list"><div style="text-align:center;padding:20px;color:var(--mute)"><span class="material-icons-round spin" style="font-size:28px">autorenew</span></div></div></div>`;
  },

  async loadSessions(){
    const res=await apiGet('/sessions');
    const el=Q('#sessions-list');if(!el)return;
    if(!res||!Array.isArray(res)){el.innerHTML='<p style="color:var(--mute);padding:10px">Unable to load sessions.</p>';return;}
    el.innerHTML=res.length===0?'<p style="color:var(--mute);padding:10px">No active sessions.</p>':res.map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--bdr)"><div><div style="font-size:.875rem;font-weight:600;color:var(--txt)">${s.device||'Web Browser'}&nbsp;${s.isCurrent?'<span class="badge b-ok">Current</span>':''}</div><div style="font-size:.72rem;color:var(--mute);margin-top:3px">IP: ${s.ip} · Signed in: ${new Date(s.created_at).toLocaleString('en-IN')} · Last active: ${new Date(s.last_seen).toLocaleString('en-IN')}</div></div>${!s.isCurrent?`<button class="btn btn-sm btn-er" onclick="A.revokeSession(${s.id})"><span class="material-icons-round">close</span>Revoke</button>`:''}</div>`).join('');
  },

  async changePassword(){
    const cur=Q('#cpp')?.value,nw=Q('#npp')?.value,conf=Q('#cpp2')?.value;
    if(!cur||!nw||!conf){this.toast('Fill all password fields','err');return;}
    if(nw!==conf){this.toast('New passwords do not match','err');return;}
    if(nw.length<8){this.toast('Password must be at least 8 characters','err');return;}
    const res=await apiPost('/change-password',{currentPassword:cur,newPassword:nw});
    if(!res){this.toast('Server error','err');return;}
    if(res.ok){this.toast('Password changed! Signing you out…','ok');setTimeout(()=>this.logout(),2000);}
    else{this.toast(res.msg||'Failed to change password','err');}
  },

  async revokeSession(id){
    if(!confirm('Revoke this session? That device will be signed out.'))return;
    const res=await apiDel('/sessions/'+id);
    if(res?.ok){this.toast('Session revoked','ok');this.loadSessions();}
  },

  async logoutAll(){
    if(!confirm('Sign out from ALL devices including this one?'))return;
    await apiPost('/logout-all',{});
    this.toast('Signed out from all devices','ok');
    setTimeout(()=>{
      localStorage.removeItem('pd_token');localStorage.removeItem('pd_user');this._token=null;
      this.st.user=null;this.st.role=null;this.st.page='login';
      this.data={pharmacies:[],drugs:[],orders:[],bills:[],returns:[],tickets:[],notifs:[],chats:[],dist:this.data.dist};
      this.render();
    },1500);
  },

  async saveDistSettings(){
    const upi=(Q('#ds-upi')?.value||'').trim();
    if(!upi){this.toast('Enter a UPI ID first','err');return;}
    const d={
      name:(Q('#ds-name')?.value||this.data.dist.name||'').trim(),
      phone:(Q('#ds-phone')?.value||this.data.dist.phone||'').trim(),
      email:(Q('#ds-email')?.value||this.data.dist.email||'').trim(),
      upi,
      gst:(Q('#ds-gst')?.value||this.data.dist.gst||'').trim(),
      license:(Q('#ds-lic')?.value||this.data.dist.license||'').trim(),
      address:(Q('#ds-addr')?.value||this.data.dist.address||'').trim(),
    };
    this.toast('Saving...','ok');
    const res=await apiPost('/dist-settings',d);
    console.log('dist-settings res:',res);
    // Always update local data so QR codes work immediately
    Object.assign(this.data.dist,d);
    if(res?.ok){this.toast('\u2714 Saved! UPI: '+d.upi,'ok');}
    else{this.toast('Saved locally (server may retry)','warn');}
  },


  // ═══════════════════════════════════════════════════════════
  //  SAAS ANALYTICS PAGE (Admin Only)
  // ═══════════════════════════════════════════════════════════
  rAnalytics(){
    const d=this.data;
    return`<div class="ph"><div class="pt"><h1>SaaS Analytics</h1><p>Platform-wide metrics, revenue insights and payment ledger.</p></div><button class="btn btn-s" onclick="A.exportCSV('pharmacies')"><span class="material-icons-round">download</span>CSV</button><button class="btn btn-p" onclick="A.addPharmacyModal()"><span class="material-icons-round">add</span>Add Tenant</button></div>
    <div class="sg" id="an-grid">
      <div class="sc p"><div class="sic p"><span class="material-icons-round">storefront</span></div><div><div class="sv" id="an-ph">—</div><div class="sl2">Total Tenants</div><div class="scc up" id="an-ph2"></div></div></div>
      <div class="sc c"><div class="sic c"><span class="material-icons-round">currency_rupee</span></div><div><div class="sv" id="an-rev">—</div><div class="sl2">Total Revenue</div><div class="scc up" id="an-rev2"></div></div></div>
      <div class="sc g"><div class="sic g"><span class="material-icons-round">card_membership</span></div><div><div class="sv" id="an-sub">—</div><div class="sl2">Active Subscriptions</div><div class="scc" id="an-sub2"></div></div></div>
      <div class="sc o"><div class="sic o"><span class="material-icons-round">devices</span></div><div><div class="sv" id="an-sess">—</div><div class="sl2">Active Sessions</div><div class="scc" id="an-ord"></div></div></div>
    </div>
    <div class="cr" style="margin-top:14px">
      <div class="card"><div class="ch"><h3>Monthly Revenue</h3><span class="badge b-ok">Live</span></div><div class="cc"><canvas id="an-rev-chart"></canvas></div></div>
      <div class="card"><div class="ch"><h3>Orders Trend</h3></div><div class="cc"><canvas id="an-ord-chart"></canvas></div></div>
    </div>
    <div class="cr" style="margin-top:14px">
      <div class="card"><div class="ch"><h3>Top Medicines Ordered</h3><span class="badge b-acc">By Qty</span></div><div class="cc" style="height:220px"><canvas id="an-med-chart"></canvas></div></div>
      <div class="card"><div class="ch"><h3>Top Pharmacies by Revenue</h3></div><div class="cc" style="height:220px"><canvas id="an-ph-chart"></canvas></div></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="ch"><h3>💳 Payment Ledger — Outstanding</h3><span class="badge b-err" id="an-out-total">Loading…</span></div>
      <div class="tw"><table><thead><tr><th>Pharmacy</th><th>Total Billed</th><th>Collected</th><th>Outstanding</th><th>Actions</th></tr></thead>
      <tbody id="an-ledger-body"><tr><td colspan="5" style="text-align:center;padding:20px;color:var(--mute)"><span class="material-icons-round spin">autorenew</span></td></tr></tbody></table></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="ch"><h3>Tenant Management</h3><span class="badge b-ok">${d.pharmacies.filter(p=>p.status==='active').length} Active</span></div><div class="tw"><table><thead><tr><th>Pharmacy</th><th>Email</th><th>Plan</th><th>Status</th><th>Revenue</th><th>Joined</th><th>Actions</th></tr></thead><tbody>${d.pharmacies.map(p=>{const rev=d.bills.filter(b=>b.phId===p.id&&b.status==='paid').reduce((s,b)=>s+b.amt,0);const pend=d.bills.filter(b=>b.phId===p.id&&b.status==='unpaid').reduce((s,b)=>s+b.amt,0);return`<tr><td><strong>${p.name}</strong></td><td style="font-size:.8rem;color:var(--mute)">${p.email}</td><td>${p.plan?`<span class="badge b-acc">₹${p.plan}/mo</span>`:'<span class="badge b-gray">No Plan</span>'}</td><td>${this.sbadge(p.status)}</td><td><div style="font-weight:700;color:var(--ok)">₹${this.fmt(rev)}</div>${pend>0?`<div style="font-size:.72rem;color:var(--err)">₹${this.fmt(pend)} pending</div>`:''}</td><td style="font-size:.8rem;color:var(--mute)">${p.joined}</td><td><div class="ta"><button class="btn btn-sm btn-s" onclick="A.phDetail('${p.id}')">View</button><button class="btn btn-sm btn-p" onclick="A.editPhModal('${p.id}')">Edit</button></div></td></tr>`;}).join('')}</tbody></table></div></div>`;
  },

  async loadAnalytics(){
    const set=(id,v)=>{const el=Q('#'+id);if(el)el.textContent=v;};
    const res=await apiGet('/admin/analytics');
    if(res){
      set('an-ph',res.totalPharmacies); set('an-ph2',`${res.activePharmacies} active · ${res.pendingPharmacies} pending`);
      set('an-rev','₹'+this.fmt(res.totalRevenue)); set('an-rev2','+₹'+this.fmt(res.pendingRevenue)+' pending');
      set('an-sub',res.premiumSubs+res.basicSubs); set('an-sub2',`${res.premiumSubs} premium · ${res.basicSubs} basic`);
      set('an-sess',res.activeSessions); set('an-ord',res.totalOrders+' total orders');
    }
    const [revData,ordData,medData,phData,ledger]=await Promise.all([
      apiGet('/analytics/revenue'), apiGet('/analytics/orders-trend'),
      apiGet('/analytics/top-medicines'), apiGet('/analytics/top-pharmacies'),
      apiGet('/ledger/summary')
    ]);
    const chartCfg={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}},y:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#7B9CC4'}}}};
    const c1=Q('#an-rev-chart')?.getContext('2d');
    if(c1&&revData)this.st.charts.anRev=new Chart(c1,{type:'line',data:{labels:revData.map(r=>r.label),datasets:[{label:'Revenue',data:revData.map(r=>r.revenue),borderColor:'#6C63FF',backgroundColor:'rgba(108,99,255,.15)',borderWidth:2.5,fill:true,tension:.4,pointBackgroundColor:'#6C63FF',pointRadius:4}]},options:{...chartCfg,plugins:{legend:{display:false}},scales:{...chartCfg.scales,y:{...chartCfg.scales.y,ticks:{color:'#7B9CC4',callback:v=>'₹'+v}}}}});
    const c2=Q('#an-ord-chart')?.getContext('2d');
    if(c2&&ordData)this.st.charts.anOrd=new Chart(c2,{type:'bar',data:{labels:ordData.map(r=>r.label),datasets:[{label:'Orders',data:ordData.map(r=>r.orders),backgroundColor:'rgba(0,212,142,.7)',borderColor:'#00D48E',borderWidth:1,borderRadius:5}]},options:chartCfg});
    const COLORS=['#6C63FF','#00D4FF','#00D48E','#FFB547','#FF4757','#3B82F6','#A855F7','#F97316'];
    const c3=Q('#an-med-chart')?.getContext('2d');
    if(c3&&medData?.length)this.st.charts.anMed=new Chart(c3,{type:'bar',data:{labels:medData.map(m=>m.name.length>20?m.name.slice(0,18)+'…':m.name),datasets:[{data:medData.map(m=>m.qty),backgroundColor:COLORS,borderRadius:4}]},options:{...chartCfg,indexAxis:'y',plugins:{legend:{display:false}}}});
    const c4=Q('#an-ph-chart')?.getContext('2d');
    if(c4&&phData?.length)this.st.charts.anPh=new Chart(c4,{type:'doughnut',data:{labels:phData.map(p=>p.name),datasets:[{data:phData.map(p=>p.total),backgroundColor:COLORS,borderColor:'#0E1826',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#7B9CC4',padding:8,font:{size:10}}}},cutout:'60%'}});
    const tbody=Q('#an-ledger-body');
    if(tbody&&ledger){
      const totalOut=ledger.reduce((s,r)=>s+r.outstanding,0);
      const badge=Q('#an-out-total');if(badge)badge.textContent='₹'+this.fmt(totalOut)+' outstanding';
      tbody.innerHTML=!ledger.length?'<tr><td colspan="5" style="text-align:center;color:var(--ok);padding:16px">✅ All payments up to date</td></tr>':
        ledger.map(r=>`<tr>
          <td><strong>${r.name}</strong></td>
          <td>₹${this.fmt(r.totalBilled)}</td>
          <td style="color:var(--ok)">₹${this.fmt(r.totalPaid)}</td>
          <td style="font-weight:700;color:${r.outstanding>0?'var(--err)':'var(--ok)'}">₹${this.fmt(r.outstanding)}</td>
          <td><div class="ta">
            <button class="btn btn-sm btn-s" onclick="A.viewLedger('${r.phId}','${r.name}')">History</button>
            ${r.outstanding>0?`<button class="btn btn-sm btn-ok" onclick="A.recordPaymentModal('${r.phId}','${r.name}',${r.outstanding.toFixed(2)})">Record Pay</button>`:''}
          </div></td>
        </tr>`).join('');
    }
  },

  recordPaymentModal(phId,phName,outstanding){
    this.showModal('Record Payment — '+phName,
      `<div class="ai info" style="margin-bottom:14px"><span class="material-icons-round ai-icon">payments</span><div class="ai-txt"><strong>Outstanding: ₹${this.fmt(outstanding)}</strong><span>Recording this payment will auto-mark oldest unpaid bills as paid.</span></div></div>
      <div class="fr"><div class="fg"><label>Amount Received (₹) *</label><input id="pay-amt" type="number" min="1" step="0.01" placeholder="0.00" value="${(+outstanding).toFixed(2)}"></div>
      <div class="fg"><label>Payment Date *</label><input id="pay-date" type="date" value="${new Date().toLocaleDateString('en-CA')}"></div></div>
      <div class="fr"><div class="fg"><label>Method</label><select id="pay-method"><option value="cash">Cash</option><option value="upi">UPI</option><option value="neft">NEFT/RTGS</option><option value="imps">IMPS</option><option value="cheque">Cheque</option></select></div>
      <div class="fg"><label>UTR / Reference No.</label><input id="pay-ref" placeholder="UTR or cheque number"></div></div>
      <div class="fg"><label>Note</label><input id="pay-note" placeholder="Optional note"></div>`,
      `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button>
       <button class="btn btn-ok" onclick="A.savePayment('${phId}')"><span class="material-icons-round">save</span>Save Payment</button>`
    );
  },

  async savePayment(phId){
    const amt=parseFloat(Q('#pay-amt')?.value),date=Q('#pay-date')?.value;
    if(!amt||!date){this.toast('Amount and date are required','err');return;}
    const res=await apiPost('/payments',{phId,amount:amt,date,method:Q('#pay-method')?.value||'cash',ref:Q('#pay-ref')?.value||'',note:Q('#pay-note')?.value||''});
    if(res?.ok){
      this.closeModal();
      this.toast('Payment recorded! Bills auto-updated.','ok');
      const bills=await apiGet('/bills');if(bills)this.data.bills=bills;
      this.loadAnalytics();
    } else { this.toast('Failed to save payment','err'); }
  },

  async viewLedger(phId,phName){
    const [bills,payments]=await Promise.all([apiGet('/bills?phId='+phId),apiGet('/payments/'+phId)]);
    const b=bills||[];const p=payments||[];
    const allEntries=[
      ...b.map(x=>({date:x.date,type:'debit',desc:'Bill '+x.id+' (Order '+x.ordId+')',amount:x.amt,status:x.status,id:x.id})),
      ...p.map(x=>({date:x.date,type:'credit',desc:'Payment received ('+x.method+')'+( x.ref?' Ref:'+x.ref:''),amount:x.amount,status:'paid',id:x.id}))
    ].sort((a,b)=>a.date>b.date?-1:1);
    const totalDebit=b.reduce((s,x)=>s+x.amt,0);
    const totalCredit=p.reduce((s,x)=>s+x.amount,0)+b.filter(x=>x.status==='paid').reduce((s,x)=>s+x.amt,0);
    const balance=b.filter(x=>x.status==='unpaid').reduce((s,x)=>s+x.amt,0);
    this.showModal(phName+' — Account Ledger',
      `<div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div class="sc p" style="flex-direction:column;padding:12px;text-align:center"><div class="sv" style="font-size:1.1rem">₹${this.fmt(totalDebit)}</div><div class="sl2">Total Billed</div></div>
        <div class="sc g" style="flex-direction:column;padding:12px;text-align:center"><div class="sv" style="font-size:1.1rem;color:var(--ok)">₹${this.fmt(totalCredit)}</div><div class="sl2">Collected</div></div>
        <div class="sc o" style="flex-direction:column;padding:12px;text-align:center"><div class="sv" style="font-size:1.1rem;color:${balance>0?'var(--err)':'var(--ok)'}">₹${this.fmt(balance)}</div><div class="sl2">Outstanding</div></div>
      </div>
      <div class="tw"><table><thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Status</th></tr></thead><tbody>
      ${allEntries.length?allEntries.map(e=>`<tr style="background:${e.type==='credit'?'rgba(0,212,142,.04)':''}"><td>${e.date}</td><td style="font-size:.82rem">${e.desc}</td><td style="color:${e.type==='debit'?'var(--err)':'var(--mute)'}">${e.type==='debit'?'₹'+this.fmt(e.amount):'—'}</td><td style="color:${e.type==='credit'?'var(--ok)':'var(--mute)'}">${e.type==='credit'?'₹'+this.fmt(e.amount):'—'}</td><td>${this.sbadge(e.status)}</td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--mute);padding:16px">No transactions yet</td></tr>'}
      </tbody></table></div>`,
      `<button class="btn btn-s" onclick="A.closeModal()">Close</button><button class="btn btn-ok" onclick="A.closeModal();A.recordPaymentModal('${phId}','${phName}',${balance.toFixed(2)})">Record Payment</button>`,'mdl-lg'
    );
  },

  exportCSV(type){
    let rows=[],name=type+'.csv';
    if(type==='orders'){rows=[['Order ID','Pharmacy','Date','Items','Subtotal','GST','Total','Status','Delivery']];this.data.orders.filter(o=>o.type==='inventory').forEach(o=>rows.push([o.id,o.phName,o.date,o.drugs.map(d=>d.name+'×'+d.qty).join(';'),(+o.sub).toFixed(2),(+o.gst).toFixed(2),(+o.tot).toFixed(2),o.status,o.del]));name='orders.csv';}
    else if(type==='bills'){rows=[['Bill ID','Pharmacy','Order','Amount','Date','Due','Status']];this.data.bills.forEach(b=>rows.push([b.id,b.phName,b.ordId,(+b.amt).toFixed(2),b.date,b.due,b.status]));name='bills.csv';}
    else if(type==='pharmacies'){rows=[['ID','Name','Email','Contact','License','Plan','Status','Joined']];this.data.pharmacies.forEach(p=>rows.push([p.id,p.name,p.email,p.contact,p.license,p.plan?p.plan+'/mo':'None',p.status,p.joined]));name='pharmacies.csv';}
    const csv=rows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=name;a.click();
    this.toast('Downloaded!','ok',name);
  },

  downloadOrderPDF(id){
    const o=this.data.orders.find(o=>o.id===id);if(!o)return;
    const d=this.data.dist;
    let c='PharmaDist Pro\n'+(d.address||'')+'\nGST: '+(d.gst||'')+'\n\nTAX INVOICE\nOrder: '+o.id+'\nDate: '+o.date+'\nPharmacy: '+o.phName+'\nStatus: '+o.status.toUpperCase()+'\n\n';
    c+='Drug                                    Qty   Unit Price   Total\n'+'='.repeat(65)+'\n';
    o.drugs.forEach(dr=>{ c+=(dr.name||'').padEnd(40)+String(dr.qty).padEnd(6)+('Rs'+(+dr.up).toFixed(2)).padEnd(13)+'Rs'+(+dr.tot).toFixed(2)+'\n'; });
    c+='='.repeat(65)+'\n'+'Subtotal: Rs'+(+o.sub).toFixed(2)+'\nGST(5%):  Rs'+(+o.gst).toFixed(2)+'\nTOTAL:    Rs'+(+o.tot).toFixed(2)+'\n';
    const blob=new Blob([c],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Invoice-'+o.id+'.txt';a.click();
    this.toast('Invoice downloaded!','ok','Invoice-'+o.id+'.txt');
  },


  async loadAudit(){
    const res=await apiGet('/audit-log');const tbody=Q('#audit-body');if(!tbody||!res)return;
    const aC={LOGIN_SUCCESS:'b-ok',LOGIN_FAILED:'b-err',LOGOUT:'b-gray',LOGOUT_ALL:'b-warn',REGISTER:'b-acc',PASSWORD_CHANGED:'b-warn',ADMIN_PASSWORD_CHANGED:'b-warn',PASSWORD_RESET_SUCCESS:'b-warn',PASSWORD_RESET_REQUEST:'b-info',PHARMACY_CREATED:'b-ok',PHARMACY_UPDATED:'b-info',PHARMACY_DELETED:'b-err',SESSION_REVOKED:'b-warn',ADMIN_CREATED:'b-ok',ADMIN_DELETED:'b-err'};
    tbody.innerHTML=res.length===0
      ?'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--mute)">No audit events yet.</td></tr>'
      :res.map(l=>`<tr><td><span class="badge ${aC[l.action]||'b-gray'}" style="font-size:.72rem;white-space:nowrap">${l.action.replace(/_/g,' ')}</span></td><td style="font-family:monospace;font-size:.8rem;color:var(--acc)">${l.user_id}</td><td><span class="badge b-gray" style="font-size:.72rem">${l.role}</span></td><td style="font-size:.8rem;color:var(--txt2)">${l.details||'—'}</td><td style="font-size:.75rem;color:var(--mute);white-space:nowrap">${new Date(l.ts).toLocaleString('en-IN')}</td></tr>`).join('');
  },

  // ═══════════════════════════════════════════════════════════
  //  PRODUCTS CATALOG (Admin)
  // ═══════════════════════════════════════════════════════════
  rAdminProducts(){
    return`<div class="ph"><div class="pt"><h1>Products Catalog</h1><p>Manage your medicine & product inventory visible to pharmacies.</p></div>
    <div class="pa"><a class="btn btn-s" href="/products.html" target="_blank"><span class="material-icons-round">open_in_new</span>Public View</a><button class="btn btn-p" onclick="A.showAddProductModal()"><span class="material-icons-round">add</span>Add Product</button></div></div>
    <div class="card" style="margin-bottom:18px">
      <div class="ch" style="flex-wrap:wrap;gap:10px">
        <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:240px">
          <span class="material-icons-round" style="color:var(--mute)">search</span>
          <input id="prod-srch" type="text" placeholder="Search products…" style="border:none;background:transparent;flex:1;padding:0" oninput="A.filterProducts()">
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <select id="prod-cat" onchange="A.filterProducts()" style="padding:5px 11px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);color:var(--txt);font-family:inherit;min-width:140px">
            <option value="all">All Categories</option>
            <option value="Analgesic">Analgesic</option>
            <option value="Antibiotic">Antibiotic</option>
            <option value="Antidiabetic">Antidiabetic</option>
            <option value="Antihypertensive">Antihypertensive</option>
            <option value="Antihistamine">Antihistamine</option>
            <option value="Statin">Statin</option>
            <option value="PPI">PPI</option>
            <option value="Antifungal">Antifungal</option>
            <option value="Antiviral">Antiviral</option>
            <option value="Vitamin">Vitamin</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card"><div class="tw"><table><thead><tr><th>#</th><th>Product Name</th><th>Category</th><th>Price (₹)</th><th>Stock</th><th>Expiry Date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody id="prod-tbody"><tr><td colspan="8"><div class="empty"><span class="material-icons-round spin">autorenew</span><h3>Loading…</h3></div></td></tr></tbody></table></div></div>`;
  },

  // ===== PHARMACY PRODUCT CATALOG =====
  rPhCatalog(){
    return`<div class="ph"><div class="pt"><h1>Product Catalog</h1><p>Browse distributor products and place inventory orders directly.</p></div>
    <div class="pa"><button class="btn btn-p" id="ph-cart-btn" onclick="A.phCatalogCheckout()" style="display:none"><span class="material-icons-round">shopping_cart</span>Place Order (<span id="ph-cart-count">0</span> items)</button></div></div>
    <div class="card" style="margin-bottom:18px">
      <div class="ch" style="flex-wrap:wrap;gap:10px">
        <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:220px">
          <span class="material-icons-round" style="color:var(--mute)">search</span>
          <input id="phcat-srch" type="text" placeholder="Search products…" style="border:none;background:transparent;flex:1;padding:0" oninput="A.filterPhCatalog()">
        </div>
        <select id="phcat-cat" onchange="A.filterPhCatalog()" style="padding:5px 11px;background:var(--inp);border:1px solid var(--bdr);border-radius:var(--rs);color:var(--txt);font-family:inherit;min-width:140px">
          <option value="all">All Categories</option>
          <option value="Analgesic">Analgesic</option>
          <option value="Antibiotic">Antibiotic</option>
          <option value="Antidiabetic">Antidiabetic</option>
          <option value="Antihypertensive">Antihypertensive</option>
          <option value="Antihistamine">Antihistamine</option>
          <option value="Statin">Statin</option>
          <option value="PPI">PPI</option>
          <option value="Antifungal">Antifungal</option>
          <option value="Antiviral">Antiviral</option>
          <option value="Vitamin">Vitamin</option>
          <option value="Other">Other</option>
        </select>
      </div>
    </div>
    <div id="phcat-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
      <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--mute)">
        <span class="material-icons-round spin" style="font-size:36px">autorenew</span>
        <p style="margin-top:10px">Loading products…</p>
      </div>
    </div>`;
  },

  // Cart stored per session
  _phCart: {},

  async loadPhCatalog(){
    const prods = await apiGet('/products') || this.data.products || [];
    this.data.products = prods;
    this._phCart = {};
    this._renderPhCatalogGrid(prods);
  },

  filterPhCatalog(){
    const srch=(Q('#phcat-srch')?.value||'').toLowerCase();
    const cat=Q('#phcat-cat')?.value||'all';
    const prods=this.data.products.filter(p=>{
      const matchCat=cat==='all'||p.category===cat;
      const matchSrch=!srch||p.name.toLowerCase().includes(srch)||p.category.toLowerCase().includes(srch);
      return matchCat&&matchSrch;
    });
    this._renderPhCatalogGrid(prods);
  },

  _renderPhCatalogGrid(prods){
    const grid=Q('#phcat-grid');if(!grid)return;
    const today=new Date();
    if(!prods.length){
      grid.innerHTML=`<div style="grid-column:1/-1"><div class="empty"><span class="material-icons-round">store</span><h3>No products found</h3><p>The distributor hasn't added any products yet.</p></div></div>`;
      return;
    }
    grid.innerHTML=prods.map(p=>{
      const exp=new Date(p.expiry_date);
      const daysLeft=Math.round((exp-today)/864e5);
      const expired=daysLeft<0;
      const nearExp=daysLeft>=0&&daysLeft<=30;
      const outOfStock=p.stock<=0;
      const cartQty=this._phCart[p.id]||0;
      return`<div class="card" style="display:flex;flex-direction:column;gap:0;transition:box-shadow .2s" onmouseenter="this.style.boxShadow='0 0 0 2px var(--acc)'" onmouseleave="this.style.boxShadow=''">
        <div style="padding:16px 16px 12px;border-bottom:1px solid var(--bdr)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px">
            <div style="background:linear-gradient(135deg,rgba(108,99,255,.15),rgba(0,212,255,.1));border-radius:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span class="material-icons-round" style="color:var(--acc);font-size:22px">medication</span>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:.95rem;color:var(--txt);line-height:1.3;margin-bottom:3px">${p.name}</div>
              <span class="badge b-gray" style="font-size:.7rem">${p.category}</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div style="background:var(--inp);border-radius:8px;padding:8px 10px">
              <div style="font-size:.68rem;color:var(--mute);margin-bottom:2px">UNIT PRICE</div>
              <div style="font-size:1.1rem;font-weight:800;color:var(--acc)">₹${(+p.price).toFixed(2)}</div>
            </div>
            <div style="background:var(--inp);border-radius:8px;padding:8px 10px">
              <div style="font-size:.68rem;color:var(--mute);margin-bottom:2px">STOCK</div>
              <div style="font-size:1.1rem;font-weight:800;color:${outOfStock?'var(--err)':p.stock<=20?'var(--warn)':'var(--ok)'}">${p.stock} <span style="font-size:.7rem;font-weight:400">units</span></div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${outOfStock?'<span class="badge b-err">Out of Stock</span>':nearExp?`<span class="badge b-warn">Exp Soon (${daysLeft}d)</span>`:'<span class="badge b-ok">Available</span>'}
            ${expired?'<span class="badge b-err">Expired</span>':''}
            <span style="font-size:.72rem;color:var(--mute);margin-left:auto">Exp: ${p.expiry_date}</span>
          </div>
        </div>
        <div style="padding:12px 16px;display:flex;gap:8px;align-items:center">
          <div style="display:flex;align-items:center;border:1px solid var(--bdr);border-radius:8px;overflow:hidden">
            <button onclick="A._phCartAdj('${p.id}',-1)" style="background:var(--inp);border:none;padding:6px 10px;cursor:pointer;color:var(--txt);font-size:1rem;line-height:1">−</button>
            <input type="number" id="phq-${p.id}" value="${cartQty}" min="0" max="${p.stock}" style="width:50px;text-align:center;border:none;background:transparent;color:var(--txt);font-weight:700;font-size:.95rem;padding:6px 0" onchange="A._phCartSet('${p.id}',this.value)">
            <button onclick="A._phCartAdj('${p.id}',1)" style="background:var(--inp);border:none;padding:6px 10px;cursor:pointer;color:var(--txt);font-size:1rem;line-height:1">+</button>
          </div>
          <button onclick="A._phCartAdj('${p.id}',1)" ${outOfStock||expired?'disabled':''} class="btn btn-p" style="flex:1;justify-content:center;font-size:.85rem;padding:7px 10px;${outOfStock||expired?'opacity:.4;cursor:not-allowed':''}"><span class="material-icons-round" style="font-size:16px">add_shopping_cart</span>Add to Order</button>
        </div>
      </div>`;
    }).join('');
  },

  _phCartAdj(pid, delta){
    const prod=this.data.products.find(p=>p.id==pid);if(!prod)return;
    const cur=this._phCart[pid]||0;
    const nv=Math.max(0,Math.min(prod.stock,cur+delta));
    this._phCart[pid]=nv;
    const inp=Q('#phq-'+pid);if(inp)inp.value=nv;
    this._phCartUpdate();
  },

  _phCartSet(pid, val){
    const prod=this.data.products.find(p=>p.id==pid);if(!prod)return;
    const nv=Math.max(0,Math.min(prod.stock,parseInt(val)||0));
    this._phCart[pid]=nv;
    this._phCartUpdate();
  },

  _phCartUpdate(){
    const total=Object.values(this._phCart).reduce((s,v)=>s+(v||0),0);
    const btn=Q('#ph-cart-btn');const cnt=Q('#ph-cart-count');
    if(btn)btn.style.display=total>0?'flex':'none';
    if(cnt)cnt.textContent=total;
  },

  phCatalogCheckout(){
    const items=Object.entries(this._phCart).filter(([,q])=>q>0).map(([pid,qty])=>{
      const p=this.data.products.find(pr=>pr.id==pid);
      return p?{prod:p,qty}:null;
    }).filter(Boolean);
    if(!items.length){this.toast('Add items to your order first','warn');return;}
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);
    const del=ph?.plan==='1500'?'free':'paid';
    const sub=items.reduce((s,i)=>s+(+i.prod.price)*i.qty,0);
    const gst=sub*.05;const tot=sub+gst;
    const rows=items.map(i=>`
      <tr>
        <td style="font-weight:600">${i.prod.name}</td>
        <td><span class="badge b-gray" style="font-size:.7rem">${i.prod.category}</span></td>
        <td style="text-align:center">
          <div style="display:flex;align-items:center;gap:4px;justify-content:center">
            <button onclick="A._phCartAdj('${i.prod.id}',-1);A.phCatalogCheckout()" style="background:var(--inp);border:1px solid var(--bdr);border-radius:5px;padding:2px 7px;cursor:pointer;color:var(--txt)">−</button>
            <span style="font-weight:700;min-width:28px;text-align:center">${i.qty}</span>
            <button onclick="A._phCartAdj('${i.prod.id}',1);A.phCatalogCheckout()" style="background:var(--inp);border:1px solid var(--bdr);border-radius:5px;padding:2px 7px;cursor:pointer;color:var(--txt)">+</button>
          </div>
        </td>
        <td style="text-align:right">₹${(+i.prod.price).toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;color:var(--acc)">₹${((+i.prod.price)*i.qty).toFixed(2)}</td>
      </tr>`).join('');
    this.showModal('Review & Place Order',
      `<div class="ai info" style="margin-bottom:14px"><span class="material-icons-round ai-icon">local_shipping</span><div class="ai-txt"><strong>${ph?.name||'Your Pharmacy'}</strong><span>Plan: ${ph?.plan?'₹'+ph.plan+'/mo':' No plan'} · Delivery: <strong>${del==='free'?'Free':'Paid'}</strong></span></div></div>
       <div class="tw" style="margin-bottom:14px"><table><thead><tr><th>Product</th><th>Category</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit ₹</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table></div>
       <div style="background:var(--inp);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
         <div style="display:flex;justify-content:space-between;font-size:.875rem"><span style="color:var(--mute)">Subtotal</span><span>₹${this.fmt(sub)}</span></div>
         <div style="display:flex;justify-content:space-between;font-size:.875rem"><span style="color:var(--mute)">GST (5%)</span><span>₹${this.fmt(gst)}</span></div>
         <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:800;border-top:1px solid var(--bdr);padding-top:6px;margin-top:2px"><span>Total</span><span style="color:var(--acc)">₹${this.fmt(tot)}</span></div>
       </div>
       <div class="fg"><label>Notes / Special Instructions</label><textarea id="phcat-notes" placeholder="Optional delivery notes…" style="min-height:60px"></textarea></div>`,
      `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.submitPhCatalogOrder()"><span class="material-icons-round">send</span>Confirm Order</button>`,
      'mdl-lg');
  },

  async submitPhCatalogOrder(){
    const items=Object.entries(this._phCart).filter(([,q])=>q>0).map(([pid,qty])=>{
      const p=this.data.products.find(pr=>pr.id==pid);
      return p?{name:p.name,qty,up:+p.price,tot:(+p.price)*qty}:null;
    }).filter(Boolean);
    if(!items.length){this.toast('Cart is empty','err');return;}
    const ph=this.data.pharmacies.find(p=>p.id===this.st.user.phId);
    const del=ph?.plan==='1500'?'free':'paid';
    const sub=items.reduce((s,i)=>s+i.tot,0),gst=sub*.05,tot=sub+gst;
    const ord={id:'ORD-'+Date.now(),type:'inventory',phId:ph.id,phName:ph.name,drugs:items,sub,gst,tot,date:new Date().toLocaleDateString('en-CA'),status:'pending',del,notes:Q('#phcat-notes')?.value||'',billed:false};
    const res=await apiPost('/orders',ord);
    if(res?.ok){ord.id=res.id;this.data.orders.push(ord);this.addNotif('order','New order from '+ph.name+': '+ord.id,true);}
    this._phCart={};
    this.closeModal();
    this.toast('Order placed successfully!','ok',items.length+' items · ₹'+this.fmt(tot));
    this.nav('orders');
  },

  async loadAdminProducts(){
    const prods = await apiGet('/products') || this.data.products || [];
    this.data.products = prods;
    this._renderProdTable(prods);
  },

  filterProducts(){
    const srch=(Q('#prod-srch')?.value||'').toLowerCase();
    const cat=Q('#prod-cat')?.value||'all';
    const prods=this.data.products.filter(p=>{
      const matchCat=cat==='all'||p.category===cat;
      const matchSrch=!srch||p.name.toLowerCase().includes(srch)||p.category.toLowerCase().includes(srch);
      return matchCat&&matchSrch;
    });
    this._renderProdTable(prods);
  },

  _renderProdTable(prods){
    const tbody=Q('#prod-tbody');if(!tbody)return;
    const today=new Date();
    if(!prods.length){tbody.innerHTML='<tr><td colspan="8"><div class="empty"><span class="material-icons-round">inventory_2</span><h3>No products found</h3><p>Add your first product using the button above.</p></div></td></tr>';return;}
    tbody.innerHTML=prods.map((p,i)=>{
      const exp=new Date(p.expiry_date);
      const daysLeft=Math.round((exp-today)/864e5);
      const nearExpiry=daysLeft>=0&&daysLeft<=30;
      const expired=daysLeft<0;
      let stockBadge=p.stock>0?'<span class="badge b-ok">In Stock</span>':'<span class="badge b-err">Out of Stock</span>';
      let expBadge=expired?'<span class="badge b-err">Expired</span>':nearExpiry?`<span class="badge b-warn">Near Expiry (${daysLeft}d)</span>`:'<span class="badge b-ok">OK</span>';
      const rowClass=expired?'inv-exp':nearExpiry?'inv-soon':p.stock===0?'inv-low':'';
      return`<tr class="${rowClass}">
        <td style="color:var(--mute);font-size:.8rem">${i+1}</td>
        <td style="font-weight:700">${p.name}</td>
        <td><span class="badge b-gray">${p.category}</span></td>
        <td style="font-weight:700;color:var(--txt)">₹${(+p.price).toFixed(2)}</td>
        <td style="font-weight:700;color:${p.stock===0?'var(--err)':p.stock<=20?'var(--warn)':'var(--txt)'}">${p.stock} units</td>
        <td style="color:${expired?'var(--err)':nearExpiry?'var(--warn)':'var(--txt2)'}">${p.expiry_date}</td>
        <td><div style="display:flex;flex-direction:column;gap:3px">${stockBadge}${expBadge}</div></td>
        <td><div class="ta">
          <button class="btn btn-sm btn-s" onclick="A.editProductModal('${p.id}')"><span class="material-icons-round" style="font-size:15px">edit</span>Edit</button>
          <button class="btn btn-sm btn-er" onclick="A.deleteProduct('${p.id}','${p.name.replace(/'/g,"&apos;")}')"><span class="material-icons-round" style="font-size:15px">delete</span></button>
        </div></td></tr>`;
    }).join('');
  },

  showAddProductModal(){
    const cats=['Analgesic','Antibiotic','Antidiabetic','Antihypertensive','Antihistamine','Statin','PPI','Antifungal','Antiviral','Vitamin','Other'];
    this.showModal('Add New Product',
      `<div class="fg"><label>Product Name *</label><input id="ap-name" placeholder="e.g. Paracetamol 500mg Tablets"></div>
      <div class="fr">
        <div class="fg"><label>Category *</label><select id="ap-cat">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
        <div class="fg"><label>Price (₹) *</label><input id="ap-price" type="number" min="0" step="0.01" placeholder="0.00"></div>
      </div>
      <div class="fr">
        <div class="fg"><label>Stock (units) *</label><input id="ap-stock" type="number" min="0" placeholder="0"></div>
        <div class="fg"><label>Expiry Date *</label><input id="ap-exp" type="date"></div>
      </div>`,
      `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" id="ap-btn" onclick="A.saveProduct()"><span class="material-icons-round">save</span>Add Product</button>`
    );
  },

  async saveProduct(){
    const name=Q('#ap-name')?.value.trim(),cat=Q('#ap-cat')?.value,
          price=Q('#ap-price')?.value,stock=Q('#ap-stock')?.value,exp=Q('#ap-exp')?.value;
    if(!name||!cat||price===''||stock===''||!exp){this.toast('All fields are required','err');return;}
    const btn=Q('#ap-btn');if(btn){btn.disabled=true;btn.innerHTML='<span class="material-icons-round spin">autorenew</span>Saving…';}
    const res=await apiPost('/products',{name,category:cat,price:parseFloat(price),stock:parseInt(stock),expiry_date:exp});
    if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">save</span>Add Product';}
    if(!res||!res.ok){this.toast(res?.msg||'Failed to add product','err');return;}
    this.closeModal();
    this.toast(name+' added!','ok');
    await this.loadAdminProducts();
  },

  editProductModal(id){
    const p=this.data.products.find(x=>x.id===id);if(!p)return;
    const cats=['Analgesic','Antibiotic','Antidiabetic','Antihypertensive','Antihistamine','Statin','PPI','Antifungal','Antiviral','Vitamin','Other'];
    this.showModal('Edit Product — '+p.name,
      `<div class="fg"><label>Product Name *</label><input id="ep-name" value="${p.name}"></div>
      <div class="fr">
        <div class="fg"><label>Category *</label><select id="ep-cat">${cats.map(c=>`<option value="${c}"${p.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
        <div class="fg"><label>Price (₹) *</label><input id="ep-price" type="number" min="0" step="0.01" value="${p.price}"></div>
      </div>
      <div class="fr">
        <div class="fg"><label>Stock (units) *</label><input id="ep-stock" type="number" min="0" value="${p.stock}"></div>
        <div class="fg"><label>Expiry Date *</label><input id="ep-exp" type="date" value="${p.expiry_date}"></div>
      </div>`,
      `<button class="btn btn-er btn-sm" onclick="A.deleteProduct('${p.id}','${p.name.replace(/'/g,'&apos;')}')">Delete</button><button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" id="ep-btn" onclick="A.updateProduct('${id}')"><span class="material-icons-round">save</span>Update</button>`
    );
  },

  async updateProduct(id){
    const name=Q('#ep-name')?.value.trim(),cat=Q('#ep-cat')?.value,
          price=Q('#ep-price')?.value,stock=Q('#ep-stock')?.value,exp=Q('#ep-exp')?.value;
    if(!name||!cat||price===''||stock===''||!exp){this.toast('All fields are required','err');return;}
    const btn=Q('#ep-btn');if(btn){btn.disabled=true;btn.innerHTML='<span class="material-icons-round spin">autorenew</span>Saving…';}
    const res=await apiPut('/products/'+id,{name,category:cat,price:parseFloat(price),stock:parseInt(stock),expiry_date:exp});
    if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">save</span>Update';}
    if(!res?.ok){this.toast('Failed to update','err');return;}
    this.closeModal();
    this.toast(name+' updated!','ok');
    await this.loadAdminProducts();
  },

  async deleteProduct(id,name){
    if(!confirm(`Delete "${name}"? This cannot be undone.`))return;
    const res=await apiDel('/products/'+id);
    if(res?.ok){this.toast(name+' deleted','warn');this.closeModal();await this.loadAdminProducts();}
    else{this.toast('Delete failed','err');}
  },

  // ═══════════════════════════════════════════════════════════
  //  ADMIN TEAM PAGE
  // ═══════════════════════════════════════════════════════════
  rAdminTeam(){
    return`<div class="ph"><div class="pt"><h1>Admin Team</h1><p>Manage admin accounts. Only the super admin can create or remove admins.</p></div>
    <button class="btn btn-p" onclick="A.showAddAdminModal()"><span class="material-icons-round">person_add</span>Add Admin</button></div>
    <div class="card"><div class="ch"><h3><span class="material-icons-round" style="vertical-align:middle;margin-right:6px;font-size:18px">supervised_user_circle</span>Admin Accounts</h3><span class="badge b-info" id="adm-count"> </span></div>
    <div class="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
    <tbody id="adm-body"><tr><td colspan="5" style="text-align:center;padding:28px;color:var(--mute)"><span class="material-icons-round spin" style="font-size:28px">autorenew</span></td></tr></tbody></table></div></div>`;
  },

  async loadAdminTeam(){
    const res=await apiGet('/admins');const tbody=Q('#adm-body');if(!tbody)return;
    if(!res||!Array.isArray(res)){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--mute)">Unable to load admins.</td></tr>';return;}
    const cnt=Q('#adm-count');if(cnt)cnt.textContent=res.length+' admin'+(res.length!==1?'s':'');
    tbody.innerHTML=res.map(a=>`<tr>
      <td><div style="font-weight:700;display:flex;align-items:center;gap:8px"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--acc),#00D48E);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.8rem">${a.name[0].toUpperCase()}</div>${a.name}</div></td>
      <td style="font-size:.85rem;color:var(--mute)">${a.email}</td>
      <td>${a.is_super?'<span class="badge b-ok">Super Admin</span>':'<span class="badge b-info">Admin</span>'}</td>
      <td style="font-size:.8rem;color:var(--mute)">${new Date(a.created_at).toLocaleDateString('en-IN')}</td>
      <td>${!a.is_super?`<button class="btn btn-sm btn-er" onclick="A.deleteAdmin('${a.id}','${a.name}')"><span class="material-icons-round">delete</span>Remove</button>`:'<span style="color:var(--mute);font-size:.8rem">Protected</span>'}</td>
    </tr>`).join('');
  },

  showAddAdminModal(){
    this.showModal('Add New Admin',
      `<div class="ai info" style="margin-bottom:14px"><span class="material-icons-round ai-icon">info</span><div class="ai-txt"><strong>Admin Account</strong><span>This admin will have full access to manage pharmacies, orders and billing.</span></div></div>
      <div class="fr"><div class="fg"><label>Full Name *</label><input id="an-name" placeholder="e.g. Rahul Kumar" autocomplete="off"></div>
      <div class="fg"><label>Email *</label><input id="an-email" type="email" placeholder="admin@company.com" autocomplete="off"></div></div>
      <div class="fg pwrap"><label>Password * <span style="font-size:.72rem;color:var(--mute)">(min 8 chars)</span></label>
      <input id="an-pw" type="password" placeholder="Strong password"><button class="pw-toggle" onclick="A.togglePw('an-pw',this)"><span class="material-icons-round">visibility</span></button></div>`,
      `<button class="btn btn-s" onclick="A.closeModal()">Cancel</button>
      <button class="btn btn-p" id="an-btn" onclick="A.createAdmin()"><span class="material-icons-round">check</span>Create Admin</button>`
    );
  },

  async createAdmin(){
    const name=Q('#an-name')?.value.trim(),email=Q('#an-email')?.value.trim(),pw=Q('#an-pw')?.value;
    if(!name||!email||!pw){this.toast('All fields are required','err');return;}
    if(pw.length<8){this.toast('Password must be at least 8 characters','err');return;}
    const btn=Q('#an-btn');if(btn){btn.disabled=true;btn.innerHTML='<span class="material-icons-round spin">autorenew</span>Creating…';}
    const res=await apiPost('/admins',{name,email,password:pw});
    if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">check</span>Create Admin';}
    if(!res){this.toast('Server error','err');return;}
    if(res.ok){this.toast(res.msg||'Admin created!','ok');this.closeModal();this.loadAdminTeam();}
    else{this.toast(res.msg||'Failed to create admin','err');}
  },

  async deleteAdmin(id,name){
    if(!confirm(`Remove admin "${name}"? They will be signed out immediately.`))return;
    const res=await apiDel('/admins/'+id);
    if(res?.ok){this.toast('Admin removed','ok');this.loadAdminTeam();}
    else{this.toast(res?.msg||'Failed to remove admin','err');}
  },

  // ═══════════════════════════════════════════════════════════
  //  AUDIT LOG PAGE (Admin Only)
  // ═══════════════════════════════════════════════════════════
  rAudit(){
    return`<div class="ph"><div class="pt"><h1>Audit Log</h1><p>Security events and activity trail for your SaaS platform.</p></div></div>
    <div class="card"><div class="ch"><h3>Security Events</h3><span class="badge b-info">Last 200 events</span></div>
    <div class="tw"><table><thead><tr><th>Event</th><th>User / ID</th><th>Role</th><th>Details</th><th>Timestamp</th></tr></thead><tbody id="audit-body">
    <tr><td colspan="5" style="text-align:center;padding:28px;color:var(--mute)"><span class="material-icons-round spin" style="font-size:28px">autorenew</span></td></tr>
    </tbody></table></div></div>`;
  },
};

// Helpers
function Q(sel){return document.querySelector(sel);}
function QA(sel){return document.querySelectorAll(sel);}

// Keyboard shortcuts
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){A.closeModal();const np=Q('#np');if(np?.classList.contains('open'))np.classList.remove('open');}
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();Q('#global-search')?.focus();}
});

// Export CSV
A.exportCSV=function(){
  const phId=this.st.user?.phId;if(!phId)return;
  const drugs=this.data.drugs.filter(d=>d.phId===phId);
  const rows=[['Drug Name','Generic','Category','Manufacturer','Batch','Quantity','Min Stock','Purchase Price','MRP','Expiry','Barcode']];
  drugs.forEach(d=>rows.push([d.name,d.gen,d.cat,d.mfr,d.batch,d.qty,d.min,d.price,d.mrp,d.exp,d.bc]));
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='inventory_'+new Date().toLocaleDateString('en-CA')+'.csv';a.click();
  this.toast('Inventory exported as CSV!','ok');
};

// WhatsApp Bill Share
A.shareBillWA=function(id){
  const b=this.data.bills.find(b=>b.id===id);if(!b)return;
  const txt='💊 *PharmaDist Pro — Bill '+b.id+'*\n• Pharmacy: '+b.phName+'\n• Amount: ₹'+A.fmt(b.amt)+'\n• Due: '+b.due+'\n• Status: '+(b.status==='paid'?'✅ PAID':'❌ UNPAID')+'\n\nPay via UPI: '+(A.data.dist.upi||'N/A')+'\nLogin: '+window.location.origin;
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
};

// Distributor Inventory
A.loadDistInventory=async function(){
  const el=Q('#pc');if(!el)return;
  const res=await apiGet('/dist-stock');
  A.data.distStock=res||[];
  const items=A.data.distStock;
  const low=items.filter(i=>i.stock<=i.min_stock);
  el.innerHTML=
    '<div class="ph"><div class="pt"><h1>My Stock</h1><p>Drugs you supply to pharmacies.</p></div>'+
    '<button class="btn btn-p" onclick="A.addStockModal()"><span class="material-icons-round">add</span>Add Item</button> '+
    '<button class="btn btn-s" onclick="A.nav(\'dist-inventory\')"><span class="material-icons-round">refresh</span>Refresh</button></div>'+
    (low.length?'<div class="card" style="margin-bottom:14px;border-color:rgba(255,71,87,.3)"><div class="ch"><h3 style="color:var(--err)"><span class="material-icons-round">warning</span> Low Stock Alert</h3><span class="badge b-err">'+low.length+' items</span></div><div class="cb">'+low.map(i=>'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bdr)"><span>'+i.name+'</span><span style="color:var(--err);font-weight:700">'+i.stock+' '+i.unit+' left (min '+i.min_stock+')</span></div>').join('')+'</div></div>':'')+
    '<div class="card">'+
    (items.length===0?'<div class="empty"><span class="material-icons-round">inventory_2</span><h3>No stock items yet</h3><p>Click Add Item to add your first product.</p></div>':
    '<div class="tw"><table><thead><tr><th>Name</th><th>Category</th><th>Manufacturer</th><th>Price</th><th>MRP</th><th>Stock</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
    items.map(i=>
      '<tr><td><strong>'+i.name+'</strong></td><td>'+i.category+'</td><td>'+(i.mfr||'-')+'</td>'+
      '<td>₹'+A.fmt(i.price)+'</td><td>₹'+A.fmt(i.mrp)+'</td>'+
      '<td style="color:'+(i.stock<=i.min_stock?'var(--err)':'var(--ok)')+'"><strong>'+i.stock+'</strong> '+i.unit+'</td>'+
      '<td>'+(i.expiry||'-')+'</td>'+
      '<td>'+(i.stock===0?'<span class="badge b-err">Out</span>':i.stock<=i.min_stock?'<span class="badge b-warn">Low</span>':'<span class="badge b-ok">OK</span>')+'</td>'+
      '<td><div class="ta">'+
      '<button class="btn btn-sm btn-s" onclick="A.editStockModal(\''+i.id+'\')"><span class="material-icons-round">edit</span></button>'+
      '<button class="btn btn-sm btn-er" onclick="A.delStock(\''+i.id+'\')"><span class="material-icons-round">delete</span></button>'+
      '</div></td></tr>'
    ).join('')+
    '</tbody></table></div>')+
    '</div>';
};
A.addStockModal=function(){
  A.showModal('Add Stock Item',
    '<div class="fr"><div class="fg"><label>Drug Name *</label><input id="si-name" placeholder="e.g. Paracetamol 500mg"></div>'+
    '<div class="fg"><label>Category</label><select id="si-cat"><option>Analgesic</option><option>Antibiotic</option><option>Antacid</option><option>Vitamin</option><option>Antidiabetic</option><option>Antihypertensive</option><option>General</option></select></div></div>'+
    '<div class="fr"><div class="fg"><label>Manufacturer</label><input id="si-mfr" placeholder="e.g. Sun Pharma"></div>'+
    '<div class="fg"><label>Unit</label><select id="si-unit"><option>Strip</option><option>Bottle</option><option>Box</option><option>Vial</option><option>Sachet</option></select></div></div>'+
    '<div class="fr"><div class="fg"><label>Price (₹) *</label><input id="si-price" type="number" min="0" step="0.01" placeholder="0.00"></div>'+
    '<div class="fg"><label>MRP (₹)</label><input id="si-mrp" type="number" min="0" step="0.01" placeholder="0.00"></div></div>'+
    '<div class="fr"><div class="fg"><label>Stock Qty *</label><input id="si-stock" type="number" min="0" placeholder="0"></div>'+
    '<div class="fg"><label>Min Stock Alert</label><input id="si-min" type="number" min="0" value="10"></div></div>'+
    '<div class="fg"><label>Expiry Date</label><input id="si-exp" type="date"></div>',
    '<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.saveStock()"><span class="material-icons-round">add</span>Add Item</button>');
};
A.saveStock=async function(){
  const name=(Q('#si-name')?.value||'').trim(),price=parseFloat(Q('#si-price')?.value),stock=parseInt(Q('#si-stock')?.value);
  if(!name||isNaN(price)||isNaN(stock)){A.toast('Fill required fields','err');return;}
  const res=await apiPost('/dist-stock',{name,category:Q('#si-cat')?.value,mfr:(Q('#si-mfr')?.value||'').trim(),unit:Q('#si-unit')?.value,price,mrp:parseFloat(Q('#si-mrp')?.value)||price,stock,min_stock:parseInt(Q('#si-min')?.value)||10,expiry:Q('#si-exp')?.value});
  if(res?.ok){A.closeModal();A.toast('Item added!','ok');A.nav('dist-inventory');}else{A.toast('Failed to add','err');}
};
A.editStockModal=function(id){
  const i=(A.data.distStock||[]).find(s=>s.id===id);if(!i)return;
  A.showModal('Edit: '+i.name,
    '<div class="fr"><div class="fg"><label>Name *</label><input id="si-name" value="'+i.name+'"></div>'+
    '<div class="fg"><label>Category</label><input id="si-cat" value="'+i.category+'"></div></div>'+
    '<div class="fr"><div class="fg"><label>Manufacturer</label><input id="si-mfr" value="'+(i.mfr||'')+'"></div>'+
    '<div class="fg"><label>Unit</label><input id="si-unit" value="'+(i.unit||'Strip')+'"></div></div>'+
    '<div class="fr"><div class="fg"><label>Price (₹)</label><input id="si-price" type="number" value="'+i.price+'"></div>'+
    '<div class="fg"><label>MRP (₹)</label><input id="si-mrp" type="number" value="'+i.mrp+'"></div></div>'+
    '<div class="fr"><div class="fg"><label>Stock Qty</label><input id="si-stock" type="number" value="'+i.stock+'"></div>'+
    '<div class="fg"><label>Min Stock</label><input id="si-min" type="number" value="'+i.min_stock+'"></div></div>'+
    '<div class="fg"><label>Expiry</label><input id="si-exp" type="date" value="'+(i.expiry||'')+'"></div>',
    '<button class="btn btn-s" onclick="A.closeModal()">Cancel</button><button class="btn btn-p" onclick="A.updateStock(\''+id+'\')">Update</button>');
};
A.updateStock=async function(id){
  const name=(Q('#si-name')?.value||'').trim();if(!name){A.toast('Name required','err');return;}
  const res=await apiPut('/dist-stock/'+id,{name,category:(Q('#si-cat')?.value||'').trim(),mfr:(Q('#si-mfr')?.value||'').trim(),unit:(Q('#si-unit')?.value||'').trim(),price:parseFloat(Q('#si-price')?.value)||0,mrp:parseFloat(Q('#si-mrp')?.value)||0,stock:parseInt(Q('#si-stock')?.value)||0,min_stock:parseInt(Q('#si-min')?.value)||10,expiry:Q('#si-exp')?.value});
  if(res?.ok){const item=(A.data.distStock||[]).find(s=>s.id===id);if(item){item.name=name;item.stock=parseInt(Q('#si-stock')?.value)||0;}A.closeModal();A.toast('Updated!','ok');A.nav('dist-inventory');}else{A.toast('Update failed','err');}
};
A.delStock=async function(id){
  if(!confirm('Delete this stock item?'))return;
  const res=await apiDel('/dist-stock/'+id);
  if(res?.ok){A.data.distStock=(A.data.distStock||[]).filter(s=>s.id!==id);A.toast('Deleted','warn');A.nav('dist-inventory');}else{A.toast('Delete failed','err');}
};

// Print Bill
A.printBill=function(id){
  const b=this.data.bills.find(b=>b.id===id);if(!b)return;
  const d=this.data.dist;
  const w=window.open('','_blank','width=800,height=700');
  if(!w)return;
  w.document.write(`<!DOCTYPE html><html><head><title>Bill ${b.id}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:720px;margin:0 auto}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #6C63FF}
  .co-name{font-size:22px;font-weight:800;color:#6C63FF;margin-bottom:4px}.co-info{font-size:13px;color:#555}
  .bill-title{font-size:22px;font-weight:800;text-align:right}.bill-id{color:#777;font-size:14px;margin-top:4px}
  .status{display:inline-block;padding:4px 14px;border-radius:99px;font-size:13px;font-weight:700;margin-top:8px;background:${b.status==='paid'?'#00D48E':'#FF4757'};color:#fff}
  .section{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:18px}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0}
  .row:last-child{border-bottom:none}.lbl{color:#777;font-size:13px}.val{font-weight:600;font-size:14px}
  .total{text-align:right;font-size:26px;font-weight:800;color:#6C63FF;margin-top:20px;padding-top:16px;border-top:2px solid #6C63FF}
  .footer{margin-top:30px;text-align:center;color:#999;font-size:12px}
  .btn{padding:10px 24px;background:#6C63FF;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;margin-top:20px}
  @media print{.no-print{display:none}}</style>
  </head><body>
  <div class="hdr"><div><div class="co-name">${d.name}</div><div class="co-info">${d.address}<br>GST: ${d.gst} | License: ${d.license}</div></div>
  <div><div class="bill-title">TAX INVOICE</div><div class="bill-id">${b.id}</div><div><span class="status">${b.status.toUpperCase()}</span></div></div></div>
  <div class="section">
  <div class="row"><span class="lbl">Billed To</span><span class="val">${b.phName}</span></div>
  <div class="row"><span class="lbl">Invoice Date</span><span class="val">${b.date}</span></div>
  <div class="row"><span class="lbl">Due Date</span><span class="val">${b.due}</span></div>
  ${b.paid?`<div class="row"><span class="lbl" style="color:#00D48E">Paid On</span><span class="val" style="color:#00D48E">${b.paid}</span></div>`:''}
  <div class="row"><span class="lbl">Order Reference</span><span class="val">${b.ordId}</span></div>
  <div class="row"><span class="lbl">Bill Type</span><span class="val">${b.type.toUpperCase()}</span></div>
  </div>
  <div class="total">Total: ₹${(+b.amt).toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
  <div class="footer">PharmaDist Pro • Automated Billing System<br>${d.email} • ${d.phone}</div>
  <div class="no-print" style="text-align:center"><button class="btn" onclick="window.print()">🖨️ Print / Save PDF</button></div>
  </body></html>`);w.document.close();
};

// Start
A.init();

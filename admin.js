(function(){
  const STORAGE_KEY = 'service_requests_v2';
  function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } }
  function save(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
  function fmt(ts){ if(!ts) return ''; const d=new Date(ts); return d.toLocaleString(); }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]); }

  // Admin Users storage helpers
  const ADMIN_KEY = 'service_admin_users_v1';
  function loadAdmins(){ try { return JSON.parse(localStorage.getItem(ADMIN_KEY)) || [] } catch { return [] } }
  function saveAdmins(list){ localStorage.setItem(ADMIN_KEY, JSON.stringify(list)); }
  function nextAdminId(list){ return (list.reduce((m,a)=> Math.max(m,a.id||0),0)+1); }
  const SESSION_KEY = 'service_admin_session_v1';
  function getSession(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null } }

  // Optional: Manually set the admin name in code to force a session
  // How to use:
  // 1) Set MANUAL_ADMIN_NAME = 'Your Name' below, OR
  // 2) Define window.SERVICE_MANUAL_ADMIN_NAME (and optional window.SERVICE_MANUAL_ADMIN_EMAIL) in HTML before this script.
  // This will populate the admin session so actions (Pending/Completed, comments) use that name.
  const MANUAL_ADMIN_NAME = 'Tony Starks';
  const MANUAL_ADMIN_EMAIL = 'tstarks@gmail.com';
  function ensureManualSession(){
    try {
      const name = (window.SERVICE_MANUAL_ADMIN_NAME || MANUAL_ADMIN_NAME || '').trim();
      if(!name) return;
      const email = (window.SERVICE_MANUAL_ADMIN_EMAIL || MANUAL_ADMIN_EMAIL || '').trim();
      const existing = getSession();
      if(existing && existing.name === name && (!email || existing.email === email)) return;
      const session = { name, email, createdAt: Date.now() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      // Notify listeners (e.g., prefs.js) that session changed
      try { window.dispatchEvent(new CustomEvent('adminSessionChanged', { detail: session })); } catch {}
    } catch {}
  }
  ensureManualSession();

  // Elements
  const countNew = document.getElementById('count-new');
  const countPending = document.getElementById('count-pending');
  const countCompleted = document.getElementById('count-completed');
  const tbody = document.querySelector('#requests-table tbody');
  const emptyState = document.getElementById('empty-state');
  const filterStatus = document.getElementById('filter-status');
  const searchInput = document.getElementById('search');
  const seedBtn = document.getElementById('seed-demo'); // may not exist yet when script loads (floating button added later)
  const exportBtn = document.getElementById('export-csv');
  // Admin Users elements
  const adminForm = document.getElementById('admin-user-form');
  const adminMsg = document.getElementById('admin-user-msg');
  const adminSubmitBtn = adminForm ? adminForm.querySelector('button[type="submit"], button:not([type])') : null;
  let editingAdminId = null;
  const adminsTableBody = document.querySelector('#admins-table tbody');
  const adminsEmpty = document.getElementById('admins-empty');
  const seedAdminsBtn = document.getElementById('seed-admins');
  // Admin Users modal elements
  const adminUsersModal = document.getElementById('admin-users-modal');
  const openAdminUsersBtn = document.getElementById('open-admin-users');
  const closeAdminUsersBtn = document.getElementById('close-admin-users');
  const adminUsersBackdrop = adminUsersModal ? adminUsersModal.querySelector('[data-admin-users-close]') : null;

  // Modal elements
  const modal = document.getElementById('details-modal');
  const modalClose = document.getElementById('details-close');
  const modalBackdrop = modal.querySelector('[data-close]');
  const detailsTitle = document.getElementById('details-title');
  const detailsSubtitle = document.getElementById('details-subtitle');
  const detailsContent = document.getElementById('details-content');
  const commentsList = document.getElementById('comments-list');
  const commentForm = document.getElementById('comment-form');
  const commentAuthor = document.getElementById('comment-author');
  const commentText = document.getElementById('comment-text');

  let currentId = null;

  function syncCounts(list){
    const counts = {New:0, Pending:0, Completed:0};
    list.forEach(r=> counts[r.status] = (counts[r.status]||0)+1);
    countNew.textContent = counts.New || 0;
    countPending.textContent = counts.Pending || 0;
    countCompleted.textContent = counts.Completed || 0;
  }

  function render(){
    const list = load();
    syncCounts(list);
    const statusFilter = filterStatus.value;
    const q = (searchInput.value||'').toLowerCase();
    const rows = list
      .filter(r=> statusFilter==='all' || r.status===statusFilter)
      .filter(r=> !q || `${r.subject} ${r.name} ${r.email} ${r.category}`.toLowerCase().includes(q))
      .sort((a,b)=> b.updatedAt - a.updatedAt);
    if(rows.length===0){
      tbody.innerHTML='';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      tbody.innerHTML = rows.map(r=> rowHtml(r)).join('');
    }
  }

  function badge(status){
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border';
    const map = {
      New: base+' bg-sky-500/10 text-sky-300 border-sky-600/40',
      Pending: base+' bg-amber-500/10 text-amber-300 border-amber-600/40',
      Completed: base+' bg-emerald-500/10 text-emerald-300 border-emerald-600/40'
    };
    return `<span class="${map[status]||base}">${status}</span>`;
  }

  function rowHtml(r){
    return `<tr class="hover:bg-slate-900/50 transition">
      <td class="px-4 py-2 align-top font-mono text-xs text-slate-400">#${r.id}</td>
      <td class="px-4 py-2 align-top">${escapeHtml(r.subject)}</td>
      <td class="px-4 py-2 align-top">${escapeHtml(r.name)}<div class="text-xs text-slate-500">${escapeHtml(r.email)}</div></td>
      <td class="px-4 py-2 align-top text-slate-300">${escapeHtml(r.category)}</td>
      <td class="px-4 py-2 align-top">${escapeHtml(r.priority)}</td>
      <td class="px-4 py-2 align-top">${badge(r.status)}</td>
      <td class="px-4 py-2 align-top text-xs text-slate-400">${fmt(r.updatedAt)}</td>
      <td class="px-4 py-2 align-top space-y-1">
        ${r.status==='New'?`<button data-action="to-pending" data-id="${r.id}" class="block w-full text-left px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs">Mark Pending</button>`:''}
        ${r.status!=='Completed'?`<button data-action="to-completed" data-id="${r.id}" class="block w-full text-left px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs">Mark Completed</button>`:''}
        <button data-action="details" data-id="${r.id}" class="block w-full text-left px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-xs">Details</button>
        <button data-action="delete" data-id="${r.id}" class="block w-full text-left px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-xs">Delete</button>
      </td>
    </tr>`;
  }

  // Admin Users rendering
  function renderAdmins(){
    if(!adminsTableBody) return; // Section may not exist
    const list = loadAdmins();
    const allowed = ['IT Support','Facilities','HR','Other'];
    // Normalize legacy free-text categories (mutate in-memory and persist once if changed)
    let changed = false;
    list.forEach(a=>{
      if(a.category){
        if(!allowed.includes(a.category)){
          a.category = 'Other';
          changed = true;
        }
      }
    });
    if(changed) saveAdmins(list);
    if(!list.length){
      adminsTableBody.innerHTML='';
      if(adminsEmpty) adminsEmpty.classList.remove('hidden');
      return;
    }
    if(adminsEmpty) adminsEmpty.classList.add('hidden');
    adminsTableBody.innerHTML = list.slice().sort((a,b)=> b.createdAt - a.createdAt).map(a=>`
      <tr class="hover:bg-slate-900/40 cursor-pointer" data-admin-row data-id="${a.id}">
        <td class="px-4 py-2 text-xs font-mono text-slate-500">#${a.id}</td>
        <td class="px-4 py-2 text-sm">${escapeHtml(a.name)}</td>
        <td class="px-4 py-2 text-xs text-slate-400">${escapeHtml(a.email)}</td>
        <td class="px-4 py-2 text-xs text-slate-400">${a.category ? escapeHtml(a.category) : '<span class="text-slate-600">—</span>'}</td>
        <td class="px-4 py-2 text-xs text-slate-400">${a.managerName?escapeHtml(a.managerName):'<span class="text-slate-600">—</span>'}<div class="text-[10px] ${a.managerEmail?'text-slate-500':'text-slate-600'}">${a.managerEmail?escapeHtml(a.managerEmail):''}</div></td>
        <td class="px-4 py-2 text-xs">${escapeHtml(a.role||'Admin')}</td>
        <td class="px-4 py-2 text-xs text-slate-500">${fmt(a.createdAt)}</td>
        <td class="px-4 py-2 text-xs"><button data-admin-action="del" data-id="${a.id}" class="px-2 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600">Delete</button></td>
      </tr>`).join('');
  }

  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const id = Number(btn.getAttribute('data-id'));
    const action = btn.getAttribute('data-action');
    const list = load();
    const idx = list.findIndex(r=> r.id===id);
    if(idx===-1) return;
    const r = list[idx];
    const now = Date.now();
    const session = getSession();
    if(action==='to-pending' && r.status==='New'){
      r.status='Pending'; r.movedToPendingAt=now; r.updatedAt=now; r.pendingBy = session?.name || null;
    } else if(action==='to-completed' && r.status!=='Completed'){
      if(r.status==='New' && !r.movedToPendingAt){ r.movedToPendingAt = now; r.pendingBy = session?.name || r.pendingBy || null; }
      r.status='Completed'; r.completedAt=now; r.updatedAt=now; r.completedBy = session?.name || null;
    } else if(action==='delete'){
      list.splice(idx,1); save(list); render(); return;
    } else if(action==='details'){
      openDetails(id); return;
    } else {
      return;
    }
    save(list); render();
  });

  filterStatus.addEventListener('change', render);
  searchInput.addEventListener('input', ()=> render());

  // Seed demo via delegation so it works even if button is injected after script
  document.addEventListener('click', (e)=>{
    const seedTrigger = e.target.closest('#seed-demo');
    if(!seedTrigger) return;
    const list = load();
    if(list.length){
      seedTrigger.title = 'Requests already exist; demo seeding skipped';
      return;
    }
    const now = Date.now();
    const demo = [
      {id:1,name:'Alice',email:'alice@example.com',subject:'Laptop will not boot',priority:'High',category:'IT Support',description:'Black screen on startup',status:'New',createdAt:now-5*86400000,updatedAt:now-5*86400000,comments:[],pendingBy:null,completedBy:null},
      {id:2,name:'Bob',email:'bob@example.com',subject:'AC not cooling',priority:'Medium',category:'Facilities',description:'Office 2A too warm',status:'Pending',createdAt:now-9*86400000,movedToPendingAt:now-6*86400000,updatedAt:now-6*86400000,comments:[{author:'Tech',text:'Ordered replacement part',createdAt:now-5*86400000}],pendingBy:'Jane Admin',completedBy:null},
      {id:3,name:'Chloe',email:'chloe@example.com',subject:'Benefits question',priority:'Low',category:'HR',description:'Clarify PTO rollover',status:'Completed',createdAt:now-20*86400000,movedToPendingAt:now-15*86400000,completedAt:now-3*86400000,updatedAt:now-3*86400000,comments:[{author:'HR',text:'Sent policy PDF',createdAt:now-4*86400000}],pendingBy:'Mike Manager',completedBy:'Mike Manager'}
    ];
    save(demo);
    render();
    seedTrigger.title = 'Demo data loaded';
  });

  // Modal logic
  function openDetails(id){
    const list = load();
    const r = list.find(x=> x.id===id);
    if(!r) return;
    currentId = id;
    if(!Array.isArray(r.comments)) r.comments = [];
    save(list);
    detailsTitle.textContent = `Request #${r.id}`;
    detailsSubtitle.textContent = `${r.status} • ${fmt(r.updatedAt)}`;
    detailsContent.innerHTML = `
      <div class="grid gap-4 md:grid-cols-2 text-xs text-slate-300">
        <div class="space-y-1">
          <div><span class="text-slate-500">Name:</span> ${escapeHtml(r.name)}</div>
          <div><span class="text-slate-500">Email:</span> ${escapeHtml(r.email)}</div>
          <div><span class="text-slate-500">Priority:</span> ${escapeHtml(r.priority)}</div>
          <div><span class="text-slate-500">Category:</span> ${escapeHtml(r.category)}</div>
        </div>
        <div class="space-y-1">
          <div><span class="text-slate-500">Created:</span> ${fmt(r.createdAt)}</div>
          <div><span class="text-slate-500">Updated:</span> ${fmt(r.updatedAt)}</div>
          <div><span class="text-slate-500">Moved Pending:</span> ${fmt(r.movedToPendingAt)}</div>
          <div><span class="text-slate-500">Completed:</span> ${fmt(r.completedAt)}</div>
        </div>
      </div>
      <div class="pt-2 text-sm">
        <h5 class="font-medium mb-1">Subject</h5>
        <p class="mb-3 text-slate-300">${escapeHtml(r.subject)}</p>
        <h5 class="font-medium mb-1">Description</h5>
        <p class="whitespace-pre-line text-slate-300">${escapeHtml(r.description)}</p>
      </div>`;
    renderComments(r.comments);
    modal.classList.remove('hidden');
  }

  function closeDetails(){
    modal.classList.add('hidden');
    currentId = null;
  }

  function renderComments(comments){
    if(!comments || comments.length===0){
      commentsList.innerHTML = '<div class="text-xs text-slate-500 italic">No comments yet.</div>';
      return;
    }
    commentsList.innerHTML = comments.slice().sort((a,b)=> b.createdAt - a.createdAt).map(c=>`
      <div class="rounded-xl border border-slate-800 bg-slate-800/60 p-3 text-xs space-y-1">
        <div class="flex items-center justify-between">
          <span class="font-medium text-slate-200">${escapeHtml(c.author||'Admin')}</span>
          <span class="text-[10px] text-slate-500">${fmt(c.createdAt)}</span>
        </div>
        <div class="text-slate-300 leading-relaxed">${escapeHtml(c.text)}</div>
      </div>`).join('');
  }

  commentForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(currentId==null) return;
    const author = commentAuthor.value.trim() || 'Admin';
    const text = commentText.value.trim();
    if(!text){ return; }
    const list = load();
    const r = list.find(x=> x.id===currentId);
    if(!r) return;
    if(!Array.isArray(r.comments)) r.comments = [];
    r.comments.push({author,text,createdAt:Date.now()});
    r.updatedAt = Date.now();
    save(list);
    commentText.value='';
    renderComments(r.comments);
    render(); // refresh table updated timestamp

    // --- Email Notification Logic (Comment Added) ---
    // This section triggers email notifications when a comment is added.
    // Placeholder customization zone: Developers can modify subject/body formatting,
    // add integration with a real email API, or add conditional logic.
    // To customize, adjust the buildEmail() function below or replace sendMailto()
    // with an API call.

    try {
      // Load admins to find those matching the request category
      const admins = loadAdmins();
      const matchingAdmins = admins.filter(a=> a.category && r.category && a.category.toLowerCase() === r.category.toLowerCase());
      const requesterEmail = r.email;

      function buildEmail(to, context){
        const baseSubject = `Update on Request #${r.id} (${r.subject})`;
        const baseLines = [
          `Request ID: ${r.id}`,
          `Subject: ${r.subject}`,
          `Category: ${r.category}`,
          `Status: ${r.status}`,
          `Comment Author: ${author}`,
          `Comment: ${text}`,
          '',
          'You are receiving this notification because: ' + context,
          '',
          '--- Customize email template in admin.js (search for "Email Notification Logic") ---'
        ];
        return { subject: baseSubject, body: baseLines.join('\n') };
      }

      function sendMailto(to, subject, body){
        if(!to) return;
        const link = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        // Create a temporary anchor to trigger the mail client (best-effort UX)
        const a = document.createElement('a');
        a.href = link;
        a.style.display='none';
        document.body.appendChild(a);
        a.click();
        setTimeout(()=> a.remove(), 0);
        logEmailEvent({ to, subject, body, reason:'comment-added', requestId: r.id });
      }

      // Simple local log (re-using or creating a log structure similar to request submission)
      function logEmailEvent(evt){
        try {
          const KEY = 'service_email_log_v1';
            const existing = JSON.parse(localStorage.getItem(KEY)) || [];
            existing.push({ ...evt, ts: Date.now() });
            localStorage.setItem(KEY, JSON.stringify(existing));
        } catch { /* no-op */ }
      }

      // Notify category-matched admins
      matchingAdmins.forEach(adm=>{
        if(adm.email){
          const { subject, body } = buildEmail(adm.email, 'you are an admin assigned to this category');
          sendMailto(adm.email, subject, body);
        }
        // Optionally notify manager
        if(adm.managerEmail){
          const { subject, body } = buildEmail(adm.managerEmail, 'you manage an admin assigned to this category');
          sendMailto(adm.managerEmail, subject, body);
        }
      });

      // Notify requester about the status & new comment
      if(requesterEmail){
        const { subject, body } = buildEmail(requesterEmail, 'you are the requester of this service ticket');
        sendMailto(requesterEmail, subject, body);
      }
    } catch(err){
      console.warn('Email notification failed (non-blocking):', err);
    }
  });

  modalClose.addEventListener('click', closeDetails);
  modalBackdrop.addEventListener('click', closeDetails);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !modal.classList.contains('hidden')) closeDetails(); });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && adminUsersModal && !adminUsersModal.classList.contains('hidden')){
      adminUsersModal.classList.add('hidden');
    }
  });

  // Admin Users modal events
  openAdminUsersBtn?.addEventListener('click', ()=>{ adminUsersModal?.classList.remove('hidden'); renderAdmins(); });
  closeAdminUsersBtn?.addEventListener('click', ()=> adminUsersModal?.classList.add('hidden'));
  adminUsersBackdrop?.addEventListener('click', ()=> adminUsersModal?.classList.add('hidden'));

  // Admin Users events
  adminForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!adminMsg) return;
    adminMsg.classList.add('hidden'); adminMsg.textContent='';
    const fd = new FormData(adminForm);
  const name = (fd.get('name')||'').toString().trim();
  const email = (fd.get('email')||'').toString().trim().toLowerCase();
  const category = (fd.get('category')||'').toString().trim();
  const role = (fd.get('role')||'Admin').toString();
  const managerName = (fd.get('managerName')||'').toString().trim();
  const managerEmail = (fd.get('managerEmail')||'').toString().trim().toLowerCase();
  if(managerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(managerEmail)){ adminMsg.textContent='Invalid manager email'; adminMsg.classList.remove('hidden'); return; }
  if(!name || !email || !category){ adminMsg.textContent='Name, email & category required'; adminMsg.classList.remove('hidden'); return; }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ adminMsg.textContent='Invalid email'; adminMsg.classList.remove('hidden'); return; }
    const list = loadAdmins();
    if(editingAdminId==null){
      if(list.some(a=> a.email===email)){ adminMsg.textContent='Email already exists'; adminMsg.classList.remove('hidden'); return; }
      list.push({ id: nextAdminId(list), name, email, role, category, managerName, managerEmail, createdAt: Date.now() });
      saveAdmins(list);
      adminForm.reset();
      renderAdmins();
    } else {
      const idx = list.findIndex(a=> a.id===editingAdminId);
      if(idx===-1){ editingAdminId=null; adminForm.reset(); renderAdmins(); return; }
      // Prevent collision with another user's email
      if(list.some(a=> a.email===email && a.id!==editingAdminId)){ adminMsg.textContent='Email already exists'; adminMsg.classList.remove('hidden'); return; }
      list[idx] = { ...list[idx], name, email, role, category, managerName, managerEmail };
      saveAdmins(list);
      editingAdminId = null;
      adminForm.reset();
      if(adminSubmitBtn){ adminSubmitBtn.textContent='Add User'; }
      const cancelBtn = adminForm.querySelector('[data-cancel-edit]');
      if(cancelBtn) cancelBtn.remove();
      renderAdmins();
    }
  });

  adminsTableBody?.addEventListener('click', (e)=>{
    const delBtn = e.target.closest('button[data-admin-action="del"]');
    if(delBtn){
      e.stopPropagation();
      const id = Number(delBtn.getAttribute('data-id'));
      const list = loadAdmins();
      const idx = list.findIndex(a=> a.id===id);
      if(idx>-1){ list.splice(idx,1); saveAdmins(list); renderAdmins(); if(editingAdminId===id){ editingAdminId=null; adminForm.reset(); if(adminSubmitBtn) adminSubmitBtn.textContent='Add User'; const cb=adminForm.querySelector('[data-cancel-edit]'); cb&&cb.remove(); } }
      return;
    }
    const row = e.target.closest('tr[data-admin-row]');
    if(!row) return;
    const id = Number(row.getAttribute('data-id'));
    const list = loadAdmins();
    const admin = list.find(a=> a.id===id);
    if(!admin) return;
    editingAdminId = id;
    adminForm.querySelector('#admin-name').value = admin.name || '';
    adminForm.querySelector('#admin-email').value = admin.email || '';
    adminForm.querySelector('#admin-role').value = admin.role || 'Admin';
    const cat = adminForm.querySelector('#admin-category'); if(cat) cat.value = admin.category || '';
    const mn = adminForm.querySelector('#manager-name'); if(mn) mn.value = admin.managerName || '';
    const me = adminForm.querySelector('#manager-email'); if(me) me.value = admin.managerEmail || '';
    if(adminSubmitBtn) adminSubmitBtn.textContent='Update User';
    if(!adminForm.querySelector('[data-cancel-edit]')){
      const cancel = document.createElement('button');
      cancel.type='button';
      cancel.textContent='Cancel';
      cancel.className='w-full rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2';
      cancel.setAttribute('data-cancel-edit','');
      cancel.addEventListener('click', ()=>{
        editingAdminId=null; adminForm.reset(); if(adminSubmitBtn) adminSubmitBtn.textContent='Add User'; cancel.remove(); adminMsg.classList.add('hidden'); adminMsg.textContent='';
      });
      adminForm.appendChild(cancel);
    }
  });

  seedAdminsBtn?.addEventListener('click', ()=>{
    const list = loadAdmins();
    if(list.length) return; // only seed when empty
    const now = Date.now();
    const demo = [
      {id:1,name:'Jane Admin', email:'jane.admin@example.com', role:'Admin', category:'IT', createdAt: now},
      {id:2,name:'Mike Manager', email:'mike.manager@example.com', role:'Manager', category:'Operations', createdAt: now-3600000},
      {id:3,name:'View Only', email:'viewer@example.com', role:'Viewer', category:'Audit', createdAt: now-7200000}
    ];
    saveAdmins(demo); renderAdmins();
  });

  // Initial render
  render();
  renderAdmins();

  // Real-time sync: if another tab adds or modifies requests, update this view
  window.addEventListener('storage', (e)=>{
    if(e.key === STORAGE_KEY){
      render();
    }
  });

  // Same-tab custom event sync (index page dispatches after submission)
  window.addEventListener('serviceRequestsUpdated', ()=>{
    render();
  });

  // Export CSV
  exportBtn?.addEventListener('click', ()=>{
    const all = load();
    const statusFilter = filterStatus.value;
    const q = (searchInput.value||'').toLowerCase();
    const rows = all
      .filter(r=> statusFilter==='all' || r.status===statusFilter)
      .filter(r=> !q || `${r.subject} ${r.name} ${r.email} ${r.category}`.toLowerCase().includes(q))
      .sort((a,b)=> b.updatedAt - a.updatedAt);
    if(!rows.length){ alert('No rows to export'); return; }
    const header = ['ID','Name','Email','Subject','Priority','Category','Status','Created At','Updated At','Moved Pending At','Completed At','Pending By','Completed By'];
    function csvEscape(v){ if(v==null) return ''; const s=String(v).replace(/"/g,'""'); return /[",\n]/.test(s)?`"${s}`+`"`:s; }
    const lines = [header.join(',')].concat(rows.map(r=>[
      r.id,
      r.name,
      r.email,
      r.subject,
      r.priority,
      r.category,
      r.status,
      r.createdAt? new Date(r.createdAt).toISOString(): '',
      r.updatedAt? new Date(r.updatedAt).toISOString(): '',
      r.movedToPendingAt? new Date(r.movedToPendingAt).toISOString(): '',
      r.completedAt? new Date(r.completedAt).toISOString(): '',
      r.pendingBy||'',
      r.completedBy||''
    ].map(csvEscape).join(',')));
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'service_requests.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();

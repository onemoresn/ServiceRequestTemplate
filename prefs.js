// Centralized preferences management with per-admin scoping
(function(){
  const SESSION_KEY = 'service_admin_session_v1';
  const GLOBAL_KEY = 'service_ui_prefs_v1'; // used for public (non-admin) usage

  function getSession(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null } }
  function prefsKey(){ const s = getSession(); return s ? `service_ui_prefs_${s.id}_v1` : GLOBAL_KEY; }
  function load(){ try { return JSON.parse(localStorage.getItem(prefsKey())) || {} } catch { return {} } }
  function save(p){ localStorage.setItem(prefsKey(), JSON.stringify(p)); }
  function apply(p){ const root=document.documentElement; if(p.theme==='light'){ root.classList.add('theme-light'); } else { root.classList.remove('theme-light'); } root.dataset.textScale = p.textSize || 'base'; }

  function ensureStyles(){
    if(document.getElementById('prefs-styles')) return;
    const style = document.createElement('style');
    style.id='prefs-styles';
    style.textContent = `:root[data-text-scale=sm]{font-size:14px;} :root[data-text-scale=base]{font-size:16px;} :root[data-text-scale=lg]{font-size:18px;} :root[data-text-scale=xl]{font-size:20px;}
/* Light theme base */ .theme-light body{--tw-bg-opacity:1; background-color:rgb(241 245 249 / var(--tw-bg-opacity)); color:#0f172a;}
/* Surfaces */ .theme-light .bg-slate-950{background-color:#f1f5f9 !important;} .theme-light .bg-slate-900{background-color:#f8fafc !important; color:#0f172a;}
/* Typography tiers */ .theme-light .text-slate-200{color:#1e293b !important;} .theme-light .text-slate-300{color:#334155 !important;} .theme-light .text-slate-400{color:#475569 !important;} .theme-light .text-slate-500{color:#64748b !important;}
/* Metadata tiny */ .theme-light .text-slate-500.text-[11px], .theme-light .text-slate-500.text-xs{color:#5b6d82 !important;}
/* Navbar */ .theme-light header nav .text-slate-400{color:#1e293b !important;} .theme-light header nav .hover\\:text-slate-200:hover{color:#0f172a !important;}
/* Borders */ .theme-light .border-slate-800{border-color:#cbd5e1 !important;} .theme-light .border-slate-700{border-color:#cbd5e1 !important;}
/* Form fields */ .theme-light input,.theme-light textarea,.theme-light select{background:#ffffff !important; color:#0f172a; border-color:#cbd5e1;}
/* Panels & buttons */ .theme-light .bg-slate-800{background-color:#e2e8f0 !important;} .theme-light .bg-slate-700{background-color:#cbd5e1 !important;} .theme-light .hover\\:bg-slate-800:hover{background-color:#e2e8f0 !important;} .theme-light .hover\\:bg-slate-700:hover{background-color:#cbd5e1 !important;}
/* Misc */ .theme-light .shadow-inner{box-shadow:inset 0 1px 3px 0 rgba(0,0,0,0.08);} .theme-light .ring-offset-slate-950{--tw-ring-offset-color:#ffffff;} .theme-light .text-white{color:#0f172a !important;}`;
    document.head.appendChild(style);
  }

  function ensureModal(){
    if(document.getElementById('settings-modal')) return;
    const html = `<div id="settings-modal" class="fixed inset-0 hidden z-50"><div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" data-settings-close></div><div class="relative mx-auto max-w-md mt-24 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl p-6 flex flex-col gap-6"><div class="flex items-start justify-between"><h3 class="text-lg font-semibold">Settings</h3><button id="close-settings" class="text-slate-400 hover:text-slate-200">✕</button></div><form id="settings-form" class="space-y-6"><section class="space-y-3"><h4 class="text-sm font-medium text-slate-300">Theme</h4><div class="flex items-center gap-4 text-sm"><label class="inline-flex items-center gap-2"><input type="radio" name="theme" value="dark" class="text-brand-500 focus:ring-brand-500" checked><span>Dark</span></label><label class="inline-flex items-center gap-2"><input type="radio" name="theme" value="light" class="text-brand-500 focus:ring-brand-500"><span>Light</span></label></div></section><section class="space-y-3"><h4 class="text-sm font-medium text-slate-300">Text Size</h4><select name="textSize" id="text-size" class="w-full bg-slate-950/40 border border-slate-700 rounded-xl text-sm px-3 py-2 focus:border-brand-500 focus:ring-brand-500"><option value="sm">Small</option><option value="base" selected>Default</option><option value="lg">Large</option><option value="xl">Extra Large</option></select><p class="text-[11px] text-slate-500">Applies to body text size scaling.</p></section><div class="flex justify-end gap-3 pt-2"><button type="button" id="settings-cancel" class="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700">Cancel</button><button class="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-white">Save</button></div></form></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function bindUI(){
    const btn = document.getElementById('open-settings');
    const modal = document.getElementById('settings-modal');
    const form = document.getElementById('settings-form');
    if(!btn || !modal || !form) return;
    const prefs = load();
    // Pre-fill
    if(prefs.theme){ const t=form.querySelector(`input[name="theme"][value="${prefs.theme}"]`); if(t) t.checked=true; }
    if(prefs.textSize){ const sel=form.querySelector('#text-size'); if(sel) sel.value=prefs.textSize; }
    function open(){ modal.classList.remove('hidden'); }
    function close(){ modal.classList.add('hidden'); }
    btn.addEventListener('click', open);
    ['close-settings','settings-cancel'].forEach(id=>{ document.getElementById(id)?.addEventListener('click', e=>{ e.preventDefault(); close(); }); });
    modal.addEventListener('click', e=>{ if(e.target && e.target.hasAttribute && e.target.hasAttribute('data-settings-close')) close(); });
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const data = new FormData(form);
      const newPrefs = { theme: data.get('theme') || 'dark', textSize: data.get('textSize') || 'base' };
      save(newPrefs); apply(newPrefs); close();
    });
  }

  function init(){ ensureStyles(); ensureModal(); apply(load()); bindUI(); }
  function reloadForUser(){ apply(load()); // if modal open, update radio/text size
    const form=document.getElementById('settings-form'); if(form){ const prefs=load(); if(prefs.theme){ const t=form.querySelector(`input[name="theme"][value="${prefs.theme}"]`); if(t) t.checked=true; } const sel=form.querySelector('#text-size'); if(sel && prefs.textSize) sel.value=prefs.textSize; }
  }

  // React to session changes dispatched by pages
  window.addEventListener('adminSessionChanged', reloadForUser);

  window.Prefs = { init, loadPrefs:load, savePrefs:save, applyPrefs:apply, reloadForUser };
})();

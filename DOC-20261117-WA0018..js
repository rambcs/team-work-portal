import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PORTAL_NAME } from './config.js';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const z = n => String(n).padStart(2, '0');
const fmtDate = d => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
const today = () => fmtDate(new Date());
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return fmtDate(d); };
const weekStart = s => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmtDate(d); };
const nice = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const niceLong = s => parseD(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dow = s => parseD(s).toLocaleDateString('en-IN', { weekday: 'short' });
const when = ts => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const hrsFmt = h => (Math.round(h * 100) / 100).toString();
const orNull = v => v ? v : null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000); }

const STATUSES = ['To do', 'In progress', 'Blocked', 'Done'];
const sCls = s => 's-' + String(s || 'To do').toLowerCase().replace(/\s/g, '');
const TYPES = ['Task', 'Area / Role', 'Instruction'];
const PRI = { High: 0, Medium: 1, Low: 2 };
const HISTORY_DAYS = 180;

document.title = PORTAL_NAME;
$('.brand h1').textContent = PORTAL_NAME;

/* ---------- state ---------- */
const S = {
  me: null, isMgr: false, people: {}, clients: [], engs: [], tasks: [], entries: [], updates: {},
  tab: null, tsWeek: weekStart(today()), tsWho: 'me', teamDate: today(),
  taskFilter: { who: '', eng: '', status: 'open', q: '' }, myFilter: 'open', openTask: null,
};

/* ---------- supabase ---------- */
const configured = SUPABASE_URL && !SUPABASE_URL.includes('YOUR-') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR-');
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function run(promise, okMsg) {
  const { data, error } = await promise;
  if (error) { toast(error.message || 'Something went wrong'); return null; }
  if (okMsg) toast(okMsg);
  return data ?? true;
}

async function loadAll() {
  const since = addDays(today(), -HISTORY_DAYS);
  const [p, c, e, t, te] = await Promise.all([
    sb.from('profiles').select('*').order('full_name'),
    sb.from('clients').select('*').order('name'),
    sb.from('engagements').select('*').order('name'),
    sb.from('tasks').select('*, task_updates(count)'),
    sb.from('time_entries').select('*').gte('entry_date', since).order('entry_date', { ascending: false }),
  ]);
  const err = [p, c, e, t, te].find(r => r.error);
  if (err) toast(err.error.message);
  S.people = Object.fromEntries((p.data || []).map(x => [x.id, x]));
  S.clients = c.data || []; S.engs = e.data || [];
  S.tasks = (t.data || []).map(x => ({ ...x, n_updates: x.task_updates?.[0]?.count || 0 }));
  S.entries = te.data || [];
  const me = S.people[S.me];
  S.isMgr = !!(me && me.role === 'manager' && me.active);
}
let reloadT = null;
function scheduleReload() { clearTimeout(reloadT); reloadT = setTimeout(async () => { await loadAll(); refresh(); }, 300); }
async function loadUpdates(taskId) {
  const { data, error } = await sb.from('task_updates').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
  if (!error) { S.updates[taskId] = data; if (S.openTask === taskId) renderModal(false); }
}

/* ---------- lookups ---------- */
const nm = id => { const p = S.people[id]; return id ? ((p?.full_name || p?.email || 'Someone') + (id === S.me ? ' (you)' : '')) : '—'; };
const client = id => S.clients.find(c => c.id === id);
const eng = id => S.engs.find(e => e.id === id);
function engLabel(id) { const e = eng(id); if (!e) return 'General / internal'; const c = client(e.client_id); return (c ? c.name + ' · ' : '') + e.name; }
const activePeople = () => Object.values(S.people).filter(p => p.active);
const memberIds = () => { const ids = activePeople().map(p => p.id).filter(i => i !== S.me).sort((a, b) => nm(a).localeCompare(nm(b))); return S.isMgr ? [S.me, ...ids] : ids; };
const teamIds = () => activePeople().filter(p => p.id !== S.me).map(p => p.id).sort((a, b) => nm(a).localeCompare(nm(b)));
const isOver = t => t.due_date && t.status !== 'Done' && t.due_date < today();
function sortTasks(a, b) {
  const da = a.status === 'Done', dbb = b.status === 'Done';
  if (da !== dbb) return da ? 1 : -1;
  const x = a.due_date || '9999', y = b.due_date || '9999';
  if (x !== y) return x < y ? -1 : 1;
  return (PRI[a.priority] ?? 1) - (PRI[b.priority] ?? 1);
}
function fillSelect(sel, opts, placeholder) {
  if (!sel || document.activeElement === sel) return;
  const v = sel.dataset.want ?? sel.value ?? '';
  sel.innerHTML = (placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '') +
    opts.map(([val, lab]) => `<option value="${esc(val)}">${esc(lab)}</option>`).join('');
  if ([...sel.options].some(o => o.value === v)) sel.value = v;
  delete sel.dataset.want;
}
function fillEng(sel, placeholder) {
  if (!sel || document.activeElement === sel) return;
  const v = sel.dataset.want ?? sel.value ?? '';
  let h = placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '';
  for (const c of [...S.clients].sort((a, b) => a.name.localeCompare(b.name))) {
    const es = S.engs.filter(e => e.client_id === c.id && (e.active || e.id === v));
    if (es.length) h += `<optgroup label="${esc(c.name)}">` + es.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('') + '</optgroup>';
  }
  sel.innerHTML = h;
  if ([...sel.options].some(o => o.value === v)) sel.value = v;
  delete sel.dataset.want;
}

/* ---------- login ---------- */
function showLogin(msg) {
  S.tab = null; $('#tabs').innerHTML = ''; $('#who').textContent = ''; $('#signOut').style.display = 'none'; $('#pwLink').style.display = 'none';
  $('#main').innerHTML = `<div class="login panel">
    <h2>Sign in</h2>
    <p class="muted">Use the email and password your manager gave you.</p>
    <form id="loginForm">
      <div style="margin-bottom:10px"><label>Email</label><input type="email" name="email" required placeholder="you@yourfirm.com" autocomplete="email"></div>
      <div><label>Password</label><input type="password" name="password" placeholder="Password" autocomplete="current-password"></div>
      <div class="actions"><button class="btn primary" id="loginBtn">Sign in</button><button class="btn" type="button" id="linkBtn">Email me a sign-in link instead</button></div></form>
    <p id="loginMsg" class="muted" style="margin-top:12px">${esc(msg || '')}</p></div>`;
  const form = $('#loginForm'), msgEl = $('#loginMsg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.elements.email.value.trim(), password = form.elements.password.value;
    if (!password) { msgEl.textContent = 'Enter your password, or use the sign-in link option.'; return; }
    const btn = $('#loginBtn'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (error) msgEl.textContent = /invalid/i.test(error.message) ? 'Wrong email or password.' : error.message;
  });
  $('#linkBtn').addEventListener('click', async () => {
    const email = form.elements.email.value.trim();
    if (!email) { msgEl.textContent = 'Enter your email first.'; return; }
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    msgEl.textContent = error
      ? (/signups not allowed|not found|Signups/i.test(error.message) ? 'That email has not been added yet. Ask your manager.' : error.message)
      : `Check ${email} for a sign-in link. Open it on this device.`;
  });
}

function showPasswordDialog() {
  S.openTask = null;
  $('#sheet').innerHTML = `<button class="close" data-act="close">✕</button><h2>Change password</h2>
    <form id="pwForm" style="margin-top:12px"><label>New password (min 8 characters)</label>
      <input type="password" name="pw" minlength="8" required autocomplete="new-password">
      <div class="actions"><button class="btn primary">Save password</button></div></form>`;
  $('#modal').classList.remove('hidden');
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = e.target.elements.pw.value;
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return toast(error.message);
    toast('Password changed'); closeModal();
  });
}

/* ---------- tabs ---------- */
function tabs() {
  return S.isMgr
    ? [['team', 'Team view'], ['tasks', 'Assignments'], ['time', 'Timesheets'], ['today', 'My day'], ['setup', 'Setup']]
    : [['today', 'My day'], ['tasks', 'My tasks'], ['time', 'Timesheet']];
}
function renderNav() { $('#tabs').innerHTML = tabs().map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join(''); }
function go(tab) { S.tab = tab; try { history.replaceState(null, '', '#' + tab); } catch (e) {} renderNav(); renderTab(); window.scrollTo(0, 0); }

/* ---------- task card ---------- */
function taskCard(t, showWho) {
  const over = isOver(t);
  return `<div class="card p-${esc(t.priority)} ${t.status === 'Done' ? 'done' : ''}" data-act="open" data-id="${esc(t.id)}">
    <div class="row"><span class="pill ty">${esc(t.type)}</span><span class="pill ${sCls(t.status)}">${esc(t.status)}</span>${t.n_updates ? `<span class="pill">💬 ${t.n_updates}</span>` : ''}</div>
    <div class="t">${esc(t.title)}</div>
    <div class="meta"><span>${esc(engLabel(t.engagement_id))}</span>${t.due_date ? `<span class="${over ? 'over' : ''}">${over ? 'Overdue · ' : 'Due '}${esc(nice(t.due_date))}</span>` : ''}${showWho ? `<span>👤 ${esc(nm(t.assignee))}</span>` : ''}</div>
  </div>`;
}

/* ---------- render: tab skeletons (forms are built once per tab visit) ---------- */
function renderTab() {
  const m = $('#main');
  if (S.tab === 'today') m.innerHTML = `
    <div class="hero"><div><h2 id="hello">Hello</h2><div class="muted">${esc(niceLong(today()))}</div></div>
      <button class="btn primary" data-act="tab" data-tab="time">+ Log time</button></div>
    <div class="stats" id="todayStats"></div><div id="todayList"></div>`;

  if (S.tab === 'tasks' && S.isMgr) m.innerHTML = `
    <details class="panel" id="newPanel" open><summary id="formTitle">New assignment</summary>
      <form id="taskForm" autocomplete="off">
        <input type="hidden" name="f_edit">
        <div class="grid">
          <div><label>Title *</label><input name="f_title" placeholder="e.g. Vouch March GRNs for spares" maxlength="200"></div>
          <div><label>Assign to * <span class="muted" style="font-weight:400">(pick several to give each person their own copy)</span></label><div class="chips" id="assignees"></div></div>
        </div>
        <div class="grid four" style="margin-top:10px">
          <div><label>Type</label><select name="f_type">${TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
          <div><label>Client · Engagement</label><select name="f_eng" id="fEng"></select></div>
          <div><label>Due date</label><input type="date" name="f_due" value="${today()}"></div>
          <div><label>Priority</label><select name="f_pri"><option>High</option><option selected>Medium</option><option>Low</option></select></div>
        </div>
        <div style="margin-top:10px"><label>Details / instructions</label><textarea name="f_details" placeholder="Scope, sample size, files to refer to, expected output…"></textarea></div>
        <div class="actions"><button class="btn primary" type="submit" id="taskSubmit">Assign</button><button class="btn" type="button" data-act="cancelEdit" id="cancelEdit" style="display:none">Cancel edit</button></div>
      </form>
    </details>
    <div class="filters">
      <select id="flWho"></select><select id="flEng"></select>
      <select id="flStatus"><option value="open">Open</option><option value="">All statuses</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}<option value="over">Overdue</option></select>
      <input id="flQ" placeholder="Search…">
    </div>
    <div id="taskList"></div>`;

  if (S.tab === 'tasks' && !S.isMgr) m.innerHTML = `
    <div class="hero"><h2>My tasks</h2>
      <select id="myFilter" style="width:auto"><option value="open">Open</option><option value="Done">Done</option><option value="">All</option></select></div>
    <div id="taskList"></div>`;

  if (S.tab === 'time') m.innerHTML = `
    <form class="panel" id="tsForm" autocomplete="off">
      <input type="hidden" name="t_edit">
      <div style="font-weight:600;margin-bottom:10px" id="tsFormTitle">Log work</div>
      <div class="grid four">
        <div><label>Date</label><input type="date" name="t_date" value="${today()}" max="${addDays(today(), 7)}"></div>
        <div><label>Client · Engagement</label><select name="t_eng" id="tEng"></select></div>
        <div><label>Linked task (optional)</label><select name="t_task" id="tTask"></select></div>
        <div><label>Hours *</label><input type="number" name="t_hrs" min="0.25" max="24" step="0.25" placeholder="e.g. 2.5" inputmode="decimal"></div>
      </div>
      <div style="margin-top:10px"><label>Work done *</label><textarea name="t_desc" placeholder="What did you work on? Areas covered, samples tested, status…"></textarea></div>
      <div class="actions"><button class="btn primary" type="submit" id="tsSubmit">Save entry</button><button class="btn" type="button" data-act="cancelTs" id="cancelTs" style="display:none">Cancel edit</button></div>
    </form>
    <div class="wknav">
      <button class="btn sm" data-act="wk" data-d="-7">‹</button><span class="lbl" id="wkLbl"></span><button class="btn sm" data-act="wk" data-d="7">›</button>
      <button class="btn sm" data-act="wk" data-d="0">This week</button>
      ${S.isMgr ? '<select id="tsWho"></select>' : ''}
    </div>
    <div id="tsSummary"></div><div id="tsList"></div>`;

  if (S.tab === 'team') m.innerHTML = `
    <div id="setupHint"></div>
    <div class="hero"><h2>Team view</h2></div>
    <div class="wknav"><button class="btn sm" data-act="td" data-d="-1">‹</button><span class="lbl" id="tdLbl"></span><button class="btn sm" data-act="td" data-d="1">›</button><button class="btn sm" data-act="td" data-d="0">Today</button></div>
    <div class="stats" id="teamStats"></div><div id="teamGrid"></div>`;

  if (S.tab === 'setup') m.innerHTML = `
    <div class="panel"><div style="font-weight:600">Team members</div>
      <p class="muted" style="margin:4px 0 10px">To add someone: Supabase dashboard → Authentication → Users → <b>Add user → Create new user</b> (tick auto-confirm), then send them the portal link, email and password. They appear here immediately. Rename them, make them a manager, or deactivate them below.</p>
      <div id="teamList"></div></div>
    <div class="panel"><div style="font-weight:600;margin-bottom:8px">Clients / organisations</div>
      <form id="clientForm" class="row" autocomplete="off"><input name="c_name" placeholder="e.g. Switch Mobility" style="flex:1;min-width:180px"><button class="btn primary">Add</button></form>
      <div id="clientList" style="margin-top:8px"></div></div>
    <div class="panel"><div style="font-weight:600;margin-bottom:8px">Engagements</div>
      <form id="engForm" class="grid three" autocomplete="off">
        <div><label>Client</label><select name="e_client" id="eClient"></select></div>
        <div><label>Engagement name</label><input name="e_name" placeholder="e.g. O2C Internal Audit FY26-27"></div>
        <div style="display:flex;align-items:flex-end"><button class="btn primary" style="width:100%">Add engagement</button></div>
      </form>
      <div id="engList" style="margin-top:8px"></div></div>`;

  bindTab();
  refresh();
}

function bindTab() {
  const f = $('#taskForm'); if (f) f.addEventListener('submit', e => { e.preventDefault(); submitTask(f); });
  const tf = $('#tsForm'); if (tf) tf.addEventListener('submit', e => { e.preventDefault(); submitTs(tf); });
  const cf = $('#clientForm'); if (cf) cf.addEventListener('submit', async e => {
    e.preventDefault(); const n = cf.elements.c_name.value.trim(); if (!n) return;
    if (await run(sb.from('clients').insert({ name: n }), 'Client added')) { cf.reset(); await loadAll(); refresh(); }
  });
  const ef = $('#engForm'); if (ef) ef.addEventListener('submit', async e => {
    e.preventDefault(); const c = ef.elements.e_client.value, n = ef.elements.e_name.value.trim();
    if (!c) return toast('Pick a client first'); if (!n) return toast('Name the engagement');
    if (await run(sb.from('engagements').insert({ client_id: c, name: n }), 'Engagement added')) { ef.elements.e_name.value = ''; await loadAll(); refresh(); }
  });
  ['flWho', 'flEng', 'flStatus'].forEach(id => { const el = $('#' + id); if (el) el.addEventListener('change', () => { S.taskFilter = { ...S.taskFilter, who: $('#flWho').value, eng: $('#flEng').value, status: $('#flStatus').value }; refresh(); }); });
  const q = $('#flQ'); if (q) q.addEventListener('input', () => { S.taskFilter.q = q.value.trim().toLowerCase(); refresh(); });
  if ($('#flStatus')) { $('#flStatus').value = S.taskFilter.status; $('#flQ').value = S.taskFilter.q; $('#flWho').dataset.want = S.taskFilter.who; $('#flEng').dataset.want = S.taskFilter.eng; }
  const mf = $('#myFilter'); if (mf) { mf.value = S.myFilter; mf.addEventListener('change', () => { S.myFilter = mf.value; refresh(); }); }
  const tw = $('#tsWho'); if (tw) { tw.dataset.want = S.tsWho; tw.addEventListener('change', () => { S.tsWho = tw.value; refresh(); }); }
}

/* ---------- render: data-driven parts ---------- */
function refresh() {
  if (!S.tab) return;
  const meP = S.people[S.me];
  $('#who').textContent = (meP?.full_name || meP?.email || '') + (S.isMgr ? ' · Manager' : '');

  if (S.tab === 'today') {
    $('#hello').textContent = 'Hello' + (meP?.full_name ? ', ' + meP.full_name.split(' ')[0] : '');
    const open = S.tasks.filter(t => t.assignee === S.me && t.status !== 'Done').sort(sortTasks);
    const over = open.filter(isOver), dueT = open.filter(t => t.due_date === today()), up = open.filter(t => t.due_date && t.due_date > today()), nod = open.filter(t => !t.due_date);
    const hrsToday = S.entries.filter(e => e.user_id === S.me && e.entry_date === today()).reduce((s, e) => s + (+e.hours || 0), 0);
    $('#todayStats').innerHTML = `<div class="stat ${over.length ? 'warn' : ''}"><b>${over.length}</b><span>Overdue</span></div><div class="stat"><b>${dueT.length}</b><span>Due today</span></div><div class="stat"><b>${open.length}</b><span>Open</span></div><div class="stat ${hrsToday ? '' : 'warn'}"><b>${hrsFmt(hrsToday)}h</b><span>Logged today</span></div>`;
    const sec = (title, arr) => arr.length ? `<h3>${title}</h3>` + arr.map(t => taskCard(t, false)).join('') : '';
    $('#todayList').innerHTML = open.length ? sec('Overdue', over) + sec('Due today', dueT) + sec('Upcoming', up) + sec('No due date', nod)
      : `<div class="empty">Nothing open on your list. ${S.isMgr ? 'Assign work from the Assignments tab.' : 'New assignments will show up here.'}</div>`;
  }

  if (S.tab === 'tasks') {
    let list;
    if (S.isMgr) {
      const box = $('#assignees');
      if (box) {
        const checked = new Set($$('#assignees input:checked').map(i => i.value).concat(box.dataset.want ? box.dataset.want.split(',') : []));
        delete box.dataset.want;
        box.innerHTML = memberIds().map(id => `<label class="chip"><input type="checkbox" value="${esc(id)}" ${checked.has(id) ? 'checked' : ''}>${esc(nm(id))}</label>`).join('');
      }
      fillEng($('#fEng'), 'General / internal');
      fillSelect($('#flWho'), memberIds().map(id => [id, nm(id)]), 'Everyone');
      fillEng($('#flEng'), 'All engagements');
      const f = S.taskFilter;
      list = S.tasks.filter(t =>
        (!f.who || t.assignee === f.who) && (!f.eng || t.engagement_id === f.eng) &&
        (f.status === '' ? true : f.status === 'open' ? t.status !== 'Done' : f.status === 'over' ? isOver(t) : t.status === f.status) &&
        (!f.q || (t.title + ' ' + t.details + ' ' + engLabel(t.engagement_id) + ' ' + nm(t.assignee)).toLowerCase().includes(f.q)));
    } else {
      list = S.tasks.filter(t => t.assignee === S.me && (S.myFilter === '' ? true : S.myFilter === 'open' ? t.status !== 'Done' : t.status === S.myFilter));
    }
    list.sort(sortTasks);
    $('#taskList').innerHTML = list.length ? `<div class="muted" style="margin-bottom:8px">${list.length} item${list.length > 1 ? 's' : ''}</div>` + list.map(t => taskCard(t, S.isMgr)).join('') : '<div class="empty">No assignments match.</div>';
  }

  if (S.tab === 'time') {
    fillEng($('#tEng'), 'General / internal');
    const cur = $('#tTask')?.dataset.want ?? $('#tTask')?.value;
    fillSelect($('#tTask'), S.tasks.filter(t => t.assignee === S.me && (t.status !== 'Done' || t.id === cur)).sort(sortTasks).map(t => [t.id, t.title]), '— None —');
    const ws = S.tsWeek, we = addDays(ws, 6);
    $('#wkLbl').textContent = nice(ws) + ' – ' + nice(we) + ' ' + parseD(we).getFullYear();
    if (S.isMgr) fillSelect($('#tsWho'), [['me', 'My timesheet'], ['all', 'Whole team'], ...teamIds().map(id => [id, nm(id)])]);
    const who = S.isMgr ? S.tsWho : 'me';
    const days = [...Array(7)].map((_, i) => addDays(ws, i));
    const inWeek = e => e.entry_date >= ws && e.entry_date <= we;
    const wk = S.entries.filter(inWeek);
    if (ws < addDays(today(), -HISTORY_DAYS)) toast(`Only the last ${HISTORY_DAYS} days are loaded`);

    if (who === 'all') {
      const ids = memberIds(); const tot = days.map(() => 0); let grand = 0;
      const rows = ids.map(id => {
        const per = days.map(d => wk.filter(e => e.user_id === id && e.entry_date === d).reduce((s, e) => s + (+e.hours || 0), 0));
        per.forEach((v, i) => tot[i] += v); const sum = per.reduce((a, b) => a + b, 0); grand += sum;
        return `<tr><td>${esc(nm(id))}</td>${per.map(v => `<td class="${v ? '' : 'zero'}">${v ? hrsFmt(v) : '–'}</td>`).join('')}<td><b>${hrsFmt(sum)}</b></td></tr>`;
      }).join('');
      $('#tsSummary').innerHTML = `<div class="tablewrap"><table><tr><th>Member</th>${days.map(d => `<th>${dow(d)} ${parseD(d).getDate()}</th>`).join('')}<th>Total</th></tr>${rows}<tr class="tot"><td>Total</td>${tot.map(v => `<td>${hrsFmt(v)}</td>`).join('')}<td>${hrsFmt(grand)}</td></tr></table></div>` + engTable(wk);
      $('#tsList').innerHTML = entriesHtml(wk, true);
    } else {
      const uid = who === 'me' ? S.me : who;
      const es = wk.filter(e => e.user_id === uid);
      const per = days.map(d => es.filter(e => e.entry_date === d).reduce((s, e) => s + (+e.hours || 0), 0));
      $('#tsSummary').innerHTML = `<div class="tablewrap"><table><tr>${days.map(d => `<th style="text-align:center">${dow(d)} ${parseD(d).getDate()}</th>`).join('')}<th>Week</th></tr><tr>${per.map(v => `<td style="text-align:center" class="${v ? '' : 'zero'}">${v ? hrsFmt(v) : '–'}</td>`).join('')}<td><b>${hrsFmt(per.reduce((a, b) => a + b, 0))}</b></td></tr></table></div>` + engTable(es);
      $('#tsList').innerHTML = entriesHtml(es, false);
    }
  }

  if (S.tab === 'team') {
    const d = S.teamDate;
    $('#tdLbl').textContent = niceLong(d);
    $('#setupHint').innerHTML = (!teamIds().length || !S.engs.length) ? `<div class="banner">Getting started: open <b>Setup</b> to add clients and engagements, and invite your team from Supabase. Then assign work from <b>Assignments</b>.</div>` : '';
    const ids = teamIds();
    let logged = 0, overT = 0, openT = 0;
    const weekday = parseD(d).getDay() % 6 !== 0;
    const cards = ids.map(id => {
      const es = S.entries.filter(e => e.user_id === id && e.entry_date === d);
      const h = es.reduce((s, e) => s + (+e.hours || 0), 0);
      const open = S.tasks.filter(t => t.assignee === id && t.status !== 'Done');
      const over = open.filter(isOver), dueD = open.filter(t => t.due_date === d), blocked = open.filter(t => t.status === 'Blocked');
      if (h) logged++; overT += over.length; openT += open.length;
      return `<div class="member">
        <div class="top"><div><div class="name">${esc(nm(id))}</div><div class="meta"><span>${open.length} open</span>${over.length ? `<span class="over">${over.length} overdue</span>` : ''}${blocked.length ? `<span class="over">${blocked.length} blocked</span>` : ''}</div></div>
          <div style="text-align:right"><div class="hrs ${!h && weekday && d <= today() ? 'none' : ''}">${hrsFmt(h)}h</div><div class="meta">logged</div></div></div>
        ${es.length ? `<ul class="mini">${es.map(e => `<li><b>${hrsFmt(+e.hours)}h</b> · ${esc(engLabel(e.engagement_id))} — ${esc(e.description)}</li>`).join('')}</ul>` : ''}
        ${over.length || dueD.length ? `<div class="mini muted" style="margin-top:6px">${[...over, ...dueD].slice(0, 4).map(t => `<div data-act="open" data-id="${esc(t.id)}" style="cursor:pointer">• ${esc(t.title)} <span class="${isOver(t) ? 'over' : ''}">(${isOver(t) ? 'overdue' : 'due'} ${esc(nice(t.due_date))})</span></div>`).join('')}</div>` : ''}
        <div class="actions" style="margin-top:8px"><button class="btn sm" data-act="assignTo" data-id="${esc(id)}">+ Assign</button><button class="btn sm" data-act="viewTs" data-id="${esc(id)}">Timesheet</button><button class="btn sm" data-act="viewTasks" data-id="${esc(id)}">Tasks</button></div>
      </div>`;
    }).join('');
    $('#teamStats').innerHTML = `<div class="stat"><b>${logged}/${ids.length}</b><span>Logged time</span></div><div class="stat ${overT ? 'warn' : ''}"><b>${overT}</b><span>Overdue tasks</span></div><div class="stat"><b>${openT}</b><span>Open tasks</span></div>`;
    $('#teamGrid').innerHTML = ids.length ? `<div class="grid two">${cards}</div>` : '<div class="empty">No team members yet. Invite them from Supabase (see Setup).</div>';
  }

  if (S.tab === 'setup') {
    const people = Object.values(S.people).sort((a, b) => (b.active - a.active) || nm(a.id).localeCompare(nm(b.id)));
    $('#teamList').innerHTML = people.map(p => `<div class="list-item" style="${p.active ? '' : 'opacity:.55'}">
        <span><b>${esc(p.full_name || '—')}</b> <span class="muted">${esc(p.email)}</span> ${p.role === 'manager' ? '<span class="pill s-inprogress">manager</span>' : ''} ${p.active ? '' : '<span class="pill">inactive</span>'}</span>
        <span class="row"><button class="btn sm" data-act="rename" data-id="${esc(p.id)}">Rename</button>
        ${p.id !== S.me ? `<button class="btn sm" data-act="toggleRole" data-id="${esc(p.id)}">${p.role === 'manager' ? 'Make member' : 'Make manager'}</button>
        <button class="btn sm ${p.active ? 'danger' : ''}" data-act="toggleActive" data-id="${esc(p.id)}">${p.active ? 'Deactivate' : 'Reactivate'}</button>` : ''}</span></div>`).join('');
    $('#clientList').innerHTML = S.clients.length ? [...S.clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => `<div class="list-item"><span>${esc(c.name)} <span class="muted">· ${S.engs.filter(e => e.client_id === c.id).length} engagement(s)</span></span><button class="btn sm danger" data-act="rmClient" data-id="${esc(c.id)}">Delete</button></div>`).join('') : '<div class="muted">No clients yet.</div>';
    fillSelect($('#eClient'), [...S.clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.id, c.name]), 'Select client');
    $('#engList').innerHTML = S.engs.length ? [...S.engs].sort((a, b) => engLabel(a.id).localeCompare(engLabel(b.id))).map(e => `<div class="list-item"><span style="${e.active ? '' : 'opacity:.5'}">${esc(engLabel(e.id))}${e.active ? '' : ' <span class="pill">closed</span>'}</span><span class="row"><button class="btn sm" data-act="toggleEng" data-id="${esc(e.id)}">${e.active ? 'Close' : 'Reopen'}</button><button class="btn sm danger" data-act="rmEng" data-id="${esc(e.id)}">Delete</button></span></div>`).join('') : '<div class="muted">No engagements yet.</div>';
  }

  if (S.openTask) renderModal(false);
}

function engTable(es) {
  if (!es.length) return '';
  const m = {}; es.forEach(e => { const k = e.engagement_id || ''; m[k] = (m[k] || 0) + (+e.hours || 0); });
  return `<div class="tablewrap"><table><tr><th>By engagement</th><th>Hours</th></tr>${Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(engLabel(k))}</td><td>${hrsFmt(v)}</td></tr>`).join('')}</table></div>`;
}
function entriesHtml(es, showWho) {
  if (!es.length) return '<div class="empty">No time logged this week.</div>';
  const byDate = {}; es.forEach(e => (byDate[e.entry_date] ||= []).push(e));
  return Object.keys(byDate).sort().reverse().map(d => {
    const list = byDate[d].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const tot = list.reduce((s, e) => s + (+e.hours || 0), 0);
    return `<div class="panel" style="padding:10px 12px"><div class="dayhead"><span>${esc(niceLong(d))}</span><span>${hrsFmt(tot)}h</span></div>` +
      list.map(e => {
        const t = S.tasks.find(x => x.id === e.task_id);
        return `<div class="entry"><div class="h">${hrsFmt(+e.hours)}h</div><div class="body">
          <div class="meta">${showWho ? `<span><b>${esc(nm(e.user_id))}</b></span>` : ''}<span>${esc(engLabel(e.engagement_id))}</span>${t ? `<span>↳ ${esc(t.title)}</span>` : ''}</div>
          <div class="desc">${esc(e.description)}</div></div>
          ${e.user_id === S.me ? `<div class="row" style="align-items:flex-start"><button class="btn sm" data-act="editTs" data-id="${esc(e.id)}">Edit</button><button class="btn sm danger" data-act="rmTs" data-id="${esc(e.id)}">✕</button></div>` : ''}</div>`;
      }).join('') + '</div>';
  }).join('');
}

/* ---------- forms ---------- */
async function submitTask(f) {
  const el = f.elements;
  const title = el.f_title.value.trim();
  if (!title) return toast('Add a title');
  const who = $$('#assignees input:checked').map(i => i.value);
  if (!who.length) return toast('Pick at least one team member');
  const base = { title, type: el.f_type.value, engagement_id: orNull(el.f_eng.value), due_date: orNull(el.f_due.value), priority: el.f_pri.value, details: el.f_details.value.trim() };
  const editId = el.f_edit.value;
  const btn = $('#taskSubmit'); btn.disabled = true;
  try {
    if (editId) {
      const ok = await run(sb.from('tasks').update({ ...base, assignee: who[0] }).eq('id', editId), 'Assignment updated');
      if (ok && who.length > 1) await run(sb.from('tasks').insert(who.slice(1).map(a => ({ ...base, assignee: a, assigned_by: S.me }))));
      if (ok) resetTaskForm();
    } else {
      const ok = await run(sb.from('tasks').insert(who.map(a => ({ ...base, assignee: a, assigned_by: S.me }))), `Assigned to ${who.length} member${who.length > 1 ? 's' : ''}`);
      if (ok) { el.f_title.value = ''; el.f_details.value = ''; }
    }
    await loadAll(); refresh();
  } finally { btn.disabled = false; }
}
function resetTaskForm() {
  const f = $('#taskForm'); if (!f) return;
  f.reset(); f.elements.f_edit.value = ''; f.elements.f_due.value = today();
  $('#formTitle').textContent = 'New assignment'; $('#taskSubmit').textContent = 'Assign'; $('#cancelEdit').style.display = 'none';
  $$('#assignees input').forEach(i => i.checked = false);
}
function editTask(t) {
  go('tasks');
  const f = $('#taskForm'), el = f.elements;
  el.f_edit.value = t.id; el.f_title.value = t.title; el.f_type.value = t.type;
  el.f_due.value = t.due_date || ''; el.f_pri.value = t.priority; el.f_details.value = t.details || '';
  $('#fEng').dataset.want = t.engagement_id || ''; fillEng($('#fEng'), 'General / internal');
  $$('#assignees input').forEach(i => i.checked = i.value === t.assignee);
  $('#formTitle').textContent = 'Edit assignment'; $('#taskSubmit').textContent = 'Save changes'; $('#cancelEdit').style.display = '';
  $('#newPanel').open = true; f.scrollIntoView({ behavior: 'smooth' });
}
function resetTsForm() {
  const f = $('#tsForm'); if (!f) return;
  f.reset(); f.elements.t_edit.value = ''; f.elements.t_date.value = today();
  $('#tsFormTitle').textContent = 'Log work'; $('#tsSubmit').textContent = 'Save entry'; $('#cancelTs').style.display = 'none';
}
async function submitTs(f) {
  const el = f.elements;
  const hours = parseFloat(el.t_hrs.value), description = el.t_desc.value.trim(), entry_date = el.t_date.value, editId = el.t_edit.value;
  if (!entry_date) return toast('Pick a date');
  if (!(hours > 0 && hours <= 24)) return toast('Enter hours between 0.25 and 24');
  if (!description) return toast('Describe the work done');
  const dayTot = S.entries.filter(e => e.user_id === S.me && e.entry_date === entry_date && e.id !== editId).reduce((s, e) => s + (+e.hours || 0), 0);
  if (dayTot + hours > 24) return toast('That would exceed 24h for the day');
  const row = { entry_date, engagement_id: orNull(el.t_eng.value), task_id: orNull(el.t_task.value), hours, description };
  const btn = $('#tsSubmit'); btn.disabled = true;
  try {
    const ok = editId ? await run(sb.from('time_entries').update(row).eq('id', editId), 'Entry updated')
                      : await run(sb.from('time_entries').insert({ ...row, user_id: S.me }), 'Time logged');
    if (ok) { resetTsForm(); S.tsWeek = weekStart(entry_date); S.tsWho = 'me'; if ($('#tsWho')) $('#tsWho').dataset.want = 'me'; await loadAll(); refresh(); }
  } finally { btn.disabled = false; }
}

/* ---------- task modal ---------- */
function renderModal(full) {
  const t = S.tasks.find(x => x.id === S.openTask);
  if (!t) { closeModal(); return; }
  const canStatus = S.isMgr || t.assignee === S.me;
  if (full) {
    $('#sheet').innerHTML = `<div id="mHead"></div>
      <div style="margin-top:10px"><textarea id="updText" placeholder="Post an update, question or instruction…"></textarea>
      <div class="actions"><button class="btn primary" data-act="postUpd">Post update</button>
      ${S.isMgr ? `<button class="btn" data-act="editTask">Edit</button><button class="btn danger" data-act="rmTask">Delete</button>` : ''}
      ${t.assignee === S.me ? `<button class="btn" data-act="logFor">Log time on this</button>` : ''}</div></div>
      <div id="mHist"><h3>Updates</h3><div class="muted">Loading…</div></div>`;
    $('#modal').classList.remove('hidden');
    loadUpdates(t.id);
  }
  $('#mHead').innerHTML = `<button class="close" data-act="close">✕</button>
    <div class="row"><span class="pill ty">${esc(t.type)}</span><span class="pill">${esc(t.priority)} priority</span></div>
    <h2 style="margin-top:8px">${esc(t.title)}</h2>
    <div class="meta"><span>${esc(engLabel(t.engagement_id))}</span>${t.due_date ? `<span class="${isOver(t) ? 'over' : ''}">Due ${esc(nice(t.due_date))}</span>` : ''}<span>👤 ${esc(nm(t.assignee))}</span><span>Assigned by ${esc(nm(t.assigned_by))} · ${esc(when(t.created_at))}</span></div>
    ${t.details ? `<div class="details">${esc(t.details)}</div>` : ''}
    <div class="statusbar">${STATUSES.map(s => `<button data-act="status" data-s="${s}" class="${t.status === s ? 'on' : ''}" ${canStatus ? '' : 'disabled'}>${s}</button>`).join('')}</div>`;
  const ups = S.updates[t.id];
  if (ups) $('#mHist').innerHTML = `<h3>Updates</h3>` + (ups.length ? ups.map(u => `<div class="upd"><div class="by">${esc(nm(u.author))} · ${esc(when(u.created_at))}</div><div style="white-space:pre-wrap">${esc(u.body)}</div></div>`).join('') : '<div class="muted">No updates yet.</div>');
}
function openModal(id) { S.openTask = id; renderModal(true); }
function closeModal() { S.openTask = null; $('#modal').classList.add('hidden'); }

function armed(btn) {
  if (btn.classList.contains('armed')) return true;
  btn.classList.add('armed'); btn._txt = btn.textContent; btn.textContent = 'Tap again';
  setTimeout(() => { btn.classList.remove('armed'); if (btn._txt) btn.textContent = btn._txt; }, 3000);
  return false;
}
async function after(ok) { if (ok) { await loadAll(); refresh(); } return ok; }

/* ---------- clicks ---------- */
document.addEventListener('click', async e => {
  if (e.target.id === 'modal') return closeModal();
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  const task = () => S.tasks.find(x => x.id === S.openTask);
  switch (a) {
    case 'tab': return go(b.dataset.tab);
    case 'open': return openModal(id);
    case 'close': return closeModal();
    case 'status': {
      const t = task(); const s = b.dataset.s; if (!t || t.status === s) return;
      if (await run(sb.from('tasks').update({ status: s }).eq('id', t.id))) {
        await run(sb.from('task_updates').insert({ task_id: t.id, author: S.me, body: `Status → ${s}` }));
        await after(true); loadUpdates(t.id);
      }
      return;
    }
    case 'postUpd': {
      const ta = $('#updText'), body = ta.value.trim(), t = task(); if (!body || !t) return;
      if (await run(sb.from('task_updates').insert({ task_id: t.id, author: S.me, body }), 'Update posted')) { ta.value = ''; await after(true); loadUpdates(t.id); }
      return;
    }
    case 'editTask': { const t = task(); closeModal(); if (t) editTask(t); return; }
    case 'rmTask': { if (!armed(b)) return; const tid = S.openTask; closeModal(); return after(await run(sb.from('tasks').delete().eq('id', tid), 'Assignment deleted')); }
    case 'logFor': {
      const t = task(); closeModal(); go('time');
      $('#tEng').dataset.want = t.engagement_id || ''; $('#tTask').dataset.want = t.id; refresh();
      $('#tsForm').elements.t_hrs.focus(); return;
    }
    case 'cancelEdit': return resetTaskForm();
    case 'cancelTs': return resetTsForm();
    case 'wk': { const d = +b.dataset.d; S.tsWeek = d ? addDays(S.tsWeek, d) : weekStart(today()); return refresh(); }
    case 'td': { const d = +b.dataset.d; S.teamDate = d ? addDays(S.teamDate, d) : today(); return refresh(); }
    case 'editTs': {
      const en = S.entries.find(x => x.id === id); if (!en) return;
      const el = $('#tsForm').elements;
      el.t_edit.value = en.id; el.t_date.value = en.entry_date; el.t_hrs.value = en.hours; el.t_desc.value = en.description;
      $('#tEng').dataset.want = en.engagement_id || ''; $('#tTask').dataset.want = en.task_id || ''; refresh();
      $('#tsFormTitle').textContent = 'Edit entry'; $('#tsSubmit').textContent = 'Save changes'; $('#cancelTs').style.display = '';
      $('#tsForm').scrollIntoView({ behavior: 'smooth' }); return;
    }
    case 'rmTs': if (!armed(b)) return; return after(await run(sb.from('time_entries').delete().eq('id', id), 'Entry deleted'));
    case 'assignTo': go('tasks'); $('#assignees').dataset.want = id; refresh(); $('#newPanel').open = true; $('#taskForm').elements.f_title.focus(); return;
    case 'viewTs': S.tsWho = id; S.tsWeek = weekStart(S.teamDate); return go('time');
    case 'viewTasks': S.taskFilter = { who: id, eng: '', status: 'open', q: '' }; return go('tasks');
    case 'rename': {
      const p = S.people[id]; const row = b.closest('.list-item');
      row.innerHTML = `<form class="row" style="flex:1" data-rename="${esc(id)}"><input name="n" value="${esc(p.full_name)}" style="flex:1"><button class="btn sm primary">Save</button></form>`;
      const form = row.querySelector('form'); form.elements.n.focus();
      form.addEventListener('submit', async ev => { ev.preventDefault(); const n = form.elements.n.value.trim(); if (!n) return; await after(await run(sb.from('profiles').update({ full_name: n }).eq('id', id), 'Name saved')); if (!S.people[id] || S.people[id].full_name !== n) refresh(); });
      return;
    }
    case 'toggleRole': { const p = S.people[id]; return after(await run(sb.from('profiles').update({ role: p.role === 'manager' ? 'member' : 'manager' }).eq('id', id), 'Role changed')); }
    case 'toggleActive': { const p = S.people[id]; if (p.active && !armed(b)) return; return after(await run(sb.from('profiles').update({ active: !p.active }).eq('id', id), p.active ? 'Deactivated — they can no longer see anything' : 'Reactivated')); }
    case 'rmClient':
      if (S.engs.some(x => x.client_id === id)) return toast('Delete its engagements first');
      if (!armed(b)) return; return after(await run(sb.from('clients').delete().eq('id', id), 'Client deleted'));
    case 'toggleEng': { const en = eng(id); return after(await run(sb.from('engagements').update({ active: !en.active }).eq('id', id))); }
    case 'rmEng':
      if (S.tasks.some(t => t.engagement_id === id) || S.entries.some(t => t.engagement_id === id)) return toast('This engagement has tasks or time logged — close it instead');
      if (!armed(b)) return; return after(await run(sb.from('engagements').delete().eq('id', id), 'Engagement deleted'));
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.openTask) closeModal(); });
$('#signOut').addEventListener('click', async () => { await sb?.auth.signOut(); });
$('#pwLink').addEventListener('click', showPasswordDialog);

/* ---------- boot ---------- */
let channel = null, booted = false;
async function boot(session) {
  if (!session) { booted = false; if (channel) { sb.removeChannel(channel); channel = null; } return showLogin(); }
  if (booted) return;
  booted = true;
  S.me = session.user.id;
  $('#signOut').style.display = ''; $('#pwLink').style.display = '';
  await loadAll();
  const me = S.people[S.me];
  if (!me) { $('#main').innerHTML = '<div class="empty">Your profile is being set up. Refresh in a moment.</div>'; booted = false; return; }
  if (!me.active) { $('#main').innerHTML = '<div class="empty">Your access has been deactivated. Contact your manager.</div>'; return; }
  channel = sb.channel('portal').on('postgres_changes', { event: '*', schema: 'public' }, payload => {
    scheduleReload();
    if (payload.table === 'task_updates' && S.openTask) loadUpdates(S.openTask);
  }).subscribe();
  const h = (location.hash || '').slice(1);
  go(tabs().some(t => t[0] === h) ? h : tabs()[0][0]);
}

if (!sb) {
  $('#main').innerHTML = '<div class="empty">This portal is not connected to a database yet. Put your Supabase URL and anon key in <code>config.js</code> — see README.md.</div>';
} else {
  sb.auth.onAuthStateChange((_evt, session) => { setTimeout(() => boot(session), 0); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && booted) scheduleReload(); });
}

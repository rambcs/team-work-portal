import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY, PORTAL_NAME } from './config.js';

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const z = n => String(n).padStart(2, '0');
const fmtDate = d => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
const today = () => fmtDate(new Date());
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return fmtDate(d); };
const weekStart = s => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmtDate(d); };
const nice = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const niceLong = s => parseD(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const niceMid = s => parseD(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const dow = s => parseD(s).toLocaleDateString('en-IN', { weekday: 'short' });
const nowHM = () => { const d = new Date(); return z(d.getHours()) + ':' + z(d.getMinutes()); };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hm = t => t ? t.slice(0, 5) : '';
const t12 = t => { if (!t) return '–'; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${z(m)} ${ap}`; };
const dur = mins => { if (mins == null || isNaN(mins)) return '–'; const neg = mins < 0; mins = Math.abs(Math.round(mins)); return `${neg ? '−' : ''}${Math.floor(mins / 60)}h ${z(mins % 60)}m`; };
const hrs = h => (Math.round(h * 100) / 100).toString();
const ago = ts => { const s = (Date.now() - new Date(ts)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
const stamp = ts => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const initials = n => (n || '?').split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const orNull = v => v ? v : null;
const isUrl = s => /^https:\/\/\S+$/i.test(s);
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const isOneDrive = u => /(sharepoint\.com|1drv\.ms|onedrive\.live\.com|onedrive\.com)$/i.test(hostOf(u));
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- icons ---------- */
const P = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.4c2.3.2 4 1.7 4.6 4.1"/>',
  tasks: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.3 1.3L7.3 5M3.5 12l1.3 1.3 2.5-2.3M3.5 18l1.3 1.3 2.5-2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  setup: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  cloud: '<path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.3 9.6 4.2 4.2 0 0 0 7 18z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  wa: '<path d="M4 20l1.2-3.6A8 8 0 1 1 8 19z"/><path d="M9.3 9.2c.3 2.6 2.6 5 5.4 5.4l1-1.3-1.8-1-1 .8c-1-.4-1.7-1.2-2.1-2.1l.8-1-1-1.8z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  out: '<path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4"/><path d="M10 16l-4-4 4-4M6 12h9"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c.8-3.4 3.5-5.5 7-5.5s6.2 2.1 7 5.5"/>',
  chat: '<path d="M5 5.5h14v10h-9l-4 3.5v-3.5H5z"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  inbox: '<path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z"/><path d="M4 13.5h5l1 2h4l1-2h5"/>',
};
const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const brandMark = `<svg class="brand-mark" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="7" fill="#2A6F6B"/><path d="M7 10h7M7 14h5M7 18h6" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/><path d="m14 15 2.6 2.8L22 10.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STATUSES = ['To do', 'In progress', 'Blocked', 'Done'];
const TYPES = ['Task', 'Area / Role', 'Instruction'];
const PRI = { High: 0, Medium: 1, Low: 2 };
function statusIcon(s, draw = false) {
  const lbl = `role="img" aria-label="${esc(s)}"`;
  if (s === 'Done') return `<svg class="st st-done${draw ? ' draw' : ''}" viewBox="0 0 20 20" ${lbl}><circle class="disc" cx="10" cy="10" r="8.5"/><path class="tick" d="m6.3 10.3 2.5 2.5 5-5.3"/></svg>`;
  if (s === 'In progress') return `<svg class="st st-prog" viewBox="0 0 20 20" ${lbl}><circle class="ring" cx="10" cy="10" r="7.5"/><path class="half" d="M10 4.5a5.5 5.5 0 0 1 0 11z"/></svg>`;
  if (s === 'Blocked') return `<svg class="st st-blocked" viewBox="0 0 20 20" ${lbl}><circle class="ring" cx="10" cy="10" r="7.5"/><path class="bar" d="M6.5 10h7"/></svg>`;
  return `<svg class="st st-todo" viewBox="0 0 20 20" ${lbl}><circle class="ring" cx="10" cy="10" r="7.5"/></svg>`;
}

/* ---------- toasts ---------- */
function toast(msg, action) {
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { action.fn(); kill(); }; t.append(b); }
  $('#toasts').append(t);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  setTimeout(kill, action ? 7000 : 3200);
}

/* =====================================================================
   State & data
   ===================================================================== */
const S = {
  me: null, isMgr: false, people: {}, clients: [], engs: [], tasks: [], entries: [], att: [], links: [], notifs: [],
  updates: {}, reportUpdates: {}, view: null, painted: new Set(),
  date: today(), timeWho: 'me', teamDate: today(), expanded: null,
  taskFilter: { q: '', who: '', eng: '', status: 'open' }, myFilter: 'open',
  report: { period: 'day', date: today() },
  openTask: null, sheet: null, justDone: null, editEntry: null,
  push: { supported: false, on: false }, nudgeOff: false,
};
const HISTORY_DAYS = 180;
const configured = SUPABASE_URL && !SUPABASE_URL.includes('YOUR-') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR-');
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function run(promise, okMsg) {
  const { data, error } = await promise;
  if (error) { toast(error.message || 'That didn’t save. Check your connection and try again.'); return null; }
  if (okMsg) toast(okMsg);
  return data ?? true;
}

async function loadAll() {
  const since = addDays(today(), -HISTORY_DAYS);
  const res = await Promise.all([
    sb.from('profiles').select('*').order('full_name'),
    sb.from('clients').select('*').order('name'),
    sb.from('engagements').select('*').order('name'),
    sb.from('tasks').select('*, task_updates(count)'),
    sb.from('time_entries').select('*').gte('entry_date', since),
    sb.from('attendance').select('*').gte('work_date', since),
    sb.from('task_links').select('*'),
    sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60),
  ]);
  const bad = res.find(r => r.error);
  if (bad) console.warn(bad.error);
  const [p, c, e, t, te, at, li, no] = res.map(r => r.data || []);
  S.people = Object.fromEntries(p.map(x => [x.id, x]));
  S.clients = c; S.engs = e;
  S.tasks = t.map(x => ({ ...x, n_updates: x.task_updates?.[0]?.count || 0 }));
  S.entries = te; S.att = at; S.links = li; S.notifs = no;
  const me = S.people[S.me];
  S.isMgr = !!(me && me.role === 'manager' && me.active);
}
let reloadT = null;
function scheduleReload() { clearTimeout(reloadT); reloadT = setTimeout(async () => { await loadAll(); paint(); }, 250); }
async function reload() { await loadAll(); paint(); }
async function loadUpdates(taskId) {
  const { data, error } = await sb.from('task_updates').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
  if (!error) { S.updates[taskId] = data; if (S.openTask === taskId) paintTaskSheet(); }
}

/* ---------- lookups ---------- */
const person = id => S.people[id];
const nm = id => { const p = person(id); return id ? (p?.full_name || p?.email?.split('@')[0] || 'Someone') : '—'; };
const nmYou = id => nm(id) + (id === S.me ? ' (you)' : '');
const avatar = (id, lg) => `<span class="avatar${lg ? ' lg' : ''}" title="${esc(nm(id))}">${esc(initials(nm(id)))}</span>`;
const eng = id => S.engs.find(e => e.id === id);
const client = id => S.clients.find(c => c.id === id);
function engLabel(id) { const e = eng(id); if (!e) return 'General / internal'; const c = client(e.client_id); return (c ? c.name + ' – ' : '') + e.name; }
const activePeople = () => Object.values(S.people).filter(p => p.active);
const byName = (a, b) => nm(a).localeCompare(nm(b));
const teamIds = () => activePeople().filter(p => p.id !== S.me).map(p => p.id).sort(byName);
const assignable = () => S.isMgr ? [S.me, ...teamIds()] : teamIds();
const isOver = t => t.due_date && t.status !== 'Done' && t.due_date < today();
const attOf = (uid, d) => S.att.find(a => a.user_id === uid && a.work_date === d);
const entriesOf = (uid, d) => S.entries.filter(e => e.user_id === uid && e.entry_date === d).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
const entryLabel = e => S.tasks.find(t => t.id === e.task_id)?.title || engLabel(e.engagement_id);
const linksOf = tid => S.links.filter(l => l.task_id === tid).sort((a, b) => a.created_at.localeCompare(b.created_at));
function sortTasks(a, b) {
  const da = a.status === 'Done', dbb = b.status === 'Done';
  if (da !== dbb) return da ? 1 : -1;
  const x = a.due_date || '9999', y = b.due_date || '9999';
  if (x !== y) return x < y ? -1 : 1;
  return (PRI[a.priority] ?? 1) - (PRI[b.priority] ?? 1);
}
function waNumber(id) { let d = (person(id)?.whatsapp || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d.length >= 11 ? d : ''; }
function waLink(id, t) {
  const first = nm(id).split(' ')[0];
  const msg = `Hi ${first}, a new ${t.type.toLowerCase()} is assigned to you on ${PORTAL_NAME}:\n*${t.title}*\n${engLabel(t.engagement_id)}${t.due_date ? `, due ${nice(t.due_date)}` : ''}\n${location.origin + location.pathname}#task-${t.id}`;
  return `https://wa.me/${waNumber(id)}?text=${encodeURIComponent(msg)}`;
}
function fillSelect(sel, opts, placeholder) {
  if (!sel || document.activeElement === sel) return;
  const v = sel.dataset.want ?? sel.value ?? '';
  sel.innerHTML = (placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '') + opts.map(([val, lab]) => `<option value="${esc(val)}">${esc(lab)}</option>`).join('');
  if ([...sel.options].some(o => o.value === v)) sel.value = v;
  delete sel.dataset.want;
}
function engOptions(selected, placeholder = 'General / internal') {
  let h = placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '';
  for (const c of [...S.clients].sort((a, b) => a.name.localeCompare(b.name))) {
    const es = S.engs.filter(e => e.client_id === c.id && (e.active || e.id === selected));
    if (es.length) h += `<optgroup label="${esc(c.name)}">` + es.map(e => `<option value="${e.id}" ${e.id === selected ? 'selected' : ''}>${esc(e.name)}</option>`).join('') + '</optgroup>';
  }
  return h;
}

/* =====================================================================
   Graphics: day ledger + week bars
   ===================================================================== */
function dayFigures(uid, d) {
  const a = attOf(uid, d), es = entriesOf(uid, d);
  const login = toMin(a?.login_at), logout = toMin(a?.logout_at);
  const live = d === today() && login != null && logout == null;
  const end = logout ?? (live ? Math.max(nowMin(), login) : null);
  const atWork = login != null && end != null ? end - login - (a?.break_mins || 0) : null;
  const logged = sum(es, e => Number(e.hours) * 60);
  return { a, es, login, logout, live, end, atWork, logged };
}
function ledgerHtml(uid, d, { compact = false, win = null } = {}) {
  const f = dayFigures(uid, d);
  let W0 = win?.[0] ?? 8 * 60, W1 = win?.[1] ?? 20 * 60;
  if (f.login != null) W0 = Math.min(W0, Math.floor(f.login / 60) * 60);
  const lastEnd = Math.max(f.end ?? 0, (f.login ?? 9 * 60) + f.logged);
  W1 = Math.max(W1, Math.ceil(lastEnd / 60) * 60);
  const pct = m => Math.max(0, Math.min(100, (m - W0) / (W1 - W0) * 100));
  let h = '';
  if (f.login != null) {
    const r = f.end ?? f.login + 2;
    h += `<div class="span tip" style="left:${pct(f.login)}%;width:${Math.max(.6, pct(r) - pct(f.login))}%" data-tip="${esc(`At work ${t12(f.a.login_at)} to ${f.logout != null ? t12(f.a.logout_at) : 'now'}`)}"></div>`;
  }
  let cur = f.login ?? 9 * 60;
  f.es.forEach((e, i) => {
    const w = Number(e.hours) * 60;
    const cls = ['seg-h', 'tip', i === 0 ? 'first' : '', i === f.es.length - 1 ? 'last' : ''].join(' ');
    h += `<div class="${cls}" style="--i:${i};left:${pct(cur)}%;width:${Math.max(.5, pct(cur + w) - pct(cur))}%" data-tip="${esc(`${entryLabel(e)}: ${hrs(e.hours)}h`)}"></div>`;
    cur += w;
  });
  if (f.live) h += `<div class="live" style="left:${pct(f.end)}%"></div>`;
  let ticks = '';
  for (let m = Math.ceil(W0 / 180) * 180; m <= W1; m += 180) ticks += `<span style="left:${pct(m)}%">${t12(z(Math.floor(m / 60)) + ':00').replace(':00', '')}</span>`;
  const grow = !reduceMotion && !S.painted.has(S.view) ? ' grow' : '';
  const label = f.login == null ? 'No login recorded' : `Logged ${dur(f.logged)} of ${dur(f.atWork)} at work`;
  return `<div class="ledger${compact ? ' compact' : ''}${grow}" role="img" aria-label="${esc(label)}"><div class="track">${h}</div><div class="ticks">${ticks}</div></div>`;
}
function weekBarsHtml(days, values, todayKey) {
  const W = 840, H = 170, padB = 24, padT = 22, n = days.length, slot = W / n, bw = Math.min(24, slot * .5);
  const max = Math.max(8, ...values);
  const y = v => H - padB - (v / max) * (H - padB - padT);
  const grow = !reduceMotion && !S.painted.has(S.view) ? ' grow' : '';
  let g = `<line class="base" x1="0" x2="${W}" y1="${H - padB + .5}" y2="${H - padB + .5}"/>`;
  days.forEach((d, i) => {
    const v = values[i], cx = slot * i + slot / 2, top = y(v), hgt = H - padB - top;
    if (v > 0) {
      const r = Math.min(4, hgt);
      g += `<path class="bar${d === todayKey ? ' today' : ''}${grow}" style="animation-delay:${i * 40}ms" d="M${cx - bw / 2},${H - padB} V${top + r} q0,-${r} ${r},-${r} h${bw - 2 * r} q${r},0 ${r},${r} V${H - padB} z"><title>${esc(`${niceMid(d)}: ${hrs(v)}h`)}</title></path>`;
      g += `<text class="val" x="${cx}" y="${top - 6}" text-anchor="middle">${hrs(v)}</text>`;
    }
    g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(dow(d))} ${parseD(d).getDate()}</text>`;
  });
  return `<svg class="weekbars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Hours logged per day">${g}</svg>`;
}

/* =====================================================================
   Shell
   ===================================================================== */
const root = () => $('#root');
function tabs() {
  return S.isMgr
    ? [['team', 'Team', 'team'], ['tasks', 'Assignments', 'tasks'], ['time', 'Timesheets', 'clock'], ['today', 'My day', 'sun'], ['reports', 'Reports', 'chart'], ['setup', 'Setup', 'setup']]
    : [['today', 'My day', 'sun'], ['tasks', 'My tasks', 'tasks'], ['time', 'Timesheet', 'clock']];
}
function renderShell() {
  root().innerHTML = `<div class="app">
    <aside class="rail">
      <div class="brand">${brandMark}<span>${esc(PORTAL_NAME)}</span></div>
      <nav class="nav" id="nav" aria-label="Main"></nav>
      <div class="rail-foot"><button class="me-btn" data-act="profile">${avatar(S.me)}<span class="who"><b>${esc(nm(S.me))}</b><span>${S.isMgr ? 'Manager' : 'Team member'}</span></span></button></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="brand mobile-only">${brandMark}</div>
        <div class="spacer"></div>
        <button class="icon-btn" data-act="notifs" aria-label="Notifications">${ico('bell')}<span class="badge" id="badge" hidden></span></button>
        <button class="icon-btn mobile-only" data-act="profile" aria-label="Profile">${ico('user')}</button>
      </header>
      <main id="view"></main>
    </div>
    <nav class="tabbar" id="tabbar" aria-label="Main"></nav>
  </div>`;
}
function renderNav() {
  const t = tabs();
  $('#nav').innerHTML = t.map(([k, l, i]) => `<button data-act="go" data-view="${k}" class="${S.view === k ? 'on' : ''}">${ico(i)}<span>${l}</span></button>`).join('');
  $('#tabbar').innerHTML = t.filter(x => x[0] !== 'setup').slice(0, 5).map(([k, l, i]) => `<button data-act="go" data-view="${k}" class="${S.view === k ? 'on' : ''}">${ico(i)}<span>${l}</span></button>`).join('');
}
function paintBadge(pop) {
  const n = S.notifs.filter(x => !x.read_at).length, b = $('#badge'); if (!b) return;
  b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
  if (pop) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
}
const VIEWS = {};
function go(view) {
  if (!tabs().some(t => t[0] === view)) view = tabs()[0][0];
  S.view = view; S.editEntry = null;
  try { history.replaceState(null, '', '#' + view); } catch (e) {}
  renderNav();
  VIEWS[view].mount();
  paint();
  window.scrollTo(0, 0);
}
function paint() {
  if (!S.view) return;
  const v = VIEWS[S.view]; v.paint();
  S.painted.add(S.view);
  paintBadge();
  if (S.sheet === 'task') paintTaskSheet();
  if (S.sheet === 'notifs') paintNotifs();
}

/* =====================================================================
   View: My day
   ===================================================================== */
function taskRow(t, showWho) {
  const due = t.status === 'Done' ? `<span class="chip done">Done</span>`
    : t.status === 'Blocked' ? `<span class="chip blocked">Blocked</span>`
    : isOver(t) ? `<span class="chip over">Overdue, ${nice(t.due_date)}</span>`
    : t.due_date === today() ? `<span class="chip ledger">Due today</span>`
    : t.due_date ? `<span class="chip">Due ${nice(t.due_date)}</span>` : '';
  const nl = linksOf(t.id).length;
  return `<div class="row${t.status === 'Done' ? ' done' : ''}" data-act="open" data-id="${t.id}" tabindex="0">
    ${statusIcon(t.status)}
    <div style="min-width:0"><div class="t">${esc(t.title)}</div>
      <div class="meta"><span class="m">${esc(engLabel(t.engagement_id))}</span>${t.type !== 'Task' ? `<span class="m">${esc(t.type)}</span>` : ''}${nl ? `<span class="m">${ico('link')}${nl}</span>` : ''}${t.n_updates ? `<span class="m">${ico('chat')}${t.n_updates}</span>` : ''}</div></div>
    <div class="right">${t.priority === 'High' && t.status !== 'Done' ? '<span class="chip high">High</span>' : ''}${due}${showWho ? avatar(t.assignee) : ''}</div>
  </div>`;
}
function emptyState(title, text, icon = 'inbox') { return `<div class="empty">${ico(icon)}<b>${esc(title)}</b>${esc(text)}</div>`; }

function dayCard(uid, d, own) {
  const f = dayFigures(uid, d);
  const unlogged = f.atWork != null ? f.atWork - f.logged : null;
  let actions = '';
  if (own && d === today()) {
    actions = f.login == null ? `<button class="btn accent" data-act="clockIn">${ico('play')}Log in</button>`
      : f.logout == null ? `<button class="btn primary" data-act="clockOut">${ico('stop')}Log out</button>` : '';
  }
  return `<div class="daycard">
    <div class="clock">
      <div><div class="k">Logged in</div><div class="v${f.login == null ? ' muted' : ''}">${f.login == null ? '–' : t12(f.a.login_at)}</div></div>
      <div><div class="k">Logged out</div><div class="v${f.logout == null ? ' muted' : ''}">${f.logout == null ? (f.live ? 'Working' : '–') : t12(f.a.logout_at)}</div></div>
    </div>
    <div>${ledgerHtml(uid, d)}
      <div class="day-stats"><span>At work <b>${dur(f.atWork)}</b></span><span>Logged to tasks <b>${dur(f.logged)}</b></span>${unlogged != null && unlogged > 15 ? `<span class="warn">Not yet logged <b>${dur(unlogged)}</b></span>` : ''}${f.a?.break_mins ? `<span>Break <b>${f.a.break_mins}m</b></span>` : ''}</div>
    </div>
  </div>${actions ? `<div style="display:flex;gap:8px;margin-top:16px">${actions}<button class="btn ghost" data-act="go" data-view="time">Add task hours</button></div>` : ''}`;
}

VIEWS.today = {
  mount() {
    $('#view').innerHTML = `
      <div class="page-head"><div><h1 id="hello"></h1><div class="sub">${esc(niceLong(today()))}</div></div></div>
      <div id="nudge"></div>
      <section class="panel pad" id="dayCard" aria-label="Your day"></section>
      <div id="todayTasks"></div>`;
  },
  paint() {
    $('#hello').textContent = `${greeting()}, ${nm(S.me).split(' ')[0]}`;
    $('#nudge').innerHTML = S.push.supported && !S.push.on && !S.nudgeOff
      ? `<div class="banner">${ico('bell')}<span class="grow">Turn on alerts to hear about new tasks and updates, even when the portal is closed.</span><button class="btn sm accent" data-act="pushOn">Turn on alerts</button><button class="btn sm ghost" data-act="nudgeOff" aria-label="Dismiss">${ico('x')}</button></div>` : '';
    $('#dayCard').innerHTML = dayCard(S.me, today(), true);
    const open = S.tasks.filter(t => t.assignee === S.me && t.status !== 'Done').sort(sortTasks);
    const groups = [['Overdue', open.filter(isOver)], ['Due today', open.filter(t => t.due_date === today())], ['Coming up', open.filter(t => t.due_date && t.due_date > today())], ['No due date', open.filter(t => !t.due_date)]];
    $('#todayTasks').innerHTML = open.length
      ? groups.filter(g => g[1].length).map(([l, a]) => `<h2 class="sec">${l}<span class="count">${a.length}</span></h2><div class="panel rows">${a.map(t => taskRow(t)).join('')}</div>`).join('')
      : `<h2 class="sec">Your tasks</h2><div class="panel">${emptyState('Nothing open', S.isMgr ? ' Assign work from Assignments.' : ' New assignments will appear here.', 'tasks')}</div>`;
  },
};

/* =====================================================================
   View: Assignments / My tasks
   ===================================================================== */
VIEWS.tasks = {
  mount() {
    const f = S.taskFilter;
    $('#view').innerHTML = S.isMgr ? `
      <div class="page-head"><div><h1>Assignments</h1><div class="sub" id="taskSub"></div></div>
        <button class="btn primary" data-act="newTask">${ico('plus')}New assignment</button></div>
      <div class="toolbar">
        <label class="search">${ico('search')}<input id="flQ" placeholder="Search tasks, people, engagements" value="${esc(f.q)}" aria-label="Search"></label>
        <select id="flWho" aria-label="Person" data-want="${esc(f.who)}"></select>
        <select id="flEng" aria-label="Engagement">${engOptions(f.eng, 'All engagements')}</select>
        <div class="seg" id="flStatus">${[['open', 'Open'], ['over', 'Overdue'], ['Blocked', 'Blocked'], ['Done', 'Done'], ['', 'All']].map(([v, l]) => `<button data-act="flStatus" data-v="${v}" class="${f.status === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="panel rows" id="taskList"></div>` : `
      <div class="page-head"><div><h1>My tasks</h1><div class="sub" id="taskSub"></div></div>
        <div class="seg">${[['open', 'Open'], ['Done', 'Done'], ['', 'All']].map(([v, l]) => `<button data-act="myFilter" data-v="${v}" class="${S.myFilter === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="panel rows" id="taskList"></div>`;
    if (S.isMgr) {
      $('#flQ').addEventListener('input', e => { S.taskFilter.q = e.target.value.trim().toLowerCase(); VIEWS.tasks.paint(); });
      $('#flWho').addEventListener('change', e => { S.taskFilter.who = e.target.value; VIEWS.tasks.paint(); });
      $('#flEng').addEventListener('change', e => { S.taskFilter.eng = e.target.value; VIEWS.tasks.paint(); });
    }
  },
  paint() {
    let list;
    if (S.isMgr) {
      fillSelect($('#flWho'), assignable().map(id => [id, nmYou(id)]), 'Everyone');
      const f = S.taskFilter;
      list = S.tasks.filter(t =>
        (!f.who || t.assignee === f.who) && (!f.eng || t.engagement_id === f.eng) &&
        (f.status === '' ? true : f.status === 'open' ? t.status !== 'Done' : f.status === 'over' ? isOver(t) : t.status === f.status) &&
        (!f.q || [t.title, t.details, engLabel(t.engagement_id), nm(t.assignee)].join(' ').toLowerCase().includes(f.q)));
      const open = S.tasks.filter(t => t.status !== 'Done');
      $('#taskSub').textContent = `${open.length} open, ${open.filter(isOver).length} overdue, ${open.filter(t => t.status === 'Blocked').length} blocked`;
    } else {
      const mine = S.tasks.filter(t => t.assignee === S.me);
      list = mine.filter(t => S.myFilter === '' ? true : S.myFilter === 'open' ? t.status !== 'Done' : t.status === S.myFilter);
      $('#taskSub').textContent = `${mine.filter(t => t.status !== 'Done').length} open, ${mine.filter(t => t.status === 'Done').length} done`;
    }
    list.sort(sortTasks);
    $('#taskList').innerHTML = list.length ? list.map(t => taskRow(t, S.isMgr)).join('')
      : emptyState('No tasks here', S.isMgr ? ' Try another filter, or create a new assignment.' : ' Try another filter.', 'tasks');
  },
};

/* =====================================================================
   View: Timesheet
   ===================================================================== */
VIEWS.time = {
  mount() {
    const who = S.isMgr ? S.timeWho : 'me', d = S.date;
    const uid = who === 'me' ? S.me : who, own = uid === S.me;
    const head = `<div class="page-head"><div><h1>${S.isMgr ? 'Timesheets' : 'Timesheet'}</h1><div class="sub">${esc(niceLong(d))}</div></div>
      <div class="toolbar" style="margin:0">
        <div class="datenav"><button class="btn" data-act="tsDay" data-d="-1" aria-label="Previous day">${ico('left')}</button><button class="btn" data-act="tsDay" data-d="0">Today</button><button class="btn" data-act="tsDay" data-d="1" aria-label="Next day">${ico('right')}</button></div>
        ${S.isMgr ? `<select id="tsWho" aria-label="Whose timesheet">${[['me', 'My timesheet'], ...teamIds().map(id => [id, nm(id)]), ['all', 'Whole team, this week']].map(([v, l]) => `<option value="${v}" ${v === who ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
      </div></div>`;
    if (who === 'all') {
      $('#view').innerHTML = head + `<div id="teamWeek"></div>`;
    } else {
      const a = attOf(uid, d);
      $('#view').innerHTML = head + `
        <h2 class="sec" style="margin-top:0">Login and logout</h2>
        <section class="panel pad">
          ${own ? `<form id="attForm" class="grid g4 keep2" style="align-items:end;margin-bottom:18px">
            <label class="field"><span>Logged in</span><input type="time" name="login" value="${hm(a?.login_at)}"></label>
            <label class="field"><span>Logged out</span><input type="time" name="logout" value="${hm(a?.logout_at)}"></label>
            <label class="field"><span>Break <em>(minutes)</em></span><input type="number" name="brk" min="0" max="600" step="5" value="${a?.break_mins ?? 0}"></label>
            <div style="display:flex;gap:8px"><button class="btn primary" type="submit">Save times</button>${d === today() ? (a?.login_at ? (a?.logout_at ? '' : `<button class="btn" type="button" data-act="clockOut">Log out now</button>`) : `<button class="btn" type="button" data-act="clockIn">Log in now</button>`) : ''}</div>
          </form>` : ''}
          <div id="attView"></div>
        </section>
        <h2 class="sec">Time by task<span class="count" id="entryTotal"></span></h2>
        <section class="panel">
          <div class="rows" id="entryList"></div>
          ${own ? `<form id="entryForm" class="addrow" autocomplete="off">
            <label class="field wide"><span id="entryFormTitle">Task</span><select name="task" id="eTask"></select></label>
            <label class="field"><span>Hours</span><input type="number" name="hours" min="0.25" max="24" step="0.25" inputmode="decimal" placeholder="2.5"></label>
            <label class="field wide"><span>Remarks <em>(optional)</em></span><input name="desc" maxlength="4000" placeholder="What you covered"></label>
            <div style="display:flex;gap:6px"><button class="btn accent" type="submit" id="entrySubmit">Add</button><button class="btn ghost" type="button" data-act="cancelEntry" id="cancelEntry" hidden>Cancel</button></div>
          </form>` : ''}
        </section>
        <h2 class="sec">This week<span class="count" id="weekTotal"></span></h2>
        <section class="panel pad" id="weekChart"></section>`;
    }
    $('#tsWho')?.addEventListener('change', e => { S.timeWho = e.target.value; go('time'); });
  },
  paint() {
    const who = S.isMgr ? S.timeWho : 'me', d = S.date;
    const ws = weekStart(d), days = [...Array(7)].map((_, i) => addDays(ws, i));
    if (who === 'all') {
      const ids = assignable();
      const per = id => days.map(x => sum(S.entries.filter(e => e.user_id === id && e.entry_date === x), e => Number(e.hours)));
      const tot = days.map(x => sum(S.entries.filter(e => e.entry_date === x && ids.includes(e.user_id)), e => Number(e.hours)));
      const rows = ids.map(id => { const p = per(id); return `<tr><td><span style="display:inline-flex;gap:8px;align-items:center">${avatar(id)}${esc(nmYou(id))}</span></td>${p.map((v, i) => { const a = attOf(id, days[i]); return `<td class="r">${v ? `<b>${hrs(v)}</b>` : '<span class="zero">–</span>'}${a?.login_at ? `<div class="note">${hm(a.login_at)}–${hm(a.logout_at) || '…'}</div>` : ''}</td>`; }).join('')}<td class="r"><b>${hrs(sum(p))}</b></td></tr>`; }).join('');
      $('#teamWeek').innerHTML = `
        <h2 class="sec" style="margin-top:0">Week of ${esc(nice(ws))}<span class="count">${hrs(sum(tot))} hours</span></h2>
        <section class="panel pad">${weekBarsHtml(days, tot, today())}</section>
        <h2 class="sec">By person</h2>
        <section class="panel tablewrap"><table><tr><th>Member</th>${days.map(x => `<th class="r">${dow(x)} ${parseD(x).getDate()}</th>`).join('')}<th class="r">Total</th></tr>${rows}
          <tr class="tot"><td>Total</td>${tot.map(v => `<td class="r">${hrs(v)}</td>`).join('')}<td class="r">${hrs(sum(tot))}</td></tr></table></section>`;
      return;
    }
    const uid = who === 'me' ? S.me : who, own = uid === S.me;
    $('#attView').innerHTML = own ? `${ledgerHtml(uid, d)}<div class="day-stats">${(() => { const f = dayFigures(uid, d); const un = f.atWork != null ? f.atWork - f.logged : null; return `<span>At work <b>${dur(f.atWork)}</b></span><span>Logged to tasks <b>${dur(f.logged)}</b></span>${un != null && un > 15 ? `<span class="warn">Not yet logged <b>${dur(un)}</b></span>` : ''}`; })()}</div>` : dayCard(uid, d, false);
    const es = entriesOf(uid, d);
    $('#entryTotal').textContent = es.length ? `${hrs(sum(es, e => Number(e.hours)))} hours` : '';
    $('#entryList').innerHTML = es.length ? es.map(e => {
      const t = S.tasks.find(x => x.id === e.task_id);
      return `<div class="entry"><div class="h">${hrs(e.hours)}h</div><div style="min-width:0">
        <div class="t" style="font-weight:500">${esc(t ? t.title : 'Other work')}</div>
        <div class="meta"><span class="m">${esc(engLabel(e.engagement_id))}</span></div>
        ${e.description ? `<div class="desc">${esc(e.description)}</div>` : ''}</div>
        ${own ? `<div class="right"><button class="btn sm ghost" data-act="editEntry" data-id="${e.id}" aria-label="Edit">${ico('edit')}</button><button class="btn sm ghost danger" data-act="rmEntry" data-id="${e.id}" aria-label="Delete">${ico('trash')}</button></div>` : '<span></span>'}</div>`;
    }).join('') : emptyState('No task hours yet', own ? ' Add each task you worked on and the hours spent.' : ' Nothing logged for this day.', 'clock');
    if (own) {
      const sel = $('#eTask');
      if (sel && document.activeElement !== sel) {
        const want = sel.dataset.want ?? sel.value;
        const mine = S.tasks.filter(t => t.assignee === S.me && (t.status !== 'Done' || t.id === want)).sort(sortTasks);
        let h = mine.length ? `<optgroup label="My tasks">${mine.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</optgroup>` : '';
        h += `<optgroup label="Other work">` + [['eng:', 'General / internal'], ...S.engs.filter(e => e.active).map(e => ['eng:' + e.id, engLabel(e.id)])].map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('') + '</optgroup>';
        sel.innerHTML = h;
        if ([...sel.options].some(o => o.value === want)) sel.value = want;
        delete sel.dataset.want;
      }
    }
    const per = days.map(x => sum(S.entries.filter(e => e.user_id === uid && e.entry_date === x), e => Number(e.hours)));
    $('#weekTotal').textContent = `${hrs(sum(per))} hours`;
    $('#weekChart').innerHTML = weekBarsHtml(days, per, today());
  },
};

/* =====================================================================
   View: Team (manager)
   ===================================================================== */
VIEWS.team = {
  mount() {
    $('#view').innerHTML = `
      <div id="setupHint"></div>
      <div class="page-head"><div><h1>Team</h1><div class="sub" id="teamSub"></div></div>
        <div class="datenav"><button class="btn" data-act="tmDay" data-d="-1" aria-label="Previous day">${ico('left')}</button><button class="btn" data-act="tmDay" data-d="0">Today</button><button class="btn" data-act="tmDay" data-d="1" aria-label="Next day">${ico('right')}</button></div></div>
      <div class="stats" id="teamStats"></div>
      <section class="panel rows" id="teamRows" style="margin-top:14px"></section>`;
  },
  paint() {
    const d = S.teamDate, ids = teamIds();
    $('#teamSub').textContent = niceLong(d);
    $('#setupHint').innerHTML = !ids.length || !S.engs.length ? `<div class="banner">${ico('setup')}<span class="grow">Add your clients, engagements and team in Setup, then assign work from Assignments.</span><button class="btn sm" data-act="go" data-view="setup">Open Setup</button></div>` : '';
    const figs = Object.fromEntries(ids.map(id => [id, dayFigures(id, d)]));
    const logins = ids.map(id => figs[id].login).filter(x => x != null), ends = ids.map(id => figs[id].end).filter(x => x != null);
    const win = [Math.min(8 * 60, ...logins.map(m => Math.floor(m / 60) * 60)), Math.max(20 * 60, ...ends.map(m => Math.ceil(m / 60) * 60))];
    const open = S.tasks.filter(t => t.status !== 'Done' && ids.includes(t.assignee));
    $('#teamStats').innerHTML = `
      <div class="stat"><b>${logins.length} of ${ids.length}</b><span>logged in</span></div>
      <div class="stat"><b>${hrs(sum(ids, id => figs[id].logged) / 60)}h</b><span>logged to tasks</span></div>
      <div class="stat${open.filter(isOver).length ? ' warn' : ''}"><b>${open.filter(isOver).length}</b><span>overdue tasks</span></div>
      <div class="stat"><b>${open.filter(t => t.status === 'Blocked').length}</b><span>blocked</span></div>`;
    $('#teamRows').innerHTML = ids.length ? ids.map(id => {
      const f = figs[id], mine = open.filter(t => t.assignee === id), over = mine.filter(isOver), blocked = mine.filter(t => t.status === 'Blocked');
      const weekday = parseD(d).getDay() % 6 !== 0;
      const exp = S.expanded === id;
      return `<div><div class="member-row" data-act="expand" data-id="${id}" tabindex="0" aria-expanded="${exp}">
          <div class="who">${avatar(id, true)}<div style="min-width:0"><b>${esc(nm(id))}</b><span>${f.login == null ? 'No login' : `${t12(f.a.login_at)} to ${f.logout != null ? t12(f.a.logout_at) : 'now'}`}</span></div></div>
          ${ledgerHtml(id, d, { compact: true, win })}
          <div class="hrs${!f.logged && weekday && d <= today() ? ' none' : ''}">${hrs(f.logged / 60)}h</div>
          <div class="flags"><span class="chip">${mine.length} open</span>${over.length ? `<span class="chip over">${over.length} overdue</span>` : ''}${blocked.length ? `<span class="chip blocked">${blocked.length} blocked</span>` : ''}</div>
        </div>
        ${exp ? `<div class="member-detail">
          <div><h4>Time logged</h4>${f.es.length ? `<ul>${f.es.map(e => `<li><b>${hrs(e.hours)}h</b> ${esc(entryLabel(e))}${e.description ? `<div class="note">${esc(e.description)}</div>` : ''}</li>`).join('')}</ul>` : '<div class="note">Nothing logged.</div>'}</div>
          <div><h4>Needs attention</h4>${[...over, ...blocked.filter(t => !over.includes(t)), ...mine.filter(t => t.due_date === d)].length ? `<ul>${[...new Set([...over, ...blocked, ...mine.filter(t => t.due_date === d)])].slice(0, 6).map(t => `<li><a href="#" data-act="open" data-id="${t.id}">${esc(t.title)}</a> <span class="note">${t.status === 'Blocked' ? 'blocked' : isOver(t) ? 'overdue ' + nice(t.due_date) : 'due today'}</span></li>`).join('')}</ul>` : '<div class="note">Nothing overdue or blocked.</div>'}</div>
          <div class="actions"><button class="btn sm" data-act="newTask" data-who="${id}">${ico('plus')}Assign</button><button class="btn sm" data-act="viewTs" data-id="${id}">${ico('clock')}Timesheet</button><button class="btn sm" data-act="viewTasks" data-id="${id}">${ico('tasks')}Tasks</button>${waNumber(id) ? `<a class="btn sm wa" href="https://wa.me/${waNumber(id)}" target="_blank" rel="noopener">${ico('wa')}WhatsApp</a>` : ''}</div>
        </div>` : ''}</div>`;
    }).join('') : emptyState('No team members yet', ' Create logins in Supabase, then they appear here.', 'team');
  },
};

/* =====================================================================
   View: Reports (manager)
   ===================================================================== */
function reportRange() { const r = S.report; return r.period === 'day' ? [r.date, r.date] : [weekStart(r.date), addDays(weekStart(r.date), 6)]; }
async function loadReportUpdates() {
  const [from, to] = reportRange(), key = from + to;
  if (S.reportUpdates[key]) return S.reportUpdates[key];
  const { data } = await sb.from('task_updates').select('task_id,author,status_to,body,link_url,created_at')
    .gte('created_at', new Date(parseD(from)).toISOString()).lt('created_at', new Date(parseD(addDays(to, 1))).toISOString());
  S.reportUpdates[key] = data || [];
  if (S.view === 'reports') VIEWS.reports.paint();
  return S.reportUpdates[key];
}
function reportData() {
  const [from, to] = reportRange(), key = from + to, ups = S.reportUpdates[key];
  const ids = activePeople().filter(p => p.role === 'member' || S.entries.some(e => e.user_id === p.id && e.entry_date >= from && e.entry_date <= to)).map(p => p.id).sort(byName);
  const days = []; for (let x = from; x <= to; x = addDays(x, 1)) days.push(x);
  const openOf = id => S.tasks.filter(t => t.assignee === id && t.status !== 'Done');
  return { from, to, ids, days, ups, openOf };
}
VIEWS.reports = {
  mount() {
    const me = person(S.me);
    $('#view').innerHTML = `
      <div class="page-head"><div><h1>Reports</h1><div class="sub" id="repSub"></div></div>
        <div class="toolbar" style="margin:0">
          <div class="seg">${[['day', 'Day'], ['week', 'Week']].map(([v, l]) => `<button data-act="repPeriod" data-v="${v}" class="${S.report.period === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="datenav"><button class="btn" data-act="repStep" data-d="-1" aria-label="Previous">${ico('left')}</button><button class="btn" data-act="repStep" data-d="0">Now</button><button class="btn" data-act="repStep" data-d="1" aria-label="Next">${ico('right')}</button></div>
        </div></div>
      <div class="banner">${ico('mail')}<span class="grow">${me?.summary_email ? `Summaries are emailed to <b>${esc(me.summary_email)}</b> every day at 7:00 pm (Mon–Sat) and weekly on Saturday at 7:15 pm.` : 'Add your email in Profile to receive the daily and weekly summary emails.'}</span>
        ${me?.summary_email ? `<button class="btn sm" data-act="emailReport">${ico('mail')}Email me this summary</button>` : `<button class="btn sm" data-act="profile">Open Profile</button>`}
        <button class="btn sm" data-act="csv">${ico('download')}Download CSV</button></div>
      <div id="repBody"></div>`;
    loadReportUpdates();
  },
  paint() {
    const R = reportData(), { from, to, ids, days, ups, openOf } = R;
    $('#repSub').textContent = S.report.period === 'day' ? niceLong(from) : `Week of ${nice(from)} to ${nice(to)}`;
    if (!ups) { $('#repBody').innerHTML = `<div class="panel">${emptyState('Loading', ' Gathering updates for this period.', 'chart')}</div>`; return; }
    if (S.report.period === 'day') {
      const rows = ids.map(id => {
        const f = dayFigures(id, from), byTask = new Map();
        f.es.forEach(e => byTask.set(entryLabel(e), (byTask.get(entryLabel(e)) || 0) + Number(e.hours)));
        const myUps = ups.filter(u => u.author === id), o = openOf(id), ov = o.filter(isOver);
        return `<tr><td><b>${esc(nm(id))}</b></td>
          <td class="c">${f.login == null ? '<span class="chip over">No login</span>' : t12(f.a.login_at)}</td>
          <td class="c">${f.logout == null ? (f.live ? 'Working' : '–') : t12(f.a.logout_at)}</td>
          <td class="r">${dur(f.atWork)}</td><td class="r"><b>${hrs(f.logged / 60)}h</b></td>
          <td>${[...byTask].map(([k, v]) => `${esc(k)} <span class="note">${hrs(v)}h</span>`).join('<br>') || '<span class="zero">–</span>'}</td>
          <td>${myUps.map(u => `${esc(S.tasks.find(t => t.id === u.task_id)?.title || 'Task')}: ${u.status_to ? `<b>${esc(u.status_to)}</b> ` : ''}${esc((u.body || '').slice(0, 100))}${u.link_url ? ` <a href="${esc(u.link_url)}" target="_blank" rel="noopener">file</a>` : ''}`).join('<br>') || '<span class="zero">–</span>'}</td>
          <td class="c">${o.length}</td><td class="c">${ov.length ? `<span class="chip over">${ov.length}</span>` : '0'}</td></tr>`;
      }).join('');
      $('#repBody').innerHTML = `<section class="panel tablewrap"><table><tr><th>Member</th><th class="c">Login</th><th class="c">Logout</th><th class="r">At work</th><th class="r">Logged</th><th>Time by task</th><th>Updates</th><th class="c">Open</th><th class="c">Overdue</th></tr>${rows || `<tr><td colspan="9">${emptyState('No team members yet', '')}</td></tr>`}</table></section>`;
    } else {
      const tot = days.map(x => sum(S.entries.filter(e => e.entry_date === x && ids.includes(e.user_id)), e => Number(e.hours)));
      const rows = ids.map(id => {
        const per = days.map(x => sum(S.entries.filter(e => e.user_id === id && e.entry_date === x), e => Number(e.hours)));
        const present = days.filter(x => attOf(id, x)?.login_at).length;
        const done = new Set(ups.filter(u => u.status_to === 'Done' && S.tasks.find(t => t.id === u.task_id)?.assignee === id).map(u => u.task_id)).size;
        const o = openOf(id), ov = o.filter(isOver);
        return `<tr><td><b>${esc(nm(id))}</b></td>${per.map(v => `<td class="r">${v ? hrs(v) : '<span class="zero">–</span>'}</td>`).join('')}<td class="r"><b>${hrs(sum(per))}</b></td><td class="c">${present}</td><td class="c">${done}</td><td class="c">${o.length}</td><td class="c">${ov.length ? `<span class="chip over">${ov.length}</span>` : '0'}</td></tr>`;
      }).join('');
      const byEng = new Map(); S.entries.filter(e => e.entry_date >= from && e.entry_date <= to && ids.includes(e.user_id)).forEach(e => byEng.set(engLabel(e.engagement_id), (byEng.get(engLabel(e.engagement_id)) || 0) + Number(e.hours)));
      $('#repBody').innerHTML = `
        <section class="panel pad">${weekBarsHtml(days, tot, today())}</section>
        <h2 class="sec">By person<span class="count">${hrs(sum(tot))} hours</span></h2>
        <section class="panel tablewrap"><table><tr><th>Member</th>${days.map(x => `<th class="r">${dow(x)} ${parseD(x).getDate()}</th>`).join('')}<th class="r">Total</th><th class="c">Days in</th><th class="c">Completed</th><th class="c">Open</th><th class="c">Overdue</th></tr>${rows}</table></section>
        ${byEng.size ? `<h2 class="sec">By engagement</h2><section class="panel tablewrap"><table><tr><th>Engagement</th><th class="r">Hours</th></tr>${[...byEng].sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${hrs(v)}</td></tr>`).join('')}</table></section>` : ''}`;
    }
  },
};
function reportCsv() {
  const { from, to, ids, days, ups, openOf } = reportData();
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let lines;
  if (S.report.period === 'day') {
    lines = [['Member', 'Login', 'Logout', 'At work (h)', 'Logged (h)', 'Time by task', 'Updates', 'Open', 'Overdue']];
    ids.forEach(id => {
      const f = dayFigures(id, from);
      lines.push([nm(id), hm(f.a?.login_at), hm(f.a?.logout_at), f.atWork != null ? hrs(f.atWork / 60) : '', hrs(f.logged / 60),
        f.es.map(e => `${entryLabel(e)} (${hrs(e.hours)}h)`).join('; '),
        (ups || []).filter(u => u.author === id).map(u => `${S.tasks.find(t => t.id === u.task_id)?.title || 'Task'}: ${u.status_to || ''} ${u.body || ''}`.trim()).join('; '),
        openOf(id).length, openOf(id).filter(isOver).length]);
    });
  } else {
    lines = [['Member', ...days, 'Total', 'Days in']];
    ids.forEach(id => { const per = days.map(x => sum(S.entries.filter(e => e.user_id === id && e.entry_date === x), e => Number(e.hours))); lines.push([nm(id), ...per.map(hrs), hrs(sum(per)), days.filter(x => attOf(id, x)?.login_at).length]); });
  }
  const blob = new Blob(['﻿' + lines.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `team-summary-${from}${to !== from ? '-to-' + to : ''}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* =====================================================================
   View: Setup (manager)
   ===================================================================== */
VIEWS.setup = {
  mount() {
    $('#view').innerHTML = `
      <div class="page-head"><div><h1>Setup</h1><div class="sub">People, clients and engagements</div></div></div>
      <h2 class="sec" style="margin-top:0">Team</h2>
      <div class="note" style="margin:-4px 0 10px">To add someone, create a login in Supabase: Authentication, Users, Add user, Create new user (tick Auto Confirm). Use any email-style ID, for example name@bcs.team. They appear here straight away.</div>
      <section class="panel rows" id="peopleList"></section>
      <h2 class="sec">Clients</h2>
      <section class="panel"><form id="clientForm" class="addrow" style="grid-template-columns:1fr auto;border-radius:var(--r-m) var(--r-m) 0 0;border-top:0;border-bottom:1px solid var(--rule-2)" autocomplete="off">
        <label class="field"><span>New client</span><input name="name" placeholder="e.g. Switch Mobility" maxlength="120"></label><button class="btn accent">Add client</button></form>
        <div class="rows" id="clientList"></div></section>
      <h2 class="sec">Engagements</h2>
      <section class="panel"><form id="engForm" class="addrow" style="grid-template-columns:1fr 1.4fr auto;border-radius:var(--r-m) var(--r-m) 0 0;border-top:0;border-bottom:1px solid var(--rule-2)" autocomplete="off">
        <label class="field"><span>Client</span><select name="client" id="engClient"></select></label>
        <label class="field"><span>Engagement</span><input name="name" placeholder="e.g. O2C Internal Audit FY26-27" maxlength="160"></label><button class="btn accent">Add engagement</button></form>
        <div class="rows" id="engList"></div></section>`;
  },
  paint() {
    const people = Object.values(S.people).sort((a, b) => (b.active - a.active) || byName(a.id, b.id));
    $('#peopleList').innerHTML = people.map(p => `<div class="row" data-act="editPerson" data-id="${p.id}" style="grid-template-columns:auto 1fr auto${p.active ? '' : ';opacity:.55'}">
      ${avatar(p.id)}<div style="min-width:0"><div class="t">${esc(nmYou(p.id))}</div><div class="meta"><span class="m">${esc(p.email)}</span>${p.whatsapp ? `<span class="m">${ico('wa')}${esc(p.whatsapp)}</span>` : ''}</div></div>
      <div class="right">${p.role === 'manager' ? '<span class="chip ledger">Manager</span>' : ''}${p.active ? '' : '<span class="chip">Inactive</span>'}<span class="btn sm ghost">${ico('edit')}Edit</span></div></div>`).join('');
    const clients = [...S.clients].sort((a, b) => a.name.localeCompare(b.name));
    $('#clientList').innerHTML = clients.length ? clients.map(c => `<div class="row" style="cursor:default;grid-template-columns:1fr auto"><div><div class="t">${esc(c.name)}</div><div class="meta">${S.engs.filter(e => e.client_id === c.id).length} engagements</div></div>
      <div class="right"><button class="btn sm ghost danger" data-act="rmClient" data-id="${c.id}">${ico('trash')}Delete</button></div></div>`).join('') : emptyState('No clients yet', ' Add the organisations you audit.', 'team');
    fillSelect($('#engClient'), clients.map(c => [c.id, c.name]), 'Select client');
    const engs = [...S.engs].sort((a, b) => engLabel(a.id).localeCompare(engLabel(b.id)));
    $('#engList').innerHTML = engs.length ? engs.map(e => `<div class="row" style="cursor:default;grid-template-columns:1fr auto${e.active ? '' : ';opacity:.55'}"><div><div class="t">${esc(e.name)}</div><div class="meta">${esc(client(e.client_id)?.name || '')}${e.active ? '' : ', closed'}</div></div>
      <div class="right"><button class="btn sm ghost" data-act="toggleEng" data-id="${e.id}">${e.active ? 'Close' : 'Reopen'}</button><button class="btn sm ghost danger" data-act="rmEng" data-id="${e.id}">${ico('trash')}</button></div></div>`).join('') : emptyState('No engagements yet', ' Add one under a client.', 'tasks');
  },
};

/* =====================================================================
   Sheets
   ===================================================================== */
function openSheet(kind, html, { wide = false, side = false } = {}) {
  const w = $('#sheetWrap'), s = $('#sheet');
  w.hidden = false; w.classList.toggle('side', side);
  s.className = 'sheet' + (wide ? ' wide' : ''); s.innerHTML = html; s.scrollTop = 0;
  S.sheet = kind; document.body.style.overflow = 'hidden';
  setTimeout(() => (s.querySelector('[autofocus]') || s.querySelector('.close'))?.focus(), 60);
}
function closeSheet() {
  $('#sheetWrap').hidden = true; S.sheet = null; S.openTask = null; document.body.style.overflow = '';
  if (location.hash.startsWith('#task-')) try { history.replaceState(null, '', '#' + S.view); } catch (e) {}
}
const closeBtn = `<button class="close" data-act="close" aria-label="Close">${ico('x')}</button>`;

/* ---------- link item ---------- */
function linkItem(url, label, sub, rmId) {
  const od = isOneDrive(url);
  return `<div class="link-item"><div class="ico${od ? '' : ' generic'}">${ico(od ? 'cloud' : 'link')}</div>
    <div class="lt"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(label || (od ? 'OneDrive file' : hostOf(url)))}</a><span>${od ? 'OneDrive' : esc(hostOf(url))}${sub ? ', ' + esc(sub) : ''}</span></div>
    ${rmId ? `<button class="btn sm ghost" data-act="rmLink" data-id="${rmId}" aria-label="Remove link">${ico('x')}</button>` : ''}</div>`;
}

/* ---------- task sheet ---------- */
function openTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) { toast('That task isn’t available to you.'); return; }
  S.openTask = id;
  const canUpdate = S.isMgr || t.assignee === S.me;
  openSheet('task', `
    <div class="sheet-head"><span id="tsIcon"></span><h3 id="tsTitle"></h3>${closeBtn}</div>
    <div class="sheet-body">
      <div class="facts" id="tsFacts"></div>
      <div id="tsDetails"></div>
      <div class="sheet-sec"><div class="lbl"><span>Files</span>${canUpdate ? `<button class="btn sm ghost" data-act="showAddLink">${ico('plus')}Add link</button>` : ''}</div>
        <div id="tsLinks"></div>
        <form id="addLinkForm" class="link-edit" hidden autocomplete="off"><input name="url" placeholder="Paste OneDrive link (https://…)" aria-label="Link"><input name="label" placeholder="File name (optional)" maxlength="200" aria-label="File name"><button class="btn accent">Add</button></form>
      </div>
      ${canUpdate ? `<div class="sheet-sec"><div class="lbl"><span>Post an update</span></div>
        <form class="composer" id="updForm" autocomplete="off">
          <div class="seg" id="updStatus" role="radiogroup" aria-label="Status">${STATUSES.map(s => `<button type="button" data-act="pickStatus" data-v="${s}" role="radio">${s}</button>`).join('')}</div>
          <div class="grid">
            <label class="field"><span>Remarks <em>(optional)</em></span><textarea name="body" maxlength="4000" placeholder="What changed, what's pending, any blockers"></textarea></label>
            <div class="grid g2"><label class="field"><span>Updated file or folder <em>(optional)</em></span><input name="url" placeholder="Paste OneDrive link"></label>
            <label class="field"><span>File name <em>(optional)</em></span><input name="label" maxlength="200" placeholder="e.g. Sales vouching WP v2"></label></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn accent" type="submit" id="updSubmit">Post update</button>${t.assignee === S.me ? `<button class="btn ghost" type="button" data-act="logFor">${ico('clock')}Log time on this</button>` : ''}</div>
        </form></div>` : ''}
      <div class="sheet-sec"><div class="lbl"><span>History</span></div><div class="timeline" id="tsTimeline"><div class="note">Loading…</div></div></div>
    </div>
    ${S.isMgr ? `<div class="sheet-foot">${waNumber(t.assignee) ? `<a class="btn wa" id="tsWa" target="_blank" rel="noopener">${ico('wa')}WhatsApp ${esc(nm(t.assignee).split(' ')[0])}</a>` : ''}<button class="btn" data-act="editTask">${ico('edit')}Edit</button><button class="btn danger" data-act="rmTask">${ico('trash')}Delete</button></div>` : ''}`, { wide: true });
  S.pickStatus = t.status;
  paintTaskSheet();
  loadUpdates(id);
  try { history.replaceState(null, '', '#task-' + id); } catch (e) {}
}
function paintTaskSheet() {
  const t = S.tasks.find(x => x.id === S.openTask); if (!t) { closeSheet(); return; }
  $('#tsIcon').innerHTML = statusIcon(t.status, S.justDone === t.id);
  if (S.justDone === t.id) S.justDone = null;
  $('#tsTitle').textContent = t.title;
  $('#tsFacts').innerHTML = [
    ['Engagement', engLabel(t.engagement_id)], ['Assigned to', nmYou(t.assignee)], ['Due', t.due_date ? niceMid(t.due_date) + (isOver(t) ? ' (overdue)' : '') : 'No date'],
    ['Priority', t.priority], ['Type', t.type], ['Assigned by', `${nmYou(t.assigned_by)}, ${nice(t.created_at.slice(0, 10))}`],
  ].map(([k, v]) => `<div><div class="k">${k}</div><div class="v"${k === 'Due' && isOver(t) ? ' style="color:var(--over)"' : ''}>${esc(v)}</div></div>`).join('');
  $('#tsDetails').innerHTML = t.details ? `<div class="sheet-sec"><div class="lbl"><span>Instructions</span></div><div class="details">${esc(t.details)}</div></div>` : '';
  const ups = S.updates[t.id];
  const refs = linksOf(t.id).map(l => linkItem(l.url, l.label, `added by ${nm(l.added_by).split(' ')[0]}`, (l.added_by === S.me || S.isMgr) ? l.id : null));
  const delivered = (ups || []).filter(u => u.link_url).map(u => linkItem(u.link_url, u.link_label, `${nm(u.author).split(' ')[0]}, ${ago(u.created_at)}`));
  $('#tsLinks').innerHTML = (refs.length || delivered.length) ? refs.join('') + (delivered.length ? `<div class="note" style="margin:10px 0 6px">Shared in updates</div>` + delivered.join('') : '') : `<div class="note">No files linked yet.</div>`;
  $$('#updStatus button').forEach(b => { const on = b.dataset.v === S.pickStatus; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  const wa = $('#tsWa'); if (wa) wa.href = waLink(t.assignee, t);
  if (ups) {
    const created = `<div class="tl"><div class="dot">${ico('plus')}</div><div><div class="by"><b>${esc(nm(t.assigned_by))}</b> assigned this to ${esc(nmYou(t.assignee))}, ${esc(stamp(t.created_at))}</div></div></div>`;
    $('#tsTimeline').innerHTML = ups.map(u => `<div class="tl"><div class="dot">${u.status_to ? statusIcon(u.status_to) : u.link_url ? ico('link') : ico('chat')}</div><div style="min-width:0">
      <div class="by"><b>${esc(nm(u.author))}</b> ${u.status_to ? `set status to <b>${esc(u.status_to)}</b>` : u.link_url ? 'shared a file' : 'commented'}, ${esc(ago(u.created_at))}</div>
      ${u.body ? `<div class="body">${esc(u.body)}</div>` : ''}${u.link_url ? linkItem(u.link_url, u.link_label) : ''}</div></div>`).join('') + created;
  }
}

/* ---------- assign / edit sheet ---------- */
function openAssign(preWho, task) {
  const edit = !!task;
  const who = new Set(edit ? [task.assignee] : preWho ? [preWho] : []);
  openSheet('assign', `
    <div class="sheet-head"><h3>${edit ? 'Edit assignment' : 'New assignment'}</h3>${closeBtn}</div>
    <form id="assignForm" autocomplete="off">
      <div class="sheet-body grid">
        <label class="field"><span>Title</span><input name="title" maxlength="200" required placeholder="e.g. Vouch March sales invoices above ₹5 lakh" value="${esc(task?.title || '')}" autofocus></label>
        <div class="field"><span>Assign to${edit ? '' : ' <em>(each person gets their own copy)</em>'}</span><div class="people">${assignable().map(id => `<label class="person"><input type="checkbox" name="who" value="${id}" ${who.has(id) ? 'checked' : ''}>${avatar(id)}${esc(nmYou(id))}</label>`).join('') || '<span class="note">Add team members in Setup first.</span>'}</div></div>
        <div class="grid g2">
          <label class="field"><span>Client and engagement</span><select name="eng">${engOptions(task?.engagement_id || '')}</select></label>
          <label class="field"><span>Due date</span><input type="date" name="due" value="${task ? (task.due_date || '') : today()}"></label>
        </div>
        <div class="grid g2">
          <div class="field"><span>Type</span><div class="seg" data-group="type">${TYPES.map(x => `<button type="button" data-act="segPick" data-v="${x}" class="${(task?.type || 'Task') === x ? 'on' : ''}">${x}</button>`).join('')}</div></div>
          <div class="field"><span>Priority</span><div class="seg" data-group="priority">${['High', 'Medium', 'Low'].map(x => `<button type="button" data-act="segPick" data-v="${x}" class="${(task?.priority || 'Medium') === x ? 'on' : ''}">${x}</button>`).join('')}</div></div>
        </div>
        <label class="field"><span>Instructions</span><textarea name="details" maxlength="8000" rows="5" placeholder="Scope, sample size, period, where to save the working paper, expected output">${esc(task?.details || '')}</textarea></label>
        ${edit ? `<div class="note">Add or remove file links from the task itself.</div>` : `<div class="field"><span>Reference files <em>(OneDrive links, optional)</em></span><div id="refRows"></div><button type="button" class="btn sm ghost" data-act="addRefRow" style="justify-self:start;margin-top:6px">${ico('plus')}Add a link</button></div>`}
      </div>
      <div class="sheet-foot"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" id="assignSubmit">${edit ? 'Save changes' : 'Assign'}</button></div>
    </form>`, { wide: true });
  S.editTaskId = task?.id || null;
  if (!edit) addRefRow();
}
function addRefRow() {
  const box = $('#refRows'); if (!box) return;
  const d = document.createElement('div'); d.className = 'link-edit'; d.style.marginTop = box.children.length ? '8px' : '0';
  d.innerHTML = `<input name="refUrl" placeholder="Paste OneDrive link (https://…)" aria-label="Link"><input name="refLabel" placeholder="File name (optional)" maxlength="200" aria-label="File name"><button type="button" class="btn ghost" data-act="rmRefRow" aria-label="Remove">${ico('x')}</button>`;
  box.append(d);
}
function openWhatsAppList(created) {
  const rows = created.map(t => `<div class="row" style="cursor:default;grid-template-columns:auto 1fr auto">${avatar(t.assignee)}<div><div class="t">${esc(nm(t.assignee))}</div><div class="meta">${waNumber(t.assignee) ? esc(person(t.assignee).whatsapp) : 'No WhatsApp number saved. Add it in Setup.'}</div></div>
    ${waNumber(t.assignee) ? `<a class="btn sm wa" href="${esc(waLink(t.assignee, t))}" target="_blank" rel="noopener">${ico('wa')}Send</a>` : '<span></span>'}</div>`).join('');
  openSheet('wa', `<div class="sheet-head"><h3>Assigned. Let them know?</h3>${closeBtn}</div>
    <div class="sheet-body" style="padding-top:8px"><p class="note" style="margin:0 0 10px">Each person also gets an alert in the portal${S.push.on ? ' and on devices where alerts are on' : ''}. Send a WhatsApp message with the task details:</p><div class="panel rows">${rows}</div></div>
    <div class="sheet-foot"><button class="btn primary" data-act="close">Done</button></div>`);
}

/* ---------- person sheet (manager) ---------- */
function openPerson(id) {
  const p = person(id), self = id === S.me;
  openSheet('person', `<div class="sheet-head">${avatar(id, true)}<h3>${esc(nm(id))}</h3>${closeBtn}</div>
    <form id="personForm" data-id="${id}" autocomplete="off"><div class="sheet-body grid">
      <div class="note">Login ID: <b>${esc(p.email)}</b></div>
      <label class="field"><span>Display name</span><input name="full_name" value="${esc(p.full_name)}" maxlength="120" required autofocus></label>
      <label class="field"><span>WhatsApp number <em>(with country code, e.g. 91 98400 12345)</em></span><input name="whatsapp" value="${esc(p.whatsapp || '')}" inputmode="tel" maxlength="20"></label>
      ${self ? '' : `<div class="grid g2"><div class="field"><span>Role</span><div class="seg" data-group="role">${[['member', 'Team member'], ['manager', 'Manager']].map(([v, l]) => `<button type="button" data-act="segPick" data-v="${v}" class="${p.role === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>Access</span><div class="seg" data-group="active">${[['true', 'Active'], ['false', 'Deactivated']].map(([v, l]) => `<button type="button" data-act="segPick" data-v="${v}" class="${String(p.active) === v ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>
      <div class="note">Deactivated people can't see anything. Their past timesheets stay in reports.</div>`}
    </div><div class="sheet-foot"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary">Save</button></div></form>`);
}

/* ---------- profile sheet ---------- */
function openProfile() {
  const p = person(S.me);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const pushText = !S.push.supported ? (ios && !standalone ? 'On iPhone, first add this portal to your Home Screen (Share, Add to Home Screen), then open it from there to turn on alerts.' : 'This browser can’t receive alerts.')
    : S.push.on ? 'Alerts are on for this device.' : Notification.permission === 'denied' ? 'Alerts are blocked in this browser’s site settings. Allow notifications for this site, then try again.' : 'Get an alert on this device when a task is assigned or updated.';
  openSheet('profile', `<div class="sheet-head">${avatar(S.me, true)}<h3>${esc(nm(S.me))}</h3>${closeBtn}</div>
    <div class="sheet-body">
      <form id="profileForm" class="grid" autocomplete="off">
        <div class="note">Login ID: <b>${esc(p.email)}</b>${S.isMgr ? ', manager' : ''}</div>
        <label class="field"><span>Display name</span><input name="full_name" value="${esc(p.full_name)}" maxlength="120" required></label>
        <label class="field"><span>WhatsApp number <em>(with country code)</em></span><input name="whatsapp" value="${esc(p.whatsapp || '')}" inputmode="tel" maxlength="20" placeholder="91 98400 12345"></label>
        ${S.isMgr ? `<label class="field"><span>Email for daily and weekly summaries</span><input type="email" name="summary_email" value="${esc(p.summary_email || '')}" placeholder="you@yourfirm.com"></label>` : ''}
        <div><button class="btn primary">Save profile</button></div>
      </form>
      <div class="sheet-sec"><div class="lbl"><span>Alerts</span></div>
        <div class="banner" style="margin:0">${ico('bell')}<span class="grow">${esc(pushText)}</span>${S.push.supported ? (S.push.on ? `<button class="btn sm" data-act="pushOff">Turn off</button>` : Notification.permission === 'denied' ? '' : `<button class="btn sm accent" data-act="pushOn">Turn on alerts</button>`) : ''}</div></div>
      <div class="sheet-sec"><div class="lbl"><span>Password</span></div>
        <form id="pwForm" class="link-edit" style="grid-template-columns:1fr auto" autocomplete="off"><input type="password" name="pw" minlength="8" required placeholder="New password, at least 8 characters" autocomplete="new-password"><button class="btn">Change password</button></form></div>
      <div class="sheet-sec" style="display:flex;gap:8px;flex-wrap:wrap">${S.isMgr ? `<button class="btn mobile-only" data-act="go" data-view="setup" style="display:inline-flex">${ico('setup')}Setup</button>` : ''}<button class="btn danger" data-act="signOut">${ico('out')}Sign out</button></div>
    </div>`);
}

/* ---------- notifications sheet ---------- */
function openNotifs() {
  openSheet('notifs', `<div class="sheet-head"><h3>Notifications</h3><button class="btn sm ghost" data-act="readAll">Mark all read</button>${closeBtn}</div><div id="notifList" style="padding:6px 0"></div>`, { side: true });
  paintNotifs();
}
function paintNotifs() {
  const box = $('#notifList'); if (!box) return;
  box.innerHTML = S.notifs.length ? S.notifs.map(n => `<div class="notif${n.read_at ? ' read' : ''}" data-act="openNotif" data-id="${n.id}" tabindex="0"><span class="u"></span><div><div class="nt">${esc(n.title)}</div>${n.body ? `<div class="nb">${esc(n.body)}</div>` : ''}<div class="nw">${esc(ago(n.created_at))}</div></div></div>`).join('')
    : emptyState('You’re all caught up', ' New assignments and updates will show here.', 'bell');
}

/* =====================================================================
   Actions
   ===================================================================== */
function armed(btn) {
  if (btn.classList.contains('armed')) return true;
  btn.classList.add('armed'); const old = btn.innerHTML; btn.innerHTML = 'Tap again to delete';
  setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.innerHTML = old; } }, 3000);
  return false;
}
async function clockIn() {
  const ok = await run(sb.from('attendance').upsert({ user_id: S.me, work_date: today(), login_at: nowHM() }, { onConflict: 'user_id,work_date' }), `Logged in at ${t12(nowHM())}`);
  if (ok) { await reload(); if (S.view === 'time') go('time'); }
}
async function clockOut() {
  const a = attOf(S.me, today()); if (!a?.login_at) return clockIn();
  let out = nowHM(); if (toMin(out) <= toMin(a.login_at)) { const m = toMin(a.login_at) + 1; out = z(Math.floor(m / 60)) + ':' + z(m % 60); }
  const ok = await run(sb.from('attendance').update({ logout_at: out }).eq('id', a.id), `Logged out at ${t12(out)}`);
  if (ok) {
    await reload(); if (S.view === 'time') go('time');
    const f = dayFigures(S.me, today()); const un = f.atWork - f.logged;
    if (un > 15) toast(`${dur(un)} of today isn’t logged to tasks yet.`, { label: 'Add hours', fn: () => { S.date = today(); S.timeWho = 'me'; go('time'); } });
  }
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  if (b.tagName === 'A' && b.getAttribute('href') === '#') e.preventDefault();
  const task = () => S.tasks.find(x => x.id === S.openTask);
  switch (a) {
    case 'go': closeSheet(); return go(b.dataset.view);
    case 'close': return closeSheet();
    case 'open': return openTask(id);
    case 'notifs': return openNotifs();
    case 'profile': return openProfile();
    case 'newTask': closeSheet(); return openAssign(b.dataset.who);
    case 'editTask': { const t = task(); closeSheet(); return openAssign(null, t); }
    case 'addRefRow': return addRefRow();
    case 'rmRefRow': return b.parentElement.remove();
    case 'segPick': { $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); return; }
    case 'flStatus': S.taskFilter.status = b.dataset.v; $$('#flStatus button').forEach(x => x.classList.toggle('on', x === b)); return VIEWS.tasks.paint();
    case 'myFilter': S.myFilter = b.dataset.v; $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); return VIEWS.tasks.paint();
    case 'pickStatus': S.pickStatus = b.dataset.v; return paintTaskSheet();
    case 'showAddLink': { const f = $('#addLinkForm'); f.hidden = !f.hidden; if (!f.hidden) f.elements.url.focus(); return; }
    case 'rmLink': if (!armed(b)) return; if (await run(sb.from('task_links').delete().eq('id', id), 'Link removed')) reload(); return;
    case 'logFor': { const t = task(); closeSheet(); S.date = today(); S.timeWho = 'me'; go('time'); const sel = $('#eTask'); if (sel) { sel.value = t.id; } $('#entryForm')?.elements.hours.focus(); return; }
    case 'rmTask': if (!armed(b)) return; { const tid = S.openTask; closeSheet(); if (await run(sb.from('tasks').delete().eq('id', tid), 'Assignment deleted')) reload(); } return;
    case 'clockIn': return clockIn();
    case 'clockOut': return clockOut();
    case 'tsDay': { const d = +b.dataset.d; S.date = d ? addDays(S.date, d) : today(); return go('time'); }
    case 'tmDay': { const d = +b.dataset.d; S.teamDate = d ? addDays(S.teamDate, d) : today(); return VIEWS.team.paint(); }
    case 'expand': S.expanded = S.expanded === id ? null : id; return VIEWS.team.paint();
    case 'viewTs': S.timeWho = id; S.date = S.teamDate; return go('time');
    case 'viewTasks': S.taskFilter = { q: '', who: id, eng: '', status: 'open' }; return go('tasks');
    case 'editEntry': {
      const en = S.entries.find(x => x.id === id); if (!en) return;
      const f = $('#entryForm'); S.editEntry = id;
      const sel = $('#eTask'); const v = en.task_id || 'eng:' + (en.engagement_id || '');
      if (![...sel.options].some(o => o.value === v) && en.task_id) { const t = S.tasks.find(x => x.id === en.task_id); if (t) sel.insertAdjacentHTML('afterbegin', `<option value="${t.id}">${esc(t.title)}</option>`); }
      sel.value = v; f.elements.hours.value = en.hours; f.elements.desc.value = en.description || '';
      $('#entrySubmit').textContent = 'Save'; $('#cancelEntry').hidden = false; $('#entryFormTitle').textContent = 'Editing entry: task';
      f.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    case 'cancelEntry': return resetEntryForm();
    case 'rmEntry': if (!armed(b)) return; if (await run(sb.from('time_entries').delete().eq('id', id), 'Entry deleted')) reload(); return;
    case 'repPeriod': S.report.period = b.dataset.v; return go('reports');
    case 'repStep': { const d = +b.dataset.d, step = S.report.period === 'day' ? 1 : 7; S.report.date = d ? addDays(S.report.date, d * step) : today(); return go('reports'); }
    case 'csv': return reportCsv();
    case 'emailReport': {
      b.disabled = true;
      const [from] = reportRange();
      const { data, error } = await sb.functions.invoke('daily-summary', { body: { period: S.report.period, date: from } });
      b.disabled = false;
      if (error) { let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch (x) {} toast(`Couldn’t send the email: ${msg}`); }
      else toast(`Summary emailed to ${(data?.to || []).join(', ')}`);
      return;
    }
    case 'editPerson': return openPerson(id);
    case 'rmClient':
      if (S.engs.some(x => x.client_id === id)) return toast('Delete this client’s engagements first.');
      if (!armed(b)) return; if (await run(sb.from('clients').delete().eq('id', id), 'Client deleted')) reload(); return;
    case 'toggleEng': { const en = eng(id); if (await run(sb.from('engagements').update({ active: !en.active }).eq('id', id), en.active ? 'Engagement closed' : 'Engagement reopened')) reload(); return; }
    case 'rmEng':
      if (S.tasks.some(t => t.engagement_id === id) || S.entries.some(t => t.engagement_id === id)) return toast('This engagement has tasks or hours. Close it instead.');
      if (!armed(b)) return; if (await run(sb.from('engagements').delete().eq('id', id), 'Engagement deleted')) reload(); return;
    case 'notifRead': return;
    case 'openNotif': {
      const n = S.notifs.find(x => x.id === id); if (!n) return;
      if (!n.read_at) { n.read_at = new Date().toISOString(); sb.from('notifications').update({ read_at: n.read_at }).eq('id', id).then(() => {}); paintBadge(); }
      if (n.task_id) { closeSheet(); openTask(n.task_id); } else paintNotifs();
      return;
    }
    case 'readAll': {
      const ids = S.notifs.filter(n => !n.read_at).map(n => n.id); if (!ids.length) return;
      const ts = new Date().toISOString(); S.notifs.forEach(n => n.read_at = n.read_at || ts); paintNotifs(); paintBadge();
      await run(sb.from('notifications').update({ read_at: ts }).in('id', ids)); return;
    }
    case 'pushOn': return enablePush();
    case 'pushOff': return disablePush();
    case 'nudgeOff': S.nudgeOff = true; try { localStorage.setItem('nudgeOff', '1'); } catch (x) {} return VIEWS.today.paint();
    case 'signOut': await disablePush(true); closeSheet(); await sb.auth.signOut(); return;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.sheet) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.row[data-act], .member-row, .notif')) { e.preventDefault(); e.target.click(); }
});

/* ---------- form submits ---------- */
function resetEntryForm() {
  const f = $('#entryForm'); if (!f) return;
  f.elements.hours.value = ''; f.elements.desc.value = ''; S.editEntry = null;
  $('#entrySubmit').textContent = 'Add'; $('#cancelEntry').hidden = true; $('#entryFormTitle').textContent = 'Task';
}
const pickedSeg = (form, g) => $(`.seg[data-group="${g}"] button.on`, form)?.dataset.v;
document.addEventListener('submit', async e => {
  const f = e.target; e.preventDefault();
  const btn = f.querySelector('button:not([type=button])');
  const busy = on => { if (btn) btn.disabled = on; };
  switch (f.id) {
    case 'attForm': {
      const login = f.elements.login.value, logout = f.elements.logout.value, brk = parseInt(f.elements.brk.value || '0', 10);
      if (logout && !login) return toast('Enter the login time first.');
      if (login && logout && logout <= login) return toast('Logout must be after login.');
      if (brk < 0 || brk > 600) return toast('Break must be between 0 and 600 minutes.');
      busy(true);
      const ok = await run(sb.from('attendance').upsert({ user_id: S.me, work_date: S.date, login_at: orNull(login), logout_at: orNull(logout), break_mins: brk }, { onConflict: 'user_id,work_date' }), 'Times saved');
      busy(false); if (ok) { await reload(); go('time'); }
      return;
    }
    case 'entryForm': {
      const v = f.elements.task.value, hours = parseFloat(f.elements.hours.value), desc = f.elements.desc.value.trim();
      if (!(hours > 0 && hours <= 24)) return toast('Enter hours between 0.25 and 24.');
      const others = sum(entriesOf(S.me, S.date).filter(x => x.id !== S.editEntry), x => Number(x.hours));
      if (others + hours > 24) return toast('That would take the day past 24 hours.');
      const isEng = v.startsWith('eng:'), t = isEng ? null : S.tasks.find(x => x.id === v);
      const row = { entry_date: S.date, task_id: t ? t.id : null, engagement_id: t ? t.engagement_id : orNull(v.slice(4)), hours, description: desc };
      busy(true);
      const ok = S.editEntry ? await run(sb.from('time_entries').update(row).eq('id', S.editEntry), 'Entry updated')
        : await run(sb.from('time_entries').insert({ ...row, user_id: S.me }), `${hrs(hours)}h added`);
      busy(false); if (ok) { resetEntryForm(); f.elements.task.dataset.want = v; reload(); }
      return;
    }
    case 'assignForm': {
      const title = f.elements.title.value.trim(), who = $$('input[name=who]:checked', f).map(i => i.value);
      if (!title) return toast('Add a title.');
      if (!who.length) return toast('Pick at least one person.');
      const base = { title, type: pickedSeg(f, 'type') || 'Task', priority: pickedSeg(f, 'priority') || 'Medium', engagement_id: orNull(f.elements.eng.value), due_date: orNull(f.elements.due.value), details: f.elements.details.value.trim() };
      const refs = $$('#refRows .link-edit', f).map(r => ({ url: r.querySelector('[name=refUrl]').value.trim(), label: r.querySelector('[name=refLabel]').value.trim() })).filter(r => r.url);
      const badRef = refs.find(r => !isUrl(r.url)); if (badRef) return toast('Reference links must start with https://');
      busy(true);
      try {
        if (S.editTaskId) {
          const ok = await run(sb.from('tasks').update({ ...base, assignee: who[0] }).eq('id', S.editTaskId), 'Assignment updated');
          if (ok && who.length > 1) await run(sb.from('tasks').insert(who.slice(1).map(a => ({ ...base, assignee: a, assigned_by: S.me }))));
          if (ok) { closeSheet(); reload(); }
        } else {
          const created = await run(sb.from('tasks').insert(who.map(a => ({ ...base, assignee: a, assigned_by: S.me }))).select('*'));
          if (!created) return;
          if (refs.length) await run(sb.from('task_links').insert(created.flatMap(t => refs.map(r => ({ task_id: t.id, url: r.url, label: r.label, added_by: S.me })))));
          await reload();
          const others = created.filter(t => t.assignee !== S.me);
          if (others.some(t => waNumber(t.assignee))) openWhatsAppList(others);
          else { closeSheet(); toast(`Assigned to ${created.length} ${created.length > 1 ? 'people' : 'person'}`); }
        }
      } finally { busy(false); }
      return;
    }
    case 'addLinkForm': {
      const url = f.elements.url.value.trim(), label = f.elements.label.value.trim();
      if (!isUrl(url)) return toast('Paste a full link starting with https://');
      busy(true);
      const ok = await run(sb.from('task_links').insert({ task_id: S.openTask, url, label, added_by: S.me }), 'Link added');
      busy(false); if (ok) { f.reset(); f.hidden = true; reload(); }
      return;
    }
    case 'updForm': {
      const t = S.tasks.find(x => x.id === S.openTask); if (!t) return;
      const body = f.elements.body.value.trim(), url = f.elements.url.value.trim(), label = f.elements.label.value.trim();
      const changed = S.pickStatus && S.pickStatus !== t.status;
      if (!changed && !body && !url) return toast('Change the status, add remarks or paste a file link.');
      if (url && !isUrl(url)) return toast('Paste a full link starting with https://');
      busy(true);
      try {
        if (changed && !(await run(sb.from('tasks').update({ status: S.pickStatus }).eq('id', t.id)))) return;
        const ok = await run(sb.from('task_updates').insert({ task_id: t.id, author: S.me, body, status_to: changed ? S.pickStatus : null, link_url: orNull(url), link_label: label }), changed ? `Marked ${S.pickStatus}` : 'Update posted');
        if (ok) { f.reset(); if (changed && S.pickStatus === 'Done') S.justDone = t.id; await reload(); loadUpdates(t.id); }
      } finally { busy(false); }
      return;
    }
    case 'clientForm': {
      const name = f.elements.name.value.trim(); if (!name) return;
      if (S.clients.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast('That client already exists.');
      if (await run(sb.from('clients').insert({ name }), 'Client added')) { f.reset(); reload(); }
      return;
    }
    case 'engForm': {
      const c = f.elements.client.value, name = f.elements.name.value.trim();
      if (!c) return toast('Pick a client first.'); if (!name) return toast('Name the engagement.');
      if (await run(sb.from('engagements').insert({ client_id: c, name }), 'Engagement added')) { f.elements.name.value = ''; reload(); }
      return;
    }
    case 'personForm': {
      const pid = f.dataset.id, row = { full_name: f.elements.full_name.value.trim(), whatsapp: f.elements.whatsapp.value.trim() };
      if (!row.full_name) return toast('Add a display name.');
      const role = pickedSeg(f, 'role'), active = pickedSeg(f, 'active');
      if (role) row.role = role; if (active) row.active = active === 'true';
      busy(true);
      if (await run(sb.from('profiles').update(row).eq('id', pid), 'Saved')) { closeSheet(); reload(); }
      busy(false); return;
    }
    case 'profileForm': {
      const row = { full_name: f.elements.full_name.value.trim(), whatsapp: f.elements.whatsapp.value.trim() };
      if (f.elements.summary_email) { row.summary_email = f.elements.summary_email.value.trim(); if (row.summary_email && !/^\S+@\S+\.\S+$/.test(row.summary_email)) return toast('Enter a valid email.'); }
      if (!row.full_name) return toast('Add a display name.');
      busy(true);
      if (await run(sb.from('profiles').update(row).eq('id', S.me), 'Profile saved')) { await reload(); renderShell(); renderNav(); go(S.view); }
      busy(false); return;
    }
    case 'pwForm': {
      const pw = f.elements.pw.value; if (pw.length < 8) return toast('Use at least 8 characters.');
      busy(true); const { error } = await sb.auth.updateUser({ password: pw }); busy(false);
      if (error) toast(error.message); else { f.reset(); toast('Password changed'); }
      return;
    }
    case 'loginForm': return;
  }
});

/* =====================================================================
   Push alerts
   ===================================================================== */
const b64uToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
let swReg = null;
async function initPush() {
  S.push.supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;
  try { S.nudgeOff = localStorage.getItem('nudgeOff') === '1'; } catch (e) {}
  if (!('serviceWorker' in navigator)) return;
  try { swReg = await navigator.serviceWorker.register('sw.js'); } catch (e) { S.push.supported = false; return; }
  navigator.serviceWorker.addEventListener('message', ev => { if (ev.data?.type === 'open-task' && ev.data.task_id) openTask(ev.data.task_id); });
  if (!S.push.supported) return;
  const sub = await swReg.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') {
    const j = sub.toJSON();
    const { error } = await sb.rpc('register_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    S.push.on = !error;
  }
}
async function enablePush() {
  if (!S.push.supported) { openProfile(); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Alerts weren’t allowed. You can allow them in this browser’s site settings.'); return; }
  try {
    const reg = swReg || await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    if (!(await run(sb.rpc('register_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })))) return;
    S.push.on = true; toast('Alerts are on for this device');
  } catch (e) { toast('Couldn’t turn on alerts: ' + (e.message || e)); }
  if (S.sheet === 'profile') openProfile();
  if (S.view === 'today') VIEWS.today.paint();
}
async function disablePush(quiet) {
  try {
    const sub = await swReg?.pushManager.getSubscription();
    if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); if (!quiet) await sub.unsubscribe(); }
  } catch (e) {}
  if (quiet) return;
  S.push.on = false; toast('Alerts are off for this device');
  if (S.sheet === 'profile') openProfile();
}
function onNewNotification(n) {
  if (S.notifs.some(x => x.id === n.id)) return;
  S.notifs.unshift(n); paintBadge(true);
  if (S.sheet === 'notifs') paintNotifs();
  if (document.hidden && Notification?.permission === 'granted' && swReg && !S.push.on) {
    swReg.showNotification(n.title, { body: n.body, tag: n.id, icon: 'icon-192.png', data: { task_id: n.task_id } });
  } else if (!document.hidden) {
    toast(n.title, n.task_id ? { label: 'Open', fn: () => openTask(n.task_id) } : null);
  }
}

/* =====================================================================
   Login
   ===================================================================== */
function showLogin(msg) {
  S.view = null; S.sheet = null; $('#sheetWrap').hidden = true;
  const lines = [['Engagement letter signed', '✓', ''], ['Opening balances agreed', '✓', ''], ['Sales cut-off tested', '✓', ''], ['Credit notes vouched', '✓', ''], ['GRN ageing reviewed', '✗', 'red'], ['Bank reconciliation', '✓', '']];
  root().innerHTML = `<div class="login">
    <div class="login-art" aria-hidden="true"><div class="paper">
      <div class="ttl">Every task,<br>ticked and timed.</div>
      ${lines.map(([l, , c], i) => `<div class="line"><svg class="tick ${c}" viewBox="0 0 24 24"><path style="animation-delay:${.35 + i * .18}s" d="${c ? 'M6 6l12 12M18 6 6 18' : 'm5 12.5 4.5 4.5L19 7'}"/></svg><span>${l}</span><span class="amt">${['1.5', '3.0', '4.25', '2.5', '6.0', '1.75'][i]}h</span></div>`).join('')}
      <div class="foot"><span></span><span>Logged this week</span><span class="amt">19.0h</span></div>
    </div></div>
    <div class="login-form"><form id="loginForm" autocomplete="on">
      <div>${brandMark}</div>
      <div><h1>Sign in to ${esc(PORTAL_NAME)}</h1><p>Use the login ID and password your manager gave you.</p></div>
      <label class="field"><span>Login ID</span><input type="email" name="email" required autocomplete="username" placeholder="name@bcs.team"></label>
      <label class="field"><span>Password</span><input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn primary" id="loginBtn" style="height:42px">Sign in</button>
      <div class="msg" id="loginMsg" role="alert">${esc(msg || '')}</div>
    </form></div></div>`;
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = $('#loginBtn'); btn.disabled = true; $('#loginMsg').textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: f.elements.email.value.trim(), password: f.elements.password.value });
    btn.disabled = false;
    if (error) $('#loginMsg').textContent = /invalid/i.test(error.message) ? 'That login ID or password is wrong. Check with your manager if you’ve forgotten it.' : error.message;
  });
}

/* =====================================================================
   Boot
   ===================================================================== */
let channel = null, booted = false;
async function boot(session) {
  if (!session) { booted = false; if (channel) { sb.removeChannel(channel); channel = null; } return showLogin(); }
  if (booted) return;
  booted = true;
  S.me = session.user.id;
  await loadAll();
  const me = person(S.me);
  if (!me) { root().innerHTML = `<div class="loading"><div>Your profile is being set up. Refresh in a moment.</div></div>`; booted = false; return; }
  if (!me.active) { root().innerHTML = `<div class="loading"><div>Your access has been turned off. Contact your manager.<div style="margin-top:12px"><button class="btn" data-act="signOut">Sign out</button></div></div></div>`; return; }
  renderShell();
  initPush().then(() => { if (S.view === 'today') VIEWS.today.paint(); });
  channel = sb.channel('portal').on('postgres_changes', { event: '*', schema: 'public' }, p => {
    if (p.table === 'notifications' && p.eventType === 'INSERT' && p.new?.user_id === S.me) onNewNotification(p.new);
    if (p.table === 'task_updates' && S.openTask) loadUpdates(S.openTask);
    if (p.table !== 'notifications') scheduleReload();
  }).subscribe();
  const h = (location.hash || '').slice(1);
  go(tabs().some(t => t[0] === h) ? h : tabs()[0][0]);
  if (h.startsWith('task-')) openTask(h.slice(5));
  setInterval(() => { if (!document.hidden && S.view && !S.sheet && (S.view === 'today' || S.view === 'team' || S.view === 'time')) paint(); }, 60000);
}

if (!sb) {
  root().innerHTML = '<div class="loading"><div>This portal isn’t connected to a database yet. Add your Supabase URL and key to config.js.</div></div>';
} else {
  sb.auth.onAuthStateChange((_evt, session) => { setTimeout(() => boot(session), 0); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && booted) scheduleReload(); });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h.startsWith('task-') && booted && S.openTask !== h.slice(5)) openTask(h.slice(5)); });
}

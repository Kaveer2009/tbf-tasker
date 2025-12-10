// employee.js — updated to display location + search by location + colored cards
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// UI
const empNameEl = document.getElementById('empName');
const empCountsEl = document.getElementById('empCounts');
const empTasksGrid = document.getElementById('empTasksGrid');
const empSearch = document.getElementById('empSearch');

let currentUser = null;
let currentConfirmId = null;
let tasksLocal = [];

// theme toggle
const empThemeBtn = document.getElementById('empTheme');
if (empThemeBtn) empThemeBtn.onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
};

const empLogoutBtn = document.getElementById('empLogout');
if (empLogoutBtn) empLogoutBtn.onclick = () => { auth.signOut().then(()=> window.location.href='login.html'); };

function fmt(v){
  if (!v) return '—';
  try { const d = v.toDate ? v.toDate() : new Date(v); return d.toLocaleString(); } catch { return '—'; }
}

function timeLeftStr(deadline){
  if (!deadline) return '—';
  const now = Date.now();
  const dl = deadline.toDate ? deadline.toDate().getTime() : new Date(deadline).getTime();
  const diff = dl - now;
  if (diff <= 0) return 'Overdue';
  const mins = Math.floor(diff/60000);
  const days = Math.floor(mins/1440);
  const hours = Math.floor((mins%1440)/60);
  const minutes = mins%60;
  let s = '';
  if (days) s += `${days}d `;
  if (hours) s += `${hours}h `;
  s += `${minutes}m`;
  return s;
}

// modal helpers
window.openModal = id => document.getElementById(id).style.display = 'flex';
window.closeModal = id => document.getElementById(id).style.display = 'none';

onAuthStateChanged(auth, async user => {
  if (!user) return window.location.href = 'login.html';
  currentUser = user;

  // load name from users
  try {
    const ud = await getDoc(doc(db,'users',user.uid));
    if (ud.exists()) empNameEl.textContent = ud.data().name || user.email;
  } catch(e){ console.warn('user load',e); }

  const q = query(collection(db,'tasks'), where('assignedTo','==', user.uid), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    tasksLocal = [];
    snap.forEach(s=> {
      const d = s.data(); d.id = s.id; tasksLocal.push(d);
    });
    renderCounts();
    renderTasks();
  }, err => {
    console.error('snapshot err',err);
    empTasksGrid.textContent = 'Error loading tasks';
  });
});

// counts and small summary
function renderCounts(){
  const total = tasksLocal.length;
  const done = tasksLocal.filter(t=>t.status==='done').length;
  const pending = total - done;
  const overdue = tasksLocal.filter(t=>{
    if (t.status === 'done' || !t.deadline) return false;
    const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
    return dl < Date.now();
  }).length;
  empCountsEl.textContent = `${total} tasks • ${pending} pending • ${done} completed • ${overdue} overdue`;
}

// render tasks grid (3/2/1 handled by CSS)
function renderTasks(){
  const q = empSearch.value.trim().toLowerCase();
  const filtered = tasksLocal.filter(t => {
    if (!q) return true;
    const title = (t.title||'').toLowerCase();
    const desc = (t.description||'').toLowerCase();
    const loc = (t.location||'').toLowerCase();
    return title.includes(q) || desc.includes(q) || loc.includes(q);
  });

  empTasksGrid.innerHTML = '';
  if (filtered.length === 0) empTasksGrid.innerHTML = '<div class="small">No tasks assigned.</div>';

  filtered.forEach(t=>{
    // determine bg color
    const now = Date.now();
    const isOverdue = (t.status !== 'done' && t.deadline && ((t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime()) < now));
    let bgStyle = '';
    if (t.status === 'done') bgStyle = 'background:#e7ffea;';
    else if (isOverdue) bgStyle = 'background:#ffecec;';

    const locHtml = t.location ? `<div class="small"><b>Location:</b><pre style="white-space:pre-wrap;margin:6px 0 0 0;">${escapeHtml(t.location)}</pre></div>` : '';

    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('style', bgStyle);
    card.innerHTML = `
      <div class="task-top">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="avatar">${(t.title||'?').charAt(0)}</div>
          <div>
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="small">${escapeHtml(t.description || '')}</div>
          </div>
        </div>
        <div class="small">${t.status === 'done' ? '✅' : '⏳'}</div>
      </div>

      <div class="task-meta">
        <div class="small">Created: ${fmt(t.createdAt)}</div>
        <div class="small">Deadline: ${fmt(t.deadline)}</div>
        <div class="small">Time left: ${ t.status === 'done' ? '—' : timeLeftStr(t.deadline) }</div>
        ${t.status === 'done' ? `<div class="small">Completed: ${fmt(t.completedAt)}</div>` : ''}
        ${locHtml}
      </div>

      <div class="task-actions">
        ${t.status === 'done' ? `<button class="btn btn-muted" disabled>Completed</button><button class="btn btn-blue" onclick="reopenTask('${t.id}')">Re-open</button>` :
        `<button class="btn btn-green" onclick="askComplete('${t.id}','${(t.title||'task').replace(/'/g,"\\'")}')">Mark Done</button>`}
      </div>
    `;
    empTasksGrid.appendChild(card);
  });
}

// simple helper
function escapeHtml(s){
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

window.askComplete = function(id, title){
  currentConfirmId = id;
  document.getElementById('confirmText').textContent = `Are you sure you want to complete "${title}"?`;
  openModal('confirmModal');
};

document.getElementById('confirmYes').onclick = async () => {
  if (!currentConfirmId) return closeModal('confirmModal');
  await updateDoc(doc(db,'tasks',currentConfirmId), { status:'done', completedAt: new Date() });
  closeModal('confirmModal');
  currentConfirmId = null;
};

document.getElementById('confirmNo').onclick = () => { currentConfirmId = null; closeModal('confirmModal'); };

window.reopenTask = async function(id){
  await updateDoc(doc(db,'tasks',id), { status:'pending', completedAt: null });
};

// search triggers
if (empSearch) empSearch.oninput = renderTasks;

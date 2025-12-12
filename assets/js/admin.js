// admin.js — Full final admin logic (tabs, search, theme, logout, departments, employees, tasks)
// Note: keep UI unchanged; this file expects the admin.html structure provided.

import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, where, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth, db } from "./firebase-config.js"; // assumes firebase-config exports auth, db

// secondary app for user creation (keep your config)
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCUVdzmmeLUyVICm36khJVF38lMpMPk1qE",
  authDomain: "employee-track-1.firebaseapp.com",
  projectId: "employee-track-1",
  storageBucket: "employee-track-1.firebasestorage.app",
  messagingSenderId: "1055796115720",
  appId: "1:1055796115720:web:00c66aef9af126b83b94bd"
}, "Secondary-App");
const secondaryAuth = getAuth(secondaryApp);

// ---------- DOM refs ----------
const tasksGrid = document.getElementById("tasksGrid");
const employeeSidebar = document.getElementById("employeeSidebar");
const totalTasks = document.getElementById("totalTasks");
const pendingTasks = document.getElementById("pendingTasks");
const completedTasks = document.getElementById("completedTasks");
const overdueTasks = document.getElementById("overdueTasks");
const searchTasks = document.getElementById("searchTasks");
const filterDept = document.getElementById("filterDept");
const adminTabs = document.getElementById("adminTabs");

const taskModal = document.getElementById("taskModal");
const taskModalTitle = document.getElementById("taskModalTitle");
const assignSearch = document.getElementById("assignSearch");
const assignSuggestions = document.getElementById("assignSuggestions");
const assignUid = document.getElementById("assignUid");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const taskLocationEl = document.getElementById("taskLocation");
const taskRecurrenceEl = document.getElementById("taskRecurrence");
const subtasksContainer = document.getElementById("subtasksContainer");
const addSubtaskBtn = document.getElementById("addSubtaskBtn");
const newSubtaskText = document.getElementById("newSubtaskText");

const userModal = document.getElementById("userModal");
const createUserBtn = document.getElementById("createUserBtn");
const newDeptSelect = document.getElementById("newDeptSelect");
const openAddDeptBtn = document.getElementById("openAddDeptBtn");

const editUserModal = document.getElementById("editUserModal");
const editName = document.getElementById("editName");
const editEmail = document.getElementById("editEmail");
const editDeptSelect = document.getElementById("editDeptSelect");
const openAddDeptBtn2 = document.getElementById("openAddDeptBtn2");
const saveEditUserBtn = document.getElementById("saveEditUserBtn");

const addDeptModal = document.getElementById("addDeptModal");
const newDeptName = document.getElementById("newDeptName");
const createDeptBtn = document.getElementById("createDeptBtn");

// admin detail modal refs
const adminDetailModal = document.getElementById("adminDetailModal");
const adminDetailTitle = document.getElementById("adminDetailTitle");
const adminDetailAssigned = document.getElementById("adminDetailAssigned");
const adminDetailDept = document.getElementById("adminDetailDept");
const adminDetailDeadline = document.getElementById("adminDetailDeadline");
const adminDetailCreated = document.getElementById("adminDetailCreated");
const adminDetailCompletedWrap = document.getElementById("adminDetailCompletedWrap");
const adminDetailCompleted = document.getElementById("adminDetailCompleted");
const adminDetailDesc = document.getElementById("adminDetailDesc");
const adminDetailSubtasks = document.getElementById("adminDetailSubtasks");
const adminDetailProgress = document.getElementById("adminDetailProgress");
const adminEditBtn = document.getElementById("adminEditBtn");
const adminDeleteBtn = document.getElementById("adminDeleteBtn");
const adminReopenBtn = document.getElementById("adminReopenBtn");
const adminMarkDoneBtn = document.getElementById("adminMarkDoneBtn");

const toggleThemeBtn = document.getElementById("toggleTheme");
const logoutBtn = document.getElementById("logoutBtn");
const confirmLogoutBtn = document.getElementById("confirmLogout");

// ---------- state ----------
let employees = [];      // {uid,name,email,role,department}
let departments = [];    // {id,name}
let deptMap = {};        // id -> name
let tasksCache = [];
let editingTaskId = null;
let currentAdminDetailTaskId = null;
let editingUserId = null;
let currentTab = "all";

// ---------- helpers ----------
window.openModal = id => { const el = document.getElementById(id); if (el) el.style.display = "flex"; };
window.closeModal = id => { const el = document.getElementById(id); if (el) el.style.display = "none"; };

function fmt(v){
  if (!v) return "—";
  try { const d = v.toDate ? v.toDate() : new Date(v); return d.toLocaleString(); } catch { return "—"; }
}
function safeInput(v){
  if (!v) return "";
  try { const d = v.toDate ? v.toDate() : new Date(v); if (isNaN(d)) return ""; return d.toISOString().slice(0,16); } catch { return ""; }
}
function escapeHtml(s){
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function addIntervalToDate(date, freq){
  const d = new Date(date);
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

// restore saved theme
const savedTheme = localStorage.getItem("tm-theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

// ---------- auth guard ----------
auth.onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "login.html");
  if (user.email !== "kaveer.is.king@gmail.com") { alert("Only admin allowed"); auth.signOut(); return; }

  attachEvents();
  await loadDepartments();
  await loadEmployees();
  startTasksStream();
  initCharts();
});

// ---------- attach events ----------
function attachEvents(){
  // theme toggle
  if (toggleThemeBtn) toggleThemeBtn.onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("tm-theme", next);
  };

  if (logoutBtn) logoutBtn.onclick = () => openModal('logoutModal');
  if (confirmLogoutBtn) confirmLogoutBtn.onclick = () => { auth.signOut(); window.location.href = 'login.html'; };

  document.getElementById("openCreateTaskBtn").onclick = () => {
    editingTaskId = null;
    taskModalTitle.textContent = "Create Task";
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDesc").value = "";
    assignSearch.value = "";
    assignUid.value = "";
    taskLocationEl.value = "";
    document.getElementById("taskDeadline").value = "";
    taskRecurrenceEl.value = "none";
    clearSubtasksUI();
    assignSuggestions.style.display = "none";
    openModal("taskModal");
  };

  document.getElementById("openAddUserBtn").onclick = () => {
    document.getElementById("newName").value = "";
    document.getElementById("newEmail").value = "";
    document.getElementById("newPass").value = "";
    if (newDeptSelect) newDeptSelect.value = "";
    openModal("userModal");
  };

  saveTaskBtn.onclick = saveTask;
  createUserBtn.onclick = createUser;

  assignSearch.oninput = handleAssignSearch;
  assignSearch.onclick = handleAssignSearch;

  addSubtaskBtn.onclick = () => {
    const txt = newSubtaskText.value.trim();
    if (!txt) return;
    addSubtaskToUI({ text: txt, done: false });
    newSubtaskText.value = "";
  };

  searchTasks.oninput = renderTasks;
  if (filterDept) filterDept.onchange = renderTasks;

  if (openAddDeptBtn) openAddDeptBtn.onclick = () => { newDeptName.value = ''; openModal('addDeptModal'); };
  if (openAddDeptBtn2) openAddDeptBtn2.onclick = () => { newDeptName.value = ''; openModal('addDeptModal'); };
  if (createDeptBtn) createDeptBtn.onclick = createDepartment;
  if (saveEditUserBtn) saveEditUserBtn.onclick = saveEditedUser;

  // tabs
  if (adminTabs) {
    adminTabs.querySelectorAll('.tab').forEach(tb => {
      tb.onclick = () => {
        adminTabs.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        tb.classList.add('active');
        currentTab = tb.dataset.tab || "all";
        renderTasks();
      };
    });
  }
}

// ---------- subtask UI ----------
function addSubtaskToUI(item){
  const id = 'st-' + Math.random().toString(36).slice(2,9);
  const row = document.createElement('div');
  row.className = 'subtask-row';
  row.id = id;
  row.innerHTML = `
    <input class="input subtask-input" value="${escapeHtml(item.text)}" />
    <button class="btn btn-red subtask-remove">Remove</button>
  `;
  row.querySelector('.subtask-remove').onclick = () => row.remove();
  subtasksContainer.appendChild(row);
}
function clearSubtasksUI(){ subtasksContainer.innerHTML = ''; }

// ---------- load departments ----------
async function loadDepartments(){
  const snap = await getDocs(collection(db,'departments'));
  departments = [];
  deptMap = {};
  snap.forEach(s => {
    const d = s.data();
    departments.push({ id: s.id, name: d.name });
    deptMap[s.id] = d.name;
  });
  populateDeptSelects();
}

// populate dept selects & filter
function populateDeptSelects(){
  [newDeptSelect, editDeptSelect].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = `<option value="">Select Department</option>`;
    departments.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.name;
      sel.appendChild(opt);
    });
  });

  if (!filterDept) return;
  filterDept.innerHTML = `<option value="">All departments</option>`;
  departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = d.name;
    filterDept.appendChild(opt);
  });
}

// ---------- load employees ----------
async function loadEmployees(){
  const snap = await getDocs(collection(db,'users'));
  employees = [];
  snap.forEach(s => {
    const d = s.data();
    employees.push({
      uid: s.id,
      name: d.name || d.email,
      email: d.email,
      role: d.role || 'employee',
      department: d.department || ''
    });
  });
  renderEmployeesSidebar();
}

function renderEmployeesSidebar(){
  employeeSidebar.innerHTML = "";
  employees.forEach(e=>{
    const deptName = e.department ? (deptMap[e.department] || 'Unknown') : '—';
    const row = document.createElement('div');
    row.className = 'side-row';
    row.innerHTML = `
      <div class="avatar">${(e.name||'U').charAt(0)}</div>
      <div style="flex:1">
        <div><b>${e.name}</b></div>
        <div class="small">${e.email}</div>
        <div class="small" style="margin-top:6px;">🏷️ Dept: <b>${escapeHtml(deptName)}</b></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn btn-muted" onclick="openEditUserModal('${e.uid}')">Edit</button>
      </div>
    `;
    employeeSidebar.appendChild(row);
  });
}

// ---------- assign autocomplete ----------
function handleAssignSearch(){
  const q = assignSearch.value.trim().toLowerCase();
  const list = employees.filter(e => e.role==='employee' && (e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)));
  assignSuggestions.innerHTML = "";
  if (!q || list.length === 0){ assignSuggestions.style.display = 'none'; return; }
  list.forEach(emp => {
    const r = document.createElement('div');
    r.className = 'sug-row';
    r.innerHTML = `<div class="avatar">${emp.name.charAt(0)}</div><div><b>${emp.name}</b><div class="small">${emp.email}</div></div>`;
    r.onclick = () => { assignSearch.value = emp.name; assignUid.value = emp.uid; assignSuggestions.style.display = 'none'; };
    assignSuggestions.appendChild(r);
  });
  assignSuggestions.style.display = 'block';
}

// ---------- tasks stream ----------
function startTasksStream(){
  const q = query(collection(db,'tasks'), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    tasksCache = [];
    snap.forEach(s => tasksCache.push({ ...s.data(), id: s.id }));
    computeStats();
    renderTasks();
    updateCharts();
  }, err => {
    console.error('tasks stream', err);
    if (tasksGrid) tasksGrid.textContent = 'Error loading tasks';
  });
}

function computeStats(){
  const now = Date.now();
  let total = tasksCache.length;
  let completed = 0, pending = 0, overdue = 0;
  tasksCache.forEach(t=>{
    if (t.status === 'done') completed++; else pending++;
    if (t.status !== 'done' && t.deadline){
      const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
      if (dl < now) overdue++;
    }
  });
  if (totalTasks) totalTasks.textContent = total;
  if (pendingTasks) pendingTasks.textContent = pending;
  if (completedTasks) completedTasks.textContent = completed;
  if (overdueTasks) overdueTasks.textContent = overdue;
}

function renderTasks(){
  if (!tasksGrid) return;
  const q = (searchTasks && searchTasks.value || '').trim().toLowerCase();
  const deptFilterVal = (filterDept && filterDept.value) || '';

  let list = tasksCache.filter(t => {
    if (deptFilterVal) {
      const emp = employees.find(e => e.uid === t.assignedTo);
      if (!emp || emp.department !== deptFilterVal) return false;
    }
    if (!q) return true;
    const emp = employees.find(e => e.uid === t.assignedTo);
    const name = emp ? emp.name.toLowerCase() : '';
    const deptName = emp && emp.department ? (deptMap[emp.department] || '').toLowerCase() : '';
    return (t.title||'').toLowerCase().includes(q) ||
           (t.description||'').toLowerCase().includes(q) ||
           (t.location||'').toLowerCase().includes(q) ||
           name.includes(q) || deptName.includes(q);
  });

  // TAB FILTER
  if (currentTab === 'pending') list = list.filter(t => t.status !== 'done');
  else if (currentTab === 'completed') list = list.filter(t => t.status === 'done');
  else if (currentTab === 'overdue') {
    const now = Date.now();
    list = list.filter(t => t.status !== 'done' && t.deadline && ((t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime()) < now));
  } else if (currentTab === 'recurring') {
    list = list.filter(t => !!t.recurrence);
  }

  tasksGrid.innerHTML = "";
  if (list.length === 0) { tasksGrid.innerHTML = "<div class='small'>No tasks</div>"; return; }

  const now = Date.now();
  list.forEach(t=>{
    const emp = employees.find(e=>e.uid === t.assignedTo);
    const assignedName = emp ? emp.name : (t.assignedTo || 'Unassigned');
    const deptName = emp && emp.department ? (deptMap[emp.department] || '—') : '—';

    let bg = '';
    const isOverdue = (t.status !== 'done' && t.deadline && ((t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime()) < now));
    if (t.status === 'done') bg = 'background:#e7ffea;';
    else if (isOverdue) bg = 'background:#ffecec;';

    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('style', bg);

    const locationHtml = t.location ? `<div class="small"><b>Location:</b><pre style="white-space:pre-wrap;margin:6px 0 0 0;">${escapeHtml(t.location)}</pre></div>` : '';

    const subCount = Array.isArray(t.subtasks) ? t.subtasks.length : 0;
    const doneCount = Array.isArray(t.subtasks) ? t.subtasks.filter(s=>s.done).length : 0;
    const pct = subCount ? Math.round((doneCount/subCount)*100) : 0;
    const progressHtml = subCount ? `<div style="margin-top:8px;"><div class="progress-bar"><div class="fill" style="width:${pct}%;"></div></div><div class="small" style="margin-top:6px;">${doneCount}/${subCount} done</div></div>` : '';

    card.innerHTML = `
      <div class="task-top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="avatar">${assignedName.charAt(0)}</div>
          <div style="flex:1">
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="small">${escapeHtml(t.description || '')}</div>
            <div class="small" style="margin-top:6px;">
              👤 <b>${assignedName}</b> <span class="dept-badge">${escapeHtml(deptName)}</span>
              ${t.recurrence ? ` • 🔁 ${escapeHtml(t.recurrence)}` : ''}
            </div>
            ${progressHtml}
          </div>
        </div>
        <div class="small">${t.status === 'done' ? '✅' : '⏳'}</div>
      </div>

      <div class="task-meta">
        <div class="small">Created: ${fmt(t.createdAt)} • Deadline: ${fmt(t.deadline)}</div>
        ${locationHtml}
      </div>

      <div class="task-actions">
        <button class="btn btn-blue" onclick="openAdminDetail('${t.id}')">Open</button>
        <button class="btn btn-blue" onclick="editTask('${t.id}')">Edit</button>
        <button class="btn btn-red" onclick="deleteTask('${t.id}')">Delete</button>
      </div>
    `;
    tasksGrid.appendChild(card);
  });
}

// ---------- admin detail modal ----------
window.openAdminDetail = async function(id){
  try {
    const snap = await getDoc(doc(db,'tasks',id));
    if (!snap.exists()) return alert('Task missing');
    const t = snap.data();
    currentAdminDetailTaskId = id;
    adminDetailTitle.textContent = t.title || '';
    const emp = employees.find(e=>e.uid === t.assignedTo);
    adminDetailAssigned.textContent = emp ? `${emp.name} • ${emp.email}` : (t.assignedTo||'Unassigned');
    adminDetailDept.textContent = emp && emp.department ? (deptMap[emp.department] || '—') : '—';
    adminDetailDeadline.textContent = fmt(t.deadline);
    adminDetailCreated.textContent = fmt(t.createdAt);
    if (t.completedAt) { adminDetailCompletedWrap.style.display = 'block'; adminDetailCompleted.textContent = fmt(t.completedAt); }
    else { adminDetailCompletedWrap.style.display = 'none'; adminDetailCompleted.textContent = ''; }
    adminDetailDesc.innerHTML = escapeHtml(t.description || '');

    adminDetailSubtasks.innerHTML = '';
    const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
    const subCount = subs.length;
    const doneCount = subs.filter(s=>s.done).length;
    const pct = subCount ? Math.round((doneCount/subCount)*100) : 0;
    const fill = adminDetailProgress.querySelector('.fill');
    if (fill) fill.style.width = pct + '%';

    if (subCount === 0) adminDetailSubtasks.innerHTML = '<div class="small">No subtasks</div>';
    else subs.forEach(s => {
      const row = document.createElement('div');
      row.className = 'admin-subtask';
      row.innerHTML = `<div style="width:22px; text-align:center;">${s.done ? '✅' : '•'}</div><div class="txt ${s.done ? 'done' : ''}">${escapeHtml(s.text)}</div>`;
      adminDetailSubtasks.appendChild(row);
    });

    if (t.status === 'done') {
      adminReopenBtn.style.display = 'inline-block';
      adminMarkDoneBtn.style.display = 'none';
    } else {
      adminReopenBtn.style.display = 'none';
      adminMarkDoneBtn.style.display = 'inline-block';
    }

    adminEditBtn.onclick = () => editTask(id);
    adminDeleteBtn.onclick = () => deleteTask(id);
    adminMarkDoneBtn.onclick = () => markDoneAndMaybeCreateNext(id);
    adminReopenBtn.onclick = () => reopenAndResetSubtasks(id);

    openModal('adminDetailModal');
  } catch(e){ console.error(e); alert(e.message||e); }
};

// ---------- save / create task ----------
async function saveTask(){
  const title = document.getElementById('taskTitle').value.trim();
  const desc = document.getElementById('taskDesc').value.trim();
  const assigned = assignUid.value;
  const deadline = document.getElementById('taskDeadline').value;
  const location = taskLocationEl.value.trim();
  const recurrence = taskRecurrenceEl.value || 'none';

  if (!title || !assigned) return alert('Please enter title and select employee.');

  const stNodes = Array.from(subtasksContainer.querySelectorAll('.subtask-row'));
  const subtasks = stNodes.map(n => ({ text: n.querySelector('.subtask-input').value.trim(), done: false })).filter(s => s.text);

  const docData = {
    title, description: desc, assignedTo: assigned,
    createdAt: new Date(), deadline: deadline ? new Date(deadline) : null,
    status: 'pending', completedAt: null, location: location || null,
    recurrence: recurrence === 'none' ? null : recurrence,
    subtasks: subtasks.length ? subtasks : null
  };

  try {
    if (editingTaskId){
      await updateDoc(doc(db,'tasks',editingTaskId), docData);
      editingTaskId = null;
    } else {
      await addDoc(collection(db,'tasks'), docData);
    }
    closeModal('taskModal');
  } catch(e){ alert(e.message||e); }
}

// ---------- edit task ----------
window.editTask = async function(id){
  editingTaskId = id;
  const snap = await getDoc(doc(db,'tasks',id));
  if (!snap.exists()) return;
  const t = snap.data();
  document.getElementById('taskTitle').value = t.title || '';
  document.getElementById('taskDesc').value = t.description || '';
  const emp = employees.find(e=>e.uid === t.assignedTo);
  assignSearch.value = emp ? emp.name : '';
  assignUid.value = t.assignedTo || '';
  document.getElementById('taskDeadline').value = safeInput(t.deadline);
  taskLocationEl.value = t.location || '';
  taskRecurrenceEl.value = t.recurrence || 'none';
  clearSubtasksUI();
  if (Array.isArray(t.subtasks)) t.subtasks.forEach(s => addSubtaskToUI({ text: s.text || s.title || '', done: !!s.done }));
  taskModalTitle.textContent = "Edit Task";
  openModal('taskModal');
};

// ---------- delete ----------
window.deleteTask = async function(id){
  if (!confirm('Delete task?')) return;
  await deleteDoc(doc(db,'tasks',id));
};

// ---------- mark done & recurring ----------
async function markDoneAndMaybeCreateNext(id){
  const taskRef = doc(db,'tasks',id);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const t = snap.data();
  await updateDoc(taskRef, { status:'done', completedAt:new Date() });

  if (t.recurrence) {
    let newDeadline = null;
    if (t.deadline) {
      const orig = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
      newDeadline = addIntervalToDate(orig, t.recurrence);
    }
    await addDoc(collection(db,'tasks'), {
      title: t.title||'', description: t.description||'', assignedTo: t.assignedTo||'',
      createdAt: new Date(), deadline: newDeadline ? new Date(newDeadline) : null,
      status:'pending', completedAt:null, location: t.location || null,
      recurrence: t.recurrence || null,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(s=>({ text:s.text, done:false })) : null
    });
  }
}

// ---------- reopen & reset subtasks ----------
async function reopenAndResetSubtasks(id){
  const taskRef = doc(db,'tasks',id);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const t = snap.data();
  const newSubs = Array.isArray(t.subtasks) ? t.subtasks.map(s => ({ text: s.text, done: false })) : null;
  await updateDoc(taskRef, { status:'pending', completedAt: null, subtasks: newSubs });
}

// ---------- create user (secondary auth) ----------
async function createUser(){
  const name = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const pass = document.getElementById('newPass').value.trim();
  const dept = newDeptSelect ? newDeptSelect.value || '' : '';

  if (!name || !email || !pass) return alert('Fill required fields');

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = cred.user.uid;
    await setDoc(doc(db,'users',uid), { name, email, role:'employee', department: dept || '', createdAt: new Date() });
    alert('Employee created');
    closeModal('userModal');
    await loadEmployees();
  } catch (e){ alert(e.message || e); }
}

// ---------- create department ----------
async function createDepartment(){
  const name = newDeptName.value.trim();
  if (!name) return alert('Enter department name');
  try {
    const ref = await addDoc(collection(db,'departments'), { name, createdAt: new Date() });
    await loadDepartments();
    if (newDeptSelect) newDeptSelect.value = ref.id;
    if (editDeptSelect) editDeptSelect.value = ref.id;
    alert('Department created');
    closeModal('addDeptModal');
  } catch(e){ alert(e.message||e); }
}

// ---------- edit user ----------
window.openEditUserModal = async function(uid){
  try {
    const snap = await getDoc(doc(db,'users',uid));
    if (!snap.exists()) return alert('User record missing');
    const data = snap.data();
    editingUserId = uid;
    editName.value = data.name || '';
    editEmail.value = data.email || '';
    editDeptSelect.value = data.department || '';
    openModal('editUserModal');
  } catch(e){ console.error(e); alert(e.message||e); }
};

async function saveEditedUser(){
  if (!editingUserId) return;
  const name = editName.value.trim();
  const dept = editDeptSelect.value || '';
  try {
    await updateDoc(doc(db,'users',editingUserId), { name, department: dept });
    await loadEmployees();
    closeModal('editUserModal');
    alert('Employee updated');
  } catch(e){ alert(e.message||e); }
}

// ---------- charts ----------
let pieChart=null, barChart=null;
function initCharts(){
  const pieCtx = document.getElementById('tasksPie').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type:'doughnut', data:{ labels:['Completed','Pending','Overdue'], datasets:[{ data:[0,0,0], backgroundColor:['#22c55e','#f59e0b','#ef4444'] }] },
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });
  const barCtx = document.getElementById('tasksBar').getContext('2d');
  barChart = new Chart(barCtx, {
    type:'bar', data:{ labels:[], datasets:[{ label:'Tasks', data:[], backgroundColor:'#6478ff' }] },
    options:{ indexAxis:'y', plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true } } }
  });
}
function updateCharts(){
  if (!pieChart) return;
  const total = tasksCache.length;
  const completed = tasksCache.filter(t=>t.status==='done').length;
  const pending = tasksCache.filter(t=>t.status!=='done').length;
  const overdue = tasksCache.filter(t=>{
    if (t.status === 'done' || !t.deadline) return false;
    const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
    return dl < Date.now();
  }).length;
  pieChart.data.datasets[0].data = [completed, pending, overdue]; pieChart.update();

  const counts = {}; employees.forEach(e=>counts[e.name]=0);
  tasksCache.forEach(t=>{ const emp = employees.find(e=>e.uid===t.assignedTo); const name = emp ? emp.name : 'Unassigned'; counts[name] = (counts[name]||0)+1; });
  const labels = Object.keys(counts).slice(0,10); const data = labels.map(l => counts[l] || 0);
  barChart.data.labels = labels; barChart.data.datasets[0].data = data; barChart.update();
}

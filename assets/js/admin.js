// admin.js — modern responsive admin panel (modular Firebase v10)
// NO duplicate imports
import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, where, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


import { auth, db } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Secondary app for user creation so admin stays logged in
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCUVdzmmeLUyVICm36khJVF38lMpMPk1qE",
  authDomain: "employee-track-1.firebaseapp.com",
  projectId: "employee-track-1",
  storageBucket: "employee-track-1.firebasestorage.app",
  messagingSenderId: "1055796115720",
  appId: "1:1055796115720:web:00c66aef9af126b83b94bd"
}, "Secondary-App");
const secondaryAuth = getAuth(secondaryApp);

// UI elements
const tasksGrid = document.getElementById("tasksGrid");
const employeeSidebar = document.getElementById("employeeSidebar");
const totalTasks = document.getElementById("totalTasks");
const pendingTasks = document.getElementById("pendingTasks");
const completedTasks = document.getElementById("completedTasks");
const overdueTasks = document.getElementById("overdueTasks");
const searchTasks = document.getElementById("searchTasks");

// modal elements
const taskModal = document.getElementById("taskModal");
const taskModalTitle = document.getElementById("taskModalTitle");
const assignSearch = document.getElementById("assignSearch");
const assignSuggestions = document.getElementById("assignSuggestions");
const assignUid = document.getElementById("assignUid");
const saveTaskBtn = document.getElementById("saveTaskBtn");

const userModal = document.getElementById("userModal");
const createUserBtn = document.getElementById("createUserBtn");

// charts
let pieChart = null;
let barChart = null;

// local caches
let employees = []; // {uid,name,email,role}
let tasksCache = []; // array of task objects
let editingTaskId = null;

// helpers
window.openModal = id => document.getElementById(id).style.display = "flex";
window.closeModal = id => document.getElementById(id).style.display = "none";

function fmt(v){
  if (!v) return "—";
  try { const d = v.toDate ? v.toDate() : new Date(v); return d.toLocaleString(); } catch { return "—"; }
}
function safeInput(v){
  if (!v) return "";
  try { const d = v.toDate ? v.toDate() : new Date(v); if (isNaN(d)) return ""; return d.toISOString().slice(0,16); } catch { return ""; }
}

// theme toggle
const themeToggle = document.getElementById("toggleTheme");
themeToggle.onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
};

// auth guard + init
auth.onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "login.html");
  if (user.email !== "kaveer.is.king@gmail.com"){ alert("Only admin allowed"); auth.signOut(); return; }

  // setup UI events
  attachEvents();

  // load employees then start tasks streaming
  await loadEmployees();
  startTasksStream();
  initCharts();
});

// attach UI events
function attachEvents(){
  document.getElementById("openCreateTaskBtn").onclick = () => {
    editingTaskId = null;
    taskModalTitle.textContent = "Create Task";
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDesc").value = "";
    assignSearch.value = "";
    assignUid.value = "";
    document.getElementById("taskDeadline").value = "";
    assignSuggestions.style.display = "none";
    openModal("taskModal");
  };

  document.getElementById("openAddUserBtn").onclick = () => {
    document.getElementById("newName").value = "";
    document.getElementById("newEmail").value = "";
    document.getElementById("newPass").value = "";
    openModal("userModal");
  };

  document.getElementById("logoutBtn").onclick = () => openModal("logoutModal");
  document.getElementById("confirmLogout").onclick = () => { auth.signOut(); window.location.href='login.html'; };

  // save task
  saveTaskBtn.onclick = saveTask;

  // create user
  createUserBtn.onclick = createUser;

  // assignSearch autocomplete
  assignSearch.oninput = handleAssignSearch;
  assignSearch.onclick = handleAssignSearch;

  // search tasks quick filter
  searchTasks.oninput = renderTasks; // re-render with filter

  // cancel modals - close via closeModal inline buttons
}

// load employees list
async function loadEmployees(){
  const snap = await getDocs(collection(db,'users'));
  employees = [];
  snap.forEach(s => {
    const d = s.data();
    employees.push({ uid: s.id, name: d.name || d.email, email: d.email, role: d.role || 'employee' });
  });
  renderEmployeesSidebar();
}

// render sidebar employees
function renderEmployeesSidebar(){
  employeeSidebar.innerHTML = "";
  employees.filter(e=>e.role==='employee').forEach(e=>{
    const row = document.createElement('div');
    row.className = 'side-row';
    row.innerHTML = `<div class="avatar">${(e.name||'U').charAt(0)}</div><div><b>${e.name}</b><div class="small">${e.email}</div></div>`;
    employeeSidebar.appendChild(row);
  });
}

// autocomplete suggestions
function handleAssignSearch(){
  const q = assignSearch.value.trim().toLowerCase();
  const list = employees.filter(e => e.role==='employee' && (e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)));
  assignSuggestions.innerHTML = "";
  if (!q || list.length === 0){ assignSuggestions.style.display = 'none'; return; }
  list.forEach(emp => {
    const r = document.createElement('div');
    r.className = 'sug-row';
    r.innerHTML = `<div class="avatar">${emp.name.charAt(0)}</div><div><b>${emp.name}</b><div class="small">${emp.email}</div></div>`;
    r.onclick = () => {
      assignSearch.value = emp.name;
      assignUid.value = emp.uid;
      assignSuggestions.style.display = 'none';
    };
    assignSuggestions.appendChild(r);
  });
  assignSuggestions.style.display = 'block';
}

// start tasks realtime
function startTasksStream(){
  const q = query(collection(db,'tasks'), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    tasksCache = [];
    snap.forEach(s => {
      const d = s.data(); d.id = s.id; tasksCache.push(d);
    });
    computeStats();
    renderTasks();
    updateCharts();
  }, err => {
    console.error('tasks stream', err);
    document.getElementById('tasksGrid').textContent = 'Error loading tasks';
  });
}

// compute stats
function computeStats(){
  const now = Date.now();
  let total = tasksCache.length;
  let completed = 0, pending = 0, overdue = 0;
  tasksCache.forEach(t=>{
    if (t.status === 'done') completed++;
    else pending++;
    if (t.status !== 'done' && t.deadline){
      const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
      if (dl < now) overdue++;
    }
  });
  totalTasks.textContent = total;
  pendingTasks.textContent = pending;
  completedTasks.textContent = completed;
  overdueTasks.textContent = overdue;
}

// render tasks grid with filter
function renderTasks(){
  const q = searchTasks.value.trim().toLowerCase();
  const filtered = tasksCache.filter(t => !q || (t.title && t.title.toLowerCase().includes(q)));
  tasksGrid.innerHTML = "";
  if (filtered.length === 0) tasksGrid.innerHTML = "<div class='small'>No tasks</div>";

  filtered.forEach(t=>{
    const emp = employees.find(e=>e.uid === t.assignedTo);
    const assignedName = emp ? emp.name : (t.assignedTo || 'Unassigned');
    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
      <div class="task-top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="avatar">${assignedName.charAt(0)}</div>
          <div>
            <div class="task-title">${t.title}</div>
            <div class="small">${assignedName}</div>
          </div>
        </div>
        <div class="small">${t.status === 'done' ? '✅' : '⏳'}</div>
      </div>

      <div class="task-meta">
        ${t.description || ''}<br>
        <span class="small">Created: ${fmt(t.createdAt)} • Deadline: ${fmt(t.deadline)}</span>
      </div>

      <div class="task-actions">
        <button class="btn btn-blue" data-id="${t.id}" onclick="editTask('${t.id}')">Edit</button>
        <button class="btn btn-red" data-id="${t.id}" onclick="deleteTask('${t.id}')">Delete</button>
        ${t.status === 'done' ? `<button class="btn btn-green" onclick="reopenTask('${t.id}')">Reopen</button>` : `<button class="btn btn-green" onclick="markDoneConfirm('${t.id}')">Mark Done</button>`}
      </div>
    `;
    tasksGrid.appendChild(card);
  });
}

// save/create task
async function saveTask(){
  const title = document.getElementById('taskTitle').value.trim();
  const desc = document.getElementById('taskDesc').value.trim();
  const assigned = assignUid.value;
  const deadline = document.getElementById('taskDeadline').value;

  if (!title || !assigned) return alert('Please enter title and select employee.');

  if (editingTaskId){
    await updateDoc(doc(db,'tasks',editingTaskId), {
      title, description: desc, assignedTo: assigned, deadline: deadline ? new Date(deadline) : null
    });
    editingTaskId = null;
  } else {
    await addDoc(collection(db,'tasks'), {
      title, description: desc, assignedTo: assigned,
      createdAt: new Date(), deadline: deadline ? new Date(deadline) : null,
      status: 'pending', completedAt: null
    });
  }
  closeModal('taskModal');
}

// edit task - open modal and prefill
window.editTask = async function(id){
  editingTaskId = id;
  const snap = await getDoc(doc(db,'tasks',id));
  const t = snap.data();
  document.getElementById('taskTitle').value = t.title || '';
  document.getElementById('taskDesc').value = t.description || '';
  const emp = employees.find(e=>e.uid === t.assignedTo);
  assignSearch.value = emp ? emp.name : '';
  assignUid.value = t.assignedTo || '';
  document.getElementById('taskDeadline').value = safeInput(t.deadline);
  taskModalTitle.textContent = "Edit Task";
  openModal('taskModal');
};

// delete task
window.deleteTask = async function(id){
  if (!confirm('Delete task?')) return;
  await deleteDoc(doc(db,'tasks',id));
};

// reopen task
window.reopenTask = async function(id){
  await updateDoc(doc(db,'tasks',id), { status:'pending', completedAt:null });
};

// mark done confirm
window.markDoneConfirm = function(id){
  if (!confirm('Mark this task as done?')) return;
  markDone(id);
};

async function markDone(id){
  await updateDoc(doc(db,'tasks',id), { status:'done', completedAt: new Date() });
}

// create employee
async function createUser(){
  const name = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const pass = document.getElementById('newPass').value.trim();
  if (!name || !email || !pass) return alert('Fill required fields');

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = cred.user.uid;
    await setDoc(doc(db,'users',uid), { name, email, role:'employee', createdAt: new Date() });
    alert('Employee created');
    closeModal('userModal');
    await loadEmployees();
  } catch (e){
    alert(e.message || e);
  }
}

// Charts
function initCharts(){
  const pieCtx = document.getElementById('tasksPie').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type:'doughnut',
    data:{ labels:['Completed','Pending','Overdue'], datasets:[{ data:[0,0,0], backgroundColor:['#22c55e','#f59e0b','#ef4444'] }] },
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  const barCtx = document.getElementById('tasksBar').getContext('2d');
  barChart = new Chart(barCtx, {
    type:'bar',
    data:{ labels:[], datasets:[{ label:'Tasks', data:[], backgroundColor:'#6478ff' }] },
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
  pieChart.data.datasets[0].data = [completed, pending, overdue];
  pieChart.update();

  // tasks per employee
  const counts = {};
  employees.forEach(e=>counts[e.name]=0);
  tasksCache.forEach(t=>{
    const emp = employees.find(e=>e.uid===t.assignedTo);
    const name = emp ? emp.name : 'Unassigned';
    counts[name] = (counts[name]||0)+1;
  });
  const labels = Object.keys(counts).slice(0,8);
  const data = labels.map(l => counts[l] || 0);
  barChart.data.labels = labels;
  barChart.data.datasets[0].data = data;
  barChart.update();
}

/* -----------------------------------------------------
   ADMIN.JS — FULL FINAL FIXED VERSION  
   UI untouched, only logic fixes
-------------------------------------------------------- */

import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, where, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --------------------------------
// SECONDARY AUTH APP (for creating employees)
// --------------------------------
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCUVdzmmeLUyVICm36khJVF38lMpMPk1qE",
  authDomain: "employee-track-1.firebaseapp.com",
  projectId: "employee-track-1",
  storageBucket: "employee-track-1.firebasestorage.app",
  messagingSenderId: "1055796115720",
  appId: "1:1055796115720:web:00c66aef9af126b83b94bd"
}, "Secondary-App");

const secondaryAuth = getAuth(secondaryApp);

// --------------------------------
// UI ELEMENT REFERENCES
// --------------------------------
// Restore saved theme on page load
const savedTheme = localStorage.getItem("tm-theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
const tasksGrid = document.getElementById("tasksGrid");
const employeeSidebar = document.getElementById("employeeSidebar");
const totalTasks = document.getElementById("totalTasks");
const pendingTasks = document.getElementById("pendingTasks");
const completedTasks = document.getElementById("completedTasks");
const overdueTasks = document.getElementById("overdueTasks");
const searchTasks = document.getElementById("searchTasks");
const filterDept = document.getElementById("filterDept");

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

// --- ADMIN DETAIL MODAL ELEMENTS ---
const adminDetailModal = document.getElementById("adminDetailModal");
const adminDetailTitle = document.getElementById("adminDetailTitle");
const adminDetailAssigned = document.getElementById("adminDetailAssigned");

// 🔥 FIXED: ensure dept element exists
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

// --------------------------------
// GLOBAL STATE
// --------------------------------
let employees = [];
let departments = [];
let deptMap = {};
let tasksCache = [];
let editingTaskId = null;
let currentAdminDetailTaskId = null;
let editingUserId = null;

// --------------------------------
// HELPER FUNCTIONS
// --------------------------------
window.openModal = id => document.getElementById(id).style.display = "flex";
window.closeModal = id => document.getElementById(id).style.display = "none";

function fmt(v) {
  if (!v) return "—";
  try {
    const d = v.toDate ? v.toDate() : new Date(v);
    return d.toLocaleString();
  } catch { return "—"; }
}

function safeInput(v) {
  if (!v) return "";
  try {
    const d = v.toDate ? v.toDate() : new Date(v);
    if (isNaN(d)) return "";
    return d.toISOString().slice(0, 16);
  } catch { return ""; }
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function addIntervalToDate(date, freq) {
  const d = new Date(date);
  if (freq === "daily") d.setDate(d.getDate() + 1);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  return d;
}

// --------------------------------
// AUTH GUARD
// --------------------------------
auth.onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "login.html");

  if (user.email !== "kaveer.is.king@gmail.com") {
    alert("Only admin allowed");
    auth.signOut();
    return;
  }

  attachEvents();
  await loadDepartments();
  await loadEmployees();
  startTasksStream();
  initCharts();
});

// --------------------------------
// ATTACH EVENTS
// --------------------------------
function attachEvents() {

  /* ---------- THEME TOGGLE (FIXED) ---------- */
  const themeBtn = document.getElementById("toggleTheme");

  themeBtn.onclick = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("tm-theme", next);
  };

  /* ---------- REST OF YOUR EVENTS (unchanged) ---------- */

  document.getElementById("openCreateTaskBtn").onclick = () => {
    editingTaskId = null;
    taskModalTitle.textContent = "Create Task";
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDesc").value = "";
    assignSearch.value = "";
    assignUid.value = "";
    taskLocationEl.value = "";
    taskRecurrenceEl.value = "none";
    document.getElementById("taskDeadline").value = "";
    clearSubtasksUI();
    assignSuggestions.style.display = "none";
    openModal("taskModal");
  };

  document.getElementById("openAddUserBtn").onclick = () => {
    document.getElementById("newName").value = "";
    document.getElementById("newEmail").value = "";
    document.getElementById("newPass").value = "";
    newDeptSelect.value = "";
    openModal("userModal");
  };

  document.getElementById("logoutBtn").onclick = () => openModal("logoutModal");
  document.getElementById("confirmLogout").onclick = () => {
    auth.signOut();
    window.location.href = "login.html";
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
  filterDept.onchange = renderTasks;

  openAddDeptBtn.onclick = () => { newDeptName.value = ""; openModal("addDeptModal"); };
  openAddDeptBtn2.onclick = () => { newDeptName.value = ""; openModal("addDeptModal"); };
  createDeptBtn.onclick = createDepartment;

  saveEditUserBtn.onclick = saveEditedUser;
}


// --------------------------------
// SUBTASK UI HELPERS
// --------------------------------
function addSubtaskToUI(item) {
  const row = document.createElement("div");
  row.className = "subtask-row";
  row.innerHTML = `
    <input class="input subtask-input" value="${escapeHtml(item.text)}">
    <button class="btn btn-red subtask-remove">Remove</button>
  `;
  row.querySelector(".subtask-remove").onclick = () => row.remove();
  subtasksContainer.appendChild(row);
}

function clearSubtasksUI() {
  subtasksContainer.innerHTML = "";
}

// --------------------------------
// DEPARTMENTS
// --------------------------------
async function loadDepartments() {
  const snap = await getDocs(collection(db, "departments"));
  departments = [];
  deptMap = {};

  snap.forEach(s => {
    departments.push({ id: s.id, name: s.data().name });
    deptMap[s.id] = s.data().name;
  });

  populateDeptSelects();
}

function populateDeptSelects() {
  [newDeptSelect, editDeptSelect].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = `<option value="">Select Department</option>`;
    departments.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name;
      sel.appendChild(opt);
    });
  });

  filterDept.innerHTML = `<option value="">All Departments</option>`;
  departments.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    filterDept.appendChild(opt);
  });
}

// --------------------------------
// EMPLOYEES
// --------------------------------
async function loadEmployees() {
  const snap = await getDocs(collection(db, "users"));
  employees = [];

  snap.forEach(s => {
    const d = s.data();
    employees.push({
      uid: s.id,
      name: d.name || d.email,
      email: d.email,
      role: d.role || "employee",
      department: d.department || ""
    });
  });

  renderEmployeesSidebar();
}

function renderEmployeesSidebar() {
  employeeSidebar.innerHTML = "";

  employees.forEach(e => {
    const deptName = e.department ? (deptMap[e.department] || "—") : "—";

    const row = document.createElement("div");
    row.className = "side-row";

    row.innerHTML = `
      <div class="avatar">${e.name.charAt(0)}</div>
      <div style="flex:1">
        <div><b>${e.name}</b></div>
        <div class="small">${e.email}</div>
        <div class="small" style="margin-top:6px;">🏷️ Dept: <b>${escapeHtml(deptName)}</b></div>
      </div>
      <button class="btn btn-muted" onclick="openEditUserModal('${e.uid}')">Edit</button>
    `;

    employeeSidebar.appendChild(row);
  });
}

function handleAssignSearch() {
  const q = assignSearch.value.trim().toLowerCase();
  const list = employees.filter(e =>
    e.role === "employee" &&
    (e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
  );

  assignSuggestions.innerHTML = "";
  if (!q || list.length === 0) return assignSuggestions.style.display = "none";

  list.forEach(emp => {
    const row = document.createElement("div");
    row.className = "sug-row";
    row.innerHTML = `
      <div class="avatar">${emp.name.charAt(0)}</div>
      <div><b>${emp.name}</b><div class="small">${emp.email}</div></div>
    `;
    row.onclick = () => {
      assignSearch.value = emp.name;
      assignUid.value = emp.uid;
      assignSuggestions.style.display = "none";
    };
    assignSuggestions.appendChild(row);
  });

  assignSuggestions.style.display = "block";
}

// --------------------------------
// TASK STREAM
// --------------------------------
function startTasksStream() {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));

  onSnapshot(q, snap => {
    tasksCache = [];
    snap.forEach(s => tasksCache.push({ ...s.data(), id: s.id }));
    computeStats();
    renderTasks();
    updateCharts();
  }, err => {
    console.error("task stream error", err);
    tasksGrid.textContent = "Error loading tasks";
  });
}

function computeStats() {
  const now = Date.now();
  let completed = 0, pending = 0, overdue = 0;

  tasksCache.forEach(t => {
    if (t.status === "done") completed++;
    else pending++;

    if (t.status !== "done" && t.deadline) {
      const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
      if (dl < now) overdue++;
    }
  });

  totalTasks.textContent = tasksCache.length;
  pendingTasks.textContent = pending;
  completedTasks.textContent = completed;
  overdueTasks.textContent = overdue;
}

function renderTasks() {
  const search = searchTasks.value.trim().toLowerCase();
  const deptFilterVal = filterDept.value;

  let list = tasksCache.filter(t => {
    // department filter
    if (deptFilterVal) {
      const emp = employees.find(e => e.uid === t.assignedTo);
      if (!emp || emp.department !== deptFilterVal) return false;
    }

    if (!search) return true;

    const emp = employees.find(e => e.uid === t.assignedTo);
    const name = emp ? emp.name.toLowerCase() : "";
    const deptName = emp && emp.department ? (deptMap[emp.department] || "").toLowerCase() : "";

    return (
      (t.title || "").toLowerCase().includes(search) ||
      (t.description || "").toLowerCase().includes(search) ||
      (t.location || "").toLowerCase().includes(search) ||
      name.includes(search) ||
      deptName.includes(search)
    );
  });

  tasksGrid.innerHTML = "";
  if (list.length === 0) return tasksGrid.innerHTML = "<div class='small'>No tasks</div>";

  const now = Date.now();

  list.forEach(t => {
    const emp = employees.find(e => e.uid === t.assignedTo);
    const name = emp ? emp.name : "Unknown";
    const deptName = emp && emp.department ? (deptMap[emp.department] || "—") : "—";

    let bg = "";
    if (t.status === "done") bg = "background:#e7ffea;";
    else if (t.deadline) {
      const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
      if (dl < now) bg = "background:#ffecec";
    }

    // progress
    const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
    const doneCount = subs.filter(s => s.done).length;
    const pct = subs.length ? Math.round((doneCount / subs.length) * 100) : 0;

    const card = document.createElement("div");
    card.className = "task-card";
    card.setAttribute("style", bg);

    card.innerHTML = `
      <div class="task-top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="avatar">${name.charAt(0)}</div>
          <div style="flex:1">
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="small">${escapeHtml(t.description || "")}</div>
            <div class="small" style="margin-top:6px;">
              👤 <b>${name}</b> <span class="dept-badge">${escapeHtml(deptName)}</span>
            </div>

            ${subs.length ? `
              <div style="margin-top:8px;">
                <div class="progress-bar"><div class="fill" style="width:${pct}%;"></div></div>
                <div class="small" style="margin-top:6px;">${doneCount}/${subs.length} done</div>
              </div>
            ` : ""}
          </div>
        </div>
        <div class="small">${t.status === "done" ? "✅" : "⏳"}</div>
      </div>

      <div class="task-meta">
        <div class="small">Created: ${fmt(t.createdAt)} • Deadline: ${fmt(t.deadline)}</div>
        ${t.location ? `
          <div class="small"><b>Location:</b>
            <pre style="white-space:pre-wrap;margin-top:4px;">${escapeHtml(t.location)}</pre>
          </div>` : ""}
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

// --------------------------------
// OPEN ADMIN DETAIL MODAL
// --------------------------------
window.openAdminDetail = async function (id) {
  try {
    const snap = await getDoc(doc(db, "tasks", id));
    if (!snap.exists()) return alert("Task missing");

    const t = snap.data();
    currentAdminDetailTaskId = id;

    adminDetailTitle.textContent = t.title || "";
    adminDetailDesc.textContent = t.description || "";

    const emp = employees.find(e => e.uid === t.assignedTo);
    adminDetailAssigned.textContent = emp ? `${emp.name} • ${emp.email}` : "Unknown";

    const deptName = emp && emp.department ? (deptMap[emp.department] || "—") : "—";
    adminDetailDept.textContent = deptName;

    adminDetailDeadline.textContent = fmt(t.deadline);
    adminDetailCreated.textContent = fmt(t.createdAt);

    if (t.completedAt) {
      adminDetailCompletedWrap.style.display = "block";
      adminDetailCompleted.textContent = fmt(t.completedAt);
    } else {
      adminDetailCompletedWrap.style.display = "none";
    }

    const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
    adminDetailSubtasks.innerHTML = "";
    const doneCount = subs.filter(s => s.done).length;
    const pct = subs.length ? Math.round((doneCount / subs.length) * 100) : 0;

    adminDetailProgress.querySelector(".fill").style.width = pct + "%";

    if (subs.length === 0) {
      adminDetailSubtasks.innerHTML = "<div class='small'>No subtasks</div>";
    } else {
      subs.forEach(s => {
        const row = document.createElement("div");
        row.className = "admin-subtask";
        row.innerHTML = `
          <div style="width:22px;text-align:center;">${s.done ? "✅" : "•"}</div>
          <div class="txt ${s.done ? "done" : ""}">${escapeHtml(s.text)}</div>
        `;
        adminDetailSubtasks.appendChild(row);
      });
    }

    // Button visibility
    if (t.status === "done") {
      adminReopenBtn.style.display = "inline-block";
      adminMarkDoneBtn.style.display = "none";
    } else {
      adminReopenBtn.style.display = "none";
      adminMarkDoneBtn.style.display = "inline-block";
    }

    // Attach handlers
    adminEditBtn.onclick = () => editTask(id);
    adminDeleteBtn.onclick = () => deleteTask(id);
    adminMarkDoneBtn.onclick = () => markDoneAndMaybeCreateNext(id);
    adminReopenBtn.onclick = () => reopenAndResetSubtasks(id);

    openModal("adminDetailModal");

  } catch (e) {
    console.error(e);
    alert(e.message || e);
  }
};

// --------------------------------
// SAVE TASK (CREATE / UPDATE)
// --------------------------------
async function saveTask() {
  const title = document.getElementById("taskTitle").value.trim();
  const desc = document.getElementById("taskDesc").value.trim();
  const assigned = assignUid.value;
  const deadline = document.getElementById("taskDeadline").value;
  const location = taskLocationEl.value.trim();
  const recurrence = taskRecurrenceEl.value || "none";

  if (!title || !assigned) return alert("Please enter title and pick employee");

  const subs = Array.from(subtasksContainer.querySelectorAll(".subtask-row"))
    .map(n => ({
      text: n.querySelector(".subtask-input").value.trim(),
      done: false
    }))
    .filter(s => s.text);

  const data = {
    title,
    description: desc,
    assignedTo: assigned,
    createdAt: new Date(),
    deadline: deadline ? new Date(deadline) : null,
    status: "pending",
    completedAt: null,
    location: location || null,
    recurrence: recurrence === "none" ? null : recurrence,
    subtasks: subs.length ? subs : null
  };

  if (editingTaskId) {
    await updateDoc(doc(db, "tasks", editingTaskId), data);
    editingTaskId = null;
  } else {
    await addDoc(collection(db, "tasks"), data);
  }

  closeModal("taskModal");
}

// --------------------------------
// EDIT TASK
// --------------------------------
window.editTask = async function (id) {
  editingTaskId = id;
  const snap = await getDoc(doc(db, "tasks", id));
  if (!snap.exists()) return;

  const t = snap.data();

  document.getElementById("taskTitle").value = t.title || "";
  document.getElementById("taskDesc").value = t.description || "";

  const emp = employees.find(e => e.uid === t.assignedTo);
  assignSearch.value = emp ? emp.name : "";
  assignUid.value = t.assignedTo;

  document.getElementById("taskDeadline").value = safeInput(t.deadline);
  taskLocationEl.value = t.location || "";
  taskRecurrenceEl.value = t.recurrence || "none";

  clearSubtasksUI();
  if (Array.isArray(t.subtasks)) {
    t.subtasks.forEach(s => addSubtaskToUI(s));
  }

  taskModalTitle.textContent = "Edit Task";
  openModal("taskModal");
};

// --------------------------------
// DELETE TASK
// --------------------------------
window.deleteTask = async function (id) {
  if (!confirm("Delete task?")) return;
  await deleteDoc(doc(db, "tasks", id));
};

// --------------------------------
// MARK DONE (WITH RECURRING)
// --------------------------------
async function markDoneAndMaybeCreateNext(id) {
  const ref = doc(db, "tasks", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const t = snap.data();
  await updateDoc(ref, { status: "done", completedAt: new Date() });

  if (t.recurrence) {
    let newDeadline = null;
    if (t.deadline) {
      const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
      newDeadline = addIntervalToDate(d, t.recurrence);
    }

    await addDoc(collection(db, "tasks"), {
      title: t.title,
      description: t.description,
      assignedTo: t.assignedTo,
      createdAt: new Date(),
      deadline: newDeadline ? new Date(newDeadline) : null,
      status: "pending",
      completedAt: null,
      location: t.location || null,
      recurrence: t.recurrence,
      subtasks: Array.isArray(t.subtasks)
        ? t.subtasks.map(s => ({ text: s.text, done: false }))
        : null
    });
  }
}

// --------------------------------
// REOPEN TASK (RESET SUBTASKS)
// --------------------------------
async function reopenAndResetSubtasks(id) {
  const ref = doc(db, "tasks", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const t = snap.data();
  const subs = Array.isArray(t.subtasks)
    ? t.subtasks.map(s => ({ text: s.text, done: false }))
    : null;

  await updateDoc(ref, {
    status: "pending",
    completedAt: null,
    subtasks: subs
  });
}

// --------------------------------
// CREATE EMPLOYEE
// --------------------------------
async function createUser() {
  const name = document.getElementById("newName").value.trim();
  const email = document.getElementById("newEmail").value.trim();
  const pass = document.getElementById("newPass").value.trim();
  const dept = newDeptSelect.value || "";

  if (!name || !email || !pass) return alert("Fill all fields");

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = cred.user.uid;

    await setDoc(doc(db, "users", uid), {
      name, email, department: dept, role: "employee", createdAt: new Date()
    });

    closeModal("userModal");
    await loadEmployees();
    alert("Employee created!");

  } catch (e) {
    alert(e.message || e);
  }
}

// --------------------------------
// ADD DEPARTMENT
// --------------------------------
async function createDepartment() {
  const name = newDeptName.value.trim();
  if (!name) return alert("Enter department name");

  const ref = await addDoc(collection(db, "departments"), {
    name,
    createdAt: new Date()
  });

  await loadDepartments();
  newDeptSelect.value = ref.id;
  editDeptSelect.value = ref.id;

  closeModal("addDeptModal");
  alert("Department created!");
}

// --------------------------------
// OPEN EDIT EMPLOYEE MODAL
// --------------------------------
window.openEditUserModal = async function (uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return alert("User not found");

  const u = snap.data();
  editingUserId = uid;

  editName.value = u.name;
  editEmail.value = u.email;
  editDeptSelect.value = u.department || "";

  openModal("editUserModal");
};

// --------------------------------
// SAVE EDITED USER
// --------------------------------
async function saveEditedUser() {
  if (!editingUserId) return;

  const name = editName.value.trim();
  const dept = editDeptSelect.value;

  await updateDoc(doc(db, "users", editingUserId), {
    name, department: dept
  });

  await loadEmployees();
  closeModal("editUserModal");
  alert("Employee updated!");
}

// --------------------------------
// CHARTS (UNCHANGED UI CODE)
// --------------------------------
let pieChart = null, barChart = null;

function initCharts() {
  const pctx = document.getElementById("tasksPie").getContext("2d");
  pieChart = new Chart(pctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending", "Overdue"],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"]
      }]
    }
  });

  const bctx = document.getElementById("tasksBar").getContext("2d");
  barChart = new Chart(bctx, {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: "#6478ff" }] },
    options: { indexAxis: "y" }
  });
}

function updateCharts() {
  if (!pieChart) return;

  const total = tasksCache.length;
  const completed = tasksCache.filter(t => t.status === "done").length;
  const pending = tasksCache.filter(t => t.status !== "done").length;
  const overdue = tasksCache.filter(t => {
    if (t.status === "done" || !t.deadline) return false;
    const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
    return dl < Date.now();
  }).length;

  pieChart.data.datasets[0].data = [completed, pending, overdue];
  pieChart.update();

  const counts = {};
  employees.forEach(e => counts[e.name] = 0);
  tasksCache.forEach(t => {
    const emp = employees.find(e => e.uid === t.assignedTo);
    const name = emp ? emp.name : "Unassigned";
    counts[name] = (counts[name] || 0) + 1;
  });

  const labels = Object.keys(counts).slice(0, 10);
  const vals = labels.map(l => counts[l]);

  barChart.data.labels = labels;
  barChart.data.datasets[0].data = vals;
  barChart.update();
}

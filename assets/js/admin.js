// -------------------------------
// IMPORTS
// -------------------------------
import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// ------------------------------------
// ⭐ FIX: Missing variable added here!
// ------------------------------------
let currentEditId = null;


// SECONDARY APP FOR CREATE USER
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCUVdzmmeLUyVICm36khJVF38lMpMPk1qE",
  authDomain: "employee-track-1.firebaseapp.com",
  projectId: "employee-track-1",
  storageBucket: "employee-track-1.firebasestorage.app",
  messagingSenderId: "1055796115720",
  appId: "1:1055796115720:web:00c66aef9af126b83b94bd"
}, "Secondary-App");

const secondaryAuth = getAuth(secondaryApp);


// MODAL HANDLERS
window.openModal = id => document.getElementById(id).style.display = "flex";
window.closeModal = id => document.getElementById(id).style.display = "none";


// SAFE DATE FORMAT
function fmt(v) {
  if (!v) return "—";
  try {
    const d = v.toDate ? v.toDate() : new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch { return "—"; }
}

function safeToInput(deadline) {
  if (!deadline) return "";
  const d = deadline.toDate ? deadline.toDate() : new Date(deadline);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 16);
}


// EMPLOYEE CACHE
let employeeList = [];
let pickerMode = "create";


// -------------------------------
// AUTH CHECK
// -------------------------------
auth.onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "login.html");

  if (user.email !== "kaveer.is.king@gmail.com") {
    alert("Not admin");
    return auth.signOut();
  }

  document.getElementById("welcomeName").textContent = user.email;

  attachListeners();
  await loadEmployees();
  loadTasksRealtime();
});


// -------------------------------
// EVENT LISTENERS
// -------------------------------
function attachListeners() {
  document.getElementById("openCreateTaskBtn").onclick =
    () => openModal("createTaskModal");

  document.getElementById("openAddUserBtn").onclick =
    () => openModal("addUserModal");

  document.getElementById("createTaskBtn").onclick = createTask;
  document.getElementById("createUserBtn").onclick = createEmployee;
  document.getElementById("saveTaskEditBtn").onclick = saveEditedTask;
}


// -------------------------------
// LOAD EMPLOYEES
// -------------------------------
async function loadEmployees() {
  const snap = await getDocs(collection(db, "users"));
  employeeList = [];

  snap.forEach(s => {
    const u = s.data();
    employeeList.push({
      uid: s.id,
      name: u.name,
      email: u.email,
      role: u.role
    });
  });

  renderEmployeePicker(employeeList);
}


// -------------------------------
// EMPLOYEE PICKER
// -------------------------------
window.openEmployeePicker = mode => {
  pickerMode = mode;
  document.getElementById("employeeSearch").value = "";
  renderEmployeePicker(employeeList);
  openModal("employeePickerModal");
};

window.filterEmployees = () => {
  const val = document.getElementById("employeeSearch").value.toLowerCase();
  const filtered = employeeList.filter(e =>
    e.name.toLowerCase().includes(val) ||
    e.email.toLowerCase().includes(val)
  );
  renderEmployeePicker(filtered);
};

function renderEmployeePicker(list) {
  const box = document.getElementById("employeePickerList");
  box.innerHTML = "";

  list
    .filter(x => x.role === "employee")
    .forEach(e => {
      const row = document.createElement("div");
      row.innerHTML = `
        <div class="avatar">👤</div>
        <div><b>${e.name}</b><br><small>${e.email}</small></div>
      `;

      row.onclick = () => {
        if (pickerMode === "create") {
          document.getElementById("taskAssignToName").value = e.name;
          document.getElementById("taskAssignToUID").value = e.uid;
        } else {
          document.getElementById("editAssignToName").value = e.name;
          document.getElementById("editAssignToUID").value = e.uid;
        }
        closeModal("employeePickerModal");
      };

      box.appendChild(row);
    });
}


// -------------------------------
// CREATE TASK
// -------------------------------
async function createTask() {
  const title = document.getElementById("taskTitle").value;
  const desc = document.getElementById("taskDesc").value;
  const assignedTo = document.getElementById("taskAssignToUID").value;
  const deadline = document.getElementById("taskDeadline").value;

  if (!title || !assignedTo) return alert("Fill required fields");

  await addDoc(collection(db, "tasks"), {
    title,
    description: desc,
    assignedTo,
    createdAt: new Date(),
    deadline: deadline ? new Date(deadline) : null,
    status: "pending",
    completedAt: null
  });

  closeModal("createTaskModal");
}


// -------------------------------
// CREATE EMPLOYEE
// -------------------------------
async function createEmployee() {
  const name = document.getElementById("newUserName").value;
  const email = document.getElementById("newUserEmail").value;
  const pass = document.getElementById("newUserPassword").value;

  if (!name || !email || !pass) return alert("Missing fields");

  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
  const uid = cred.user.uid;

  await setDoc(doc(db, "users", uid), {
    name,
    email,
    role: "employee",
    createdAt: new Date()
  });

  alert("Employee created!");

  secondaryAuth.signOut();
  closeModal("addUserModal");
  await loadEmployees();
}


// -------------------------------
// REALTIME TASKS
// -------------------------------
function loadTasksRealtime() {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  const list = document.getElementById("taskList");

  onSnapshot(q, snap => {
    list.innerHTML = "";

    snap.forEach(d => {
      const t = d.data();
      const id = d.id;

      const emp = employeeList.find(x => x.uid === t.assignedTo);
      const empName = emp ? emp.name : t.assignedTo;

      const div = document.createElement("div");
      div.innerHTML = `
        <h3>📌 ${t.title}</h3>
        <p>${t.description || ""}</p>

        <p>👤 Assigned To: <b>${empName}</b></p>
        <p>📅 Created: <b>${fmt(t.createdAt)}</b></p>
        <p>⏳ Deadline: <b>${fmt(t.deadline)}</b></p>
        <p>🟡 Status: <b>${t.status}</b></p>

        ${t.status === "done" ? `<p>✅ Completed: <b>${fmt(t.completedAt)}</b></p>` : ""}

        <button onclick="editTask('${id}')" class="button btn-yellow">✏️ Edit</button>
        <button onclick="deleteTask('${id}')" class="button btn-red">🗑 Delete</button>
        ${t.status === "done" ? `<button onclick="reopenTask('${id}')" class="button btn-green">🔄 Reopen</button>` : ""}
      `;

      list.appendChild(div);
    });
  });
}


// -------------------------------
// EDIT TASK
// -------------------------------
window.editTask = async id => {
  currentEditId = id; // ⭐ FIXED

  const snap = await getDoc(doc(db, "tasks", id));
  const t = snap.data();

  const emp = employeeList.find(x => x.uid === t.assignedTo);

  document.getElementById("editTitle").value = t.title;
  document.getElementById("editDesc").value = t.description;
  document.getElementById("editAssignToName").value = emp?.name || "Unknown";
  document.getElementById("editAssignToUID").value = t.assignedTo;

  document.getElementById("editDeadline").value = safeToInput(t.deadline);

  openModal("editTaskModal");
};


// -------------------------------
// SAVE EDIT
// -------------------------------
async function saveEditedTask() {
  const title = document.getElementById("editTitle").value;
  const desc = document.getElementById("editDesc").value;
  const assigned = document.getElementById("editAssignToUID").value;
  const deadlineRaw = document.getElementById("editDeadline").value;

  await updateDoc(doc(db, "tasks", currentEditId), {
    title,
    description: desc,
    assignedTo: assigned,
    deadline: deadlineRaw ? new Date(deadlineRaw) : null
  });

  closeModal("editTaskModal");
}


// -------------------------------
// DELETE + REOPEN
// -------------------------------
window.deleteTask = async id => {
  if (!confirm("Delete task?")) return;
  await deleteDoc(doc(db, "tasks", id));
};

window.reopenTask = async id => {
  await updateDoc(doc(db, "tasks", id), {
    status: "pending",
    completedAt: null
  });
};

// LOGOUT
document.getElementById("logoutBtn").onclick = () => {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    });
};

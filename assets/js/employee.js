// employee.js — THE ONLY FULLY CORRECT VERSION
//------------------------------------------------------------
import {
  collection, query, where, orderBy,
  onSnapshot, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

//------------------------------------------------------------
// MODAL HELPERS
//------------------------------------------------------------
window.openModal = id => document.getElementById(id).style.display = "flex";
window.closeModal = id => document.getElementById(id).style.display = "none";

//------------------------------------------------------------
// THEME INIT
//------------------------------------------------------------
const savedTheme = localStorage.getItem("tm-theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

//------------------------------------------------------------
// DOM REFS
//------------------------------------------------------------
const empNameEl = document.getElementById("empName");
const empCountsEl = document.getElementById("empCounts");
const empTasksGrid = document.getElementById("empTasksGrid");
const empSearch = document.getElementById("empSearch");

const detailTitleEl = document.getElementById("detailTitle");
const detailDescEl = document.getElementById("detailDesc");
const detailMetaEl = document.getElementById("detailMeta");
const detailSubtasksEl = document.getElementById("detailSubtasks");
const detailProgressFillEl = document.getElementById("detailProgressFill");
const detailMarkBtnEl = document.getElementById("detailMarkBtn");

const confirmTextEl = document.getElementById("confirmText");
const confirmYesBtn = document.getElementById("confirmYes");
const confirmNoBtn = document.getElementById("confirmNo");

//------------------------------------------------------------
// FIXED THEME + LOGOUT (MATCHES YOUR HTML IDs)
//------------------------------------------------------------
document.getElementById("toggleTheme").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("tm-theme", next);
};

document.getElementById("logoutBtn").onclick = () => {
  auth.signOut();
  window.location.href = "login.html";
};

//------------------------------------------------------------
// UTILITIES
//------------------------------------------------------------
function fmt(v) {
  if (!v) return "—";
  return (v.toDate ? v.toDate() : new Date(v)).toLocaleString();
}

function escapeHtml(s) {
  return s ? s.replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  ) : "";
}

//------------------------------------------------------------
// STATE
//------------------------------------------------------------
let CURRENT_TASK_ID = null;
let tasksLocal = [];

//------------------------------------------------------------
// AUTH + REAL-TIME TASK FETCH
//------------------------------------------------------------
onAuthStateChanged(auth, async user => {
  if (!user) return (window.location.href = "login.html");

  const u = await getDoc(doc(db, "users", user.uid));
  empNameEl.textContent = u.exists() ? u.data().name : user.email;

  const q = query(
    collection(db, "tasks"),
    where("assignedTo", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, snap => {
    tasksLocal = [];
    snap.forEach(s => {
      const d = s.data();
      d.id = s.id;
      tasksLocal.push(d);
    });

    updateEmployeeCounts(tasksLocal);
    renderTasks();
  });
});

//------------------------------------------------------------
// UPDATE COUNTS (works now)
//------------------------------------------------------------
function updateEmployeeCounts(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "done").length;
  const pending = tasks.filter(t => t.status !== "done").length;

  const overdue = tasks.filter(t => {
    if (!t.deadline || t.status === "done") return false;
    const dl = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
    return dl < Date.now();
  }).length;

  empCountsEl.textContent =
    `${total} tasks • ${pending} pending • ${completed} completed • ${overdue} overdue`;
}

//------------------------------------------------------------
// SEARCH FIX — NOW WORKS
//------------------------------------------------------------
empSearch.oninput = () => renderTasks();

//------------------------------------------------------------
// RENDER TASKS
//------------------------------------------------------------
function renderTasks() {
  const q = empSearch.value.trim().toLowerCase();

  const list = tasksLocal.filter(t => {
    return (
      (t.title || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.location || "").toLowerCase().includes(q)
    );
  });

  empTasksGrid.innerHTML = "";
  if (!list.length) {
    empTasksGrid.innerHTML = "<div class='small'>No tasks assigned.</div>";
    return;
  }

  list.forEach(t => {
    const overdue =
      t.deadline &&
      (t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime()) < Date.now() &&
      t.status !== "done";

    const doneCount = Array.isArray(t.subtasks) ? t.subtasks.filter(s => s.done).length : 0;
    const total = Array.isArray(t.subtasks) ? t.subtasks.length : 0;
    const pct = total ? Math.round((doneCount / total) * 100) : 0;

    const card = document.createElement("div");
    card.className = "task-card";

    card.style.background =
      t.status === "done" ? "#e7ffea" :
      overdue ? "#ffecec" : "white";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <div style="flex:1;">
          <h3>${escapeHtml(t.title)}</h3>
          <div class="small">${escapeHtml(t.description || "")}</div>

          <div class="small" style="margin-top:6px;">
            ⏳ Deadline: <b>${fmt(t.deadline)}</b><br>
            ${t.status === "done" ? `✅ Completed: <b>${fmt(t.completedAt)}</b>` : ""}
          </div>

          <div class="progress-bar" style="margin-top:10px;">
            <div class="fill" style="width:${pct}%;"></div>
          </div>

          ${t.location ? `<div class="small"><b>Location:</b><br>${escapeHtml(t.location)}</div>` : ""}
        </div>
        <div>
          <button class="btn btn-blue" data-id="${t.id}">Open</button>
        </div>
      </div>
    `;

    card.querySelector("button").onclick = () => openTaskDetailLocal(t.id);
    empTasksGrid.appendChild(card);
  });
}

//------------------------------------------------------------
// OPEN DETAIL MODAL
//------------------------------------------------------------
window.openTaskDetailLocal = async (id) => {
  const snap = await getDoc(doc(db, "tasks", id));
  if (!snap.exists()) return alert("Task missing");

  const t = snap.data();
  CURRENT_TASK_ID = id;

  detailTitleEl.textContent = t.title;
  detailDescEl.innerHTML =
    `<b>Description:</b><br>${escapeHtml(t.description || "")}<br><br>` +
    `<b>Location:</b><br>${escapeHtml((t.location || "").replace(/\n/g, "<br>"))}`;

  detailMetaEl.innerHTML =
    `Created: <b>${fmt(t.createdAt)}</b><br>` +
    `Deadline: <b>${fmt(t.deadline)}</b><br>` +
    `Status: <b>${t.status}</b>`;

  detailSubtasksEl.innerHTML = "";
  const subs = Array.isArray(t.subtasks) ? t.subtasks : [];

  subs.forEach((s, i) => {
    const row = document.createElement("div");
    row.innerHTML = `
      <input type="checkbox" data-i="${i}" ${s.done ? "checked" : ""}>
      <span style="margin-left:8px; ${s.done ? "text-decoration:line-through;" : ""}">
        ${escapeHtml(s.text)}
      </span>
    `;
    row.querySelector("input").onchange = () => updateSubtaskState(id);
    detailSubtasksEl.appendChild(row);
  });

  const done = subs.filter(s => s.done).length;
  detailProgressFillEl.style.width =
    subs.length ? Math.round((done / subs.length) * 100) + "%" : "0%";

  detailMarkBtnEl.style.display = subs.length ? "none" : "inline-block";
  detailMarkBtnEl.onclick = () => {
    confirmTextEl.textContent = t.title;
    openModal("confirmModal");
  };

  openModal("taskDetailModal");
};

//------------------------------------------------------------
// UPDATE SUBTASK
//------------------------------------------------------------
async function updateSubtaskState(id) {
  const snap = await getDoc(doc(db, "tasks", id));
  if (!snap.exists()) return;

  const t = snap.data();
  const subs = [...t.subtasks];

  detailSubtasksEl.querySelectorAll("input").forEach(b => {
    const i = parseInt(b.dataset.i);
    subs[i].done = b.checked;
  });

  await updateDoc(doc(db, "tasks", id), { subtasks: subs });

  const done = subs.filter(s => s.done).length;
  detailProgressFillEl.style.width =
    subs.length ? Math.round(done / subs.length * 100) + "%" : "0%";

  if (subs.length && subs.every(s => s.done)) {
    await updateDoc(doc(db, "tasks", id), {
      status: "done",
      completedAt: new Date()
    });
    closeModal("taskDetailModal");
  }
}

//------------------------------------------------------------
// CONFIRM DONE
//------------------------------------------------------------
confirmYesBtn.onclick = async () => {
  if (!CURRENT_TASK_ID) return;
  await updateDoc(doc(db, "tasks", CURRENT_TASK_ID), {
    status: "done",
    completedAt: new Date()
  });
  CURRENT_TASK_ID = null;
  closeModal("confirmModal");
  closeModal("taskDetailModal");
};

confirmNoBtn.onclick = () => {
  CURRENT_TASK_ID = null;
  closeModal("confirmModal");
};

// employee.js — FINAL FULLY FIXED (SUBTASKS + MARK DONE + TIME LEFT)
//------------------------------------------------------------
import {
  collection, query, where, orderBy,
  onSnapshot, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { auth, db } from "./firebase-config.js";

//------------------------------------------------------------
// MODAL HELPERS
//------------------------------------------------------------
window.openModal = id =>
  document.getElementById(id).style.display = "flex";

window.closeModal = id =>
  document.getElementById(id).style.display = "none";

//------------------------------------------------------------
// THEME INIT
//------------------------------------------------------------
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("tm-theme") || "light"
);

//------------------------------------------------------------
// DOM
//------------------------------------------------------------
const empNameEl = document.getElementById("empName");
const empCountsEl = document.getElementById("empCounts");
const empTasksGrid = document.getElementById("empTasksGrid");
const empSearch = document.getElementById("empSearch");
const tabsParent = document.getElementById("empTabs");

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
// UTILITIES
//------------------------------------------------------------
function fmt(v) {
  if (!v) return "—";
  return (v.toDate ? v.toDate() : new Date(v)).toLocaleString();
}

function timeLeft(deadline) {
  if (!deadline) return "—";

  const end = deadline.toDate
    ? deadline.toDate().getTime()
    : new Date(deadline).getTime();

  const diff = end - Date.now();
  if (diff <= 0) return "⛔ Overdue";

  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) return `⏳ ${days} day${days > 1 ? "s" : ""} left`;
  if (hrs > 0) return `⏳ ${hrs} hour${hrs > 1 ? "s" : ""} left`;
  return `⏳ ${mins} min left`;
}

function escapeHtml(s) {
  return s
    ? s.replace(/[&<>"']/g, m =>
        ({ "&":"&amp;","<":"&lt;",">":"&gt;",
           '"':"&quot;","'":"&#39;" }[m]))
    : "";
}

//------------------------------------------------------------
// STATE
//------------------------------------------------------------
let CURRENT_TASK_ID = null;
let tasksLocal = [];
let currentTab = "all";

//------------------------------------------------------------
// AUTH
//------------------------------------------------------------
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "login.html";

  const u = await getDoc(doc(db, "users", user.uid));
  empNameEl.textContent = u.exists() ? u.data().name : user.email;

  const q = query(
    collection(db, "tasks"),
    where("assignedTo", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, snap => {
    tasksLocal = [];
    snap.forEach(s => tasksLocal.push({ id: s.id, ...s.data() }));
    updateCounts();
    renderTasks();
  });
});

//------------------------------------------------------------
// COUNTS
//------------------------------------------------------------
function updateCounts() {
  const total = tasksLocal.length;
  const completed = tasksLocal.filter(t => t.status === "done").length;
  const pending = total - completed;

  const overdue = tasksLocal.filter(t =>
    t.deadline &&
    t.status !== "done" &&
    (t.deadline.toDate
      ? t.deadline.toDate().getTime()
      : new Date(t.deadline).getTime()) < Date.now()
  ).length;

  empCountsEl.textContent =
    `${total} tasks • ${pending} pending • ${completed} completed • ${overdue} overdue`;
}

//------------------------------------------------------------
// FILTERS
//------------------------------------------------------------
empSearch.oninput = renderTasks;

tabsParent.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    tabsParent.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    renderTasks();
  };
});

//------------------------------------------------------------
// RENDER TASKS
//------------------------------------------------------------
function renderTasks() {
  const q = empSearch.value.toLowerCase().trim();

  let list = tasksLocal.filter(t =>
    (t.title || "").toLowerCase().includes(q) ||
    (t.description || "").toLowerCase().includes(q)
  );

  /* ---------------- TAB FILTERS (FIXED) ---------------- */

  if (currentTab === "pending") {
    list = list.filter(t => t.status !== "done");
  }

  if (currentTab === "completed") {
    list = list.filter(t => t.status === "done");
  }

  if (currentTab === "overdue") {
    list = list.filter(t => {
      if (t.status === "done") return false;
      if (!t.deadline) return false;

      const dl = t.deadline.toDate
        ? t.deadline.toDate().getTime()
        : new Date(t.deadline).getTime();

      return dl < Date.now();
    });
  }

  if (currentTab === "recurring") {
    list = list.filter(t =>
      t.recurrence &&
      t.recurrence !== "none" &&
      t.status !== "done"
    );
  }

  /* ---------------------------------------------------- */

  empTasksGrid.innerHTML = "";
  if (!list.length) {
    empTasksGrid.innerHTML = "<div class='small'>No tasks found</div>";
    return;
  }

  list.forEach(t => {
  const done = t.subtasks?.filter(s => s.done).length || 0;
  const total = t.subtasks?.length || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const isOverdue =
    t.deadline &&
    t.status !== "done" &&
    (t.deadline.toDate
      ? t.deadline.toDate().getTime()
      : new Date(t.deadline).getTime()) < Date.now();

  const card = document.createElement("div");
  card.className = "task-card";

  /* ✅ COLOR LOGIC */
  if (t.status === "done") {
    card.style.background = "#e7ffea"; // green
  } else if (isOverdue) {
    card.style.background = "#ffecec"; // red
  } else {
    card.style.background = "white";
  }

  card.innerHTML = `
      <h3>${escapeHtml(t.title)}</h3>
      <div class="small">${escapeHtml(t.description || "")}</div>

      <div class="small">
        ⏳ Deadline: <b>${fmt(t.deadline)}</b><br>
        ${t.status === "done"
          ? `✅ Completed: <b>${fmt(t.completedAt)}</b>`
          : `🕒 Time left: <b>${timeLeft(t.deadline)}</b>`}
      </div>

      <div class="progress-bar">
        <div class="fill" style="width:${pct}%"></div>
      </div>

      <button class="btn btn-blue">Open</button>
    `;

    card.querySelector("button").onclick =
      () => openTaskDetailLocal(t.id);

    empTasksGrid.appendChild(card);
  });

}


//------------------------------------------------------------
// DETAIL MODAL
//------------------------------------------------------------
window.openTaskDetailLocal = async id => {
  const snap = await getDoc(doc(db, "tasks", id));
  if (!snap.exists()) return;

  const t = snap.data();
  CURRENT_TASK_ID = id;

  detailTitleEl.textContent = t.title;
  detailDescEl.innerHTML = escapeHtml(t.description || "");

  detailMetaEl.innerHTML = `
    Deadline: <b>${fmt(t.deadline)}</b><br>
    ${t.status === "done"
      ? `Completed: <b>${fmt(t.completedAt)}</b>`
      : `Time left: <b>${timeLeft(t.deadline)}</b>`}
  `;

  detailSubtasksEl.innerHTML = "";
  const subs = Array.isArray(t.subtasks) ? t.subtasks : [];

  subs.forEach((s, i) => {
    const row = document.createElement("div");
    row.innerHTML = `
      <input type="checkbox" data-i="${i}" ${s.done ? "checked" : ""}>
      <span style="margin-left:8px;${s.done ? "text-decoration:line-through;" : ""}">
        ${escapeHtml(s.text)}
      </span>
    `;
    row.querySelector("input").onchange = () => updateSubtasks(id);
    detailSubtasksEl.appendChild(row);
  });

  const done = subs.filter(s => s.done).length;
  detailProgressFillEl.style.width =
    subs.length ? Math.round((done / subs.length) * 100) + "%" : "0%";

  detailMarkBtnEl.style.display =
    subs.length || t.status === "done" ? "none" : "inline-block";

  detailMarkBtnEl.onclick = () => {
    confirmTextEl.textContent = t.title;
    openModal("confirmModal");
  };

  openModal("taskDetailModal");
};

//------------------------------------------------------------
// SUBTASK UPDATE
//------------------------------------------------------------
async function updateSubtasks(id) {
  const snap = await getDoc(doc(db, "tasks", id));
  if (!snap.exists()) return;

  const t = snap.data();
  const subs = [...t.subtasks];

  detailSubtasksEl.querySelectorAll("input").forEach(b => {
    subs[Number(b.dataset.i)].done = b.checked;
  });

  await updateDoc(doc(db, "tasks", id), { subtasks: subs });

  const done = subs.filter(s => s.done).length;
  detailProgressFillEl.style.width =
    subs.length ? Math.round((done / subs.length) * 100) + "%" : "0%";

  if (subs.length && subs.every(s => s.done)) {
    await updateDoc(doc(db, "tasks", id), {
      status: "done",
      completedAt: new Date()
    });
    closeModal("taskDetailModal");
  }
}

//------------------------------------------------------------
// CONFIRM DONE (NO SUBTASKS)
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

// inventory-employee.js — FINAL (TASK-WISE INVENTORY)

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

/* ---------------- DOM ---------------- */
const reqItem = document.getElementById("reqItem");
const reqQty = document.getElementById("reqQty");
const reqTask = document.getElementById("reqTask");
const sendReqBtn = document.getElementById("sendReqBtn");
const openMyToolsBtn = document.getElementById("openMyToolsBtn");
const myToolsModalList = document.getElementById("myToolsModalList");

/* ---------------- STATE ---------------- */
let CURRENT_USER = null;
let inventoryMap = {};
let taskMap = {};

/* ---------------- AUTH ---------------- */
auth.onAuthStateChanged(user => {
  if (!user) return (location.href = "login.html");
  CURRENT_USER = user;
  loadInventoryDropdown();
  loadMyTasks();
  startMyToolsStream();
});

openMyToolsBtn.onclick = () => openModal("myToolsModal");

/* ---------------- LOAD INVENTORY ---------------- */
async function loadInventoryDropdown() {
  const snap = await getDocs(collection(db, "inventory"));
  reqItem.innerHTML = `<option value="">Select item</option>`;
  inventoryMap = {};

  snap.forEach(s => {
    const d = s.data();
    if (d.deleted || d.availableQty <= 0) return;

    inventoryMap[s.id] = d;
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${d.name} (${d.availableQty})`;
    reqItem.appendChild(opt);
  });
}

/* ---------------- LOAD TASKS (FIXED – NO INDEX) ---------------- */
async function loadMyTasks() {
  const q = query(
    collection(db, "tasks"),
    where("assignedTo", "==", CURRENT_USER.uid)
  );

  const snap = await getDocs(q);

  reqTask.innerHTML = `<option value="">Select task / work</option>`;
  taskMap = {};

  snap.forEach(d => {
    const t = d.data();

    // ⛔ Skip completed tasks locally (NO Firestore index needed)
    if (t.status === "done") return;

    taskMap[d.id] = t.title;

    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = t.title;
    reqTask.appendChild(opt);
  });
}


/* ---------------- SEND MATERIAL REQUEST ---------------- */
sendReqBtn.onclick = async () => {
  const itemId = reqItem.value;
  const qty = Number(reqQty.value);
  const taskId = reqTask.value;

  if (!itemId || !qty || qty <= 0 || !taskId) {
    alert("Select item, quantity and task");
    return;
  }

  const item = inventoryMap[itemId];
  if (item.availableQty < qty) {
    alert("Not enough stock");
    return;
  }

  await addDoc(collection(db, "material_requests"), {
    itemId,
    itemName: item.name,
    qty,
    taskId,
    taskTitle: taskMap[taskId],
    employeeId: CURRENT_USER.uid,
    employeeName: CURRENT_USER.email,
    status: "pending",
    requestedAt: serverTimestamp()
  });

  reqQty.value = "";
  reqTask.value = "";
  alert("Request sent to admin");
};

/* ---------------- MY TOOLS (GROUPED + RETURN ENABLED) ---------------- */
function startMyToolsStream() {
  const q = query(
    collection(db, "inventory_logs"),
    where("employeeId", "==", CURRENT_USER.uid),
    where("status", "in", ["taken", "return_requested"]),
    orderBy("takenAt", "desc")
  );

  onSnapshot(q, snap => {
    myToolsModalList.innerHTML = "";

    if (snap.empty) {
      myToolsModalList.innerHTML =
        `<div class="small">No tools assigned</div>`;
      return;
    }

    const grouped = {};

    snap.forEach(docu => {
      const d = docu.data();
      const key = `${d.itemId}_${d.taskId}`;

      if (!grouped[key]) {
        grouped[key] = {
          itemId: d.itemId,
          itemName: d.itemName,
          taskId: d.taskId,
          taskTitle: d.taskTitle || "—",
          totalQty: 0,
          logs: [],
          takenAt: d.takenAt,
          hasPendingReturn: false
        };
      }

      grouped[key].totalQty += d.qty;
      grouped[key].logs.push({
        id: docu.id,
        qty: d.qty
      });

      if (d.status === "return_requested") {
        grouped[key].hasPendingReturn = true;
      }

      if (
        d.takenAt &&
        (!grouped[key].takenAt ||
          d.takenAt.seconds > grouped[key].takenAt.seconds)
      ) {
        grouped[key].takenAt = d.takenAt;
      }
    });

    Object.values(grouped).forEach(item => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "8px";

      card.innerHTML = `
        <h4>🧰 ${item.itemName}</h4>

        <div class="small">
          🔢 Qty: <b>${item.totalQty}</b><br>
          🧱 Task: <b>${item.taskTitle}</b><br>
          📅 Taken: ${
            item.takenAt
              ? new Date(item.takenAt.seconds * 1000).toLocaleDateString()
              : "—"
          }<br>
          ${
            item.hasPendingReturn
              ? `<span style="color:orange">⏳ Return requested (pending)</span>`
              : ""
          }
        </div>

        ${
          item.hasPendingReturn
            ? ""
            : `
              <div style="margin-top:8px;">
                <input type="number"
                  class="input"
                  id="ret_${item.itemId}_${item.taskId}"
                  placeholder="Return qty (max ${item.totalQty})"
                  min="1"
                  max="${item.totalQty}">
                
                <button class="btn btn-red"
                  style="margin-top:6px"
                  onclick='requestGroupedReturn(
                    ${JSON.stringify(item.logs)},
                    ${item.totalQty}
                  )'>
                  Request Return
                </button>
              </div>
            `
        }
      `;

      myToolsModalList.appendChild(card);
    });
  });
}


/* ---------------- REQUEST RETURN (GROUPED) ---------------- */
window.requestGroupedReturn = async function (logs, maxQty) {
  const qty = Number(
    event.target
      .previousElementSibling
      .value
  );

  if (!qty || qty <= 0 || qty > maxQty) {
    alert("Invalid return quantity");
    return;
  }

  let remaining = qty;

  // 🔁 Distribute return across logs
  for (const log of logs) {
    if (remaining <= 0) break;

    const retQty = Math.min(log.qty, remaining);

    await updateDoc(doc(db, "inventory_logs", log.id), {
      status: "return_requested",
      returnQtyRequested: retQty,
      returnRequestedAt: serverTimestamp()
    });

    remaining -= retQty;
  }

  alert("Return request sent to admin");
};


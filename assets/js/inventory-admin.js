// inventory-admin.js — FULL ADMIN INVENTORY + REQUESTS + RETURNS (FINAL)

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

/* ---------------- DOM ---------------- */
const inventoryList = document.getElementById("inventoryList");
const adminRequests = document.getElementById("adminRequests");
const addInventoryBtn = document.getElementById("addInventoryBtn");
const invName = document.getElementById("invName");
const invQty = document.getElementById("invQty");
const invUnit = document.getElementById("invUnit");
const openInventoryUsageBtn =
  document.getElementById("openInventoryUsageBtn");
const inventoryUsageList =
  document.getElementById("inventoryUsageList");


/* ---------------- STATE ---------------- */
let inventoryMap = {};

/* ---------------- AUTH ---------------- */
auth.onAuthStateChanged(user => {
  if (!user) location.href = "login.html";
  startInventoryStream();
  startMaterialRequestStream();
  startReturnRequestStream();
  startInventoryUsageStream();

});

/* ================= INVENTORY ADD ================= */
addInventoryBtn.onclick = async () => {
  const name = invName.value.trim();
  const qty = Number(invQty.value);
  const unit = invUnit.value.trim();

  if (!name || qty <= 0) return alert("Invalid inventory");

  await addDoc(collection(db, "inventory"), {
    name,
    unit: unit || "",
    totalQty: qty,
    availableQty: qty,
    deleted: false,
    createdAt: serverTimestamp()
  });

  invName.value = "";
  invQty.value = "";
  invUnit.value = "";
};

/* ================= INVENTORY LIST ================= */
function startInventoryStream() {
  const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));

  onSnapshot(q, snap => {
    inventoryList.innerHTML = "";
    inventoryMap = {};

    if (snap.empty) {
      inventoryList.innerHTML = `<div class="small">No inventory added</div>`;
      return;
    }

    snap.forEach(docu => {
      const d = docu.data();
      if (d.deleted) return;

      inventoryMap[docu.id] = d;

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h4>🧰 ${d.name}</h4>
        <div class="small">
          Stock: <b>${d.availableQty}</b> / ${d.totalQty}<br>
          Unit: ${d.unit || "—"}
        </div>
      `;

      inventoryList.appendChild(card);
    });
  });
}

/* ================= MATERIAL REQUESTS ================= */
function startMaterialRequestStream() {
  const q = query(
    collection(db, "material_requests"),
    where("status", "==", "pending"),
    orderBy("requestedAt", "desc")
  );

  onSnapshot(q, snap => {
    adminRequests.innerHTML = "";

    if (snap.empty) {
      adminRequests.innerHTML =
        `<div class="small">No material requests</div>`;
      return;
    }

    snap.forEach(docu => {
      const d = docu.data();

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h4>📦 Material Request</h4>
        <div class="small">
          🧰 ${d.itemName}<br>
          👤 ${d.employeeName}<br>
          🧱 Task: <b>${d.taskTitle || "—"}</b><br>
          🔢 Qty: <b>${d.qty}</b>
        </div>

        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-green"
            onclick="approveIssue('${docu.id}')">Approve</button>
          <button class="btn btn-red"
            onclick="rejectIssue('${docu.id}')">Reject</button>
        </div>
      `;


      adminRequests.appendChild(card);
    });
  });
}

/* ================= APPROVE ISSUE ================= */
window.approveIssue = async function (reqId) {
  const reqRef = doc(db, "material_requests", reqId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;

  const req = reqSnap.data();
  const invRef = doc(db, "inventory", req.itemId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) return;

  const inv = invSnap.data();
  if (inv.availableQty < req.qty) {
    alert("Not enough stock");
    return;
  }

  await addDoc(collection(db, "inventory_logs"), {
    itemId: req.itemId,
    itemName: req.itemName,

    taskId: req.taskId,
    taskTitle: req.taskTitle,

    employeeId: req.employeeId,
    employeeName: req.employeeName,

    qty: req.qty,
    status: "taken",
    takenAt: serverTimestamp(),
    returnedQty: 0
  });


  await updateDoc(invRef, {
    availableQty: inv.availableQty - req.qty
  });

  await updateDoc(reqRef, { status: "approved" });
};

/* ================= REJECT ISSUE ================= */
window.rejectIssue = async function (reqId) {
  await updateDoc(doc(db, "material_requests", reqId), {
    status: "rejected"
  });
};

/* ================= RETURN REQUESTS ================= */
function startReturnRequestStream() {
  const q = query(
    collection(db, "inventory_logs"),
    where("status", "==", "return_requested"),
    orderBy("returnRequestedAt", "desc")
  );

  onSnapshot(q, snap => {
    const adminReturnRequests =
      document.getElementById("adminReturnRequests");

    adminReturnRequests.innerHTML = "";

    if (snap.empty) {
      adminReturnRequests.innerHTML =
        `<div class="small">No return requests</div>`;
      return;
    }

    snap.forEach(docu => {
      const d = docu.data();

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h4>🔄 Return Request</h4>
        <div class="small">
          🧰 ${d.itemName}<br>
          👤 ${d.employeeName}<br>
          🧱 Task: ${d.taskTitle || "—"}<br>
          🔢 Qty: <b>${d.returnQtyRequested}</b>
        </div>

        <button class="btn btn-green"
          style="margin-top:8px"
          onclick="approveReturn('${docu.id}')">
          Approve Return
        </button>
      `;

      adminReturnRequests.appendChild(card);
    });
  });
}


/* ================= APPROVE RETURN ================= */
window.approveReturn = async function (logId) {
  const logRef = doc(db, "inventory_logs", logId);
  const logSnap = await getDoc(logRef);
  if (!logSnap.exists()) return;

  const log = logSnap.data();
  const invRef = doc(db, "inventory", log.itemId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) return;

  const inv = invSnap.data();
  const newReturned = (log.returnedQty || 0) + log.returnQtyRequested;
  const fullyReturned = newReturned >= log.qty;

  await updateDoc(invRef, {
    availableQty: inv.availableQty + log.returnQtyRequested
  });

  await updateDoc(logRef, {
    returnedQty: newReturned,
    returnQtyRequested: 0,
    status: fullyReturned ? "returned" : "taken",
    returnedAt: serverTimestamp()
  });
};

if (openInventoryUsageBtn) {
  openInventoryUsageBtn.onclick = () =>
    openModal("inventoryUsageModal");
}

/* ================= INVENTORY USAGE (TASK-AWARE) ================= */
function startInventoryUsageStream() {
  const q = query(
    collection(db, "inventory_logs"),
    where("status", "==", "taken")
  );

  onSnapshot(q, snap => {
    inventoryUsageList.innerHTML = "";

    if (snap.empty) {
      inventoryUsageList.innerHTML =
        `<div class="small">No tools currently issued</div>`;
      return;
    }

    const grouped = {};

    snap.forEach(docu => {
      const d = docu.data();

      // 🔑 EMPLOYEE + ITEM + TASK
      const key = `${d.employeeId}_${d.itemId}_${d.taskId || "no-task"}`;

      if (!grouped[key]) {
        grouped[key] = {
          itemName: d.itemName,
          employeeName: d.employeeName,
          taskTitle: d.taskTitle || "—",
          qty: 0,
          takenAt: d.takenAt
        };
      }

      grouped[key].qty += d.qty;

      if (
        d.takenAt &&
        (!grouped[key].takenAt ||
          d.takenAt.seconds < grouped[key].takenAt.seconds)
      ) {
        grouped[key].takenAt = d.takenAt;
      }
    });

    Object.values(grouped).forEach(r => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "8px";

      card.innerHTML = `
        <h4>🧰 ${r.itemName}</h4>
        <div class="small">
          👤 ${r.employeeName}<br>
          🧱 Task: <b>${r.taskTitle}</b><br>
          🔢 Qty: <b>${r.qty}</b><br>
          🕒 Since: ${
            r.takenAt
              ? new Date(r.takenAt.seconds * 1000).toLocaleDateString()
              : "—"
          }
        </div>
      `;

      inventoryUsageList.appendChild(card);
    });
  });
}



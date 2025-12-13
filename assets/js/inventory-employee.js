// inventory-employee.js — FINAL (PARTIAL RETURN ENABLED)

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
const sendReqBtn = document.getElementById("sendReqBtn");
const openMyToolsBtn = document.getElementById("openMyToolsBtn");
const myToolsModalList = document.getElementById("myToolsModalList");

window.openModal = id =>
  (document.getElementById(id).style.display = "flex");
window.closeModal = id =>
  (document.getElementById(id).style.display = "none");

/* ---------------- STATE ---------------- */
let CURRENT_USER = null;
let inventoryMap = {};

/* ---------------- AUTH ---------------- */
auth.onAuthStateChanged(user => {
  if (!user) return (location.href = "login.html");
  CURRENT_USER = user;
  loadInventoryDropdown();
  startMyToolsStream();
});

if (openMyToolsBtn) {
  openMyToolsBtn.onclick = () => openModal("myToolsModal");
}

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
    opt.textContent = `${d.name} (${d.availableQty} available)`;
    reqItem.appendChild(opt);
  });
}

/* ---------------- SEND MATERIAL REQUEST ---------------- */
sendReqBtn.onclick = async () => {
  const itemId = reqItem.value;
  const qty = Number(reqQty.value);

  if (!itemId || qty <= 0) {
    alert("Select item and quantity");
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
    employeeId: CURRENT_USER.uid,
    employeeName: CURRENT_USER.email,
    status: "pending",
    requestedAt: serverTimestamp()
  });

  reqQty.value = "";
  alert("Request sent to admin");
};

/* ---------------- MY TOOLS (MERGED BY ITEM) ---------------- */
function startMyToolsStream() {
  const q = query(
    collection(db, "inventory_logs"),
    where("employeeId", "==", CURRENT_USER.uid),
    where("status", "==", "taken"),
    orderBy("takenAt", "desc")
  );

  onSnapshot(q, snap => {
    myToolsModalList.innerHTML = "";

    if (snap.empty) {
      myToolsModalList.innerHTML =
        `<div class="small">No tools assigned</div>`;
      return;
    }

    // 🔹 GROUP BY itemId
    const grouped = {};

    snap.forEach(docu => {
      const d = docu.data();

      if (!grouped[d.itemId]) {
        grouped[d.itemId] = {
          itemId: d.itemId,
          itemName: d.itemName,
          totalQty: 0,
          latestTakenAt: d.takenAt
        };
      }

      grouped[d.itemId].totalQty += d.qty || 1;

      // keep latest date
      if (
        d.takenAt &&
        (!grouped[d.itemId].latestTakenAt ||
          d.takenAt.seconds > grouped[d.itemId].latestTakenAt.seconds)
      ) {
        grouped[d.itemId].latestTakenAt = d.takenAt;
      }
    });

    // 🔹 RENDER ONE CARD PER ITEM
    Object.values(grouped).forEach(item => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "8px";

      card.innerHTML = `
        <h4>${item.itemName}</h4>
        <div class="small">
          🔢 Qty: <b>${item.totalQty}</b><br>
          📅 Taken: ${
            item.latestTakenAt
              ? new Date(item.latestTakenAt.seconds * 1000).toLocaleDateString()
              : "—"
          }
        </div>

        <button class="btn btn-red" style="margin-top:8px"
          onclick="openReturnModal('${item.itemId}', ${item.totalQty})">
          Request Return
        </button>
      `;

      myToolsModalList.appendChild(card);
    });
  });
}


/* ---------------- REQUEST RETURN (PARTIAL) ---------------- */
window.requestReturn = async function (logId, maxQty) {
  const input = document.getElementById(`retQty_${logId}`);
  const qty = Number(input.value);

  if (!qty || qty <= 0 || qty > maxQty) {
    alert("Invalid return quantity");
    return;
  }

  await updateDoc(doc(db, "inventory_logs", logId), {
    status: "return_requested",
    returnQtyRequested: qty,
    returnRequestedAt: serverTimestamp()
  });

  alert("Return request sent to admin");
};

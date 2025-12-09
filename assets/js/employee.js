import {
    getDoc, doc, updateDoc,
    collection, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

window.openModal = id => document.getElementById(id).style.display = "flex";
window.closeModal = id => document.getElementById(id).style.display = "none";

let currentTaskId = null;

function fmt(v){
    if (!v) return "—";
    const d = v.toDate ? v.toDate() : new Date(v);
    return d.toLocaleString();
}

function timeLeft(deadline){
    if (!deadline) return "—";
    const dl = deadline.toDate ? deadline.toDate().getTime() : new Date(deadline).getTime();
    const diff = dl - Date.now();
    if (diff <= 0) return "Overdue";

    const mins = Math.floor(diff/60000);
    const days = Math.floor(mins/1440);
    const hours = Math.floor((mins%1440)/60);
    const minutes = mins%60;

    return `${days}d ${hours}h ${minutes}m`;
}

auth.onAuthStateChanged(async user => {
    if (!user) return (window.location.href="login.html");

    // Load name
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) document.getElementById("empName").textContent = snap.data().name;

    // Load tasks
    const q = query(
        collection(db, "tasks"),
        where("assignedTo", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, snap => {
        const list = document.getElementById("taskList");
        list.innerHTML = "";

        snap.forEach(taskDoc => {
            const t = taskDoc.data();
            const id = taskDoc.id;

            const div = document.createElement("div");
            div.innerHTML = `
                <h3>📌 ${t.title}</h3>
                <p>${t.description}</p>
                <p>📅 Assigned: <b>${fmt(t.createdAt)}</b></p>
                <p>⏳ Deadline: <b>${fmt(t.deadline)}</b></p>
                <p>⌛ Time Left: <b>${t.status==="done"?"—":timeLeft(t.deadline)}</b></p>
                <p>🟡 Status: ${t.status}</p>

                ${
                    t.status === "done"
                    ? `<p>✅ Completed: <b>${fmt(t.completedAt)}</b></p>`
                    : `<button onclick="askDone('${id}','${t.title}')" style="background:#2ecc71;color:white;padding:6px 10px;">Mark Done</button>`
                }
            `;

            list.appendChild(div);
        });
    });
});

window.askDone = function(id, title){
    currentTaskId = id;
    document.getElementById("doneTaskTitle").textContent = title;
    openModal("doneModal");
};

document.getElementById("confirmDoneBtn").onclick = async () => {
    await updateDoc(doc(db, "tasks", currentTaskId), {
        status:"done",
        completedAt:new Date()
    });
    closeModal("doneModal");
};

document.getElementById("cancelDoneBtn").onclick = () => closeModal("doneModal");

// LOGOUT
document.getElementById("logoutBtn").onclick = () => {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    });
};

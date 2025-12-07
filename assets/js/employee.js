import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const taskListDiv = document.getElementById("taskList");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href="login.html";
    return;
  }
  loadTasks(user.uid);
});

logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => window.location.href="login.html");
});

function formatTimeLeft(deadline) {
  const now = new Date();
  const diff = deadline - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff/1000/60/60/24);
  const hours = Math.floor((diff/1000/60/60) % 24);
  const minutes = Math.floor((diff/1000/60) % 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function loadTasks(uid) {
  const q = query(collection(db, "tasks"), where("assignedTo","==",uid), orderBy("createdAt","desc"));
  onSnapshot(q, snapshot => {
    taskListDiv.innerHTML = "";
    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const id = docSnap.id;
      const deadlineDate = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline);
      const div = document.createElement("div");

      div.innerHTML = `
        <h3>${t.title}</h3>
        <p>${t.description}</p>
        <p><b>Status:</b> ${t.status}</p>
        <p><b>Assigned:</b> ${t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : "N/A"}</p>
        <p><b>Deadline:</b> ${deadlineDate.toLocaleString()}</p>
        <p><b>Time Left:</b> ${formatTimeLeft(deadlineDate)}</p>
      `;

      if (t.status !== "done") {
        const btn = document.createElement("button");
        btn.textContent = "Mark as Done";
        btn.addEventListener("click", async () => {
          await updateDoc(doc(db, "tasks", id), { status: "done" });
        });
        div.appendChild(btn);
      } else {
        const doneSpan = document.createElement("span");
        doneSpan.textContent = "✔ Completed";
        doneSpan.style.color="green";
        doneSpan.style.fontWeight="bold";
        div.appendChild(doneSpan);
      }

      div.style.border="1px solid #aaa";
      div.style.padding="10px";
      div.style.margin="10px 0";
      div.style.borderRadius="6px";

      taskListDiv.appendChild(div);
    });
  });
}

import { auth, db } from "./firebase-config.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const taskListDiv = document.getElementById("taskList");
const createBtn = document.getElementById("createBtn");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  loadTasks();
});

logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => window.location.href="login.html");
});

createBtn.addEventListener("click", async () => {
  const title = document.getElementById("taskTitle").value;
  const desc = document.getElementById("taskDescription").value;
  const assignedTo = document.getElementById("assignedTo").value;
  const deadlineInput = document.getElementById("deadline").value;
  if (!title || !desc || !assignedTo || !deadlineInput) return alert("Fill all fields");

  try {
    await addDoc(collection(db, "tasks"), {
      title,
      description: desc,
      assignedTo,
      status: "pending",
      createdAt: serverTimestamp(),
      deadline: new Date(deadlineInput)
    });
    alert("Task created!");
  } catch(e) {
    console.error(e);
    alert("Error creating task");
  }
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

function loadTasks() {
  const q = query(collection(db, "tasks"), orderBy("createdAt","desc"));
  onSnapshot(q, snapshot => {
    taskListDiv.innerHTML = "";
    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const div = document.createElement("div");
      const deadlineDate = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline);
      div.innerHTML = `
        <h3>${t.title}</h3>
        <p>${t.description}</p>
        <p><b>Assigned To:</b> ${t.assignedTo}</p>
        <p><b>Status:</b> ${t.status}</p>
        <p><b>Assigned:</b> ${t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : "N/A"}</p>
        <p><b>Deadline:</b> ${deadlineDate.toLocaleString()}</p>
        <p><b>Time Left:</b> ${formatTimeLeft(deadlineDate)}</p>
        <hr>
      `;
      taskListDiv.appendChild(div);
    });
  });
}

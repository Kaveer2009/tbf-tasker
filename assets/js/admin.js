// const adminEmails = ["kaveer.is.king@gmail.com"]; // admin list

// auth.onAuthStateChanged(async (user) => {
//   if (!user) {
//     window.location.href = "login.html";
//     return;
//   }

//   if (!adminEmails.includes(user.email)) {
//     alert("You are not an admin");
//     window.location.href = "employee.html";
//     return;
//   }

//   loadTasks();
// });

// // Logout
// document.getElementById("logoutBtn").onclick = () => {
//   auth.signOut().then(() => {
//     window.location.href = "login.html";
//   });
// };

// // Create Task
// document.getElementById("createBtn").onclick = async () => {
//   const title = document.getElementById("title").value;
//   const desc = document.getElementById("desc").value;
//   const assignedTo = document.getElementById("assignedTo").value;
//   const dueAtValue = document.getElementById("dueAt").value;

//   if (!title || !assignedTo) {
//     alert("Title & assignedTo UID required");
//     return;
//   }

//   const task = {
//     title,
//     desc,
//     assignedTo,
//     createdAt: firebase.firestore.FieldValue.serverTimestamp(),
//     status: "pending",
//   };

//   if (dueAtValue) task.dueAt = firebase.firestore.Timestamp.fromDate(new Date(dueAtValue));

//   try {
//     await db.collection("tasks").add(task);
//     alert("Task created!");
//   } catch (err) {
//     console.error(err);
//     alert("Error creating task: " + err.message);
//   }
// };

// // Load Tasks
// function loadTasks() {
//   const list = document.getElementById("tasks");
//   list.innerHTML = "";

//   db.collection("tasks")
//     .orderBy("createdAt", "desc")
//     .onSnapshot(
//       (snap) => {
//         list.innerHTML = "";
//         snap.forEach((doc) => {
//           const data = doc.data();
//           const li = document.createElement("li");
//           li.innerHTML = `
//             <strong>${data.title}</strong><br>
//             Assigned to: ${data.assignedTo}<br>
//             Status: ${data.status}
//           `;
//           list.appendChild(li);
//         });
//       },
//       (err) => {
//         console.error(err);
//         alert("Error loading tasks");
//       }
//     );
// }

document.addEventListener("DOMContentLoaded", () => {
    window.auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        console.log("Admin logged:", user.email);
        loadTasks();
    });
});

function loadTasks() {
    const list = document.getElementById("taskList"); // MUST MATCH HTML
    list.innerHTML = "Loading...";

    window.db.collection("tasks")
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {
            list.innerHTML = "";

            snapshot.forEach(doc => {
                const t = doc.data();
                const div = document.createElement("div");

                div.innerHTML = `
                    <h3>${t.title}</h3>
                    <p>${t.description}</p>
                    <p><strong>Assigned To:</strong> ${t.assignedTo}</p>
                    <p><strong>Status:</strong> ${t.status}</p>
                    <hr>
                `;

                list.appendChild(div);
            });
        });
}

function createTask() {
    const title = document.getElementById("taskTitle").value;
    const desc = document.getElementById("taskDescription").value;
    const assignedTo = document.getElementById("assignedTo").value;

    if (!title || !desc || !assignedTo) {
        alert("Fill all fields");
        return;
    }

    window.db.collection("tasks").add({
        title,
        description: desc,
        assignedTo,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Task created!");
    });
}

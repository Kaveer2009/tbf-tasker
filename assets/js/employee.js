// auth.onAuthStateChanged(async (user) => {
//   if (!user) {
//     window.location.href = "login.html";
//     return;
//   }

//   loadMyTasks(user.uid);
// });

// // Logout
// document.getElementById("logoutBtn").onclick = () => {
//   auth.signOut().then(() => {
//     window.location.href = "login.html";
//   });
// };

// // Load employee-specific tasks
// function loadMyTasks(uid) {
//   const list = document.getElementById("tasks");
//   list.innerHTML = "";

//   db.collection("tasks")
//     .where("assignedTo", "==", uid)
//     .orderBy("createdAt", "desc")
//     .onSnapshot(
//       (snap) => {
//         list.innerHTML = "";

//         if (snap.empty) {
//           list.innerHTML = "<li>No tasks assigned.</li>";
//           return;
//         }

//         snap.forEach((doc) => {
//           const data = doc.data();
//           const li = document.createElement("li");

//           li.innerHTML = `
//             <strong>${data.title}</strong><br>
//             Status: ${data.status}<br>
//             <button class="doneBtn" data-id="${doc.id}">
//               Mark as Done
//             </button>
//           `;

//           list.appendChild(li);
//         });

//         attachDoneButtons();
//       },
//       (err) => {
//         console.error(err);
//         alert("Error loading tasks");
//       }
//     );
// }

// // Button: Mark task as done
// function attachDoneButtons() {
//   document.querySelectorAll(".doneBtn").forEach((btn) => {
//     btn.onclick = async (e) => {
//       const id = btn.dataset.id;
//       try {
//         await db.collection("tasks").doc(id).update({
//           status: "done",
//           doneAt: firebase.firestore.FieldValue.serverTimestamp(),
//         });
//       } catch (err) {
//         console.error(err);
//         alert("Error marking done: " + err.message);
//       }
//     };
//   });
// }

// employee.js - Firebase Compat Version

document.addEventListener("DOMContentLoaded", () => {
    const tasksContainer = document.getElementById("tasksContainer");

    // Wait for auth state
    window.auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        console.log("Logged in as:", user.email);

        loadTasks(user.uid);  // Use UID for assignedTo
    });
});

function loadTasks(uid) {
    const tasksContainer = document.getElementById("tasksContainer");
    tasksContainer.innerHTML = "Loading...";

    window.db.collection("tasks")
        .where("assignedTo", "==", uid)
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {
            tasksContainer.innerHTML = "";

            if (snapshot.empty) {
                tasksContainer.innerHTML = "<p>No tasks assigned.</p>";
                return;
            }

            snapshot.forEach(doc => {
                const task = doc.data();
                const div = document.createElement("div");

                div.innerHTML = `
                    <h3>${task.title}</h3>
                    <p>${task.description}</p>
                    <p><strong>Status:</strong> ${task.status}</p>
                    ${task.status !== "done" ? `<button onclick="markDone('${doc.id}')">Mark as Done</button>` : ""}
                    <hr>
                `;

                tasksContainer.appendChild(div);
            });
        }, err => {
            console.error("Error loading tasks:", err);
            tasksContainer.innerHTML = "Error loading tasks.";
        });
}

function markDone(id) {
    window.db.collection("tasks").doc(id).update({
        status: "done"
    }).then(() => {
        alert("Task marked done!");
    });
}

import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const adminEmails = ["kaveer.is.king@gmail.com"];
const loginBtn = document.getElementById("loginBtn");

onAuthStateChanged(auth, user => {
  if (user) {
    if (adminEmails.includes(user.email)) window.location.href = "admin.html";
    else window.location.href = "employee.html";
  }
});

loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  if (!email || !password) return alert("Enter email & password");

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (adminEmails.includes(user.email)) window.location.href = "admin.html";
    else window.location.href = "employee.html";
  } catch (e) {
    alert(e.message);
  }
});

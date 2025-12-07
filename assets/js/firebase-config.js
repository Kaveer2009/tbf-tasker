// Firebase modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUVdzmmeLUyVICm36khJVF38lMpMPk1qE",
  authDomain: "employee-track-1.firebaseapp.com",
  projectId: "employee-track-1",
  storageBucket: "employee-track-1.firebasestorage.app",
  messagingSenderId: "1055796115720",
  appId: "1:1055796115720:web:00c66aef9af126b83b94bd"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
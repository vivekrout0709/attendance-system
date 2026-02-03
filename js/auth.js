import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

/* Convert roll → fake email (SAME logic as signup + migration) */
function rollToEmail(roll) {
  return `${roll}@attendance.app`;
}

window.login = async () => {
  const roll = document.getElementById("loginRoll")?.value
    .trim()
    .toUpperCase();
  const password = document.getElementById("loginPassword")?.value.trim();

  if (!roll || !password) {
    alert("Enter registration number and password");
    return;
  }

  try {
    const email = rollToEmail(roll);

    // 🔐 Firebase Auth login
    const cred = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // 📄 Load Firestore profile (optional but recommended)
    const userRef = doc(db, "users", cred.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      alert("User profile not found");
      return;
    }

    const userData = snap.data();

    sessionStorage.setItem("uid", cred.user.uid);
    sessionStorage.setItem("roll", userData.roll);
    sessionStorage.setItem("role", userData.role);

    // 🎯 Redirect
    if (userData.role === "admin") {
      location.replace("admin.html");
    } else {
      location.replace("attendance.html");
    }

  } catch (err) {
    alert("Invalid roll number or password");
    console.error(err);
  }
};

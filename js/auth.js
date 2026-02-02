import { db } from "./firebase.js";
import { doc, getDoc } from
"https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

window.login = async () => {
  const roll = document.getElementById("roll").value.trim().toUpperCase();
  const pass = document.getElementById("password").value.trim();

  if (!roll || !pass) {
    alert("Enter roll number and password");
    return;
  }

  const ref = doc(db, "users", roll);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Invalid login");
    return;
  }

  const data = snap.data();
  if (data.password !== pass) {
    alert("Invalid login");
    return;
  }

  // 🔥 ALWAYS RESET SESSION
  sessionStorage.clear();

  // ✅ ADMIN LOGIN (ONLY THIS PATH)
  if (roll === "ADMIN001") {
    sessionStorage.setItem("admin", "true");
    location.replace("admin.html");
    return;
  }

  // ✅ STUDENT LOGIN (ONLY STUDENTS)
  sessionStorage.setItem("roll", roll);
  location.replace("attendance.html");
};

import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from
"https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { doc, setDoc } from
"https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

function rollToEmail(roll) {
  return `${roll}@attendance.app`;
}

window.signup = async () => {
  const name = document.getElementById("name").value.trim();
  const roll = document.getElementById("roll").value.trim().toUpperCase();
  const password = document.getElementById("password").value.trim();

  if (!name || !roll || !password) {
    alert("All fields are required");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  try {
    const email = rollToEmail(roll);

    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      roll,
      role: "student",
      createdAt: new Date()
    });

    sessionStorage.setItem("roll", roll);
    location.replace("attendance.html");

  } catch (err) {
    alert(err.message);
  }
};

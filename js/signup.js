import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const sectionSelect = document.getElementById("section");
const sectionHint = document.getElementById("sectionHint");

function rollToEmail(roll) { return `${roll}@attendance.app`; }

async function loadSections() {
  if (!sectionSelect) return;
  try {
    const snap = await getDocs(collection(db, "timetables"));
    const sections = snap.docs.map(d => d.id).sort((a,b) => a.localeCompare(b));
    sectionSelect.innerHTML = `<option value="">Select your section</option>`;
    sections.forEach(section => {
      const option = document.createElement("option");
      option.value = section;
      option.textContent = section;
      sectionSelect.appendChild(option);
    });
    if (!sections.length) {
      sectionSelect.innerHTML = `<option value="">No sections available</option>`;
      sectionHint.textContent = "No sections have been configured yet. Contact admin.";
    }
  } catch (err) {
    console.error(err);
    sectionSelect.innerHTML = `<option value="">Unable to load sections</option>`;
    sectionHint.textContent = "Could not load sections. Please try again.";
  }
}

loadSections();

window.signup = async () => {
  const name = document.getElementById("name").value.trim();
  const roll = document.getElementById("roll").value.trim().toUpperCase();
  const section = document.getElementById("section").value.trim().toUpperCase();
  const password = document.getElementById("password").value.trim();

  if (!name || !roll || !section || !password) {
    alert("Name, registration number, section and password are required.");
    return;
  }
  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  try {
    const timetableSnap = await getDoc(doc(db, "timetables", section));
    if (!timetableSnap.exists()) {
      alert(`Section "${section}" is no longer available. Please refresh and select a valid section.`);
      await loadSections();
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, rollToEmail(roll), password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name, roll, section, role: "student", createdAt: new Date()
    });

    sessionStorage.setItem("uid", cred.user.uid);
    sessionStorage.setItem("roll", roll);
    sessionStorage.setItem("section", section);
    sessionStorage.setItem("role", "student");
    sessionStorage.removeItem("admin");
    location.replace("attendance.html");
  } catch (err) {
    console.error(err);
    if (err.code === "auth/email-already-in-use") alert("This registration number already has an account.");
    else alert(err.message || "Unable to create account.");
  }
};

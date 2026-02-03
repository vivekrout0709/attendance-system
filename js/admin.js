import { db } from "./firebase.js";
import { doc, setDoc, deleteDoc } from
"https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

/* ===========================
   ADMIN PAGE PROTECTION
=========================== */

// 🚫 BLOCK NON-ADMIN USERS
if (sessionStorage.getItem("admin") !== "true") {
  location.replace("index.html");
  throw new Error("Non-admin blocked");
}

// ❌ DO NOT USE roll here — admin page must never depend on roll

/* ===========================
   SAVE HOLIDAY
=========================== */

window.saveHoliday = async () => {
  const mode = document.querySelector("input[name='mode']:checked")?.value;
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value || null;
  const reason = document.getElementById("reason").value || "";

  if (!start) {
    alert("Select a start date");
    return;
  }

  await setDoc(doc(db, "holidays", start), {
    type: mode || "single",
    endDate: mode === "range" ? end : null,
    reason,
    createdBy: "admin",
    createdAt: new Date()
  });

  alert("Holiday saved!");
};

/* ===========================
   DELETE HOLIDAY
=========================== */

window.deleteHoliday = async () => {
  const start = document.getElementById("startDate").value;

  if (!start) {
    alert("Select the date to delete");
    return;
  }

  await deleteDoc(doc(db, "holidays", start));

  alert("Holiday deleted!");
};

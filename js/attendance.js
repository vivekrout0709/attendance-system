import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

/* ===========================
   SESSION GUARD
=========================== */
if (sessionStorage.getItem("admin") === "true") {
  location.replace("admin.html");
  throw new Error("Admin blocked");
}

const roll = sessionStorage.getItem("roll");
if (!roll) {
  location.replace("index.html");
  throw new Error("No session");
}

/* ===========================
   LOGOUT
=========================== */
window.logout = () => {
  sessionStorage.clear();
  location.href = "index.html";
};

/* ===========================
   UI ELEMENTS
=========================== */
const welcomeName = document.getElementById("welcomeName");
const liveDateTime = document.getElementById("liveDateTime");
const sundayMsg = document.getElementById("sundayMsg");
const todayBox = document.getElementById("today");
const summaryBox = document.getElementById("summary");

/* ===========================
   CONFIG
=========================== */
const SECTION = "24E1P1";
const today = new Date().toLocaleDateString("en-CA");
const day = new Date().toLocaleDateString("en-US", { weekday: "long" });

/* ===========================
   HELPERS
=========================== */
function normalizeSubject(name) {
  return name.split(" ")[0].trim().toUpperCase();
}

/* ===========================
   STUDENT NAME
=========================== */
async function loadStudentName() {
  const snap = await getDoc(doc(db, "users", roll));
  if (snap.exists()) {
    welcomeName.innerText = `Welcome, ${snap.data().name} 👋`;
  }
}

/* ===========================
   LIVE CLOCK
=========================== */
function startClock() {
  setInterval(() => {
    liveDateTime.innerText = new Date().toLocaleString("en-IN");
  }, 1000);
}

/* ===========================
   HOLIDAY CHECK
=========================== */
async function isHoliday() {
  const snap = await getDoc(doc(db, "holidays", today));
  return snap.exists();
}

/* ===========================
   SUNDAY MESSAGE
=========================== */
async function loadSundayMsg() {
  const isHol = await isHoliday();
  if (new Date().getDay() === 0 && !isHol && sundayMsg) {
    sundayMsg.style.display = "block";
    sundayMsg.innerText = "😄 Sunday have a fun day!";
  }
}

/* ===========================
   MARK ATTENDANCE (FIXED)
=========================== */
window.markAttendance = async (subject, status) => {
  if (await isHoliday()) return;

  const dailyRef = doc(
    db,
    "attendance",
    today,
    "students",
    roll,
    "subjects",
    subject
  );

  // ⛔ Prevent double marking
  const dailySnap = await getDoc(dailyRef);
  if (dailySnap.exists() && dailySnap.data().marked === true) return;

  // ✅ Save daily attendance
  await setDoc(
    dailyRef,
    {
      status,
      marked: true,
      timestamp: serverTimestamp()
    },
    { merge: true }
  );

  /* ===== USER SUMMARY (PER USER, PER SUBJECT) ===== */
  const summaryRef = doc(
    db,
    "attendanceSummary",
    roll,
    "subjects",
    subject
  );

  const sumSnap = await getDoc(summaryRef);

  let present = 0;
  let total = 0;

  if (sumSnap.exists()) {
    present = sumSnap.data().present || 0;
    total = sumSnap.data().total || 0;
  } else {
    // 🔒 HARD INIT for brand-new user & subject
    await setDoc(summaryRef, {
      present: 0,
      total: 0
    });
  }

  total++;
  if (status === "present") present++;

  await setDoc(
    summaryRef,
    { present, total },
    { merge: true }
  );

  loadToday();
  loadSummary();
};

/* ===========================
   LOAD TODAY CLASSES
=========================== */
async function loadToday() {
  todayBox.innerHTML = "";

  if (await isHoliday()) {
    todayBox.innerHTML = `
      <div class="card center">
        <h2>🎉 Holiday</h2>
        <p>No classes today</p>
      </div>`;
    return;
  }

  const tt = await getDoc(doc(db, "timetables", SECTION));
  if (!tt.exists()) return;

  const classes = tt.data()[day] || [];

  for (const c of classes) {
    const key = normalizeSubject(c.subject);

    const ref = doc(
      db,
      "attendance",
      today,
      "students",
      roll,
      "subjects",
      key
    );

    const snap = await getDoc(ref);

    let statusText = "ABSENT";
    let isMarked = false;

    if (snap.exists()) {
      statusText = snap.data().status.toUpperCase();
      isMarked = snap.data().marked === true;
    }

    todayBox.innerHTML += `
      <div class="card">
        <h3>${c.subject}</h3>
        <div class="time">${c.time}</div>
        <b>Status: ${statusText}</b>

        ${
          !isMarked
            ? `<div class="btn-row">
                <button class="present-btn"
                  onclick="markAttendance('${key}','present')">
                  Present
                </button>
                <button class="absent-btn"
                  onclick="markAttendance('${key}','absent')">
                  Absent
                </button>
              </div>`
            : ""
        }
      </div>`;
  }
}

/* ===========================
   LOAD SUMMARY
=========================== */
async function loadSummary() {
  summaryBox.innerHTML = "";

  const snap = await getDocs(
    collection(db, "attendanceSummary", roll, "subjects")
  );

  if (snap.empty) {
    summaryBox.innerHTML = "No attendance data yet";
    return;
  }

  snap.forEach(d => {
    const { present = 0, total = 0 } = d.data();
    const percent = total ? Math.round((present / total) * 100) : 0;

    let colorClass = "red";
    if (percent >= 75) colorClass = "green";
    else if (percent >= 65) colorClass = "yellow";

    summaryBox.innerHTML += `
      <div class="summary-card">
        <h3>${d.id}</h3>
        <p>${present} / ${total} classes</p>

        <div class="progress">
          <div class="fill ${colorClass}"
               style="--target-width:${percent}%"></div>
        </div>

        <b class="percent" data-target="${percent}">0%</b>
      </div>`;
  });

  animatePercent();
}

/* ===========================
   % ANIMATION
=========================== */
function animatePercent() {
  document.querySelectorAll(".percent").forEach(el => {
    const target = +el.dataset.target;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 25));

    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.innerText = `${current}%`;
    }, 20);
  });
}

/* ===========================
   START APP
=========================== */
loadStudentName();
startClock();
loadSundayMsg();
loadToday();
loadSummary();

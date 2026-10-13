import { db, auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";


// =====================================================
// ADMIN PROTECTION
// =====================================================

if (localStorage.getItem("admin") === "true") {
  location.replace("admin.html");
  throw new Error("Admin blocked");
}


// =====================================================
// SESSION
// =====================================================

const roll = localStorage.getItem("roll");
const uid = localStorage.getItem("uid");

if (!roll || !uid) {
  location.replace("index.html");
  throw new Error("No session");
}


// =====================================================
// LOGOUT
// =====================================================

window.logout = async () => {
  localStorage.clear();
  try { await signOut(auth); } catch (error) { console.error("Sign out failed", error); }
  location.replace("index.html");
};


// =====================================================
// DOM ELEMENTS
// =====================================================

const welcomeName = document.getElementById("welcomeName");
const liveDateTime = document.getElementById("liveDateTime");
const sundayMsg = document.getElementById("sundayMsg");
const todayBox = document.getElementById("today");
const summaryBox = document.getElementById("summary");
const sectionLabel = document.getElementById("sectionLabel");


// =====================================================
// BASIC DATA
// =====================================================

let SECTION = localStorage.getItem("section") || "";

// Build a stable local YYYY-MM-DD date (locale formatting can vary by browser).
function localDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
const today = localDateISO();
const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];


// =====================================================
// HELPERS
// =====================================================

function normalizeSubject(name) {
  return String(name || "")
    .split(" ")[0]
    .trim()
    .toUpperCase();
}


// Safely display text inside HTML
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// =====================================================
// LOAD STUDENT PROFILE
// =====================================================

async function loadStudentProfile() {

  const snap = await getDoc(
    doc(db, "users", uid)
  );

  if (!snap.exists()) {

    alert("Student profile not found");

    return false;
  }


  const data = snap.data();


  // Prevent admin from entering student dashboard
  if (data.role === "admin") {

    localStorage.setItem("admin", "true");

    location.replace("admin.html");

    return false;
  }


  // Student name
  if (welcomeName) {

    welcomeName.innerText =
      `Welcome, ${data.name || "Student"} 👋`;
  }


  // Section
  if (data.section) {

    SECTION = String(data.section)
      .trim()
      .toUpperCase();

    localStorage.setItem(
      "section",
      SECTION
    );
  }


  // Display section
  if (sectionLabel) {
    sectionLabel.innerText = SECTION ? `SEC: ${SECTION}` : "SEC: Not set";
  }
  const heroSection = document.getElementById("heroSection");
  if (heroSection) heroSection.textContent = SECTION ? `SECTION · ${SECTION}` : "SECTION · NOT SET";


  // Section missing
  if (!SECTION) {

    alert(
      "Your section is not set. Please contact admin."
    );

    return false;
  }


  return true;
}


// =====================================================
// LIVE CLOCK
// =====================================================

function startClock() {

  const tick = () => {

    if (liveDateTime) {

      liveDateTime.innerText =
        new Date().toLocaleString("en-IN");
    }
  };


  tick();

  setInterval(tick, 1000);
}


// =====================================================
// HOLIDAY CHECK
// =====================================================

async function isHoliday(date = today) {

  // Check exact-date holiday
  const snap = await getDoc(
    doc(db, "holidays", date)
  );


  if (snap.exists()) {
    return true;
  }


  // Backward-compatible range holiday support
  const all = await getDocs(
    collection(db, "holidays")
  );


  return all.docs.some(d => {

    const data = d.data();

    return (
      data.type === "range" &&
      data.endDate &&
      d.id <= date &&
      date <= data.endDate
    );
  });
}


// =====================================================
// SUNDAY MESSAGE
// =====================================================

async function loadSundayMsg() {

  const holiday = await isHoliday();


  if (
    new Date().getDay() === 0 &&
    !holiday &&
    sundayMsg
  ) {

    sundayMsg.style.display = "block";

    sundayMsg.innerText =
      "😄 Sunday have a fun day!";
  }
}


// =====================================================
// MARK ATTENDANCE
// =====================================================

window.markAttendance = async (
  subject,
  status
) => {

  try {

    if (
      !subject ||
      !["present", "absent"].includes(status)
    ) {
      return;
    }


    // Don't allow marking on holiday
    if (await isHoliday()) {
      return;
    }


    // Daily attendance document
    const dailyRef = doc(
      db,
      "attendance",
      today,
      "students",
      roll,
      "subjects",
      subject
    );


    const dailySnap =
      await getDoc(dailyRef);


    // Already marked
    if (
      dailySnap.exists() &&
      dailySnap.data().marked === true
    ) {

      return;
    }


    // Create/update student attendance
    await setDoc(
      doc(
        db,
        "attendance",
        today,
        "students",
        roll
      ),
      {
        uid,
        roll,
        section: SECTION
      },
      {
        merge: true
      }
    );


    // Save today's attendance
    await setDoc(
      dailyRef,
      {
        status,
        marked: true,
        timestamp: serverTimestamp()
      },
      {
        merge: true
      }
    );


    // =================================================
    // UPDATE SUMMARY
    // =================================================

    const summaryRef = doc(
      db,
      "attendanceSummary",
      roll,
      "subjects",
      subject
    );


    const sumSnap =
      await getDoc(summaryRef);


    let present = sumSnap.exists()
      ? Number(
          sumSnap.data().present || 0
        )
      : 0;


    let total = sumSnap.exists()
      ? Number(
          sumSnap.data().total || 0
        )
      : 0;


    total++;


    if (status === "present") {
      present++;
    }


    await setDoc(
      summaryRef,
      {
        present,
        total
      },
      {
        merge: true
      }
    );


    // Reload dashboard
    await Promise.all([
      loadToday(),
      loadWeeklyTimetable(),
      loadSummary()
    ]);

  } catch (error) {

    console.error(
      "Attendance marking error:",
      error
    );

    alert(
      "Unable to save attendance. Please try again."
    );
  }
};


// =====================================================
// LOAD TODAY'S CLASSES
// =====================================================

async function loadWeeklyTimetable() {
  const box = document.getElementById("weeklyTimetable");
  const badge = document.getElementById("weeklySectionBadge");
  if (!box) return;
  box.innerHTML = '<div class="card center">Loading weekly timetable…</div>';
  try {
    const section = SECTION || localStorage.getItem("section") || "";
    if (badge) badge.textContent = section ? `SEC: ${section}` : "SECTION NOT SET";
    if (!section) {
      box.innerHTML = '<div class="card center">Your section is missing. Please log out and sign in again.</div>';
      return;
    }
    const snap = await getDoc(doc(db, "timetables", section));
    if (!snap.exists()) {
      box.innerHTML = `<div class="card center"><h3>⚠️ Timetable not found</h3><p>No timetable configured for <b>${esc(section)}</b>.</p></div>`;
      return;
    }
    const data = snap.data();
    // Put today's card first so it is immediately visible and visually prioritized.
    const orderedDays = day && WEEK_DAYS.includes(day)
      ? [day, ...WEEK_DAYS.filter((weekday) => weekday !== day)]
      : WEEK_DAYS;
    box.innerHTML = orderedDays.map((weekday) => {
      const entries = Array.isArray(data[weekday]) ? data[weekday] : [];
      const todayClass = weekday === day ? " is-today" : "";
      const content = entries.length ? entries.map((item, index) => {
        const subject = String(item?.subject || "").trim();
        if (!subject) return "";
        const time = String(item?.time || "").trim();
        return `<div class="weekly-class"><span class="weekly-class-number">${index + 1}</span><div><strong>${esc(subject)}</strong>${time ? `<small>🕒 ${esc(time)}</small>` : "<small>Time not set</small>"}</div></div>`;
      }).join("") : '<p class="weekly-empty">No classes scheduled</p>';
      return `<article class="weekly-day${todayClass}"><div class="weekly-day-head"><h3>${weekday}</h3>${weekday === day ? '<span class="today-pill">TODAY</span>' : ""}</div><div class="weekly-classes">${content}</div></article>`;
    }).join("");
    if (typeof window.filterTimetable === "function") window.filterTimetable();
  } catch (error) {
    console.error("Weekly timetable loading error:", error);
    box.innerHTML = '<div class="card center"><h3>Unable to load weekly timetable</h3><p>Check your connection and refresh the page.</p></div>';
  }
}

async function loadToday() {

  if (!todayBox) {
    return;
  }


  todayBox.innerHTML =
    `<div class="card center">
      Loading today's classes...
    </div>`;


  try {

    // Holiday
    if (await isHoliday()) {

      todayBox.innerHTML =
        `<div class="card center">
          <h2>🎉 Holiday</h2>
          <p>No classes today</p>
        </div>`;

      return;
    }


    // Get timetable
    const tt = await getDoc(
      doc(
        db,
        "timetables",
        SECTION
      )
    );


    // Timetable doesn't exist
    if (!tt.exists()) {

      todayBox.innerHTML =
        `<div class="card center">
          <h3>⚠️ Timetable not found</h3>
          <p>
            No timetable configured for
            <b>${esc(SECTION)}</b>.
          </p>
        </div>`;

      return;
    }


    // Get today's classes
    const timetableData = tt.data();

    const classes =
      Array.isArray(timetableData[day])
        ? timetableData[day]
        : [];


    // No classes
    if (!classes.length) {

      todayBox.innerHTML =
        `<div class="card center">
          <h3>📚 No classes today</h3>
          <p>
            No timetable entries for
            ${esc(day)}.
          </p>
        </div>`;

      return;
    }


    const html = [];


    // =================================================
    // BUILD CLASS CARDS
    // =================================================

    for (const c of classes) {

      const key =
        normalizeSubject(c.subject);


      if (!key) {
        continue;
      }


      // Attendance reference
      const ref = doc(
        db,
        "attendance",
        today,
        "students",
        roll,
        "subjects",
        key
      );


      const snap =
        await getDoc(ref);


      // Status
      const statusText =
        snap.exists()
          ? String(
              snap.data().status ||
              "absent"
            ).toUpperCase()
          : "NOT MARKED";


      // Marked?
      const marked =
        snap.exists() &&
        snap.data().marked === true;


      // Card
      html.push(`

        <div class="card">

          <h3>
            ${esc(c.subject)}
          </h3>

          <div class="time">
            ${esc(c.time || "")}
          </div>

          <b>
            Status:
            ${esc(statusText)}
          </b>


          ${
            !marked

              ? `

                <div class="btn-row">

                  <button
                    class="present-btn"
                    onclick="markAttendance('${esc(key)}','present')"
                  >
                    Present
                  </button>


                  <button
                    class="absent-btn"
                    onclick="markAttendance('${esc(key)}','absent')"
                  >
                    Absent
                  </button>

                </div>

              `

              : `

                <div class="marked-note">
                  ✓ Attendance marked
                </div>

              `
          }

        </div>

      `);
    }


    // Display cards
    todayBox.innerHTML =
      html.join("") ||
      `<div class="card center">
        No valid classes configured.
      </div>`;


  } catch (error) {

    console.error(
      "Today's classes error:",
      error
    );


    todayBox.innerHTML =
      `<div class="card center">
        <h3>⚠️ Unable to load classes</h3>
        <p>
          Please refresh the page.
        </p>
      </div>`;


    // Re-throw so main error handler can see it
    throw error;
  }
}


// =====================================================
// LOAD ATTENDANCE SUMMARY
// =====================================================

async function loadSummary() {

  if (!summaryBox) {
    return;
  }


  summaryBox.innerHTML =
    `<div class="card center">
      Loading attendance...
    </div>`;


  try {

    const snap = await getDocs(
      collection(
        db,
        "attendanceSummary",
        roll,
        "subjects"
      )
    );


    // No attendance
    if (snap.empty) {

      summaryBox.innerHTML =
        `<div class="card center">
          No attendance data yet
        </div>`;

      return;
    }


    const cards = [];


    // =================================================
    // BUILD SUBJECT SUMMARY CARDS
    // =================================================

    snap.forEach(d => {

      const data = d.data();


      const present =
        Number(data.present || 0);


      const total =
        Number(data.total || 0);


      // Current percentage
      const percent =
        total
          ? Math.round(
              (present / total) * 100
            )
          : 0;


      // If next class is present
      const presentNext =
        ((present + 1) /
          (total + 1)) *
        100;


      // If next class is absent
      const absentNext =
        (present /
          (total + 1)) *
        100;


      // Classes needed to reach 80%
      const needed =
        present >= 0.80 * total
          ? 0
          : Math.ceil(
              (0.80 * total - present) /
              0.20
            );


      // Colour
      const colorClass =
        percent >= 80
          ? "green"
          : percent >= 65
            ? "yellow"
            : "red";


      cards.push(`

        <div class="summary-card">

          <div class="summary-head">

            <h3>
              ${esc(d.id)}
            </h3>

            <span
              class="attendance-badge ${colorClass}"
            >
              ${percent}%
            </span>

          </div>


          <p class="class-count">
            ${present} / ${total}
            classes present
          </p>


          <div class="progress">

            <div
              class="fill ${colorClass}"
              style="--target-width:${Math.min(
                percent,
                100
              )}%"
            ></div>

          </div>


          <div class="scenario-grid">

            <div
              class="scenario present-scenario"
            >

              <span>
                Next Class Present
              </span>

              <strong>
                ${presentNext.toFixed(1)}%
              </strong>

            </div>


            <div
              class="scenario absent-scenario"
            >

              <span>
                Next Class Absent
              </span>

              <strong>
                ${absentNext.toFixed(1)}%
              </strong>

            </div>

          </div>


          <div class="target-box">

            <span>
              🎯 To reach 80%
            </span>

            <strong>

              ${
                needed === 0

                  ? "Already ≥ 80%"

                  : `Attend next
                     ${needed}
                     class${
                       needed === 1
                         ? ""
                         : "es"
                     }`
              }

            </strong>

          </div>


          <b
            class="percent"
            data-target="${percent}"
          >
            0%
          </b>

        </div>

      `);
    });


    // Display summary
    summaryBox.innerHTML =
      cards.join("");


    // Animate percentages
    animatePercent();


  } catch (error) {

    console.error(
      "Attendance summary error:",
      error
    );


    summaryBox.innerHTML =
      `<div class="card center">
        <h3>⚠️ Unable to load attendance</h3>
        <p>
          Please refresh the page.
        </p>
      </div>`;


    throw error;
  }
}


// =====================================================
// PERCENTAGE ANIMATION
// =====================================================

function animatePercent() {

  document
    .querySelectorAll(".percent")
    .forEach(el => {

      const target =
        Number(
          el.dataset.target || 0
        );


      let current = 0;


      const step =
        Math.max(
          1,
          Math.floor(target / 25)
        );


      const timer =
        setInterval(() => {

          current += step;


          if (current >= target) {

            current = target;

            clearInterval(timer);
          }


          el.innerText =
            `${current}%`;

        }, 20);

    });
}


// =====================================================
// START APPLICATION
// =====================================================

async function startApp() {

  try {

    // Student profile
    const loaded =
      await loadStudentProfile();


    if (!loaded) {
      return;
    }


    // Clock
    startClock();


    // Sunday message
    await loadSundayMsg();


    // Dashboard
    await Promise.all([
      loadToday(),
      loadWeeklyTimetable(),
      loadSummary()
    ]);


  } catch (error) {

    console.error(
      "Dashboard loading error:",
      error
    );


    alert(
      "Unable to load attendance dashboard. Please refresh."
    );
  }
}


// =====================================================
// START
// =====================================================

startApp();
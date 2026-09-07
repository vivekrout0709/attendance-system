import { db } from "./firebase.js";
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

if (sessionStorage.getItem("admin") === "true") {
  location.replace("admin.html");
  throw new Error("Admin blocked");
}

const roll = sessionStorage.getItem("roll");
const uid = sessionStorage.getItem("uid");
if (!roll || !uid) {
  location.replace("index.html");
  throw new Error("No session");
}

window.logout = () => { sessionStorage.clear(); location.href = "index.html"; };

const welcomeName = document.getElementById("welcomeName");
const liveDateTime = document.getElementById("liveDateTime");
const sundayMsg = document.getElementById("sundayMsg");
const todayBox = document.getElementById("today");
const summaryBox = document.getElementById("summary");
const recentHistoryBox = document.getElementById("recentHistory");
const sectionLabel = document.getElementById("sectionLabel");

let SECTION = sessionStorage.getItem("section") || "";
const today = new Date().toLocaleDateString("en-CA");
const day = new Date().toLocaleDateString("en-US", { weekday: "long" });

function normalizeSubject(name) { return String(name || "").split(" ")[0].trim().toUpperCase(); }
function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}
function statusClass(status) { return status === "present" ? "history-present" : "history-absent"; }
function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}

async function loadStudentProfile() {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) { alert("Student profile not found"); return false; }
  const data = snap.data();
  if (data.role === "admin") { sessionStorage.setItem("admin", "true"); location.replace("admin.html"); return false; }
  welcomeName.innerText = `Welcome, ${data.name || "Student"} 👋`;
  if (data.section) {
    SECTION = String(data.section).trim().toUpperCase();
    sessionStorage.setItem("section", SECTION);
  }
  if (sectionLabel) sectionLabel.innerText = SECTION ? `SEC: ${SECTION}` : "SEC: Not set";
  if (!SECTION) { alert("Your section is not set. Please contact admin."); return false; }
  return true;
}

function startClock() {
  const tick = () => liveDateTime.innerText = new Date().toLocaleString("en-IN");
  tick(); setInterval(tick, 1000);
}

async function isHoliday(date = today) {
  const snap = await getDoc(doc(db, "holidays", date));
  if (snap.exists()) return true;

  // Backward-compatible support for an older range-style holiday document.
  const all = await getDocs(collection(db, "holidays"));
  return all.docs.some(d => {
    const data = d.data();
    return data.type === "range" && data.endDate && d.id <= date && date <= data.endDate;
  });
}

async function loadSundayMsg() {
  const holiday = await isHoliday();
  if (new Date().getDay() === 0 && !holiday && sundayMsg) {
    sundayMsg.style.display = "block";
    sundayMsg.innerText = "😄 Sunday have a fun day!";
  }
}

window.markAttendance = async (subject, status) => {
  if (!subject || !["present", "absent"].includes(status)) return;
  if (await isHoliday()) return;

  const dailyRef = doc(db, "attendance", today, "students", roll, "subjects", subject);
  const dailySnap = await getDoc(dailyRef);
  if (dailySnap.exists() && dailySnap.data().marked === true) return;

  await setDoc(doc(db, "attendance", today, "students", roll), {
    uid, roll, section: SECTION
  }, { merge: true });

  await setDoc(dailyRef, { status, marked: true, timestamp: serverTimestamp() }, { merge: true });

  const summaryRef = doc(db, "attendanceSummary", roll, "subjects", subject);
  const sumSnap = await getDoc(summaryRef);
  let present = sumSnap.exists() ? Number(sumSnap.data().present || 0) : 0;
  let total = sumSnap.exists() ? Number(sumSnap.data().total || 0) : 0;
  total++;
  if (status === "present") present++;
  await setDoc(summaryRef, { present, total }, { merge: true });

  await Promise.all([loadToday(), loadSummary(), loadRecentHistory()]);
};

async function loadToday() {
  todayBox.innerHTML = `<div class="card center">Loading today's classes...</div>`;
  if (await isHoliday()) {
    todayBox.innerHTML = `<div class="card center"><h2>🎉 Holiday</h2><p>No classes today</p></div>`;
    return;
  }

  const tt = await getDoc(doc(db, "timetables", SECTION));
  if (!tt.exists()) {
    todayBox.innerHTML = `<div class="card center"><h3>⚠️ Timetable not found</h3><p>No timetable configured for <b>${esc(SECTION)}</b>.</p></div>`;
    return;
  }

  const classes = Array.isArray(tt.data()[day]) ? tt.data()[day] : [];
  if (!classes.length) {
    todayBox.innerHTML = `<div class="card center"><h3>📚 No classes today</h3><p>No timetable entries for ${esc(day)}.</p></div>`;
    return;
  }

  const html = [];
  for (const c of classes) {
    const key = normalizeSubject(c.subject);
    if (!key) continue;
    const ref = doc(db, "attendance", today, "students", roll, "subjects", key);
    const snap = await getDoc(ref);
    const statusText = snap.exists() ? String(snap.data().status || "absent").toUpperCase() : "NOT MARKED";
    const marked = snap.exists() && snap.data().marked === true;
    html.push(`
      <div class="card">
        <h3>${esc(c.subject)}</h3>
        <div class="time">${esc(c.time || "")}</div>
        <b>Status: ${statusText}</b>
        ${!marked ? `<div class="btn-row">
          <button class="present-btn" onclick="markAttendance('${esc(key)}','present')">Present</button>
          <button class="absent-btn" onclick="markAttendance('${esc(key)}','absent')">Absent</button>
        </div>` : `<div class="marked-note">✓ Attendance marked</div>`}
      </div>`);
  }
  todayBox.innerHTML = html.join("") || `<div class="card center">No valid classes configured.</div>`;
}

async function loadSummary() {
  summaryBox.innerHTML = `<div class="card center">Loading attendance...</div>`;
  const snap = await getDocs(collection(db, "attendanceSummary", roll, "subjects"));
  if (snap.empty) { summaryBox.innerHTML = `<div class="card center">No attendance data yet</div>`; return; }

  const cards = [];
  snap.forEach(d => {
    const present = Number(d.data().present || 0);
    const total = Number(d.data().total || 0);
    const percent = total ? Math.round((present / total) * 100) : 0;
    const presentNext = total ? ((present + 1) / (total + 1)) * 100 : 100;
    const absentNext = total ? (present / (total + 1)) * 100 : 0;
    const needed = present >= 0.80 * total ? 0 : Math.ceil((0.80 * total - present) / 0.20);
    const colorClass = percent >= 80 ? "green" : percent >= 65 ? "yellow" : "red";
    cards.push(`
      <div class="summary-card">
        <div class="summary-head"><h3>${esc(d.id)}</h3><span class="attendance-badge ${colorClass}">${percent}%</span></div>
        <p class="class-count">${present} / ${total} classes present</p>
        <div class="progress"><div class="fill ${colorClass}" style="--target-width:${Math.min(percent,100)}%"></div></div>
        <div class="scenario-grid">
          <div class="scenario present-scenario"><span>Next Class Present</span><strong>${presentNext.toFixed(1)}%</strong></div>
          <div class="scenario absent-scenario"><span>Next Class Absent</span><strong>${absentNext.toFixed(1)}%</strong></div>
        </div>
        <div class="target-box"><span>🎯 To reach 80%</span><strong>${needed === 0 ? "Already ≥ 80%" : `Attend next ${needed} class${needed === 1 ? "" : "es"}`}</strong></div>
        <b class="percent" data-target="${percent}">0%</b>
      </div>`);
  });
  summaryBox.innerHTML = cards.join("");
  animatePercent();
}

async function getAllHistory() {
  const dateSnapshots = await getDocs(collection(db, "attendance"));
  const history = [];
  for (const dateDoc of dateSnapshots.docs) {
    const subjectSnap = await getDocs(collection(db, "attendance", dateDoc.id, "students", roll, "subjects"));
    subjectSnap.forEach(subjectDoc => {
      const data = subjectDoc.data();
      if (data.marked === true) history.push({ date: dateDoc.id, subject: subjectDoc.id, status: data.status || "absent", timestamp: data.timestamp || null });
    });
  }
  history.sort((a,b) => a.date !== b.date ? b.date.localeCompare(a.date) : (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  return history;
}

async function loadRecentHistory() {
  if (!recentHistoryBox) return;
  recentHistoryBox.innerHTML = `<div class="card center">Loading history...</div>`;
  try {
    const recent = (await getAllHistory()).slice(0,5);
    if (!recent.length) { recentHistoryBox.innerHTML = `<div class="card center"><p>No attendance history yet.</p></div>`; return; }
    recentHistoryBox.innerHTML = recent.map(item => `<div class="history-row"><div><strong>${esc(item.subject)}</strong><small>${formatDate(item.date)}</small></div><span class="${statusClass(item.status)}">${String(item.status || "absent").toUpperCase()}</span></div>`).join("");
  } catch (err) {
    console.error(err); recentHistoryBox.innerHTML = `<div class="card center">Unable to load history.</div>`;
  }
}

function animatePercent() {
  document.querySelectorAll(".percent").forEach(el => {
    const target = Number(el.dataset.target || 0);
    let current = 0;
    const step = Math.max(1, Math.floor(target / 25));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      el.innerText = `${current}%`;
    }, 20);
  });
}

async function startApp() {
  try {
    const loaded = await loadStudentProfile();
    if (!loaded) return;
    startClock();
    await loadSundayMsg();
    await Promise.all([loadToday(), loadSummary(), loadRecentHistory()]);
  } catch (err) {
    console.error(err);
    alert("Unable to load attendance dashboard. Please refresh.");
  }
}
startApp();

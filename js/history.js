import { db } from "./firebase.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

if (sessionStorage.getItem("admin") === "true") { location.replace("admin.html"); throw new Error("Admin blocked"); }
const roll = sessionStorage.getItem("roll");
const uid = sessionStorage.getItem("uid");
if (!roll || !uid) { location.replace("index.html"); throw new Error("No session"); }

const historyBox = document.getElementById("historyBox");
const historyCount = document.getElementById("historyCount");
const studentName = document.getElementById("studentName");
const sectionLabel = document.getElementById("sectionLabel");

function formatDate(s){ return new Date(`${s}T00:00:00`).toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}); }
function statusClass(s){ return s === "present" ? "history-present" : "history-absent"; }
function esc(v){ return String(v ?? "").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch])); }

async function loadProfile(){
  const snap=await getDoc(doc(db,"users",uid));
  if(!snap.exists()) return;
  const data=snap.data();
  if(data.role === "admin"){sessionStorage.setItem("admin","true");location.replace("admin.html");return;}
  studentName.innerText=`${data.name || "Student"}'s Attendance History`;
  sectionLabel.innerText=data.section ? `SEC: ${String(data.section).toUpperCase()}` : "";
}

async function getAllHistory(){
  const dateSnapshots=await getDocs(collection(db,"attendance"));
  const history=[];
  for(const dateDoc of dateSnapshots.docs){
    const subjectSnap=await getDocs(collection(db,"attendance",dateDoc.id,"students",roll,"subjects"));
    subjectSnap.forEach(subjectDoc=>{
      const data=subjectDoc.data();
      if(data.marked===true) history.push({date:dateDoc.id,subject:subjectDoc.id,status:data.status||"absent",timestamp:data.timestamp||null});
    });
  }
  history.sort((a,b)=>a.date!==b.date?b.date.localeCompare(a.date):(b.timestamp?.seconds||0)-(a.timestamp?.seconds||0));
  return history;
}

function render(history){
  historyCount.innerText=`${history.length} recorded class${history.length===1?"":"es"}`;
  if(!history.length){historyBox.innerHTML=`<div class="empty"><div class="empty-icon">📭</div><h3>No attendance history</h3><p>Your marked classes will appear here.</p></div>`;return;}
  historyBox.innerHTML=history.map(item=>`<div class="history-card"><div><div class="history-subject">📚 ${esc(item.subject)}</div><div class="history-date">📅 ${formatDate(item.date)}</div></div><span class="${statusClass(item.status)}">${String(item.status||"absent").toUpperCase()}</span></div>`).join("");
}

async function start(){
  try{await loadProfile();historyBox.innerHTML=`<div class="empty">Loading attendance history...</div>`;render(await getAllHistory());}
  catch(err){console.error(err);historyBox.innerHTML=`<div class="empty"><div class="empty-icon">⚠️</div><h3>Unable to load history</h3><p>Please try again.</p></div>`;}
}
start();

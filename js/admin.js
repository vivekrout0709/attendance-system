import { db } from "./firebase.js";
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const uid = sessionStorage.getItem("uid");
if (!uid) { location.replace("index.html"); throw new Error("No session"); }

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const sectionName = document.getElementById("sectionName");
const sectionSelect = document.getElementById("sectionSelect");
const timetableSection = document.getElementById("timetableSection");
const timetableEditor = document.getElementById("timetableEditor");
const sectionStatus = document.getElementById("sectionStatus");

let currentData = {};

async function verifyAdmin(){
  const snap = await getDoc(doc(db,"users",uid));
  if(!snap.exists() || snap.data().role !== "admin"){
    sessionStorage.clear(); location.replace("index.html"); throw new Error("Not admin");
  }
  sessionStorage.setItem("admin","true");
}

async function loadSections(){
  const snap=await getDocs(collection(db,"timetables"));
  const sections=snap.docs.map(d=>d.id).sort((a,b)=>a.localeCompare(b));
  [sectionSelect,timetableSection].forEach(sel=>{
    const value=sel.value;
    sel.innerHTML='<option value="">Select section</option>';
    sections.forEach(s=>sel.insertAdjacentHTML("beforeend",`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
    if(sections.includes(value)) sel.value=value;
  });
  if(sectionSelect.value) sectionName.value=sectionSelect.value;
  if(!timetableSection.value && sectionSelect.value) timetableSection.value=sectionSelect.value;
  renderEditor(currentData);
}

function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));}

window.syncSectionSelectors=()=>{
  if(timetableSection.value) sectionSelect.value=timetableSection.value;
  if(sectionSelect.value) sectionName.value=sectionSelect.value;
};

window.saveSection=async()=>{
  const section=sectionName.value.trim().toUpperCase();
  if(!section){alert("Enter a section name");return;}
  const ref=doc(db,"timetables",section);
  const snap=await getDoc(ref);
  if(snap.exists()){
    alert("Section already exists. You can edit its timetable below.");
  }else{
    const empty={}; DAYS.forEach(day=>empty[day]=[]);
    await setDoc(ref,{...empty,updatedAt:new Date(),updatedBy:uid});
    alert(`Section ${section} created.`);
  }
  sectionSelect.value=section;timetableSection.value=section;currentData={};
  await loadTimetable(); await loadSections();
  sectionSelect.value=section;timetableSection.value=section;
};

window.deleteSection=async()=>{
  const section=sectionSelect.value || sectionName.value.trim().toUpperCase();
  if(!section){alert("Select a section first");return;}
  if(!confirm(`Delete timetable section ${section}? Existing student profiles will keep their section.`)) return;
  await deleteDoc(doc(db,"timetables",section));
  currentData={}; timetableEditor.innerHTML=""; sectionName.value="";
  await loadSections();
  alert(`Section ${section} deleted.`);
};

function renderEditor(data={}){
  timetableEditor.innerHTML=DAYS.map(day=>{
    const items=Array.isArray(data[day])?data[day]:[];
    return `<div class="day-block" data-day="${day}">
      <div class="day-head"><h4>${day}</h4><button type="button" class="mini-btn" onclick="addClassRow('${day}')">＋ Add class</button></div>
      <div class="day-rows" id="rows-${day}">
        ${items.map(item=>rowHtml(day,item.subject,item.time)).join("")}
      </div>
    </div>`;
  }).join("");
}
function rowHtml(day,subject="",time=""){
  return `<div class="class-row"><input class="subject-input" placeholder="Subject" value="${escapeHtml(subject)}"><input class="time-input" placeholder="Time e.g. 10:00 AM" value="${escapeHtml(time)}"><button type="button" class="remove-btn" onclick="this.parentElement.remove()">✕</button></div>`;
}
window.addClassRow=(day)=>document.getElementById(`rows-${day}`).insertAdjacentHTML("beforeend",rowHtml(day));

window.loadTimetable=async()=>{
  const section=timetableSection.value || sectionSelect.value;
  if(!section){timetableEditor.innerHTML='<div class="admin-empty">Select a section to edit its timetable.</div>';return;}
  sectionSelect.value=section;timetableSection.value=section;sectionName.value=section;
  const snap=await getDoc(doc(db,"timetables",section));
  currentData=snap.exists()?snap.data():{};
  renderEditor(currentData);
  sectionStatus.textContent=snap.exists()?`Editing ${section}`:`No timetable found for ${section}`;
};

window.saveTimetable=async()=>{
  const section=timetableSection.value || sectionSelect.value;
  if(!section){alert("Select a section first");return;}
  const data={};
  for(const day of DAYS){
    data[day]=[...document.querySelectorAll(`#rows-${day} .class-row`)].map(row=>({
      subject:row.querySelector(".subject-input").value.trim(),
      time:row.querySelector(".time-input").value.trim()
    })).filter(x=>x.subject);
  }
  await setDoc(doc(db,"timetables",section),{...data,updatedAt:new Date(),updatedBy:uid},{merge:true});
  currentData=data; alert(`Timetable saved for ${section}.`);
};

window.toggleHolidayMode=()=>{
  const range=document.querySelector("input[name='mode']:checked")?.value === "range";
  document.getElementById("endDate").style.display=range?"block":"none";
};

function dateList(start,end){
  const out=[]; let d=new Date(`${start}T00:00:00`); const last=new Date(`${end}T00:00:00`);
  while(d<=last){out.push(d.toLocaleDateString("en-CA"));d.setDate(d.getDate()+1);}
  return out;
}

window.saveHoliday=async()=>{
  const mode=document.querySelector("input[name='mode']:checked")?.value||"single";
  const start=document.getElementById("startDate").value;
  const end=document.getElementById("endDate").value;
  const reason=document.getElementById("reason").value.trim();
  if(!start){alert("Select a start date");return;}
  if(mode==='range' && (!end || end<start)){alert("Select a valid end date");return;}
  const dates=mode==='range'?dateList(start,end):[start];
  for(const date of dates){await setDoc(doc(db,"holidays",date),{type:"single",reason,createdBy:uid,createdAt:new Date()});}
  alert(mode==='range'?`Holiday saved for ${dates.length} days.`:"Holiday saved!");
};

window.deleteHoliday=async()=>{
  const mode=document.querySelector("input[name='mode']:checked")?.value||"single";
  const start=document.getElementById("startDate").value;
  const end=document.getElementById("endDate").value;
  if(!start){alert("Select the date to delete");return;}
  if(mode==='range' && (!end || end<start)){alert("Select a valid end date");return;}
  const dates=mode==='range'?dateList(start,end):[start];
  for(const date of dates) await deleteDoc(doc(db,"holidays",date));
  alert("Holiday deleted.");
};

(async()=>{try{await verifyAdmin();await loadSections();renderEditor({});}catch(err){console.error(err);}})();

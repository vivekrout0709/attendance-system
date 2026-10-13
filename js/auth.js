import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";



/* ===========================
   ROLL → EMAIL
=========================== */

function rollToEmail(roll) {

  return `${roll}@attendance.app`;

}



/* ===========================
   LOGIN
=========================== */

window.login = async () => {


  const roll =
    document
      .getElementById("loginRoll")
      ?.value
      .trim()
      .toUpperCase();


  const password =
    document
      .getElementById("loginPassword")
      ?.value
      .trim();



  if (!roll || !password) {

    alert(
      "Enter registration number and password"
    );

    return;

  }



  try {


    /* ===========================
       FIREBASE AUTH
    =========================== */

    const email =
      rollToEmail(roll);


    await setPersistence(auth, browserLocalPersistence);

    const cred =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );



    /* ===========================
       LOAD USER PROFILE
    =========================== */

    const userRef =
      doc(
        db,
        "users",
        cred.user.uid
      );


    const snap =
      await getDoc(
        userRef
      );


    if (!snap.exists()) {

      alert(
        "User profile not found"
      );

      return;

    }


    const userData =
      snap.data();



    /* ===========================
       SESSION
    =========================== */

    localStorage.setItem(
      "uid",
      cred.user.uid
    );


    localStorage.setItem(
      "roll",
      userData.roll
    );


    localStorage.setItem(
      "role",
      userData.role
    );


    /* ===========================
       SAVE SECTION
    =========================== */

    if (userData.section) {

      localStorage.setItem(
        "section",
        userData.section
      );

    }



    /* ===========================
       REDIRECT
    =========================== */

    if (
      userData.role === "admin"
    ) {

      localStorage.setItem(
        "admin",
        "true"
      );

      location.replace(
        "admin.html"
      );

    }

    else {

      location.replace(
        "attendance.html"
      );

    }


  }

  catch (err) {

    alert(
      "Invalid roll number or password"
    );

    console.error(err);

  }

};
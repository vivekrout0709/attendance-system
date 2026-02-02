import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAs27SaN_sgr4Hk1UqlGYK7ZR9dB_EeNP0",
  authDomain: "attendance-68042.firebaseapp.com",
  projectId: "attendance-68042",
  storageBucket: "attendance-68042.firebasestorage.app",
  messagingSenderId: "891856110395",
  appId: "1:891856110395:web:ed9140336dfba222e5ed1e"
};

export const db = getFirestore(initializeApp(firebaseConfig));

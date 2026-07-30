import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "foodavoidance.firebaseapp.com",
  projectId: "foodavoidance",
  storageBucket: "foodavoidance.firebasestorage.app",
  messagingSenderId: "503905836537",
  appId: "1:503905836537:web:3bf376542f1767fd643128",
  measurementId: "G-LXMMWZ1YFP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

// Firebase 설정
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 파이어베이스 구성 정보
const firebaseConfig = {
  apiKey: "AIzaSyDF-MYqSOg1_10MuoLo1UDiu18sDNhqyjw",
  authDomain: "hoteldeforre-staff.firebaseapp.com",
  projectId: "hoteldeforre-staff",
  storageBucket: "hoteldeforre-staff.firebasestorage.app",
  messagingSenderId: "540617007189",
  appId: "1:540617007189:web:3c802d4c879afdf43674dc",
  measurementId: "G-SD4HC3J8SH"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db }; 
// Firebase 구성
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

console.log('Firebase 설정 시작');

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDF-MYqSOg1_10MuoLo1UDiu18sDNhqyjw",
  authDomain: "hoteldeforre-staff.firebaseapp.com",
  projectId: "hoteldeforre-staff",
  storageBucket: "hoteldeforre-staff.appspot.com",
  messagingSenderId: "540617007189",
  appId: "1:540617007189:web:3c802d4c879afdf43674dc",
  measurementId: "G-SD4HC3J8SH"
};

// Firebase 초기화 (이미 초기화된 앱이 있는지 확인)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Firebase 서비스
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log('Firebase 초기화 성공');

// 로그인 상태 관리
const initializeAuthState = async () => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('로그인된 사용자:', user.email);
      } else {
        console.log('로그인되지 않음');
      }
      unsubscribe();
      resolve(user);
    });
  });
};

export { auth, db, storage, initializeAuthState };
export default app; 
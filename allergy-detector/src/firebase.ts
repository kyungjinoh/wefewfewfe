import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDBre5ZZdOw_VcxiijPZOEFA7kg1e1lKlA",
  authDomain: "allergy-6f2a9.firebaseapp.com",
  projectId: "allergy-6f2a9",
  storageBucket: "allergy-6f2a9.appspot.com",
  messagingSenderId: "1004642727087",
  appId: "1:1004642727087:web:2b4587c7ed31deb8b6d05a",
  measurementId: "G-89DER7TMCC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Test Firebase connection
console.log('Firebase initialized with project ID:', firebaseConfig.projectId);

// Check if we're in development mode and connect to emulator if needed
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Connected to Firebase Firestore emulator');
  } catch (error) {
    console.log('Firebase emulator already connected or not available');
  }
}

export { auth, db }; 
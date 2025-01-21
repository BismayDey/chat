import { initializeApp, getApps } from "firebase/app";
import { getAuth, User } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDody5-1OMFel94yGV3cftRt-4d_jyJWEo",
  authDomain: "chatting-c4500.firebaseapp.com",
  projectId: "chatting-c4500",
  storageBucket: "chatting-c4500.firebasestorage.app",
  messagingSenderId: "864887892219",
  appId: "1:864887892219:web:477507916ad86133e2a85e",
  measurementId: "G-8KMPW78Z41",
};

// Initialize Firebase
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);

interface AdditionalData {
  [key: string]: unknown;
}

export const createUserDocument = async (
  user: User | null,
  additionalData?: AdditionalData
) => {
  if (!user) return;

  const userRef = doc(db, `users/${user.uid}`);

  try {
    await setDoc(
      userRef,
      {
        email: user.email || "",
        displayName: user.displayName || "",
        ...additionalData,
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error creating user document", error);
  }
};

export { app, auth, db, analytics };

export const addPrivateMessage = async (
  senderId: string,
  receiverId: string,
  message: string
) => {
  const chatId = [senderId, receiverId].sort().join("_");
  await addDoc(collection(db, `privateChats/${chatId}/messages`), {
    senderId,
    text: message,
    timestamp: new Date(),
  });
};

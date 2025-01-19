"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  UserCredential,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";

export default function Signup() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential: UserCredential =
        await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: username });

      // Create a user document in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        username,
        email,
        friends: [],
        friendRequests: [],
      });

      router.push("/chat");
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/email-already-in-use") {
        setError(
          "This email is already in use. Please try logging in or use a different email."
        );
      } else {
        setError("An error occurred during signup. Please try again.");
      }
      console.error("Error signing up with email and password", error);
    }
  };

  const handleGoogleSignup = async () => {
    const provider = new GoogleAuthProvider();

    try {
      const result: UserCredential = await signInWithPopup(auth, provider);
      if (!result.user.displayName) {
        await updateProfile(result.user, { displayName: username });
      }

      // Create a user document in Firestore
      await setDoc(
        doc(db, "users", result.user.uid),
        {
          username: result.user.displayName || username,
          email: result.user.email,
          friends: [],
          friendRequests: [],
        },
        { merge: true }
      );

      router.push("/chat");
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("Error signing up with Google", error);
      setError("An error occurred during Google signup. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Sign up for Awesome Chat
        </h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleEmailSignup} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition duration-200"
          >
            Sign Up
          </button>
        </form>
        <button
          onClick={handleGoogleSignup}
          className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600 transition duration-200 mt-4"
        >
          Sign up with Google
        </button>
        <p className="mt-4 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

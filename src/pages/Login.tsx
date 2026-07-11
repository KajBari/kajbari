import React, { useState } from "react";
import { auth } from "../firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { Coins, Loader2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "../store/authStore";

export function Login() {
  const { authError } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let dToken = "";
      try {
        if (!localStorage.getItem("device_token")) {
          localStorage.setItem("device_token", crypto.randomUUID());
        }
        dToken = localStorage.getItem("device_token") || "";
      } catch (e) {
        console.warn("localStorage access denied in iframe");
      }

      if (dToken) {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        const devTokenRef = doc(db, "device_tokens", dToken);
        let devTokenSnap;
        try {
          devTokenSnap = await getDoc(devTokenRef);
        } catch(e: any) { throw new Error("Pre-login step 1 failed: " + e.message); }

        if (devTokenSnap.exists()) {
          const existingData = devTokenSnap.data();
          let isDifferentAccount = false;
          if (existingData.email && existingData.email.toLowerCase() !== email.toLowerCase()) {
            isDifferentAccount = true;
          }

          if (isDifferentAccount) {
            throw new Error("Multi-accounting detected! You can only use one account per device.");
          }
        }
      }

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address in the field above to reset password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      let dToken = "";
      try {
        if (!localStorage.getItem("device_token")) {
          localStorage.setItem("device_token", crypto.randomUUID());
        }
        dToken = localStorage.getItem("device_token") || "";
      } catch (e) {
        console.warn("localStorage access denied in iframe");
      }

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      if (dToken && googleUser) {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("../firebase");

        const userDocRef = doc(db, "users", googleUser.uid);
        let userDocSnap;
        try {
          userDocSnap = await getDoc(userDocRef);
        } catch(e: any) { throw new Error("Google post-login step 1 failed: " + e.message); }

        if (!userDocSnap.exists()) {
          const devTokenRef = doc(db, "device_tokens", dToken);
          let devTokenSnap;
          try {
            devTokenSnap = await getDoc(devTokenRef);
          } catch(e: any) { throw new Error("Google post-login step 2 failed: " + e.message); }

          if (devTokenSnap.exists()) {
            const existingData = devTokenSnap.data();
            if (existingData.email && existingData.email.toLowerCase() !== (googleUser.email || "").toLowerCase()) {
              await googleUser.delete();
              await auth.signOut();
              throw new Error("Multi-accounting detected! You can only use one account per device.");
            }
          }
        }
      }

      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-sm w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 border border-indigo-100">
            <Coins className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            {isLogin
              ? "Enter your details to access your dashboard."
              : "Sign up to start earning points today."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center font-medium">
            {error}
          </div>
        )}
        {authError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center font-medium">
            System Error: {authError}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-5 mb-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition"
              >
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              required
              className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setIsLogin(true);
                // Need to call handler directly as submit
                const form = document.querySelector('form') as HTMLFormElement;
                if (form.checkValidity()) {
                  await handleEmailAuth({ preventDefault: () => {} } as any);
                } else {
                  form.reportValidity();
                }
              }}
              className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
            >
              {loading && isLogin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setIsLogin(false);
                const form = document.querySelector('form') as HTMLFormElement;
                if (form.checkValidity()) {
                  await handleEmailAuth({ preventDefault: () => {} } as any);
                } else {
                  form.reportValidity();
                }
              }}
              className="flex-1 bg-white text-indigo-600 border-2 border-indigo-600 font-black py-4 rounded-2xl shadow-sm hover:bg-indigo-50 transition flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
            >
              {loading && !isLogin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign Up"}
            </button>
          </div>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-400 font-medium text-xs">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
          className="w-full bg-white border border-slate-200 text-slate-700 font-black py-4 rounded-2xl shadow-sm hover:bg-slate-50 transition flex items-center justify-center gap-3 disabled:opacity-70 text-sm"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Google
        </button>

        {/* Forgot Password Removed */}

      </div>
    </div>
  );
}

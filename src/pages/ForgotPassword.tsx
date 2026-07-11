import { useState } from "react";
import { Link, useLocation } from "wouter";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { Loader2, ArrowLeft } from "lucide-react";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [, setLocation] = useLocation();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! If not in your inbox, check the Spam folder.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-xl">
        <Link href="/login" className="flex items-center text-sm text-slate-500 hover:text-indigo-600 mb-6 font-bold">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Login
        </Link>
        <h2 className="text-2xl font-black mb-6">Reset Password</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {message && <p className="text-green-600 text-sm mb-4">{message}</p>}
        
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}

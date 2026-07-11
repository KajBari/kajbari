import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { LogOut, Coins, ShieldAlert, User, ChevronDown, X, Loader2, ArrowLeft, Sun, Moon } from "lucide-react";
import { Link, useLocation } from "wouter";

const AVATAR_PRESETS = [
  { name: "Felix", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" },
  { name: "Aneka", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" },
  { name: "Gamer", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=John" },
  { name: "Robot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Buster" },
  { name: "Creative", url: "https://api.dicebear.com/7.x/shapes/svg?seed=Reward" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, isVpn, updateProfile } = useAuthStore();
  const [location, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });
  
  const [newName, setNewName] = useState("");
  const [newPhoto, setNewPhoto] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (profile) {
      setNewName(profile.displayName || "");
      setNewPhoto(profile.photoURL || "");
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        displayName: newName,
        photoURL: newPhoto,
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setSaving(false);
    }
  };

  if (isVpn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-md w-full text-center border border-slate-200 border-t-4 border-t-red-500">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
            VPN/Proxy Detected
          </h1>
          <p className="text-slate-500 mb-6 text-sm">
            We have detected that you are using a VPN or Proxy. To ensure fair
            play and prevent fraud, please disable it to access your account.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition text-sm"
          >
            I have disabled it (Refresh)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          {location !== "/" && (
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  setLocation("/");
                }
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition mr-1 shadow-sm active:scale-95"
              title="Go Back"
              id="back-button"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold tracking-tight">RX</div>
          <Link href="/">
            <span className="text-xl font-bold text-slate-900 tracking-tight cursor-pointer" onClick={() => setLocation("/")}>
              Reward<span className="text-indigo-600">GPT</span>
            </span>
          </Link>
        </div>
        {profile && (
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5">
              <span className="text-emerald-600 font-bold text-xs mr-2 tracking-wide uppercase hidden sm:inline-block">Balance:</span>
              <span className="text-emerald-700 font-black text-sm">
                {profile.points} PTS
              </span>
            </div>
            
            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
            
            {/* Interactive Dropdown Profile Container */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition focus:outline-none"
              >
                {/* Avatar with Custom Image or initial */}
                <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-indigo-100 overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer shadow-sm hover:scale-105 transition-all">
                  {profile.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-base">
                      {profile.displayName
                        ? profile.displayName.charAt(0).toUpperCase()
                        : (profile.email?.charAt(0).toUpperCase() || 'U')}
                    </div>
                  )}
                </div>
                
                {/* Name & Arrow */}
                <div className="text-left hidden sm:block">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-0.5">Verified User</p>
                  <p className="text-sm font-bold text-slate-800 truncate max-w-[120px] leading-tight">
                    {profile.displayName || profile.email?.split('@')[0]}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform hidden sm:block ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu Panel */}
              {isMenuOpen && (
                <>
                  {/* Backdrop overlay for quick click-outside close */}
                  <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)} />
                  
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2.5 z-40 transform origin-top-right animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100 mb-2">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Logged In As</p>
                      <p className="text-sm font-bold text-slate-800 truncate mt-0.5">
                        {profile.displayName || profile.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{profile.email}</p>
                    </div>
                    
                    <div className="px-1.5 space-y-0.5">
                      {profile.email === "hasanfreefireid0077@gmail.com" && (
                        <Link href="/admin">
                          <button
                            onClick={() => setIsMenuOpen(false)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-indigo-600 rounded-xl hover:bg-indigo-50 transition text-left"
                          >
                            <ShieldAlert className="h-4 w-4 text-indigo-500 animate-pulse" />
                            Admin Panel
                          </button>
                        </Link>
                      )}

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsModalOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 transition text-left"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        Edit Profile
                      </button>

                      <button
                        onClick={() => {
                          setIsDarkMode(!isDarkMode);
                          setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 rounded-xl hover:bg-slate-50 transition text-left"
                      >
                        {isDarkMode ? (
                          <Sun className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Moon className="h-4 w-4 text-slate-400" />
                        )}
                        {isDarkMode ? "Light Mode" : "Dark Mode"}
                      </button>
                      
                      <button
                        onClick={async () => {
                          setIsMenuOpen(false);
                          await signOut();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-600 rounded-xl hover:bg-red-50 transition text-left"
                      >
                        <LogOut className="h-4 w-4 text-red-500" />
                        Account Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0 overflow-auto">
        {children}
      </main>

      {/* Edit Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          
          {/* Modal Content */}
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative z-50 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Edit Profile Details</h2>
              <p className="text-sm text-slate-500 mt-1">Customize your public name and profile avatar</p>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  placeholder="e.g. Marufa Akter"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Profile Picture URL
                </label>
                <input
                  type="url"
                  value={newPhoto}
                  onChange={(e) => setNewPhoto(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  placeholder="Paste any image URL (e.g. https://...)"
                />
              </div>
              
              {/* Preset Avatars */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Or Choose a Quick Preset Avatar
                </label>
                <div className="grid grid-cols-5 gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100 justify-items-center">
                  {AVATAR_PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setNewPhoto(preset.url)}
                      className={`w-12 h-12 rounded-full overflow-hidden border-2 transition ${newPhoto === preset.url ? 'border-indigo-600 scale-105 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 border border-slate-200 text-slate-600 font-bold py-3.5 rounded-2xl hover:bg-slate-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

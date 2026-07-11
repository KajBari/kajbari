import { create } from "zustand";
import { auth, db } from "../firebase";
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

interface UserProfile {
  uid: string;
  email: string | null;
  points: number;
  creationDate: number;
  deviceToken: string | null;
  isAdmin?: boolean;
  displayName?: string;
  photoURL?: string;
  dailyCompletions?: Record<string, Record<string, boolean>>; // { "YYYY-MM-DD": { taskId: true } }
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  vpnChecked: boolean;
  isVpn: boolean;
  authError?: string;
  initAuth: () => void;
  checkVpn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  vpnChecked: false,
  isVpn: false,
  authError: undefined,

  initAuth: () => {
    // Prevent multiple subscriptions
    if ((window as any)._authUnsubscribe) {
      (window as any)._authUnsubscribe();
    }
    
    (window as any)._authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch or create user profile
        const userRef = doc(db, "users", user.uid);
        let profileData: UserProfile;

        try {
          let docSnap;
          try {
            docSnap = await getDoc(userRef);
          } catch(e: any) { throw new Error("Step 1 (getDoc users) failed: " + e.message); }

          if (docSnap.exists()) {
            profileData = docSnap.data() as UserProfile;
          } else {
            let dToken = "unknown";
            try {
              dToken = localStorage.getItem("device_token") || "unknown";
            } catch (e) {
              console.warn("localStorage access denied");
            }

            if (dToken !== "unknown" && dToken !== "") {
              const devTokenRef = doc(db, "device_tokens", dToken);
              let devTokenSnap;
              try {
                devTokenSnap = await getDoc(devTokenRef);
              } catch(e: any) { throw new Error("Step 2 (getDoc device_tokens) failed: " + e.message); }

              if (devTokenSnap.exists()) {
                const existingData = devTokenSnap.data();
                if (existingData.email && existingData.email.toLowerCase() !== (user.email || "").toLowerCase()) {
                  console.warn("Multi-accounting detected under token:", dToken);
                  await user.delete();
                  await firebaseSignOut(auth);
                  set({
                    user: null,
                    profile: null,
                    loading: false,
                    vpnChecked: true,
                    authError: "Multi-accounting detected! You can only use one account per device."
                  });
                  return;
                }
              }
            }

            profileData = {
              uid: user.uid,
              email: user.email,
              points: 0,
              creationDate: Date.now(),
              deviceToken: dToken,
            };
            
            try {
              await setDoc(userRef, profileData);
            } catch(e: any) { throw new Error("Step 3 (setDoc users) failed: " + e.message); }

            if (dToken !== "unknown" && dToken !== "") {
              try {
                await setDoc(doc(db, "device_tokens", dToken), {
                  uid: user.uid,
                  email: user.email,
                  timestamp: Date.now()
                });
              } catch(e: any) { throw new Error("Step 4 (setDoc device_tokens) failed: " + e.message); }
            }
          }
          set({ user, profile: profileData, loading: false, authError: undefined });
          // Check VPN on login
          await get().checkVpn();
        } catch (error) {
          console.error("Error fetching user profile", error);
          set({ user: null, profile: null, loading: false, vpnChecked: true, authError: (error as any).message || "Failed to load profile" });
        }
      } else {
        set({ user: null, profile: null, loading: false, vpnChecked: true });
      }
    });
  },

  checkVpn: async () => {
    try {
      const res = await fetch("/api/check-vpn", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        set({ isVpn: true, vpnChecked: true });
        // Optionally sign out the user if VPN is detected
        // await get().signOut();
      } else {
        set({ isVpn: false, vpnChecked: true });
      }
    } catch (error) {
      console.error("Failed to check VPN", error);
      set({ vpnChecked: true }); // Proceed if check fails to not block users, or block them depending on strictness
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null, profile: null, isVpn: false, vpnChecked: true });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        set({ profile: docSnap.data() as UserProfile });
      }
    }
  },

  updateProfile: async (data: { displayName?: string; photoURL?: string }) => {
    const { user, profile } = get();
    if (user && profile) {
      const userRef = doc(db, "users", user.uid);
      const updatedProfile = { ...profile, ...data };
      await setDoc(userRef, updatedProfile, { merge: true });
      set({ profile: updatedProfile });
    }
  },
}));

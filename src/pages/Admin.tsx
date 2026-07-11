import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { useAuthStore } from "../store/authStore";
import { useLocation } from "wouter";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  runTransaction,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  Users,
  History,
  CheckCircle,
  XCircle,
  Clock,
  Coins,
  TrendingUp,
  Search,
  Filter,
  ShieldCheck,
  RefreshCw,
  Edit3,
  Loader2,
  AlertCircle,
  Award,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

export function Admin() {
  const { user } = useAuthStore();
  const [location, setLocation] = useLocation();

  // Redirect non-admins immediately
  useEffect(() => {
    if (!user || user.email !== "hasanfreefireid0077@gmail.com") {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Dashboard Data State
  const [users, setUsers] = useState<any[]>([]);
  const [withdraws, setWithdraws] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "conversions" | "tasks">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [withdrawFilter, setWithdrawFilter] = useState<"all" | "pending" | "success" | "rejected">("all");

  // Points Adjustment Modal State
  const [selectedUserForPoints, setSelectedUserForPoints] = useState<any | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustingPoints, setAdjustingPoints] = useState(false);

  // Task Management State
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    type: "article",
    title: "",
    url: "",
    timer: 60,
    points: 10,
  });

  useEffect(() => {
    if (user && user.email === "hasanfreefireid0077@gmail.com") {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    setRefreshing(true);
    try {
      // Fetch users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData = usersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch withdraw requests
      const withdrawsSnap = await getDocs(collection(db, "withdraw_requests"));
      const withdrawsData = withdrawsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch conversions
      const conversionsSnap = await getDocs(collection(db, "conversions"));
      const conversionsData = conversionsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch tasks
      const tasksSnap = await getDocs(collection(db, "tasks"));
      const tasksData = tasksSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUsers(usersData);
      setWithdraws(withdrawsData);
      setConversions(conversionsData);
      setTasks(tasksData);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper mapping uid to user data
  const userMap = React.useMemo(() => {
    return users.reduce((acc: any, u: any) => {
      acc[u.uid] = u;
      return acc;
    }, {});
  }, [users]);

  // Calculations for Metrics
  const totalPointsAwarded = React.useMemo(() => {
    return conversions.reduce((sum, c) => sum + (c.pointsEarned || 0), 0);
  }, [conversions]);

  const pendingWithdrawsCount = React.useMemo(() => {
    return withdraws.filter((w) => w.status === "pending").length;
  }, [withdraws]);

  const completedPayoutsCount = React.useMemo(() => {
    return withdraws.filter((w) => w.status === "success" || w.status === "Complete").length;
  }, [withdraws]);

  const totalPointsPendingWithdrawal = React.useMemo(() => {
    return withdraws
      .filter((w) => w.status === "pending")
      .reduce((sum, w) => sum + (w.amount || 0), 0);
  }, [withdraws]);

  // Transactional Approval of withdrawal requests
  const handleApproveWithdraw = async (request: any) => {
    console.log("APPROVE CLICKED for:", request.id);
    
    if (!request.id) {
      console.error("Missing Request ID");
      alert("Error: Request ID is missing.");
      return;
    }

    const requestRef = doc(db, "withdraw_requests", request.id);

    try {
      console.log("Updating document status to Complete...");
      await updateDoc(requestRef, {
        status: "Complete",
        processedAt: Date.now(),
      });

      console.log("Request marked as Complete successfully");
      alert("Success! Withdrawal request completed.");
      await fetchAdminData();
    } catch (err: any) {
      console.error("Approval error:", err);
      alert("Failed to approve: " + err.message);
    }
  };

  // Reject withdrawal request (Refund points)
  const handleRejectWithdraw = async (request: any) => {
    console.log("REJECT CLICKED for:", request.id);
    
    if (!request.id || !request.uid) {
      console.error("Missing ID or UID:", request.id, request.uid);
      alert("Error: Request ID or User UID is missing.");
      return;
    }

    const userRef = doc(db, "users", request.uid);
    const requestRef = doc(db, "withdraw_requests", request.id);
    const amountToRefund = Number(request.amount);

    try {
      console.log("Starting refund transaction for:", amountToRefund);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User profile not found in database.");
        }

        const currentPoints = Number(userDoc.data().points || 0);

        // Refund points
        transaction.update(userRef, {
          points: currentPoints + amountToRefund,
        });

        // Update status to Unsuccessful
        transaction.update(requestRef, {
          status: "Unsuccessful",
          processedAt: Date.now(),
        });
      });

      console.log("Rejection and refund successful");
      alert("Success! Withdrawal rejected and points refunded.");
      await fetchAdminData();

      // Update local member balance display if modal is open
      if (selectedUserForPoints && selectedUserForPoints.uid === request.uid) {
        setSelectedUserForPoints((prev: any) => ({
          ...prev,
          points: (Number(prev.points || 0)) + amountToRefund
        }));
      }
    } catch (err: any) {
      console.error("Rejection error:", err);
      alert("Failed to reject: " + err.message);
    }
  };

  // Handle manual adjustments of user points
  const handleAdjustPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPoints) return;

    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive number of points.");
      return;
    }

    setAdjustingPoints(true);
    const userRef = doc(db, "users", selectedUserForPoints.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User profile does not exist!");
        }

        const currentPoints = userDoc.data().points || 0;
        let newPoints = currentPoints;

        if (adjustType === "add") {
          newPoints += amount;
        } else {
          if (currentPoints < amount) {
            throw new Error(
              `User only has ${currentPoints} points. Cannot deduct ${amount} points.`
            );
          }
          newPoints -= amount;
        }

        transaction.update(userRef, { points: newPoints });
      });

      alert(
        `Successfully ${adjustType === "add" ? "added" : "deducted"} ${amount} points for ${selectedUserForPoints.email}.`
      );
      setSelectedUserForPoints(null);
      setAdjustAmount("");
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      alert("Failed to adjust points: " + err.message);
    } finally {
      setAdjustingPoints(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.url || newTask.timer <= 0 || newTask.points <= 0) {
      alert("Please fill all task fields correctly.");
      return;
    }
    
    try {
      const tasksRef = collection(db, "tasks");
      const maxOrder = tasks.filter(t => t.type === newTask.type).reduce((max, t) => Math.max(max, t.order || 0), 0);
      
      await addDoc(tasksRef, {
        type: newTask.type,
        title: newTask.title,
        url: newTask.url,
        timer: Number(newTask.timer),
        points: Number(newTask.points),
        order: maxOrder + 1,
        createdAt: Date.now(),
        isActive: true
      });
      
      alert("Task created successfully!");
      setIsAddingTask(false);
      setNewTask({ type: "article", title: "", url: "", timer: 60, points: 10 });
      fetchAdminData();
    } catch (err: any) {
      alert("Failed to create task: " + err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err: any) {
      alert("Failed to delete task: " + err.message);
    }
  };

  // Filter & Search Logics
  const filteredUsers = React.useMemo(() => {
    return users
      .filter((u) => {
        const query = searchQuery.toLowerCase();
        return (
          (u.email || "").toLowerCase().includes(query) ||
          (u.displayName || "").toLowerCase().includes(query) ||
          (u.uid || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (b.creationDate || 0) - (a.creationDate || 0));
  }, [users, searchQuery]);

  const filteredWithdraws = React.useMemo(() => {
    return withdraws
      .filter((w) => {
        // Apply status filter
        if (withdrawFilter !== "all") {
          if (withdrawFilter === "success") {
            if (w.status !== "success" && w.status !== "Complete") return false;
          } else if (w.status !== withdrawFilter) {
            return false;
          }
        }
        // Apply search query (user email, target number, uid)
        const query = searchQuery.toLowerCase();
        if (!query) return true;

        const userEmail = (userMap[w.uid]?.email || "").toLowerCase();
        const userName = (userMap[w.uid]?.displayName || "").toLowerCase();
        const targetNum = (w.targetNumber || "").toLowerCase();
        const method = (w.paymentMethod || "").toLowerCase();

        return (
          userEmail.includes(query) ||
          userName.includes(query) ||
          targetNum.includes(query) ||
          method.includes(query) ||
          w.uid.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [withdraws, withdrawFilter, searchQuery, userMap]);

  const filteredConversions = React.useMemo(() => {
    return conversions
      .filter((c) => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;

        const userEmail = (userMap[c.uid]?.email || "").toLowerCase();
        const userName = (userMap[c.uid]?.displayName || "").toLowerCase();
        const offer = (c.offerName || "").toLowerCase();

        return (
          userEmail.includes(query) ||
          userName.includes(query) ||
          offer.includes(query) ||
          c.uid.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        // Conversions use Firestore timestamp or numeric. Guard against missing/differing structures.
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });
  }, [conversions, searchQuery, userMap]);

  // Standard safe guard checking
  if (!user || user.email !== "hasanfreefireid0077@gmail.com") {
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Secure Control Panel
          </div>
          <h1 id="admin-dashboard-title" className="text-3xl font-black text-slate-900 mt-1">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as <span className="font-semibold text-slate-700">{user.email}</span>
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={refreshing}
          className="self-start sm:self-center bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {loading ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading Firestore records...</p>
        </div>
      ) : (
        <>
          {/* Dashboard KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* KPI 1 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="p-3.5 bg-indigo-50 rounded-2xl text-indigo-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</p>
                <h3 className="text-2xl font-black text-slate-800 mt-0.5">{users.length}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Registered Accounts</p>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="p-3.5 bg-emerald-50 rounded-2xl text-emerald-600">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Earned</p>
                <h3 className="text-2xl font-black text-slate-800 mt-0.5">{totalPointsAwarded} Pts</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">From {conversions.length} Offers completed</p>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="p-3.5 bg-amber-50 rounded-2xl text-amber-600">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Payouts</p>
                <h3 className="text-2xl font-black text-slate-800 mt-0.5">{pendingWithdrawsCount} Req</h3>
                <p className="text-[10px] text-amber-600 font-bold mt-0.5">{totalPointsPendingWithdrawal} Pts outstanding</p>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="p-3.5 bg-green-50 rounded-2xl text-green-600">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Paid</p>
                <h3 className="text-2xl font-black text-slate-800 mt-0.5">{completedPayoutsCount} Paid</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Withdrawals Processed</p>
              </div>
            </div>
          </div>

          {/* Tab Navigation Controls */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
            <button
              onClick={() => {
                setActiveTab("overview");
                setSearchQuery("");
              }}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition text-sm ${
                activeTab === "overview"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => {
                setActiveTab("users");
                setSearchQuery("");
              }}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition text-sm ${
                activeTab === "users"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <Users className="w-4 h-4" />
              Registered Members ({users.length})
              {pendingWithdrawsCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                  {pendingWithdrawsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab("conversions");
                setSearchQuery("");
              }}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition text-sm ${
                activeTab === "conversions"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <History className="w-4 h-4" />
              User Activity Logs ({conversions.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("tasks");
                setSearchQuery("");
              }}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition text-sm ${
                activeTab === "tasks"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              Manage Tasks ({tasks.length})
            </button>
          </div>

          {/* MAIN TAB CONTENT DISPLAY */}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Withdrawals overview list */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
                    Pending Withdraw Requests
                  </h4>
                  <button
                    onClick={() => setActiveTab("users")}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    View Members <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {withdraws.filter((w) => w.status === "pending").length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10">
                      <CheckCircle className="w-12 h-12 text-emerald-500 mb-2 stroke-1" />
                      <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                      <p className="text-xs text-slate-400 mt-0.5">No pending withdraw requests found.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {withdraws
                        .filter((w) => w.status === "pending")
                        .slice(0, 5)
                        .map((req) => (
                          <div key={req.id} className="py-3 flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-800">
                                  {userMap[req.uid]?.email || "Unknown User"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                via <span className="font-semibold text-slate-600">{req.paymentMethod}</span> to{" "}
                                <span className="font-mono text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded">
                                  {req.targetNumber}
                                </span>
                              </p>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <span className="font-black text-indigo-600 text-sm">{req.amount} Pts</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleApproveWithdraw(req)}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1 text-[10px]"
                                  title="Approve & Pay"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Success</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectWithdraw(req)}
                                  className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1 text-[10px]"
                                  title="Reject Request"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Conversions overview list */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
                    Recent Activity Logs
                  </h4>
                  <button
                    onClick={() => setActiveTab("conversions")}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {conversions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10">
                      <History className="w-12 h-12 text-slate-300 mb-2 stroke-1" />
                      <p className="text-sm font-semibold text-slate-500">No activity logged yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {filteredConversions.slice(0, 5).map((log) => (
                        <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              {userMap[log.uid]?.email || "Unknown User"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Completed <span className="font-semibold text-slate-700">{log.offerName}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full inline-block">
                              +{log.pointsEarned} Pts
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {log.timestamp?.seconds
                                ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString()
                                : log.timestamp
                                ? new Date(log.timestamp).toLocaleTimeString()
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTERED MEMBERS */}
          {activeTab === "users" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              {/* Search input for members */}
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search members by email, name, or UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Members Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">User Details</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">UID / Device Token</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">Registration Date</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Points Balance</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                          No registered members found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-50 transition">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              {member.photoURL ? (
                                <img
                                  src={member.photoURL}
                                  alt=""
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-sm border border-indigo-100">
                                  {(member.email || "U")[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {member.displayName || "Unset Name"}
                                </p>
                                <p className="text-xs text-slate-500 font-medium">{member.email || "No Email"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-mono font-semibold text-slate-400">UID: {member.uid}</p>
                              <p className="text-[10px] font-mono text-slate-400">Device: {member.deviceToken || "none"}</p>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-xs font-medium text-slate-500">
                            {member.creationDate ? new Date(member.creationDate).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-black text-sm border border-indigo-100">
                              <Coins className="w-4 h-4 text-amber-500 fill-amber-400" />
                              {member.points || 0}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="flex justify-end gap-2">
                              {withdraws.filter(w => w.uid === member.uid && w.status === "pending").length > 0 && (
                                <div className="relative flex items-center gap-1 bg-rose-50 border border-rose-100 px-2 py-1 rounded-lg">
                                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                                  <span className="text-[9px] font-black text-rose-600 uppercase">Pending</span>
                                </div>
                              )}
                              <button
                                onClick={() => setSelectedUserForPoints(member)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 text-xs"
                              >
                                <Coins className="w-4 h-4" />
                                Adjust Points
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: USER ACTIVITY LOGS */}
          {activeTab === "conversions" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              {/* Search log parameters */}
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search logs by email, offer wall name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Conversion Logs Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">User Email</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">Conversion ID</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">Completed Offer / Wall</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">Points Awarded</th>
                      <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-400">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredConversions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                          No conversion activity logs found matching search.
                        </td>
                      </tr>
                    ) : (
                      filteredConversions.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="py-4 px-5">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {userMap[log.uid]?.email || "Unknown User"}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">UID: {log.uid}</p>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-xs font-mono text-slate-400">{log.conversionId || log.id}</td>
                          <td className="py-4 px-5">
                            <span className="font-bold text-slate-700 text-sm">{log.offerName}</span>
                          </td>
                          <td className="py-4 px-5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-black text-sm">
                              +{log.pointsEarned} Pts
                            </span>
                          </td>
                          <td className="py-4 px-5 text-xs font-medium text-slate-500">
                            {log.timestamp?.seconds
                              ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                              : log.timestamp
                              ? new Date(log.timestamp).toLocaleString()
                              : "N/A"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: TASKS */}
          {activeTab === "tasks" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Task Management</h3>
                  <p className="text-sm text-slate-500 mt-1">Add or remove sequential tasks</p>
                </div>
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition text-sm flex items-center gap-2 shadow-md shadow-indigo-200"
                >
                  <Edit3 className="w-4 h-4" />
                  Add New Task
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="border-b-2 border-slate-100">
                      <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Title</th>
                      <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">URL</th>
                      <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Timer (s)</th>
                      <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Points</th>
                      <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                          No tasks available. Add some above.
                        </td>
                      </tr>
                    ) : (
                      [...tasks].sort((a, b) => a.order - b.order).map((task) => (
                        <tr key={task.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-5 text-sm font-semibold text-slate-700">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${task.type === 'video' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {task.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-sm font-semibold text-slate-900">{task.title}</td>
                          <td className="py-4 px-5 text-xs text-slate-500 max-w-xs truncate">{task.url}</td>
                          <td className="py-4 px-5 text-sm font-semibold text-slate-700">{task.timer}</td>
                          <td className="py-4 px-5 text-sm font-bold text-indigo-600">+{task.points}</td>
                          <td className="py-4 px-5 text-right">
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-rose-500 hover:text-rose-700 font-semibold text-sm transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ADJUST POINTS MODAL POPUP */}
      {selectedUserForPoints && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blur backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedUserForPoints(null)}
          />

          {/* Modal body */}
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative z-50 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedUserForPoints(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50"
            >
              <XCircle className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-indigo-100">
                <Award className="w-6 h-6 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Manage Member Balance</h2>
              <p className="text-xs text-slate-500 mt-1">
                Account: <span className="font-bold text-slate-700">{selectedUserForPoints.email}</span>
              </p>
            </div>

            {/* PENDING WITHDRAWS SECTION IN MODAL */}
            {withdraws.filter(w => w.uid === selectedUserForPoints.uid && w.status === "pending").length > 0 && (
              <div className="mb-6 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-rose-600 mb-3 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Pending Withdraw Requests
                </h3>
                <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                  {withdraws
                    .filter(w => w.uid === selectedUserForPoints.uid && w.status === "pending")
                    .map(req => (
                      <div 
                        key={req.id} 
                        className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm space-y-2 transition"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-800 uppercase">{req.paymentMethod}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-rose-600">{req.amount} PTS</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustAmount(req.amount.toString());
                                setAdjustType("deduct");
                              }}
                              className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-md transition"
                              title="Fill amount in form"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          Account: {req.targetNumber}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveWithdraw(req)}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2 rounded-lg transition active:scale-95 text-[10px] flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3 h-3" /> Success
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectWithdraw(req)}
                            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-black py-2 rounded-lg transition active:scale-95 text-[10px] flex items-center justify-center gap-1 shadow-sm"
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <form onSubmit={handleAdjustPointsSubmit} className="space-y-5">
              {/* Type toggle: ADD vs DEDUCT */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Adjustment Operation
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/40">
                  <button
                    type="button"
                    onClick={() => setAdjustType("add")}
                    className={`py-3 rounded-xl font-bold text-sm transition ${
                      adjustType === "add"
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Add Points
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("deduct")}
                    className={`py-3 rounded-xl font-bold text-sm transition ${
                      adjustType === "deduct"
                        ? "bg-white text-rose-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Deduct Points
                  </button>
                </div>
              </div>

              {/* Input Amount of Points */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Amount of Points
                </label>
                <div className="relative">
                  <Coins className="absolute left-4 top-3.5 h-5 w-5 text-amber-500" />
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter points count"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    required
                  />
                </div>
                <div className="flex justify-between items-center mt-2 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Current Balance:</span>
                  <span className="text-slate-700">{selectedUserForPoints.points || 0} PTS</span>
                </div>
              </div>

              {/* Actions buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPoints(null)}
                  className="flex-1 border border-slate-200 text-slate-600 font-bold py-3.5 rounded-2xl hover:bg-slate-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustingPoints}
                  className={`flex-1 text-white font-bold py-3.5 rounded-2xl transition text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 ${
                    adjustType === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {adjustingPoints ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adjusting...
                    </>
                  ) : (
                    "Confirm Adjust"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TASK MODAL POPUP */}
      {isAddingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsAddingTask(false)}
          />
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative z-50 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsAddingTask(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Add New Task</h2>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Type</label>
                <select
                  value={newTask.type}
                  onChange={e => setNewTask({...newTask, type: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
                >
                  <option value="article">Read Article</option>
                  <option value="video">Watch Video</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">URL (Link)</label>
                <input
                  type="url"
                  required
                  value={newTask.url}
                  onChange={e => setNewTask({...newTask, url: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Timer (Sec)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newTask.timer}
                    onChange={e => setNewTask({...newTask, timer: parseInt(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Points</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newTask.points}
                    onChange={e => setNewTask({...newTask, points: parseInt(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition text-sm shadow-md"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  runTransaction
} from "firebase/firestore";
import {
  Wallet,
  Smartphone,
  Gift,
  ExternalLink,
  Clock,
  CheckCircle,
  ShieldAlert,
  PlayCircle,
  BookOpen,
  Download,
  ClipboardList,
  XCircle
} from "lucide-react";

const DEFAULT_TASKS = [
  {
    id: "adsterra_task_1",
    type: "video",
    title: "Ads Watch 1 (অ্যাড ১)",
    url: "https://www.effectivecpmnetwork.com/hf2cid0zq?key=3aa8d508b27cb87b055548f81c4a56bf",
    timer: 10,
    points: 10,
    order: 1,
    isAdsterra: true
  },
  {
    id: "adsterra_task_2",
    type: "video",
    title: "Ads Watch 2 (অ্যাড ২)",
    url: "https://www.effectivecpmnetwork.com/zuuwq4n13?key=68737cf93fae58a79c19d950607c62da",
    timer: 10,
    points: 10,
    order: 2,
    isAdsterra: true
  },
  {
    id: "adsterra_task_3",
    type: "video",
    title: "Ads Watch 3 (অ্যাড ৩)",
    url: "https://www.effectivecpmnetwork.com/cqugurq3k4?key=d54d84e172efd488ace0794511352703",
    timer: 10,
    points: 10,
    order: 3,
    isAdsterra: true
  },
  {
    id: "default_article_1",
    type: "article",
    title: "Read Article 1 (আর্টিকেল ১)",
    url: "https://wikipedia.org",
    timer: 30,
    points: 5,
    order: 1,
  },
  {
    id: "default_article_2",
    type: "article",
    title: "Read Article 2 (আর্টিকেল ২)",
    url: "https://medium.com",
    timer: 30,
    points: 5,
    order: 2,
  },
  {
    id: "default_article_3",
    type: "article",
    title: "Read Article 3 (আর্টিকেল ৩)",
    url: "https://techcrunch.com",
    timer: 30,
    points: 5,
    order: 3,
  }
];

export function Dashboard() {
  const { profile, refreshProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"earn" | "withdraw">("earn");

  // Tasks State - Initialize with default tasks so they are immediately available
  const [tasks, setTasks] = useState<any[]>(DEFAULT_TASKS);
  const [selectedTaskType, setSelectedTaskType] = useState<"article" | "video" | null>(null);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [timerLeft, setTimerLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [completingTask, setCompletingTask] = useState(false);
  const [taskSuccess, setTaskSuccess] = useState<{ title: string; points: number } | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [profile]);

  const fetchTasks = async () => {
    try {
      const q = query(collection(db, "tasks"));
      const querySnapshot = await getDocs(q);
      const fetchedTasks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      // Merge fetched tasks with default/Adsterra tasks (avoid duplicate URLs/IDs)
      const mergedTasks = [...fetchedTasks];
      for (const defTask of DEFAULT_TASKS) {
        if (!mergedTasks.some(t => t.id === defTask.id || t.url === defTask.url)) {
          mergedTasks.push(defTask);
        }
      }

      setTasks(mergedTasks);
    } catch (err) {
      console.error("Failed to fetch tasks from Firestore, using defaults:", err);
      // Ensure default tasks are still present in state even if fetch fails
      setTasks(DEFAULT_TASKS);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timerLeft > 0) {
      interval = setInterval(() => {
        setTimerLeft((prev) => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timerLeft === 0) {
      setIsTimerRunning(false);
      handleCompleteTask();
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerLeft]);

  const handleCompleteTask = async () => {
    if (!activeTask || !profile || completingTask) return;
    setCompletingTask(true);
    setTaskError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const userRef = doc(db, "users", profile.uid);
      
      const newCompletions = profile.dailyCompletions ? { ...profile.dailyCompletions } : {};
      if (!newCompletions[today]) newCompletions[today] = {};
      newCompletions[today][activeTask.id] = true;

      // Batch Logic for specific task type
      const taskType = activeTask.type;
      const taskCooldowns = profile.taskCooldowns ? { ...profile.taskCooldowns } : {};
      const currentTaskCooldown = taskCooldowns[taskType] || { count: 0, lastBatchAt: 0 };
      
      let batchCount = currentTaskCooldown.count;
      let lastBatch = currentTaskCooldown.lastBatchAt;

      if (batchCount >= 3) {
        if (Date.now() - lastBatch >= 4 * 60 * 60 * 1000) {
          batchCount = 1;
          lastBatch = 0;
        } else {
          throw new Error("Cooldown is still active. Please wait 4 hours.");
        }
      } else {
        batchCount += 1;
        if (batchCount >= 3) {
          lastBatch = Date.now();
        }
      }

      taskCooldowns[taskType] = { count: batchCount, lastBatchAt: lastBatch };

      // Update user points and daily completions
      await updateDoc(userRef, {
        points: (profile.points || 0) + activeTask.points,
        dailyCompletions: newCompletions,
        taskCooldowns: taskCooldowns,
        // Keep old fields for backwards compatibility or general limit if needed, but not necessary. Let's just update them anyway.
        batchCompletionsCount: batchCount,
        lastBatchCompletedAt: lastBatch
      });

      // Add a conversion log
      await addDoc(collection(db, "conversions"), {
        uid: profile.uid,
        offerName: activeTask.title,
        pointsEarned: activeTask.points,
        timestamp: Date.now(),
        type: "task"
      });

      setTaskSuccess({ title: activeTask.title, points: activeTask.points });
      await refreshProfile();
      setActiveTask(null);
    } catch (err: any) {
      console.error("Task completion failed:", err);
      setTaskError("Failed to complete task: " + err.message);
    } finally {
      setCompletingTask(false);
    }
  };

  const handleStartTask = (task: any) => {
    const now = Date.now();
    const taskType = task.type;
    const taskCooldown = profile?.taskCooldowns?.[taskType] || { count: 0, lastBatchAt: 0 };
    const lastBatch = taskCooldown.lastBatchAt;
    const batchCount = taskCooldown.count;
    
    if (batchCount >= 3 && (now - lastBatch < 4 * 60 * 60 * 1000)) {
        setTaskError("Please wait 4 hours before doing more tasks.");
        return;
    }
    
    window.open(task.url, "_blank");
    setActiveTask(task);
    setTimerLeft(task.timer);
    setIsTimerRunning(true);
    setTaskSuccess(null);
    setTaskError(null);
  };

  const handleCloseSuccess = () => {
    setTaskSuccess(null);
    setTaskError(null);
  };

  const isTaskCompleted = (taskId: string) => {
    if (!profile || !profile.dailyCompletions) return false;
    const today = new Date().toISOString().split("T")[0];
    return !!profile.dailyCompletions[today]?.[taskId];
  };

  const getNextAvailableTask = (type: string) => {
    const typeTasks = tasks.filter(t => t.type === type).sort((a, b) => a.order - b.order);
    for (const task of typeTasks) {
      if (!isTaskCompleted(task.id)) return task;
    }
    return null; // All completed
  };

  // Withdraw State
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bkash");
  const [targetNumber, setTargetNumber] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "withdraw" && profile) {
      fetchWithdrawHistory();
    }
  }, [activeTab, profile]);

  const fetchWithdrawHistory = async () => {
    if (!profile) return;
    try {
      const q = query(
        collection(db, "withdraw_requests"),
        where("uid", "==", profile.uid),
      );
      const querySnapshot = await getDocs(q);
      const reqs = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort client side since we might not have composite index ready
      reqs.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setHistory(reqs);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError("");
    setWithdrawSuccess("");

    if (!profile) return;

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount < 100) {
      setWithdrawError("Minimum withdrawal is 100 points.");
      return;
    }

    if (profile.points < numAmount) {
      setWithdrawError("Insufficient points balance.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", profile.uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");
        
        const currentPoints = userDoc.data().points || 0;
        if (currentPoints < numAmount) throw new Error("Insufficient points balance.");

        // Deduct points immediately
        transaction.update(userRef, {
          points: currentPoints - numAmount
        });

        // Record the request
        const newRequestRef = doc(collection(db, "withdraw_requests"));
        transaction.set(newRequestRef, {
          uid: profile.uid,
          amount: numAmount,
          paymentMethod: method,
          targetNumber,
          status: "pending",
          timestamp: Date.now(),
        });
      });

      setWithdrawSuccess(
        "Withdrawal request submitted successfully! Points deducted and waiting for admin approval.",
      );
      setAmount("");
      setTargetNumber("");
      await refreshProfile();
      fetchWithdrawHistory();
    } catch (err: any) {
      setWithdrawError("Failed to submit request: " + err.message);
    }
  };

  // Replace this with your actual Offerwall URL and dynamic user ID tracking
  const OFFERWALL_URL = `https://example-offerwall.com/?userId=${profile?.uid}`;

  return (
    <div className="space-y-6">
      {/* Tabs styled like the sidebar/nav pills from the theme */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveTab("earn")}
          className={`px-4 py-2.5 rounded-lg font-bold flex items-center gap-3 transition ${
            activeTab === "earn"
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-50 font-medium"
          }`}
        >
          <Gift className="w-5 h-5" />
          Earn Points
        </button>
        <button
          onClick={() => setActiveTab("withdraw")}
          className={`px-4 py-2.5 rounded-lg font-bold flex items-center gap-3 transition ${
            activeTab === "withdraw"
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-50 font-medium"
          }`}
        >
          <Wallet className="w-5 h-5" />
          Withdraw
        </button>
      </div>

      {activeTab === "earn" && (
        <div className="grid grid-cols-1 gap-6">
          {/* Security Status Bar */}
          <div className="bg-white rounded-xl border-l-4 border-l-indigo-600 shadow-sm p-4 flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-50 rounded-full">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">VPN & Proxy Protection</p>
                <p className="text-xs text-slate-500">Status: Secure Connection Verified</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider hidden sm:block">Clean IP</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
                Earning Tasks
              </h2>
              <button
                onClick={refreshProfile}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Refresh Balance
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Task 1 */}
              <button className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center text-center hover:border-indigo-400 hover:shadow-md transition group cursor-pointer">
                <div className="w-14 h-14 bg-purple-50 rounded-2xl mb-4 flex items-center justify-center text-purple-500 group-hover:bg-purple-100 transition group-hover:scale-110 duration-300">
                  <ClipboardList className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-800 mb-1">
                  Surveys & Offers
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  সার্ভে ও অফার
                </p>
                <div className="mt-auto w-full py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  Start Task
                </div>
              </button>

              {/* Task 2 */}
              <button 
                onClick={(e) => {
                  const now = currentTime;
                  const taskCooldown = profile?.taskCooldowns?.["video"] || { count: 0, lastBatchAt: 0 };
                  const lastBatch = taskCooldown.lastBatchAt;
                  const batchCount = taskCooldown.count;
                  const timeLeft = 4 * 60 * 60 * 1000 - (now - lastBatch);
                  if (batchCount >= 3 && timeLeft > 0) {
                    e.preventDefault();
                  } else {
                    setSelectedTaskType("video");
                  }
                }}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center text-center hover:border-indigo-400 hover:shadow-md transition group cursor-pointer"
              >
                <div className="w-14 h-14 bg-rose-50 rounded-2xl mb-4 flex items-center justify-center text-rose-500 group-hover:bg-rose-100 transition group-hover:scale-110 duration-300">
                  <PlayCircle className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-800 mb-1">
                  Ads Watch
                </h4>
                <p className="text-xs text-slate-500 mb-4">অ্যাড দেখো</p>
                <div className={`mt-auto w-full py-2 rounded-xl text-sm font-bold transition-colors flex flex-col items-center justify-center ${
                  (() => {
                    const now = currentTime;
                    const taskCooldown = profile?.taskCooldowns?.["video"] || { count: 0, lastBatchAt: 0 };
                    const lastBatch = taskCooldown.lastBatchAt;
                    const batchCount = taskCooldown.count;
                    const timeLeft = 4 * 60 * 60 * 1000 - (now - lastBatch);
                    return batchCount >= 3 && timeLeft > 0;
                  })() 
                  ? 'bg-rose-100 text-rose-600 cursor-not-allowed'
                  : 'bg-slate-50 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
                }`}>
                  {(() => {
                    const now = currentTime;
                    const taskCooldown = profile?.taskCooldowns?.["video"] || { count: 0, lastBatchAt: 0 };
                    const lastBatch = taskCooldown.lastBatchAt;
                    const batchCount = taskCooldown.count;
                    const timeLeft = 4 * 60 * 60 * 1000 - (now - lastBatch);
                    
                    if (batchCount >= 3 && timeLeft > 0) {
                        const h = Math.floor(timeLeft / (1000 * 60 * 60));
                        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
                        return (
                          <div className="flex flex-col items-center leading-tight py-0.5">
                            <span className="text-[10px] opacity-70">Cooldown</span>
                            <span className="font-mono text-xs">{h}h {m}m {s}s</span>
                          </div>
                        );
                    }
                    return 'Start Task';
                  })()}
                </div>
              </button>

              {/* Task 3 */}
              <button 
                onClick={(e) => {
                  const now = currentTime;
                  const taskCooldown = profile?.taskCooldowns?.["article"] || { count: 0, lastBatchAt: 0 };
                  const lastBatch = taskCooldown.lastBatchAt;
                  const batchCount = taskCooldown.count;
                  const timeLeft = 4 * 60 * 60 * 1000 - (now - lastBatch);
                  if (batchCount >= 3 && timeLeft > 0) {
                    e.preventDefault();
                  } else {
                    setSelectedTaskType("article");
                  }
                }}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center text-center hover:border-indigo-400 hover:shadow-md transition group cursor-pointer"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl mb-4 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-100 transition group-hover:scale-110 duration-300">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-800 mb-1">
                  Read Articles
                </h4>
                <p className="text-xs text-slate-500 mb-4">আর্টিকেল পড়ে আয়</p>
                <div className={`mt-auto w-full py-2 rounded-xl text-sm font-bold transition-colors flex flex-col items-center justify-center ${
                  (() => {
                    const now = currentTime;
                    const taskCooldown = profile?.taskCooldowns?.["article"] || { count: 0, lastBatchAt: 0 };
                    const lastBatch = taskCooldown.lastBatchAt;
                    const batchCount = taskCooldown.count;
                    const timeLeft = 4 * 60 * 60 * 1000 - (now - lastBatch);
                    return batchCount >= 3 && timeLeft > 0;
                  })() 
                  ? 'bg-rose-100 text-rose-600 cursor-not-allowed'
                  : 'bg-slate-50 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
                }`}>
                  {(() => {
                    const now = currentTime;
                    const taskCooldown = profile?.taskCooldowns?.["article"] || { count: 0, lastBatchAt: 0 };
                    const lastBatch = taskCooldown.lastBatchAt;
                    const batchCount = taskCooldown.count;
                    const timeLeft = 4 * 60 * 60 * 1000 - (now - lastBatch);
                    
                    if (batchCount >= 3 && timeLeft > 0) {
                        const h = Math.floor(timeLeft / (1000 * 60 * 60));
                        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
                        return (
                          <div className="flex flex-col items-center leading-tight py-0.5">
                            <span className="text-[10px] opacity-70">Cooldown</span>
                            <span className="font-mono text-xs">{h}h {m}m {s}s</span>
                          </div>
                        );
                    }
                    return 'Start Task';
                  })()}
                </div>
              </button>

              {/* Task 4 */}
              <button className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center text-center hover:border-indigo-400 hover:shadow-md transition group cursor-pointer">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl mb-4 flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition group-hover:scale-110 duration-300">
                  <Download className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-800 mb-1">
                  Install Apps
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  এপ্প নামিয়ে আয়
                </p>
                <div className="mt-auto w-full py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  Start Task
                </div>
              </button>
            </div>
            
            {/* Keeping the iframe container for the offers to load into if they click */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 shadow-sm">
              <h4 className="font-bold text-slate-800 text-sm">Offerwall Container</h4>
              {/* Example Embedded Iframe Container */}
              <div className="w-full h-[600px] bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center relative">
                <span className="text-slate-400 font-medium absolute z-0 text-sm">
                  Select a task above to load content
                </span>
                {/* <iframe src={OFFERWALL_URL} className="w-full h-full relative z-10" frameBorder="0" /> */}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "withdraw" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
              Quick Redeem
            </h2>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col flex-1">
              <p className="text-sm font-semibold text-slate-700 mb-4">
                Select Payment Method
              </p>

              {withdrawError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
                  {withdrawError}
                </div>
              )}
              {withdrawSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl font-medium">
                  {withdrawSuccess}
                </div>
              )}

              <form onSubmit={handleWithdraw} className="space-y-5 flex flex-col flex-1">
                <div>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Bkash">Bkash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Mobile Recharge">Mobile Recharge</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Points to Withdraw
                  </label>
                  <input
                    type="number"
                    min="100"
                    placeholder="Min 100 points"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    Available: {profile?.points} pts
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Target Number / Account
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 017XXXXXXXX"
                    value={targetNumber}
                    onChange={(e) => setTargetNumber(e.target.value)}
                    className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>

                <div className="mt-auto pt-4">
                  <div className="p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Fee</span>
                      <span className="text-slate-800 font-bold">0 PTS</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-800 font-bold">Total Redeem</span>
                      <span className="text-indigo-600 font-black">{amount || '0'} PTS</span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
                  >
                    Request Withdrawal
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-6 bg-slate-300 rounded-full"></span>
              Withdrawal History
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 flex-1 overflow-hidden flex flex-col shadow-sm">
              <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Transactions</h4>
              </div>

              <div className="flex-1 overflow-y-auto p-0">
                {history.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 font-medium text-sm">
                    No withdrawal requests found.
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-50">
                      {history.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-xl ${
                                  req.status === "pending" 
                                    ? "bg-amber-50 text-amber-500" 
                                    : req.status === "Complete" || req.status === "success"
                                      ? "bg-emerald-50 text-emerald-500"
                                      : "bg-rose-50 text-rose-500"
                                }`}
                              >
                                {req.status === "pending" ? (
                                  <Clock className="w-5 h-5" />
                                ) : req.status === "Complete" || req.status === "success" ? (
                                  <CheckCircle className="w-5 h-5" />
                                ) : (
                                  <XCircle className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {req.paymentMethod}
                                </p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                  {req.targetNumber}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400 font-medium hidden sm:table-cell">
                            {new Date(req.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <p className="text-sm font-bold text-indigo-600 mb-1">
                              {req.amount} PTS
                            </p>
                            <span
                              className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${
                                req.status === "pending"
                                  ? "bg-amber-100 text-amber-700"
                                  : req.status === "Complete" || req.status === "success"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task List Modal */}
      {selectedTaskType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isTimerRunning && setSelectedTaskType(null)} />
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative z-50 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {!isTimerRunning && (
              <button
                onClick={() => setSelectedTaskType(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-50"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
            
            {taskSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">টাস্ক সম্পন্ন হয়েছে!</h3>
                <p className="text-sm text-slate-600 mb-6 font-medium">
                  আপনি <strong className="text-indigo-600 font-extrabold">+{taskSuccess.points} পয়েন্ট</strong> অর্জন করেছেন।
                </p>
                <button
                  onClick={handleCloseSuccess}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition text-sm shadow-md cursor-pointer"
                >
                  ঠিক আছে (Done)
                </button>
              </div>
            ) : taskError ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                  <XCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">টাস্ক ব্যর্থ হয়েছে</h3>
                <p className="text-sm text-rose-600 mb-6 font-semibold">{taskError}</p>
                <button
                  onClick={() => setTaskError(null)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition text-sm shadow-md cursor-pointer"
                >
                  আবার চেষ্টা করুন
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900 capitalize">{selectedTaskType} Tasks</h2>
                  <p className="text-sm text-slate-500 mt-1">Complete tasks in order to earn points</p>
                </div>

                {isTimerRunning ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="text-5xl font-black text-indigo-600 mb-4">{timerLeft}s</div>
                    <p className="text-slate-600 text-center font-medium">
                      Please wait... <br/> Do not close this window!
                    </p>
                    {completingTask && (
                      <p className="text-emerald-600 font-bold mt-4 animate-pulse">Completing task...</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {tasks.filter(t => t.type === selectedTaskType).sort((a, b) => a.order - b.order).length === 0 ? (
                      <p className="text-center text-slate-500 py-4">No tasks available right now.</p>
                    ) : (
                      tasks.filter(t => t.type === selectedTaskType).sort((a, b) => a.order - b.order).map((task, index, arr) => {
                        const completed = isTaskCompleted(task.id);
                        const prevTask = index > 0 ? arr[index - 1] : null;
                        const prevCompleted = prevTask ? isTaskCompleted(prevTask.id) : true;
                        const locked = (!completed && !prevCompleted);

                        return (
                          <button
                            key={task.id}
                            disabled={locked || completed}
                            onClick={() => handleStartTask(task)}
                            className={`w-full text-left p-4 rounded-2xl border transition flex items-center justify-between ${
                              completed 
                                ? 'bg-emerald-50 border-emerald-100 opacity-60 cursor-not-allowed' 
                                : locked 
                                  ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'
                                  : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-pointer'
                            }`}
                          >
                            <div>
                              <h4 className={`font-bold ${completed ? 'text-emerald-800' : 'text-slate-800'}`}>
                                {task.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">Reward: +{task.points} Points • {task.timer}s</p>
                            </div>
                            <div>
                              {completed ? (
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                              ) : locked ? (
                                <ShieldAlert className="w-5 h-5 text-slate-400" />
                              ) : (
                                <div className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg">
                                  Start
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

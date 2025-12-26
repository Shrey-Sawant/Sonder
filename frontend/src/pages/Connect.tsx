import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import {
  Phone,
  Calendar,
  Star,
  MessageSquare,
  AlertOctagon,
  Lock,
  Loader2,
  Search,
  User,
  Clock,
  X,
  CheckCircle2,
  Check,
  Ghost,
  ChevronLeft,
} from "lucide-react";
import { Counselor } from "../../types";
import ChatPage from "../components/ChatPage";
import { useAuth } from "../context/AuthContext";

// --- Types ---
interface ChatSession {
  id: string;
  student_id: string;
  counsellor_id: string;
  status: string;
  chat_type: string;
  student_name?: string;
  last_message?: string;
  updated_at: string;
}

interface Appointment {
  id: string;
  student_name: string;
  counsellor_name?: string; 
  scheduled_time: string;
  status: "pending" | "accepted" | "rejected";
}

// --- Sub-Components ---
const ScheduleModal: React.FC<{
  counselor: Counselor;
  onClose: () => void;
}> = ({ counselor, onClose }) => {
  const { user } = useAuth();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSchedule = async () => {
    if (!date || !time || !user) return;
    try {
      setLoading(true);
      const payload = {
        counsellor_id: Number(counselor.id),
        scheduled_time: `${date}T${time}:00`,
      };
      await api.post("/schedule/", payload);
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      alert("This slot might be taken or the request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">Schedule with {counselor.name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
            <X size={20} />
          </button>
        </div>
        {success ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 mx-auto rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <p className="font-bold text-lg dark:text-white">Request Sent!</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Date</label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none dark:text-white"
              />
            </div>
            <button
              disabled={!date || !time || loading}
              onClick={handleSchedule}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Calendar size={18} />} Confirm Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Connect Component ---
const Connect: React.FC = () => {
  const { user, isCounsellor } = useAuth();

  const [activeSection, setActiveSection] = useState<"counseling" | "appointments">("counseling");
  const [showSOS, setShowSOS] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [activeCounselorForSchedule, setActiveCounselorForSchedule] = useState<Counselor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (isCounsellor) {
        const [sessionRes, apptRes] = await Promise.allSettled([
          api.get("/chat/sessions"),
          api.get("/schedule/"),
        ]);
        if (sessionRes.status === "fulfilled") setSessions(sessionRes.value.data || []);
        if (apptRes.status === "fulfilled") setAppointments(apptRes.value.data || []);
      } else {
        const [counselorRes, apptRes] = await Promise.allSettled([
          api.get("/users/?role=counsellor"),
          api.get("/schedule/"),
        ]);
        
        if (counselorRes.status === "fulfilled") {
          const mapped = counselorRes.value.data.map((u: any) => ({
            id: String(u.id),
            name: u.username,
            specialty: u.certification || "General Counselor",
            available: u.is_available ?? true,
            rating: u.rating || 5.0,
            imageUrl: u.profile_pic || `https://ui-avatars.com/api/?name=${u.username}&background=random`,
          }));
          setCounselors(mapped);
        }
        if (apptRes.status === "fulfilled") setAppointments(apptRes.value.data || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [isCounsellor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // REAL-TIME UPDATE: Updates state immediately (Optimistic UI)
  const handleUpdateAppt = async (id: string, status: "accepted" | "rejected") => {
    // Save original state for rollback if API fails
    const originalAppointments = [...appointments];

    // 1. Update UI locally first
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );

    try {
      // 2. Call API
      await api.put(`/schedule/${id}?status=${status}`);
    } catch (err) {
      // 3. Rollback if API fails
      setAppointments(originalAppointments);
      console.error("Update failed:", err);
      alert("Failed to update status. Please try again.");
    }
  };

  // Shared Appointment List UI Component
  const AppointmentsList = () => (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-bold dark:text-white mb-4">
        {isCounsellor ? "Incoming Session Requests" : "My Appointment History"}
      </h2>
      {appointments.length > 0 ? (
        appointments.map((appt) => (
          <div
            key={appt.id}
            className="bg-white dark:bg-zinc-900 p-5 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm transition-all"
          >
            <div className="flex items-center gap-4 w-full">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Calendar size={20} />
              </div>
              <div className="min-w-0 flex-1">
                {/* FIXED NAMES: Showing correct label based on user role */}
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                  {isCounsellor 
                    ? `Student: ${appt.student_name || "Unknown Student"}` 
                    : `Counsellor: ${appt.counsellor_name || "Assigned Counsellor"}`}
                </h3>
                <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500 font-medium mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={12}/> {new Date(appt.scheduled_time).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12}/> {new Date(appt.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {isCounsellor && appt.status === "pending" ? (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleUpdateAppt(appt.id, "accepted")}
                    className="flex-1 px-5 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check size={14} /> Accept
                  </button>
                  <button
                    onClick={() => handleUpdateAppt(appt.id, "rejected")}
                    className="flex-1 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                  appt.status === "accepted" ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-800" :
                  appt.status === "pending" ? "bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700" :
                  "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:border-red-800"
                }`}>
                  {appt.status}
                </span>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="py-20 text-center opacity-40">
          <Ghost className="mx-auto mb-2" size={48} />
          <p className="text-sm">No scheduled items found.</p>
        </div>
      )}
    </div>
  );

  // --- RENDERING LOGIC ---

  if (!isCounsellor && selectedCounselor) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950">
        <ChatPage recipient={selectedCounselor} onBack={() => setSelectedCounselor(null)} currentUser={user} />
      </div>
    );
  }

  return (
    <div className="space-y-8 relative pb-20">
      {showSOS && <EmergencyModal onClose={() => setShowSOS(false)} />}
      {activeCounselorForSchedule && (
        <ScheduleModal counselor={activeCounselorForSchedule} onClose={() => setActiveCounselorForSchedule(null)} />
      )}

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">Connect</h1>
          <p className="text-zinc-500">Support on your schedule.</p>
        </div>
        <button onClick={() => setShowSOS(true)} className="bg-red-50 text-red-600 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-red-100 transition-all shadow-sm">
          <AlertOctagon size={20} /> SOS
        </button>
      </header>

      <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl w-full max-w-md mx-auto sm:mx-0">
        <button
          onClick={() => setActiveSection("counseling")}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${activeSection === "counseling" ? "bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-zinc-500"}`}
        >
          {isCounsellor ? "Messages" : "Counselors"}
        </button>
        <button
          onClick={() => setActiveSection("appointments")}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${activeSection === "appointments" ? "bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-zinc-500"}`}
        >
          Appointments
        </button>
      </div>

      <div className="min-h-[500px]">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
        ) : activeSection === "appointments" ? (
          <AppointmentsList />
        ) : isCounsellor ? (
          <CounsellorChatView 
              sessions={sessions} 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery} 
              selectedSession={selectedSession} 
              setSelectedSession={setSelectedSession}
              user={user}
          />
        ) : (
          <StudentDiscoveryView 
            isAnonymous={isAnonymous} 
            setIsAnonymous={setIsAnonymous} 
            counselors={counselors} 
            setSelectedCounselor={setSelectedCounselor} 
            setActiveCounselorForSchedule={setActiveCounselorForSchedule}
          />
        )}
      </div>
    </div>
  );
};

// --- Static View Components ---

const EmergencyModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-4">
    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden border border-red-500 shadow-2xl">
      <div className="bg-red-600 p-6 text-white text-center">
        <AlertOctagon size={48} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Emergency Support</h2>
      </div>
      <div className="p-6 space-y-4">
        <button className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3"><Phone className="text-red-500" /> <span className="font-bold dark:text-white">Crisis Hotline</span></div>
          <span className="font-mono font-bold text-xl dark:text-white">988</span>
        </button>
        <button onClick={onClose} className="w-full py-3 text-zinc-500 font-medium">Close</button>
      </div>
    </div>
  </div>
);

const StudentDiscoveryView = ({ isAnonymous, setIsAnonymous, counselors, setSelectedCounselor, setActiveCounselorForSchedule }: any) => (
  <div className="space-y-8">
    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-800 rounded-xl text-indigo-600"><Lock size={20} /></div>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white">Anonymous Mode</h3>
          <p className="text-xs text-indigo-700 dark:text-indigo-300">Identity protected by default.</p>
        </div>
      </div>
      <button onClick={() => setIsAnonymous(!isAnonymous)} className={`w-12 h-6 rounded-full relative transition-colors ${isAnonymous ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isAnonymous ? "left-7" : "left-1"}`} />
      </button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {counselors.map((c: any) => (
        <div key={c.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col gap-5 hover:border-indigo-300 transition-all shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <img src={c.imageUrl} className="w-16 h-16 rounded-2xl object-cover" alt="" />
              <div><h3 className="font-bold text-lg text-zinc-900 dark:text-white">{c.name}</h3><p className="text-sm text-zinc-500">{c.specialty}</p></div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-lg dark:text-white"><Star size={12} className="fill-yellow-400 text-yellow-400" /> {c.rating}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-auto">
            <button onClick={() => setActiveCounselorForSchedule(c)} className="py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold flex items-center justify-center gap-2 text-zinc-900 dark:text-white"><Calendar size={16} /> Schedule</button>
            <button onClick={() => setSelectedCounselor(c)} className="py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold shadow-lg flex items-center justify-center gap-2"><MessageSquare size={16} /> Chat</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CounsellorChatView = ({ sessions, searchQuery, setSearchQuery, selectedSession, setSelectedSession, user }: any) => {
  const filtered = sessions.filter((s: any) => (s.student_name || "").toLowerCase().includes(searchQuery.toLowerCase()));
  
  if (selectedSession) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-800">
          <button onClick={() => setSelectedSession(null)} className="p-2 text-zinc-500"><ChevronLeft size={24} /></button>
          <span className="font-bold dark:text-white">{selectedSession.student_name}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPage
            recipient={{
              id: selectedSession.student_id,
              name: selectedSession.student_name || "Student",
              imageUrl: `https://ui-avatars.com/api/?name=${selectedSession.student_name}&background=random`,
              specialty: "Student", available: true, rating: 5,
            }}
            onBack={() => setSelectedSession(null)}
            currentUser={user}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <input
          type="text"
          placeholder="Search students..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none dark:text-white"
        />
      </div>
      <div className="space-y-3">
        {filtered.map((session: any) => (
          <button key={session.id} onClick={() => setSelectedSession(session)} className="w-full flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 hover:border-indigo-300 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold uppercase">{session.student_name?.[0] || "S"}</div>
            <div className="text-left flex-1"><h3 className="font-bold dark:text-white">{session.student_name || "Unknown"}</h3><p className="text-xs text-zinc-500">Tap to respond</p></div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Connect;
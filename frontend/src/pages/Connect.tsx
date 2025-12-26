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
  scheduled_time: string;
  status: "pending" | "accepted" | "declined";
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
      alert(err.response?.data?.detail?.[0]?.msg || "Booking failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg md:text-xl font-bold">
            Schedule with {counselor.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>
        {success ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 mx-auto rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <p className="font-bold text-lg">Request Sent!</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase ml-1">
                Date
              </label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1.5 p-3 md:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl md:rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase ml-1">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full mt-1.5 p-3 md:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl md:rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none dark:text-white"
              />
            </div>
            <button
              disabled={!date || !time || loading}
              onClick={handleSchedule}
              className="w-full py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Calendar size={18} />
              )}{" "}
              Confirm Booking
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

  const [activeSection, setActiveSection] = useState<
    "counseling" | "appointments"
  >("counseling");
  const [showSOS, setShowSOS] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(
    null
  );
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
  const [activeCounselorForSchedule, setActiveCounselorForSchedule] =
    useState<Counselor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (isCounsellor) {
        const [sessionRes, apptRes] = await Promise.allSettled([
          api.get("/chat/sessions"),
          api.get("/schedule/"),
        ]);
        if (sessionRes.status === "fulfilled")
          setSessions(sessionRes.value.data || []);
        if (apptRes.status === "fulfilled")
          setAppointments(apptRes.value.data || []);
      } else {
        const res = await api.get("/users/?role=counsellor");
        const mapped = res.data.map((u: any) => ({
          id: String(u.id),
          name: u.username,
          specialty: u.certification || "General Counselor",
          available: u.is_available ?? true,
          rating: u.rating || 5.0,
          imageUrl:
            u.profile_pic ||
            `https://ui-avatars.com/api/?name=${u.username}&background=random`,
        }));
        setCounselors(mapped);
      }
    } catch (err) {
      console.error("Critical data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [isCounsellor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateAppt = async (
    id: string,
    status: "accepted" | "declined"
  ) => {
    try {
      await api.put(`/schedule/${id}?status=${status}`);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Student Chat View Overlay
  if (!isCounsellor && selectedCounselor) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950">
        <ChatPage
          recipient={selectedCounselor}
          onBack={() => setSelectedCounselor(null)}
          currentUser={user}
        />
      </div>
    );
  }

  // --- COUNSELLOR VIEW ---
  if (isCounsellor) {
    const filteredSessions = sessions.filter((s) =>
      (s.student_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-140px)] -mt-2 md:-mt-4 bg-white dark:bg-zinc-950 overflow-hidden rounded-t-[2rem] md:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-900">
        <div className="flex border-b border-zinc-100 dark:border-zinc-900 p-2 bg-zinc-50/50 dark:bg-zinc-900 shrink-0">
          <button
            onClick={() => setActiveSection("counseling")}
            className={`flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all ${
              activeSection === "counseling"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md"
                : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveSection("appointments")}
            className={`flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all ${
              activeSection === "appointments"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md"
                : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            Appointments
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          {activeSection === "counseling" ? (
            <>
              {/* Sidebar: Session List */}
              <div
                className={`${
                  selectedSession ? "hidden md:flex" : "flex"
                } w-full md:w-80 flex-col border-r border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/40 shrink-0`}
              >
                <div className="p-4">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-6">
                  {loading ? (
                    <div className="py-10 text-center">
                      <Loader2 className="animate-spin mx-auto text-zinc-300" />
                    </div>
                  ) : filteredSessions.length > 0 ? (
                    filteredSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                          selectedSession?.id === session.id
                            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 shadow-sm"
                            : "border-transparent hover:bg-white/60 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0 uppercase text-xs">
                          {session.student_name?.charAt(0) || "S"}
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                          <h3 className="font-bold text-xs truncate dark:text-white">
                            {session.student_name ||
                              `Student #${session.student_id}`}
                          </h3>
                          <p className="text-[10px] text-zinc-500 truncate">
                            Click to open chat
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-20 text-center opacity-40">
                      <Ghost className="mx-auto mb-2" size={32} />
                      <p className="text-xs">No active sessions</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat View Area */}
              <div
                className={`${
                  selectedSession ? "flex" : "hidden md:flex"
                } flex-1 flex-col relative bg-zinc-50/10 h-full overflow-hidden`}
              >
                {selectedSession ? (
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* The 'h-full overflow-hidden' here is CRITICAL. 
          It tells the chat page it only has exactly this much space. 
      */}

                    {/* Mobile Only Header inside Chat */}
                    <div className="md:hidden flex items-center gap-3 p-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
                      <button
                        onClick={() => setSelectedSession(null)}
                        className="p-2 -ml-2 text-zinc-500"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="font-bold text-sm truncate dark:text-white">
                        {selectedSession.student_name}
                      </span>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                      {/* We wrap ChatPage in a flex-1 container to let it fill the space */}
                      <ChatPage
                        key={selectedSession.id}
                        recipient={{
                          id: selectedSession.student_id,
                          name: selectedSession.student_name || "Student",
                          imageUrl: `https://ui-avatars.com/api/?name=${selectedSession.student_name}&background=random`,
                          specialty: "Student",
                          available: true,
                          rating: 5,
                        }}
                        onBack={() => setSelectedSession(null)}
                        currentUser={user}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-4 text-zinc-300 dark:text-zinc-600">
                      <MessageSquare size={32} />
                    </div>
                    <p className="text-sm font-bold dark:text-white">
                      Student Chat
                    </p>
                    <p className="text-xs max-w-[200px] mt-1">
                      Select a student from the sidebar to start counseling.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Appointments Section */
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {appointments.length > 0 ? (
                appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center dark:text-white shrink-0">
                        <User size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                          {appt.student_name}
                        </h3>
                        <div className="flex flex-wrap gap-2 md:gap-3 text-[10px] text-zinc-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />{" "}
                            {new Date(appt.scheduled_time).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />{" "}
                            {new Date(appt.scheduled_time).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {appt.status === "pending" ? (
                        <>
                          <button
                            onClick={() =>
                              handleUpdateAppt(appt.id, "accepted")
                            }
                            className="flex-1 sm:flex-none p-2 md:px-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors flex justify-center"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateAppt(appt.id, "declined")
                            }
                            className="flex-1 sm:flex-none p-2 md:px-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex justify-center"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase ${
                            appt.status === "accepted"
                              ? "bg-green-100 text-green-700"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {appt.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center opacity-40">
                  <p>No appointments requested</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- STUDENT VIEW (DISCOVERY) ---
  return (
    <div className="space-y-8 relative pb-20">
      {showSOS && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden border border-red-500 shadow-2xl">
            <div className="bg-red-600 p-6 text-white text-center">
              <AlertOctagon size={48} className="mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Emergency Support</h2>
              <p className="text-red-100 mt-2 text-sm">
                Please call emergency services if you are in immediate danger.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <button className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Phone className="text-red-500" />
                  <div>
                    <p className="font-bold dark:text-white">Crisis Hotline</p>
                    <p className="text-xs text-zinc-500">24/7 Support</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xl dark:text-white">
                  988
                </span>
              </button>
              <button
                onClick={() => setShowSOS(false)}
                className="w-full py-3 text-zinc-500 font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCounselorForSchedule && (
        <ScheduleModal
          counselor={activeCounselorForSchedule}
          onClose={() => setActiveCounselorForSchedule(null)}
        />
      )}

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">
            Connect
          </h1>
          <p className="text-zinc-500">
            Professional support, scheduled or instant.
          </p>
        </div>
        <button
          onClick={() => setShowSOS(true)}
          className="bg-red-50 text-red-600 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-red-100 transition-all shadow-sm"
        >
          <AlertOctagon size={20} /> SOS
        </button>
      </header>

      <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-800 rounded-xl text-indigo-600">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">
              Anonymous Mode
            </h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Identity protected by default.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsAnonymous(!isAnonymous)}
          className={`w-12 h-6 rounded-full relative transition-colors ${
            isAnonymous ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
              isAnonymous ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {counselors.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col gap-5 hover:border-indigo-300 transition-all shadow-sm group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={c.imageUrl}
                    className="w-16 h-16 rounded-2xl object-cover shadow-sm"
                    alt=""
                  />
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                      {c.name}
                    </h3>
                    <p className="text-sm text-zinc-500">{c.specialty}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-lg dark:text-white">
                  <Star size={12} className="fill-yellow-400 text-yellow-400" />{" "}
                  {c.rating}
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveCounselorForSchedule(c)}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold hover:bg-zinc-200 text-zinc-900 dark:text-zinc-200 transition-all"
                >
                  <Calendar size={16} /> Schedule
                </button>
                <button
                  onClick={() => setSelectedCounselor(c)}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold shadow-lg transition-all"
                >
                  <MessageSquare size={16} /> Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Connect;

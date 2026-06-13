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
  User,
  Clock,
  X,
  CheckCircle2,
  Ghost,
  LockKeyhole
} from "lucide-react";
import { Counselor } from "../../types";
import ChatPage from "../components/ChatPage";
import { useAuth } from "../context/AuthContext";

// --- Schedule Modal ---
const ScheduleModal: React.FC<{
  counselor?: Counselor | null;
  counselorsList: Counselor[];
  onClose: () => void;
}> = ({ counselor, counselorsList, onClose }) => {
  const { user } = useAuth();
  const [selectedCounselorId, setSelectedCounselorId] = useState(counselor?.id || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!counselor && counselorsList.length > 0 && !selectedCounselorId) {
      setSelectedCounselorId(counselorsList[0].id);
    }
    if (counselor && counselor.id !== selectedCounselorId) {
      setSelectedCounselorId(counselor.id);
    }
  }, [counselor, counselorsList, selectedCounselorId]);

  const handleSchedule = async () => {
    if (!date || !time || !user || !selectedCounselorId) {
      alert("Please select a counselor, date, and time before booking.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        counsellor_id: Number(selectedCounselorId),
        scheduled_time: `${date}T${time}:00`,
      };
      await api.post("/schedule/", payload);
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "This slot might be taken or the request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">Request an Appointment</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
            <X size={20} />
          </button>
        </div>
        {success ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 mx-auto rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <p className="font-bold text-lg dark:text-white">Booking Request Sent!</p>
          </div>
        ) : (
          <div className="space-y-5">
            {!counselor && (
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Select Counsellor</label>
                <select
                  value={selectedCounselorId}
                  onChange={(e) => setSelectedCounselorId(e.target.value)}
                  className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500/20"
                >
                  {counselorsList.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.specialty}</option>
                  ))}
                </select>
              </div>
            )}
            {counselor && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Booking session with <span className="font-bold text-zinc-800 dark:text-white">{counselor.name}</span>
              </p>
            )}
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
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Calendar size={18} />} Request Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Emergency Modal ---
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

// --- Connect Page ---
const Connect: React.FC = () => {
  const { user } = useAuth();

  const [showSOS, setShowSOS] = useState(false);
  const [showCounsellors, setShowCounsellors] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [activeCounselorForSchedule, setActiveCounselorForSchedule] = useState<Counselor | null>(null);
  const [showGeneralSchedule, setShowGeneralSchedule] = useState(false);

  const fetchCounselors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/users/?role=counsellor");
      const mapped = res.data.map((u: any) => ({
        id: String(u.id),
        name: u.username,
        specialty: u.certification || "General Counselor",
        available: u.is_available ?? true,
        rating: u.rating || 5.0,
        imageUrl: u.profile_pic || `https://ui-avatars.com/api/?name=${u.username}&background=random`,
      }));
      setCounselors(mapped);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounselors();
  }, [fetchCounselors]);

  if (selectedCounselor) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950">
        <ChatPage recipient={selectedCounselor} onBack={() => setSelectedCounselor(null)} currentUser={user} />
      </div>
    );
  }

  return (
    <div className="space-y-8 relative pb-20 animate-fade-in">
      {showSOS && <EmergencyModal onClose={() => setShowSOS(false)} />}
      
      {/* Specific Counselor Booking */}
      {activeCounselorForSchedule && (
        <ScheduleModal 
          counselor={activeCounselorForSchedule} 
          counselorsList={counselors} 
          onClose={() => setActiveCounselorForSchedule(null)} 
        />
      )}

      {/* General Booking Button */}
      {showGeneralSchedule && (
        <ScheduleModal 
          counselor={null} 
          counselorsList={counselors} 
          onClose={() => setShowGeneralSchedule(false)} 
        />
      )}

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">Connect</h1>
          <p className="text-zinc-500">Professional support for your wellness journey.</p>
        </div>
        <button onClick={() => setShowSOS(true)} className="bg-red-50 text-red-600 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-red-100 transition-all shadow-sm">
          <AlertOctagon size={20} /> SOS
        </button>
      </header>

      {/* Gating & Preferences Controls */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6 max-w-2xl">
        <h3 className="font-bold text-zinc-900 dark:text-white">Connection Preferences</h3>

        {/* Toggle 1: Show Counsellors */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Show counsellors</h4>
            <p className="text-xs text-zinc-500">Browse and display clinicians currently available for sessions.</p>
          </div>
          <button 
            onClick={() => setShowCounsellors(!showCounsellors)} 
            className={`w-12 h-6 rounded-full relative transition-colors ${showCounsellors ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${showCounsellors ? "left-7" : "left-1"}`} />
          </button>
        </div>

        {/* Toggle 2: Anonymous Mode */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Anonymous mode</h4>
            <p className="text-xs text-zinc-500">Hide student identity and metadata from logs.</p>
          </div>
          <button 
            onClick={() => setIsAnonymous(!isAnonymous)} 
            className={`w-12 h-6 rounded-full relative transition-colors ${isAnonymous ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isAnonymous ? "left-7" : "left-1"}`} />
          </button>
        </div>

        {/* Book a Session Action Button */}
        <button
          onClick={() => setShowGeneralSchedule(true)}
          className="mt-2 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md"
        >
          <Calendar size={18} /> Book a session
        </button>
      </div>

      {/* Discovery Board */}
      <div className="min-h-[300px]">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
        ) : showCounsellors ? (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Available Clinicians</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {counselors.map((c: any) => (
                <div key={c.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col gap-5 hover:border-indigo-300 transition-all shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <img src={c.imageUrl} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                      <div>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{c.name}</h3>
                        <p className="text-sm text-zinc-500">{c.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-lg dark:text-white">
                      <Star size={12} className="fill-yellow-400 text-yellow-400" /> {c.rating}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button onClick={() => setActiveCounselorForSchedule(c)} className="py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold flex items-center justify-center gap-2 text-zinc-900 dark:text-white">
                      <Calendar size={16} /> Schedule
                    </button>
                    <button onClick={() => setSelectedCounselor(c)} className="py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold shadow-lg flex items-center justify-center gap-2">
                      <MessageSquare size={16} /> Chat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center opacity-40 max-w-sm mx-auto">
            <LockKeyhole className="mx-auto mb-3" size={48} />
            <p className="text-sm font-medium">Clinician list hidden. Toggle "Show counsellors" to browse available options.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Connect;
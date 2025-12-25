import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { 
  Phone, Star, MessageSquare, AlertOctagon, Lock, 
  Loader2, Search, X, Ghost
} from 'lucide-react';
import { Counselor } from '../../types';
import ChatPage from '../components/ChatPage';
import { useAuth } from '../context/AuthContext';

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

const Connect: React.FC = () => {
  const { user, isCounsellor } = useAuth();
  const [activeSection, setActiveSection] = useState<'counseling' | 'peer'>('counseling');
  const [showSOS, setShowSOS] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (isCounsellor) {
        // Fetch only active chat sessions for the counsellor
        const sessionRes = await api.get('/chat/sessions');
        setSessions(sessionRes.data || []);
      } else {
        // Fetch list of available counsellors for the student
        const res = await api.get('/users/?role=counsellor');
        const mapped = res.data.map((u: any) => ({
          id: String(u.id), 
          name: u.username,
          specialty: u.certification || 'General Counselor',
          available: u.is_available ?? true,
          rating: u.rating || 5.0,
          imageUrl: u.profile_pic || `https://ui-avatars.com/api/?name=${u.username}&background=random`
        }));
        setCounselors(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [isCounsellor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Render Chat Overlays ---
  if (selectedCounselor) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950">
        <ChatPage recipient={selectedCounselor} onBack={() => setSelectedCounselor(null)} currentUser={user} />
      </div>
    );
  }

  // --- COUNSELLOR VIEW (Session Focused) ---
  if (isCounsellor) {
    const filteredSessions = sessions.filter(s => 
      (s.student_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] -mt-4 bg-white dark:bg-zinc-950 overflow-hidden rounded-[2.5rem] border border-zinc-100 dark:border-zinc-900">
        <div className="flex border-b border-zinc-100 dark:border-zinc-900 p-4 bg-zinc-50/50 dark:bg-zinc-900">
           <h2 className="font-bold text-lg dark:text-white flex items-center gap-2">
             <MessageSquare className="text-indigo-500" size={20} /> 
             Active Counseling Sessions
           </h2>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: Session List */}
          <div className="w-full md:w-80 flex flex-col border-r border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/40">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Find student..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none" 
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-6">
              {loading ? (
                <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-zinc-300" /></div>
              ) : filteredSessions.length > 0 ? (
                filteredSessions.map(session => (
                  <button 
                    key={session.id} 
                    onClick={() => setSelectedSession(session)} 
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${selectedSession?.id === session.id ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm' : 'border-transparent hover:bg-white/60 dark:hover:bg-zinc-800/50'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                      {session.student_name?.charAt(0) || 'S'}
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <h3 className="font-bold text-xs truncate dark:text-white">{session.student_name || `Student #${session.student_id}`}</h3>
                      <p className="text-[10px] text-zinc-500 truncate">Tap to open chat</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-20 text-center opacity-40">
                  <Ghost className="mx-auto mb-2" size={32} />
                  <p className="text-xs font-medium">No active chats</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Window Container */}
          <div className="flex-1 flex flex-col relative bg-zinc-50/10">
            {selectedSession ? (
              <ChatPage 
                recipient={{ 
                  id: selectedSession.student_id, 
                  name: selectedSession.student_name || 'Student', 
                  imageUrl: `https://ui-avatars.com/api/?name=${selectedSession.student_name}&background=random`, 
                  specialty: 'Student', 
                  available: true, 
                  rating: 5 
                }} 
                onBack={() => setSelectedSession(null)} 
                currentUser={user} 
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mb-4 text-indigo-500">
                  <MessageSquare size={32} />
                </div>
                <h2 className="font-bold text-zinc-900 dark:text-white">Your Workspace</h2>
                <p className="text-zinc-500 text-sm max-w-xs mt-1">Select a student conversation from the sidebar to provide support and view history.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- STUDENT VIEW (Discovery Focused) ---
  return (
    <div className="space-y-8 relative pb-20">
      {showSOS && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden border border-red-500 shadow-2xl">
            <div className="bg-red-600 p-6 text-white text-center">
              <AlertOctagon size={48} className="mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Emergency Support</h2>
              <p className="text-red-100 mt-2 text-sm">Please call emergency services if you are in immediate danger.</p>
            </div>
            <div className="p-6">
              <button className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Phone className="text-red-500" />
                  <div className="text-left"><p className="font-bold dark:text-white">Crisis Hotline</p><p className="text-xs text-zinc-500">24/7 Support</p></div>
                </div>
                <span className="font-mono font-bold text-xl dark:text-white">988</span>
              </button>
              <button onClick={() => setShowSOS(false)} className="w-full py-3 text-zinc-500 font-medium text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">Connect</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Speak with a professional counselor.</p>
        </div>
        <button onClick={() => setShowSOS(true)} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-6 py-3 rounded-full font-bold flex items-center gap-2 animate-pulse hover:bg-red-100">
          <AlertOctagon size={20} /> SOS
        </button>
      </header>

      <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-800 rounded-xl text-indigo-600"><Lock size={20} /></div>
          <div><h3 className="font-bold text-zinc-900 dark:text-white">Anonymous Mode</h3><p className="text-xs text-indigo-700 dark:text-indigo-300">Identity protected by default.</p></div>
        </div>
        <button onClick={() => setIsAnonymous(!isAnonymous)} className={`w-12 h-6 rounded-full relative transition-colors ${isAnonymous ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
          <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isAnonymous ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {counselors.map((c) => (
            <div key={c.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col gap-5 hover:border-indigo-300 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <img src={c.imageUrl} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                  <div><h3 className="font-bold text-lg text-zinc-900 dark:text-white">{c.name}</h3><p className="text-sm text-zinc-500">{c.specialty}</p></div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-lg dark:text-white">
                  <Star size={12} className="fill-yellow-400 text-yellow-400" /> {c.rating}
                </div>
              </div>
              <button 
                onClick={() => setSelectedCounselor(c)} 
                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageSquare size={18} /> Start Conversation
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Connect;
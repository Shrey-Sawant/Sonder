import React, { useState, useEffect, useCallback, useRef } from "react";
import api, { getWebSocketUrl } from "../services/api";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import ChatPage from "./ChatPage";
import { useAuth } from "../context/AuthContext";

interface ChatSession {
  id: string;
  student_id: string;
  counsellor_id: string;
  status: string;
  student_name: string;
  student_image?: string;
  last_message?: string;
  updated_at: string;
}

const normalizeSessions = (sessions: ChatSession[]) => {
  const map = new Map<string, ChatSession>();
  sessions.forEach((s) => {
    const key = String(s.student_id);
    if (!map.has(key)) {
      map.set(key, { ...s, id: String(s.id) });
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
};

const CounsellorChatDashboard: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/chat/sessions");
      setSessions(normalizeSessions(res.data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    if (!user?.id || wsRef.current) return;

    const ws = new WebSocket(getWebSocketUrl(`/chat/ws/${user.id}`));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSessions((prev) => {
        let updated = [...prev];
        if (data.type === "NEW_SESSION") {
          const exists = updated.find(s => String(s.id) === String(data.payload.id));
          if (!exists) updated.push(data.payload);
        }
        if (data.type === "NEW_MESSAGE") {
          updated = updated.map((s) =>
            String(s.id) === String(data.payload.session_id)
              ? { ...s, last_message: data.payload.message, updated_at: new Date().toISOString() }
              : s
          );
        }
        return normalizeSessions(updated);
      });
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [user?.id, fetchSessions]);

  const filteredSessions = sessions.filter((s) =>
    s.student_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSession = (session) => {
    setSelectedSession(session);
    setShowMobileSidebar(false);
  };

  const handleBack = () => {
    setSelectedSession(null);
    setShowMobileSidebar(true);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden">
      <div className={`${showMobileSidebar ? "flex" : "hidden"} md:flex w-full md:w-80 lg:w-96 flex-col border-r border-zinc-100 dark:border-zinc-800`}>
        <div className="p-4 md:p-6">
          <h1 className="text-2xl font-bold mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-4">
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleSelectSession(session)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${selectedSession?.id === session.id ? "bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"}`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                  {session.student_name.substring(0, 2).toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-950 bg-green-500"></div>
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <h3 className="font-bold text-sm truncate">{session.student_name}</h3>
                <p className="text-xs text-zinc-500 truncate">{session.last_message}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className={`${showMobileSidebar ? "hidden" : "flex"} md:flex flex-1 items-center justify-center`}>
        {selectedSession ? (
          <ChatPage
            recipient={{ id: selectedSession.student_id, name: selectedSession.student_name }}
            currentUser={user}
            onBack={handleBack}
          />
        ) : (
          <div className="hidden md:flex text-center text-zinc-400 flex-col items-center"><MessageSquare size={40} className="mx-auto mb-2" /><p>Select a chat to start</p></div>
        )}
      </div>
    </div>
  );
};

export default CounsellorChatDashboard;
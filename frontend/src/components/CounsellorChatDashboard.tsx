import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import { Search, MessageSquare, User, Loader2 } from "lucide-react";
import ChatPage from "./ChatPage";
import { useAuth } from "../context/AuthContext";

interface ChatSession {
  id: string;
  student_id: string;
  counsellor_id: string;
  status: string;
  chat_type: string;
  student_name: string;
  student_image?: string;
  last_message?: string;
  updated_at: string;
}

/* -----------------------------------------
   🔒 Normalize & Deduplicate (ONLY PLACE)
------------------------------------------ */
const normalizeSessions = (sessions: ChatSession[]) => {
  const map = new Map<string, ChatSession>();

  sessions.forEach((s) => {
    map.set(String(s.id), {
      ...s,
      id: String(s.id),
    });
  });

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updated_at).getTime() -
      new Date(a.updated_at).getTime()
  );
};

const CounsellorChatDashboard: React.FC = () => {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] =
    useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  /* 🔐 Prevent duplicate WebSocket connections (STRICT MODE FIX) */
  const wsRef = useRef<WebSocket | null>(null);

  /* -----------------------------------------
     📥 Initial Fetch
  ------------------------------------------ */
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/chat/sessions");
      setSessions(normalizeSessions(res.data));
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* -----------------------------------------
     🔌 WebSocket (SINGLE INSTANCE)
  ------------------------------------------ */
  useEffect(() => {
    fetchSessions();

    if (!user?.id) return;

    /* ⛔ BLOCK SECOND STRICT MODE RUN */
    if (wsRef.current) return;

    const ws = new WebSocket(
      `ws://localhost:8000/api/v1/chat/ws/${user.id}`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      setSessions((prev) => {
        let updated = [...prev];

        if (data.type === "NEW_SESSION") {
          updated.push({
            ...data.payload,
            id: String(data.payload.id),
          });
        }

        if (data.type === "NEW_MESSAGE") {
          updated = updated.map((s) =>
            String(s.id) === String(data.payload.session_id)
              ? {
                  ...s,
                  last_message: data.payload.message,
                  updated_at: new Date().toISOString(),
                }
              : s
          );
        }

        return normalizeSessions(updated);
      });
    };

    ws.onerror = (e) => console.error("WebSocket error", e);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [user?.id, fetchSessions]);

  /* -----------------------------------------
     🔍 Search
  ------------------------------------------ */
  const filteredSessions = sessions.filter((s) =>
    s.student_name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col border-r border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
            Messages
          </h1>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-10">
              <User className="mx-auto text-zinc-300 mb-2" size={30} />
              <p className="text-xs text-zinc-500">
                No students found
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] ${
                  selectedSession?.id === session.id
                    ? "bg-white dark:bg-zinc-800 border"
                    : "hover:bg-white/50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <img
                  src={
                    session.student_image ||
                    `https://ui-avatars.com/api/?name=${session.student_name}`
                  }
                  className="w-12 h-12 rounded-2xl"
                />
                <div className="flex-1 text-left overflow-hidden">
                  <h3 className="font-bold text-sm truncate">
                    {session.student_name}
                  </h3>
                  <p className="text-xs text-zinc-500 truncate">
                    {session.last_message}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex items-center justify-center">
        {selectedSession ? (
          <ChatPage
            recipient={{
              id: selectedSession.student_id,
              name: selectedSession.student_name,
            }}
            currentUser={user}
            onBack={() => setSelectedSession(null)}
          />
        ) : (
          <MessageSquare size={40} />
        )}
      </div>
    </div>
  );
};

export default CounsellorChatDashboard;

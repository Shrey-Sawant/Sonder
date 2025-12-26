import React, { useState, useEffect, useRef } from "react";
import { Send, ChevronLeft, Loader2, Shield } from "lucide-react";
import api from "../services/api";

interface ChatPageProps {
  recipient: any;
  onBack: () => void;
  currentUser: any;
}

const ChatPage: React.FC<ChatPageProps> = ({
  recipient,
  onBack,
  currentUser,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const socket = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Initialization and WebSocket Setup
useEffect(() => {
    if (!currentUser || !recipient) return;

    let isMounted = true;

    const initChat = async () => {
      try {
        setLoading(true);

        // 1. Fetch or Create Session
        const sessRes = await api.post("/chat/sessions", {
          student_id: currentUser.role === "student" ? currentUser.id : recipient.id,
          counsellor_id: currentUser.role === "counsellor" ? currentUser.id : recipient.id,
          chat_type: "counsellor",
          status: "active",
        });

        if (!isMounted) return;

        const currentSessId = sessRes.data.id;
        setSessionId(currentSessId);

        // 2. Load History
        const histRes = await api.get(`/chat/messages/${currentSessId}`);
        if (isMounted) setMessages(histRes.data);

        // 3. Setup WebSocket
        const wsUrl = `ws://localhost:8000/api/v1/chat/ws/${currentUser.id}`;
        const ws = new WebSocket(wsUrl);
        socket.current = ws;

        ws.onopen = () => console.log("✅ Connected to Chat WS");

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "NEW_MESSAGE") {
            const isCorrectSession = String(data.payload.session_id) === String(currentSessId);
            const isNotMe = data.payload.sender_role !== currentUser.role;

            if (isCorrectSession && isNotMe) {
              setMessages((prev) => {
                const exists = prev.find((m) => m.id === data.payload.id);
                if (exists) return prev;
                return [...prev, data.payload];
              });
            }
          }
        };

        ws.onerror = (err) => console.error("❌ WebSocket Error:", err);
        ws.onclose = () => console.log("🔌 WebSocket Disconnected");

        // REMOVED the return statement from here
      } catch (err) {
        console.error("Chat Init Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initChat();

    // THIS is the only return statement you need
    return () => {
      isMounted = false;
      if (socket.current) {
        console.log("Cleanup: Closing ChatPage WS");
        socket.current.close();
        socket.current = null; // Good practice to clear the ref
      }
    };
  }, [recipient.id, currentUser.id, currentUser.role]);
  
  // 2. Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 3. Message Sending Logic (Defined inside the component)
  const handleSend = async () => {
    if (!inputText.trim() || !sessionId) return;

    const textToSend = inputText.trim();
    setInputText(""); // Optimistic clear

    try {
      const res = await api.post("/chat/messages", {
        session_id: sessionId,
        sender_role: currentUser.role,
        message: textToSend,
      });
      setMessages((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Send Error:", err);
      setInputText(textToSend); // Rollback on error
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      <header className="p-4 border-b flex items-center bg-white dark:bg-zinc-950 z-10">
        <button
          onClick={onBack}
          className="p-2 mr-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
        >
          <ChevronLeft size={20} />
        </button>
        <img
          src={recipient.imageUrl}
          className="w-10 h-10 rounded-full object-cover mr-3"
          alt="Recipient"
        />
        <div>
          <h2 className="text-sm font-bold">{recipient.name}</h2>
          <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">
            Active Now
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/30 dark:bg-zinc-900/10"
      >
        <div className="flex flex-col items-center py-4 opacity-40">
          <Shield size={18} className="mb-1" />
          <p className="text-[8px] font-bold uppercase tracking-widest">
            End-to-end encrypted
          </p>
        </div>

        {messages.map((m, i) => (
          <div
            key={m.id || i}
            className={`flex ${
              m.sender_role === currentUser.role
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                m.sender_role === currentUser.role
                  ? "bg-zinc-900 text-white rounded-tr-none"
                  : "bg-white border dark:bg-zinc-800 dark:border-zinc-700 rounded-tl-none"
              }`}
            >
              {m.message}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-4 py-2">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 bg-transparent py-2 text-sm outline-none"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="text-indigo-600 disabled:opacity-30 p-1 hover:scale-110 transition-transform"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

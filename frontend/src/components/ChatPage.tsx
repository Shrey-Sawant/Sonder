import React, { useState, useEffect, useRef } from "react";
import { Send, ChevronLeft, Loader2, Shield, MoreVertical } from "lucide-react";
import api, { getWebSocketUrl } from "../services/api";

const ChatPage = ({ recipient, onBack, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const socket = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!currentUser || !recipient) return;
    let isMounted = true;

    const initChat = async () => {
      try {
        setLoading(true);
        const sessRes = await api.post("/chat/sessions", {
          student_id: currentUser.role === "student" ? currentUser.id : recipient.id,
          counsellor_id: currentUser.role === "counsellor" ? currentUser.id : recipient.id,
          chat_type: "counsellor",
          status: "active",
        });
        if (!isMounted) return;
        setSessionId(sessRes.data.id);

        const histRes = await api.get(`/chat/messages/${sessRes.data.id}`);
        if (isMounted) setMessages(histRes.data);

        const ws = new WebSocket(getWebSocketUrl(`/chat/ws/${currentUser.id}`));
        socket.current = ws;
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "NEW_MESSAGE" && String(data.payload.session_id) === String(sessRes.data.id)) {
            if (data.payload.sender_role !== currentUser.role) {
              setMessages((prev) => [...prev, data.payload]);
            }
          }
        };
      } catch (err) { console.error(err); }
      finally { if (isMounted) setLoading(false); }
    };
    initChat();
    return () => { isMounted = false; socket.current?.close(); };
  }, [recipient.id, currentUser.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !sessionId) return;
    const text = inputText.trim();
    setInputText("");
    try {
      const res = await api.post("/chat/messages", {
        session_id: sessionId,
        sender_role: currentUser.role,
        message: text,
      });
      setMessages((prev) => [...prev, res.data]);
    } catch (err) { setInputText(text); }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <ChevronLeft size={22} className="text-zinc-600 dark:text-zinc-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{recipient.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {currentUser.role === "student" ? "Counsellor" : "Student"}
          </p>
        </div>
      </div>

      <div className="flex flex-col w-full max-w-5xl mx-auto h-full bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-100 px-6 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs ring-2 ring-indigo-50 dark:ring-zinc-800">
                {recipient.name ? recipient.name.substring(0, 2).toUpperCase() : "U"}
              </div>
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-zinc-950"></div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                {recipient.name}
              </h2>
              <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
                ONLINE NOW
              </p>
            </div>
          </div>
          <MoreVertical size={20} className="text-zinc-400 cursor-pointer" />
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-zinc-50/30 dark:bg-zinc-900/10 p-6 space-y-4">
          <div className="mb-8 flex flex-col items-center opacity-30">
            <Shield size={14} className="mb-1" />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]">End-to-End Encrypted</p>
          </div>

          {messages.map((m, i) => {
            const isMe = m.sender_role === currentUser.role;
            return (
              <div key={m.id || i} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`relative max-w-[85%] md:max-w-[70%] px-4 py-2.5 shadow-sm transition-all ${isMe
                  ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none"
                  : "bg-white border border-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 rounded-2xl rounded-tl-none"
                  }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.message}</p>
                  <span className={`mt-1 block text-[9px] font-medium opacity-50 ${isMe ? "text-right" : "text-left"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl px-4 py-2 focus-within:ring-2 ring-indigo-500/20 transition-all border border-transparent focus-within:border-indigo-500/20">
            <input
              type="text"
              placeholder="Write a message..."
              className="flex-1 bg-transparent py-2 text-sm outline-none text-zinc-800 dark:text-zinc-200"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg transition-all hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale active:scale-95"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
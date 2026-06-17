import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, MessageSquare, Plus, Flag, AlertCircle, ShieldCheck, Heart, User, X, Info } from 'lucide-react';
import api, { getWebSocketUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Thread {
  thread_id: string;
  thread_type: 'peer_1on1' | 'support_circle';
  participants_anon_ids: string[];
  created_at: string;
  last_message_at: string | null;
}

interface Message {
  message_id: string;
  thread_id: string;
  sender_anon_id: string;
  content: string;
  sent_at: string;
  flagged: boolean;
  crisis_detected?: boolean;
  crisis_level?: string | null;
}

const PeerChat: React.FC = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Modals / Dropdowns
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<{ id: number; anon_id: string }[]>([]);
  const [chatType, setChatType] = useState<'peer_1on1' | 'support_circle'>('peer_1on1');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  
  // Reporting state
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('');
  
  // Crisis Alert Banner state
  const [chatCrisisWarning, setChatCrisisWarning] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load threads and available peers on mount
  useEffect(() => {
    fetchThreads();
    fetchPeers();
  }, []);

  // Set up WebSocket connection for real-time messages
  useEffect(() => {
    if (!user?.anon_id) return;

    const wsUrl = getWebSocketUrl(`/peer_chat/ws/${user.anon_id}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to peer chat network');
    };

    ws.onmessage = (event) => {
      try {
        if (event.data === 'pong') return;
        const msg = JSON.parse(event.data);
        if (msg.type === 'NEW_PEER_MESSAGE') {
          const newMsg: Message = msg.payload;
          
          // Append message if it belongs to selected thread
          if (selectedThread && newMsg.thread_id === selectedThread.thread_id) {
            setMessages((prev) => {
              // Prevent duplicate insertions
              if (prev.some(m => m.message_id === newMsg.message_id)) return prev;
              return [...prev, newMsg];
            });
            
            // Trigger soft crisis banner in UI if user's own typed message contains crisis triggers
            if (newMsg.crisis_detected && newMsg.sender_anon_id === user.anon_id) {
              setChatCrisisWarning(
                "It looks like you are going through a difficult moment. Please know that you are not alone. Support is available: contact the iCall hotline at 9152987821 or Vandrevala Foundation at 9999666555."
              );
            }
          }
          
          // Refresh threads list to update last message time
          fetchThreads();
        }
      } catch (err) {
        console.error('[WS] Parse message error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Peer chat connection closed');
    };

    return () => {
      ws.close();
    };
  }, [user, selectedThread]);

  // Keep chat scrolled to the bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchThreads = async () => {
    try {
      const res = await api.get('/peer_chat/threads');
      setThreads(res.data);
    } catch (err) {
      console.error('Error fetching chat threads:', err);
    }
  };

  const fetchPeers = async () => {
    try {
      const res = await api.get('/users?role=student');
      // Filter out self and users without anon_id
      const peers = res.data
        .filter((s: any) => s.anon_id && s.anon_id !== user?.anon_id)
        .map((s: any) => ({ id: s.id, anon_id: s.anon_id }));
      setAvailableStudents(peers);
    } catch (err) {
      console.error('Error fetching peer list:', err);
    }
  };

  const loadMessages = async (thread: Thread) => {
    setSelectedThread(thread);
    setChatCrisisWarning(null); // Clear previous warnings
    try {
      const res = await api.get(`/peer_chat/messages/${thread.thread_id}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Error loading thread messages:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedThread) return;

    setIsSending(true);
    const content = inputText.trim();
    setInputText('');

    try {
      await api.post('/peer_chat/messages', {
        thread_id: selectedThread.thread_id,
        content: content
      });
      // Thread messages will be appended automatically via WebSocket broadcast
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateThread = async () => {
    if (selectedParticipants.length === 0) return;
    try {
      const res = await api.post('/peer_chat/threads', {
        thread_type: chatType,
        participants_anon_ids: selectedParticipants
      });
      
      setShowNewChatModal(false);
      setSelectedParticipants([]);
      fetchThreads();
      loadMessages(res.data);
    } catch (err) {
      console.error('Error creating chat room:', err);
    }
  };

  const handleReportMessage = async () => {
    if (!reportingMessage || !reportReason.trim()) return;
    try {
      await api.post(`/peer_chat/messages/${reportingMessage.message_id}/report`, {
        reason: reportReason.trim()
      });
      
      // Update UI to show flagged state
      setMessages(prev => prev.map(m => {
        if (m.message_id === reportingMessage.message_id) {
          return { ...m, flagged: true };
        }
        return m;
      }));

      alert("Message flagged. Sonder moderators will review it shortly.");
      setReportingMessage(null);
      setReportReason('');
    } catch (err) {
      console.error('Error reporting message:', err);
    }
  };

  const toggleParticipantSelection = (anonId: string) => {
    if (chatType === 'peer_1on1') {
      setSelectedParticipants([anonId]);
    } else {
      setSelectedParticipants(prev =>
        prev.includes(anonId) ? prev.filter(id => id !== anonId) : [...prev, anonId]
      );
    }
  };

  return (
    <div className="flex bg-white dark:bg-zinc-900 border border-[#ece9ff] dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-[0_30px_80px_rgba(15,23,42,0.04)] h-[calc(100vh-140px)] w-full max-w-6xl mx-auto animate-fade-in text-zinc-900 dark:text-zinc-100">
      
      {/* Sidebar - Threads list */}
      <div className="w-80 border-r border-[#ece9ff] dark:border-zinc-800 flex flex-col bg-[#faf9ff] dark:bg-zinc-950/40">
        <div className="p-6 border-b border-[#ece9ff] dark:border-zinc-800 flex justify-between items-center bg-white/50 dark:bg-transparent">
          <h2 className="text-xl font-bold tracking-tight">Peer Chats</h2>
          <button
            onClick={() => {
              fetchPeers();
              setShowNewChatModal(true);
            }}
            className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-[#7c3aed] dark:text-[#c084fc] hover:bg-purple-100 rounded-xl transition-all"
            title="Start New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {threads.length > 0 ? (
            threads.map((t) => {
              const isActive = selectedThread?.thread_id === t.thread_id;
              
              // Get display name for the chat
              let chatLabel = '';
              if (t.thread_type === 'peer_1on1') {
                const otherUser = t.participants_anon_ids.find(id => id !== user?.anon_id);
                chatLabel = otherUser || 'Peer User';
              } else {
                chatLabel = `Support Circle (${t.participants_anon_ids.length} members)`;
              }

              return (
                <button
                  key={t.thread_id}
                  onClick={() => loadMessages(t)}
                  className={`w-full text-left p-4 rounded-[22px] border transition-all flex items-start gap-3 ${
                    isActive
                      ? 'bg-white dark:bg-zinc-900 border-purple-200 dark:border-purple-900 shadow-md shadow-purple-500/5'
                      : 'border-transparent hover:bg-white/80 dark:hover:bg-zinc-900/40'
                  }`}
                >
                  <div className={`p-3 rounded-full ${t.thread_type === 'peer_1on1' ? 'bg-purple-100/50 dark:bg-purple-950/20 text-[#7c3aed]' : 'bg-emerald-100/50 dark:bg-emerald-950/20 text-emerald-600'}`}>
                    {t.thread_type === 'peer_1on1' ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-zinc-800 dark:text-zinc-200">{chatLabel}</p>
                    <p className="text-[10px] text-zinc-400 mt-1 uppercase font-semibold tracking-wider">
                      {t.thread_type === 'peer_1on1' ? '1-on-1 Chat' : 'Group Circle'}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-400 p-6 gap-2">
              <span className="text-2xl">💬</span>
              <p className="text-xs">No active chats. Start one using the plus icon above!</p>
            </div>
          )}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900">
        {selectedThread ? (
          <>
            {/* Active thread header */}
            <div className="p-6 border-b border-[#ece9ff] dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 z-10">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  {selectedThread.thread_type === 'peer_1on1'
                    ? selectedThread.participants_anon_ids.find(id => id !== user?.anon_id)
                    : 'Support Circle'}
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Secure anonymous messaging room
                </p>
              </div>

              <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-[#7c3aed]" />
                <span className="text-[10px] font-bold text-[#7c3aed] dark:text-[#c084fc] uppercase tracking-wider">Anon-Encrypted</span>
              </div>
            </div>

            {/* Crisis keyword intervention banner */}
            {chatCrisisWarning && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-900/50 p-4 flex gap-3 text-xs text-rose-800 dark:text-rose-300 animate-slide-in relative">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                <div className="flex-1">
                  <p className="font-bold">Important Support Notice</p>
                  <p className="mt-0.5 leading-relaxed">{chatCrisisWarning}</p>
                </div>
                <button
                  onClick={() => setChatCrisisWarning(null)}
                  className="p-1 hover:bg-rose-100 rounded-full h-fit text-rose-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Message History list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#faf9ff]/20 dark:bg-transparent">
              {messages.map((m) => {
                const isSelf = m.sender_anon_id === user?.anon_id;
                
                return (
                  <div key={m.message_id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-xl ${isSelf ? 'ml-auto' : 'mr-auto'}`}>
                    {/* Anon badge for others */}
                    {!isSelf && (
                      <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 mb-1 ml-2 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                        {m.sender_anon_id}
                      </span>
                    )}

                    <div className="flex items-end gap-2 group w-full">
                      {isSelf && !m.flagged && (
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-600 block opacity-0 group-hover:opacity-100 transition-opacity">Sent</span>
                      )}
                      
                      <div className={`p-4 rounded-[22px] text-sm leading-relaxed relative ${
                        m.flagged
                          ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700/80 italic'
                          : isSelf
                            ? 'bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white rounded-br-none shadow-md shadow-purple-500/10'
                            : 'bg-[#faf9ff] dark:bg-zinc-800 border border-[#ece9ff] dark:border-zinc-700 rounded-bl-none'
                      }`}>
                        {m.flagged ? (
                          "[This message has been hidden and reported to the system moderators.]"
                        ) : (
                          m.content
                        )}

                        {/* Hover report button for others' messages */}
                        {!isSelf && !m.flagged && (
                          <button
                            onClick={() => setReportingMessage(m)}
                            className="absolute -right-8 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-all"
                            title="Report Message"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <span className="text-[9px] text-zinc-400 mt-1 block px-2">
                      {new Date(m.sent_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input send form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-[#ece9ff] dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message anonymously..."
                className="flex-1 bg-[#faf9ff] dark:bg-zinc-950 border border-[#ece9ff] dark:border-zinc-800 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="p-4 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white font-bold rounded-2xl transition-all shadow-md shadow-purple-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 gap-3">
            <span className="text-5xl">💬</span>
            <h4 className="font-bold text-zinc-700 dark:text-zinc-300">Welcome to Peer Chats</h4>
            <p className="text-xs max-w-sm">
              Connect anonymously with your peers in a secure, non-identifying space. Select a room from the sidebar or start a new support circle.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: Start New Chat */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-[#ece9ff] dark:border-zinc-800 w-full max-w-md p-8 relative animate-scale-in">
            <button
              onClick={() => {
                setShowNewChatModal(false);
                setSelectedParticipants([]);
              }}
              className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold mb-2">New Peer Chat</h3>
            <p className="text-xs text-zinc-400 mb-6">Select student peers to open a secure workspace.</p>

            {/* Chat Type Selection */}
            <div className="flex bg-[#f3f0ff] dark:bg-zinc-950 p-1 rounded-xl mb-6">
              <button
                onClick={() => {
                  setChatType('peer_1on1');
                  setSelectedParticipants([]);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${chatType === 'peer_1on1' ? 'bg-white dark:bg-zinc-800 text-[#7c3aed] shadow-sm' : 'text-zinc-500'}`}
              >
                1-on-1 Message
              </button>
              <button
                onClick={() => {
                  setChatType('support_circle');
                  setSelectedParticipants([]);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${chatType === 'support_circle' ? 'bg-white dark:bg-zinc-800 text-[#7c3aed] shadow-sm' : 'text-zinc-500'}`}
              >
                Support Circle
              </button>
            </div>

            {/* Available Peers List */}
            <div className="max-h-60 overflow-y-auto mb-6 border border-[#ece9ff] dark:border-zinc-800 rounded-2xl p-2 bg-[#faf9ff]/50 dark:bg-zinc-950/20">
              {availableStudents.length > 0 ? (
                availableStudents.map((student) => {
                  const isChecked = selectedParticipants.includes(student.anon_id);
                  return (
                    <button
                      key={student.id}
                      onClick={() => toggleParticipantSelection(student.anon_id)}
                      className={`w-full flex justify-between items-center p-3 rounded-xl hover:bg-white dark:hover:bg-zinc-900 text-left text-sm font-semibold transition-all border ${isChecked ? 'border-purple-200 dark:border-purple-900 bg-white dark:bg-zinc-900' : 'border-transparent'}`}
                    >
                      <span className="text-zinc-700 dark:text-zinc-200">{student.anon_id}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isChecked ? 'border-[#7c3aed] bg-[#7c3aed] text-white' : 'border-zinc-300'}`}>
                        {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-zinc-400 p-4 text-center">No other online student peers found.</p>
              )}
            </div>

            <button
              onClick={handleCreateThread}
              disabled={selectedParticipants.length === 0}
              className="w-full py-3 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Start Chat Room
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Report Message Reason */}
      {reportingMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-[#ece9ff] dark:border-zinc-800 w-full max-w-md p-8 relative animate-scale-in">
            <button
              onClick={() => {
                setReportingMessage(null);
                setReportReason('');
              }}
              className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold mb-2 text-rose-600">Report Message</h3>
            <p className="text-xs text-zinc-400 mb-6">Flagging hidden message for administrator audit queue. Please state your reason below.</p>

            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="e.g. Offensive language, harassment, privacy violation, crisis warning trigger..."
              className="w-full min-h-[100px] bg-[#faf9ff] dark:bg-zinc-950 border border-[#ece9ff] dark:border-zinc-800 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-rose-500/50 text-sm mb-6"
            />

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setReportingMessage(null);
                  setReportReason('');
                }}
                className="flex-1 py-3 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 rounded-2xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReportMessage}
                disabled={!reportReason.trim()}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-rose-500/10 disabled:opacity-50"
              >
                Report & Flag
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PeerChat;

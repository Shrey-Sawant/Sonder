import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Users, MessageSquare, Plus, Flag, AlertCircle, 
  ShieldCheck, Heart, User, X, Info, Sparkles, ChevronRight, 
  Compass, ShieldAlert, CheckCircle2, Lock, Loader2, ArrowLeft,
  Volume2
} from 'lucide-react';
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
  moderation_status?: string;
  moderation_reason?: string | null;
  crisis_detected?: boolean;
  crisis_level?: string | null;
}

interface CircleResponse {
  circle_id: string;
  thread_id: string;
  name: string;
  tagline: string;
  welcome_message: string;
  rules: string[];
  opening_prompt: string;
  sensitivity_level: string;
  theme: string;
  type: string;
  created_at: string;
  participants_count: number;
  is_member: boolean;
}

const moodMeta: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  calm: { label: 'Calm', emoji: '🧘', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-300' },
  anxious: { label: 'Anxious', emoji: '😟', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300' },
  sad: { label: 'Sad', emoji: '😢', bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300' },
  frustrated: { label: 'Frustrated', emoji: '😤', bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-300' },
  hopeful: { label: 'Hopeful', emoji: '🌅', bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-300' },
  numb: { label: 'Numb', emoji: '😑', bg: 'bg-slate-100 dark:bg-slate-900/50', text: 'text-slate-700 dark:text-slate-300' },
  grateful: { label: 'Grateful', emoji: '🙏', bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-700 dark:text-purple-300' },
  overwhelmed: { label: 'Overwhelmed', emoji: '🤯', bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-700 dark:text-indigo-300' },
};

const preDefinedRoles = [
  { id: 'first-year', label: 'First Year Struggles', emoji: '🎒', desc: 'Navigating transition, new community, and dorm life.', color: 'from-blue-500 to-cyan-500' },
  { id: 'exam season', label: 'Exam Season Pressure', emoji: '📚', desc: 'Managing test anxiety, study schedules, and grades.', color: 'from-amber-500 to-orange-500' },
  { id: 'placement prep', label: 'Career & Placement', emoji: '💼', desc: 'Preparing for interviews, resumes, and future stress.', color: 'from-emerald-500 to-teal-500' },
  { id: 'relationship stress', label: 'Relationship Stress', emoji: '🤝', desc: 'Handling conflicts, breakups, roommates, and family.', color: 'from-rose-500 to-pink-500' },
  { id: 'burnout', label: 'Academic Burnout', emoji: '🔥', desc: 'Recharging motivation, dealing with exhaustion.', color: 'from-purple-500 to-indigo-500' },
  { id: 'identity & belonging', label: 'Identity & Belonging', emoji: '🌈', desc: 'Exploring selfhood, fitting in, and finding comfort.', color: 'from-violet-500 to-fuchsia-500' }
];

const PeerChat: React.FC = () => {
  const { user, updateUser } = useAuth();
  
  // Navigation Tabs: 'chats' | 'discover'
  const [activeNavTab, setActiveNavTab] = useState<'chats' | 'discover'>('chats');
  
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
  
  // Active Circle Info (rules, prompt, tagline)
  const [activeCircleInfo, setActiveCircleInfo] = useState<CircleResponse | null>(null);
  
  // Discover Board states
  const [recommendedCircles, setRecommendedCircles] = useState<CircleResponse[]>([]);
  const [allCircles, setAllCircles] = useState<CircleResponse[]>([]);
  const [loadingCircles, setLoadingCircles] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  
  // Onboarding states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedOnboardingRole, setSelectedOnboardingRole] = useState('');
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  
  // AI Circle Creator states
  const [showAICreateModal, setShowAICreateModal] = useState(false);
  const [aiTheme, setAiTheme] = useState('');
  const [aiType, setAiType] = useState('burnout');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiPreview, setAiPreview] = useState<any | null>(null);
  const [savingCircle, setSavingCircle] = useState(false);
  
  // Crisis Alert Banner state
  const [chatCrisisWarning, setChatCrisisWarning] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load threads and available peers on mount
  useEffect(() => {
    fetchThreads();
    fetchPeers();
    if (user && user.role === 'student' && !user.student_role) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Load circles when discover tab is active
  useEffect(() => {
    if (activeNavTab === 'discover') {
      fetchCircles();
    }
  }, [activeNavTab]);

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
          
          // Refresh threads list
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
      const peers = res.data
        .filter((s: any) => s.anon_id && s.anon_id !== user?.anon_id)
        .map((s: any) => ({ id: s.id, anon_id: s.anon_id }));
      setAvailableStudents(peers);
    } catch (err) {
      console.error('Error fetching peer list:', err);
    }
  };

  const fetchCircles = async () => {
    setLoadingCircles(true);
    try {
      const recRes = await api.get('/circles/recommendations');
      setRecommendedCircles(recRes.data);
      const allRes = await api.get('/circles/all');
      setAllCircles(allRes.data);
    } catch (err) {
      console.error('Error fetching support circles:', err);
    } finally {
      setLoadingCircles(false);
    }
  };

  const loadMessages = async (thread: Thread) => {
    setSelectedThread(thread);
    setChatCrisisWarning(null); // Clear warnings
    setActiveCircleInfo(null);
    try {
      const res = await api.get(`/peer_chat/messages/${thread.thread_id}`);
      setMessages(res.data);

      if (thread.thread_type === 'support_circle') {
        const circlesRes = await api.get('/circles/all');
        const match = circlesRes.data.find((c: any) => c.thread_id === thread.thread_id);
        if (match) {
          setActiveCircleInfo(match);
        }
      }
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
    } catch (err: any) {
      console.error('Error sending message:', err);
      const errMsg = err?.response?.data?.detail || "Message could not be sent due to guidelines check.";
      alert(errMsg);
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

  // Onboarding Save
  const handleSaveOnboarding = async () => {
    if (!selectedOnboardingRole) return;
    setSavingOnboarding(true);
    try {
      const res = await api.put('/users/me/student-role', { student_role: selectedOnboardingRole });
      updateUser(res.data);
      setShowOnboarding(false);
      fetchCircles();
    } catch (err) {
      console.error('Error saving focus role:', err);
      alert('Failed to save focus role. Please try again.');
    } finally {
      setSavingOnboarding(false);
    }
  };

  // AI Circle Preview Generation
  const handleGeneratePreview = async () => {
    if (!aiTheme.trim()) return;
    setGeneratingAI(true);
    setAiPreview(null);
    try {
      const res = await api.post('/circles/generate', {
        theme: aiTheme.trim(),
        type: aiType
      });
      setAiPreview(res.data);
    } catch (err) {
      console.error('Error generating circle preview:', err);
      alert('AI Generation timed out or failed. Please try again.');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Save/Create Circle
  const handleLaunchCircle = async () => {
    if (!aiPreview) return;
    setSavingCircle(true);
    try {
      const payload = {
        name: aiPreview.name,
        tagline: aiPreview.tagline,
        welcome_message: aiPreview.welcome_message,
        rules: aiPreview.rules,
        opening_prompt: aiPreview.opening_prompt,
        sensitivity_level: aiPreview.sensitivity_level,
        crisis_keywords: aiPreview.crisis_keywords,
        theme: aiTheme.trim(),
        type: aiType
      };
      
      const res = await api.post('/circles/create', payload);
      
      // Reset forms and modals
      setShowAICreateModal(false);
      setAiTheme('');
      setAiPreview(null);
      
      // Refresh chats list and switch view
      await fetchThreads();
      setActiveNavTab('chats');
      
      // Load the newly created thread
      const createdThread: Thread = {
        thread_id: res.data.thread_id,
        thread_type: 'support_circle',
        participants_anon_ids: [user?.anon_id || ''],
        created_at: res.data.created_at,
        last_message_at: null
      };
      loadMessages(createdThread);
      
    } catch (err: any) {
      console.error('Error creating circle:', err);
      alert(err.response?.data?.detail || 'Failed to create support circle.');
    } finally {
      setSavingCircle(false);
    }
  };

  // Join Circle
  const handleJoinCircle = async (circleId: string) => {
    try {
      const res = await api.post(`/circles/${circleId}/join`);
      await fetchThreads();
      setActiveNavTab('chats');
      
      const joinedThread: Thread = {
        thread_id: res.data.thread_id,
        thread_type: 'support_circle',
        participants_anon_ids: [user?.anon_id || ''],
        created_at: res.data.created_at,
        last_message_at: null
      };
      loadMessages(joinedThread);
    } catch (err) {
      console.error('Error joining circle:', err);
      alert('Failed to join circle.');
    }
  };

  // Leave Circle
  const handleLeaveCircle = async (circleId: string) => {
    if (!window.confirm("Are you sure you want to leave this Support Circle?")) return;
    try {
      await api.post(`/circles/${circleId}/leave`);
      setSelectedThread(null);
      setActiveCircleInfo(null);
      fetchThreads();
    } catch (err) {
      console.error('Error leaving circle:', err);
    }
  };

  // Filtered Circles list
  const filteredCircles = allCircles.filter(c => 
    selectedCategoryFilter === 'all' || c.type.toLowerCase() === selectedCategoryFilter.toLowerCase()
  );

  return (
    <div className="flex bg-white dark:bg-zinc-900 border border-[#ece9ff] dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-[0_30px_80px_rgba(15,23,42,0.04)] h-[calc(100vh-140px)] w-full max-w-6xl mx-auto animate-fade-in text-zinc-900 dark:text-zinc-100">
      
      {/* Sidebar */}
      <div className="w-80 border-r border-[#ece9ff] dark:border-zinc-800 flex flex-col bg-[#faf9ff] dark:bg-zinc-950/40">
        
        {/* Toggle Nav Tabs: My Chats vs Discover */}
        <div className="p-4 border-b border-[#ece9ff] dark:border-zinc-800 bg-white/50 dark:bg-transparent">
          <div className="flex bg-[#f3f0ff] dark:bg-zinc-950 p-1 rounded-2xl">
            <button
              onClick={() => setActiveNavTab('chats')}
              className={`flex-1 py-3 text-xs font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 ${
                activeNavTab === 'chats'
                  ? 'bg-white dark:bg-zinc-800 text-[#7c3aed] shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>My Chats</span>
            </button>
            <button
              onClick={() => setActiveNavTab('discover')}
              className={`flex-1 py-3 text-xs font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 ${
                activeNavTab === 'discover'
                  ? 'bg-white dark:bg-zinc-800 text-[#7c3aed] shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Discover</span>
            </button>
          </div>
        </div>

        {/* Tab 1: My active chat rooms list */}
        {activeNavTab === 'chats' && (
          <>
            <div className="p-6 border-b border-[#ece9ff]/80 dark:border-zinc-800/80 flex justify-between items-center bg-white/30 dark:bg-transparent">
              <h2 className="text-lg font-bold tracking-tight">Active Rooms</h2>
              <button
                onClick={() => {
                  fetchPeers();
                  setShowNewChatModal(true);
                }}
                className="p-2 bg-purple-50 dark:bg-purple-950/40 text-[#7c3aed] dark:text-[#c084fc] hover:bg-purple-100 rounded-xl transition-all"
                title="Start New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {threads.length > 0 ? (
                threads.map((t) => {
                  const isActive = selectedThread?.thread_id === t.thread_id;
                  
                  let chatLabel = '';
                  let iconBg = '';
                  let iconColor = '';
                  
                  if (t.thread_type === 'peer_1on1') {
                    const otherUser = t.participants_anon_ids.find(id => id !== user?.anon_id);
                    chatLabel = otherUser || 'Peer User';
                    iconBg = 'bg-purple-100/50 dark:bg-purple-950/20';
                    iconColor = 'text-[#7c3aed]';
                  } else {
                    // Try to find Circle Name from allCircles if available
                    const matchedCircle = allCircles.find(c => c.thread_id === t.thread_id);
                    chatLabel = matchedCircle?.name || 'Support Circle';
                    iconBg = 'bg-emerald-100/50 dark:bg-emerald-950/20';
                    iconColor = 'text-emerald-600';
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
                      <div className={`p-3 rounded-full shrink-0 ${iconBg} ${iconColor}`}>
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
                  <p className="text-xs">No active chats. Start one or explore Discover tab!</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab 2: Discover Circles filters */}
        {activeNavTab === 'discover' && (
          <div className="flex-1 flex flex-col p-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2">Focus Categories</h3>
            <div className="space-y-1 overflow-y-auto flex-1 pr-1">
              <button
                onClick={() => setSelectedCategoryFilter('all')}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-purple-50 dark:bg-purple-950/20 text-[#7c3aed]'
                    : 'text-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30'
                }`}
              >
                <span>🌐 All Categories</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {preDefinedRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedCategoryFilter(role.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                    selectedCategoryFilter === role.id
                      ? 'bg-purple-50 dark:bg-purple-950/20 text-[#7c3aed]'
                      : 'text-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30'
                  }`}
                >
                  <span className="truncate">{role.emoji} {role.label}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            
            {/* Create Circle button in sidebar */}
            <button
              onClick={() => setShowAICreateModal(true)}
              className="mt-4 w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/10 transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Create Circle with AI</span>
            </button>
          </div>
        )}
      </div>

      {/* Main chat window / Discover pane */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900">
        
        {/* VIEW 1: DISCOVER CIRCLES BOARD */}
        {activeNavTab === 'discover' ? (
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">Support Circles</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">Join secure anonymous group discussions tailored to your challenges.</p>
              </div>
            </header>

            {loadingCircles ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-purple-600" size={32} />
                <p className="text-xs text-zinc-400">Loading support circles...</p>
              </div>
            ) : (
              <>
                {/* 1. Recommendations board */}
                {recommendedCircles.length > 0 && selectedCategoryFilter === 'all' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" /> Matched For You
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {recommendedCircles.map((circle) => (
                        <div 
                          key={circle.circle_id}
                          className="bg-gradient-to-br from-white to-[#faf9ff] dark:from-zinc-900 dark:to-zinc-950/60 p-6 rounded-[24px] border border-purple-100 dark:border-zinc-800/80 shadow-[0_10px_30px_rgba(124,58,237,0.02)] hover:border-purple-300 dark:hover:border-purple-900/50 hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-center gap-2 mb-3">
                              <span className="text-[10px] bg-purple-100 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                {circle.type}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                circle.sensitivity_level === 'high' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' :
                                circle.sensitivity_level === 'medium' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' :
                                'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                              }`}>
                                {circle.sensitivity_level} sens
                              </span>
                            </div>
                            <h4 className="font-bold text-lg text-zinc-900 dark:text-white">{circle.name}</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic">"{circle.tagline}"</p>
                          </div>
                          
                          <div className="border-t border-[#ece9ff] dark:border-zinc-800/80 mt-6 pt-4 flex justify-between items-center">
                            <span className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-zinc-400" />
                              {circle.participants_count} peers
                            </span>
                            {circle.is_member ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Joined
                              </span>
                            ) : (
                              <button
                                onClick={() => handleJoinCircle(circle.circle_id)}
                                className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                              >
                                Join Circle
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. All Circles / Filtered Circles */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-wider px-1">
                    {selectedCategoryFilter === 'all' ? 'All Available Circles' : `${selectedCategoryFilter.toUpperCase()} Circles`}
                  </h3>
                  {filteredCircles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredCircles.map((circle) => (
                        <div 
                          key={circle.circle_id}
                          className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-950/20 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-center gap-2 mb-3">
                              <span className="text-[10px] bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {circle.type}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                circle.sensitivity_level === 'high' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' :
                                circle.sensitivity_level === 'medium' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' :
                                'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                              }`}>
                                {circle.sensitivity_level} sens
                              </span>
                            </div>
                            <h4 className="font-bold text-base text-zinc-900 dark:text-white">{circle.name}</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic">"{circle.tagline}"</p>
                          </div>
                          
                          <div className="border-t border-[#ece9ff]/80 dark:border-zinc-800/80 mt-6 pt-4 flex justify-between items-center">
                            <span className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-zinc-400" />
                              {circle.participants_count} peers
                            </span>
                            {circle.is_member ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Joined
                              </span>
                            ) : (
                              <button
                                onClick={() => handleJoinCircle(circle.circle_id)}
                                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-xl text-xs font-bold shadow-sm transition-all"
                              >
                                Join Circle
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#faf9ff] dark:bg-zinc-950/10 p-16 rounded-[28px] text-center border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 max-w-lg mx-auto mt-6">
                      <Compass size={40} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No active Support Circles found in this category.</p>
                      <button
                        onClick={() => setShowAICreateModal(true)}
                        className="mt-4 px-4 py-2.5 bg-purple-50 text-[#7c3aed] text-xs font-bold rounded-xl"
                      >
                        Create the first one!
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          
          // VIEW 2: ACTIVE CHAT ROOM (PEER 1-ON-1 OR JOINED SUPPORT CIRCLE)
          <>
            {selectedThread ? (
              <>
                {/* Active thread header */}
                <div className="p-6 border-b border-[#ece9ff] dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 z-10 shrink-0">
                  <div>
                    <h3 className="text-base font-extrabold flex items-center gap-2">
                      {selectedThread.thread_type === 'peer_1on1'
                        ? selectedThread.participants_anon_ids.find(id => id !== user?.anon_id)
                        : activeCircleInfo?.name || 'Support Circle'}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {selectedThread.thread_type === 'peer_1on1' 
                        ? 'Secure anonymous messaging room' 
                        : `Support group circle • ${activeCircleInfo?.tagline || ''}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {selectedThread.thread_type === 'support_circle' && activeCircleInfo && (
                      <button
                        onClick={() => handleLeaveCircle(activeCircleInfo.circle_id)}
                        className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl font-bold transition-all"
                      >
                        Leave Circle
                      </button>
                    )}
                    <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-full select-none">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#7c3aed]" />
                      <span className="text-[10px] font-bold text-[#7c3aed] dark:text-[#c084fc] uppercase tracking-wider">Anon-Encrypted</span>
                    </div>
                  </div>
                </div>

                {/* Crisis keyword alert banner */}
                {chatCrisisWarning && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-900/50 p-4 flex gap-3 text-xs text-rose-800 dark:text-rose-300 animate-slide-in relative shrink-0">
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

                {/* Main Scroll Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#faf9ff]/20 dark:bg-transparent">
                  
                  {/* Circle Welcome Guidelines Board */}
                  {selectedThread.thread_type === 'support_circle' && activeCircleInfo && (
                    <div className="bg-gradient-to-br from-[#7c3aed]/5 via-white to-[#7c3aed]/5 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 border border-purple-100/70 dark:border-zinc-800 rounded-[28px] p-6 shadow-sm mb-6 max-w-xl mx-auto space-y-4 animate-scale-in">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] bg-purple-100 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            {activeCircleInfo.type} circle
                          </span>
                          <h4 className="font-extrabold text-base mt-2 text-zinc-900 dark:text-white">Guidelines for {activeCircleInfo.name}</h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{activeCircleInfo.welcome_message}</p>
                        </div>
                        <ShieldCheck className="w-6 h-6 text-[#7c3aed] shrink-0" />
                      </div>
                      
                      <div className="border-t border-[#ece9ff]/80 dark:border-zinc-800/80 pt-3">
                        <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Community Rules</p>
                        <ul className="space-y-1.5">
                          {activeCircleInfo.rules.map((rule, idx) => (
                            <li key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                              <span className="text-[#7c3aed] font-bold shrink-0">{idx + 1}.</span>
                              <span>{rule}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="bg-purple-50/40 dark:bg-purple-950/10 p-4 rounded-2xl border border-purple-100/30">
                        <p className="text-[10px] font-extrabold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Volume2 className="w-3.5 h-3.5" /> Opening Prompt
                        </p>
                        <p className="text-xs text-zinc-800 dark:text-zinc-300 italic font-medium">"{activeCircleInfo.opening_prompt}"</p>
                      </div>
                    </div>
                  )}

                  {/* Message History list */}
                  {messages.map((m) => {
                    const isSelf = m.sender_anon_id === user?.anon_id;
                    const isHold = m.moderation_status === 'HOLD' || m.flagged;
                    const isSoftFlag = m.moderation_status === 'SOFT_FLAG';

                    // Message held and from another participant: render hidden block
                    if (isHold && !isSelf) {
                      return (
                        <div key={m.message_id} className="flex flex-col items-start max-w-xl mr-auto">
                          <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 mb-1 ml-2 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                            {m.sender_anon_id}
                          </span>
                          <div className="p-4 rounded-[22px] text-sm leading-relaxed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700/80 italic rounded-bl-none">
                            [This message is pending review by moderators.]
                          </div>
                          <span className="text-[9px] text-zinc-400 mt-1 block px-2">
                            {new Date(m.sent_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={m.message_id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-xl ${isSelf ? 'ml-auto' : 'mr-auto'}`}>
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
                            isHold
                              ? 'bg-amber-50/50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50 italic rounded-br-none'
                              : isSoftFlag
                                ? 'bg-amber-50/30 border border-amber-100 text-zinc-800 dark:bg-amber-950/10 dark:border-amber-900/30 dark:text-zinc-200 rounded-bl-none'
                                : isSelf
                                  ? 'bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white rounded-br-none shadow-md shadow-purple-500/10'
                                  : 'bg-[#faf9ff] dark:bg-zinc-800 border border-[#ece9ff] dark:border-zinc-700 rounded-bl-none'
                          }`}>
                            {m.content}
                            
                            {isHold && isSelf && (
                              <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1 uppercase tracking-wider flex items-center gap-1 select-none">
                                ⚠️ Pending moderator review
                              </div>
                            )}
                            
                            {isSoftFlag && (
                              <div className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 mt-1.5 italic flex items-center gap-1 select-none border-t border-[#ece9ff] dark:border-zinc-800 pt-1">
                                💡 Remember to be kind to yourself.
                              </div>
                            )}

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
                        
                        <span className="text-[9px] text-zinc-400 mt-1 block px-2 select-none">
                          {new Date(m.sent_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input send form */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-[#ece9ff] dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900 shrink-0">
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
                  Connect anonymously with your peers in a secure, non-identifying space. Select a room from the sidebar or discover new support circles.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL 1: Onboarding student role selection (forced/guided if null) */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[36px] border border-[#ece9ff] dark:border-zinc-800 w-full max-w-2xl p-8 relative animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-[#7c3aed] dark:bg-purple-950/40 dark:text-purple-300 font-extrabold text-[10px] rounded-full uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Onboarding Focus
              </span>
              <h3 className="text-2xl font-black">Choose Your Current Focus Area</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                Select the role or challenge that represents your current student experience. This helps us personalize support circles and resources.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {preDefinedRoles.map((role) => {
                const isSelected = selectedOnboardingRole === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedOnboardingRole(role.id)}
                    className={`p-5 rounded-3xl border text-left flex flex-col gap-3 transition-all transform hover:scale-[1.02] ${
                      isSelected
                        ? 'border-purple-400 bg-[#7c3aed]/5 dark:border-purple-600'
                        : 'border-[#ece9ff] hover:border-purple-200 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white/40 dark:bg-zinc-950/20'
                    }`}
                  >
                    <span className="text-3xl select-none">{role.emoji}</span>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{role.label}</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{role.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSaveOnboarding}
              disabled={!selectedOnboardingRole || savingOnboarding}
              className="w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
            >
              {savingOnboarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save & Continue</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Start New Chat */}
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

      {/* MODAL 3: AI Create Circle */}
      {showAICreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-[#ece9ff] dark:border-zinc-800 w-full max-w-xl p-8 relative animate-scale-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowAICreateModal(false);
                setAiTheme('');
                setAiPreview(null);
              }}
              className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
              <h3 className="text-xl font-extrabold">Generate Circle with AI</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-6">Describe the theme of the support group. Our AI will handle configurations, rules, and prompts.</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Core Focus Theme</label>
                <input
                  type="text"
                  value={aiTheme}
                  onChange={(e) => setAiTheme(e.target.value)}
                  placeholder="e.g. feeling like a fraud in class, coping with placement rejection"
                  className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none text-sm focus:ring-2 focus:ring-purple-500/50"
                  disabled={generatingAI}
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Focus Role Category</label>
                <select
                  value={aiType}
                  onChange={(e) => setAiType(e.target.value)}
                  className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none text-sm focus:ring-2 focus:ring-purple-500/50"
                  disabled={generatingAI}
                >
                  {preDefinedRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.emoji} {role.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {generatingAI ? (
              <div className="py-10 text-center flex flex-col items-center justify-center gap-4 bg-purple-50/20 rounded-3xl border border-[#ece9ff]">
                <Loader2 className="animate-spin text-purple-600" size={40} />
                <div>
                  <p className="text-sm font-bold text-purple-950 dark:text-purple-300">AI is crafting your Support Circle</p>
                  <p className="text-xs text-zinc-400 mt-1 animate-pulse">Drafting rules, welcome guidelines, and moderation config...</p>
                </div>
              </div>
            ) : aiPreview ? (
              
              // Generated preview details
              <div className="bg-[#faf9ff] dark:bg-zinc-950 border border-purple-100 dark:border-zinc-850 p-6 rounded-3xl space-y-4 mb-6 animate-fade-in max-h-80 overflow-y-auto">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-[#7c3aed] text-base">{aiPreview.name}</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">"{aiPreview.tagline}"</p>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    aiPreview.sensitivity_level === 'high' ? 'bg-rose-100 text-rose-800' :
                    aiPreview.sensitivity_level === 'medium' ? 'bg-amber-100 text-amber-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {aiPreview.sensitivity_level} sensitivity
                  </span>
                </div>
                
                <div className="border-t border-[#ece9ff]/80 dark:border-zinc-800/80 pt-3">
                  <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Welcome Message</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{aiPreview.welcome_message}</p>
                </div>
                
                <div>
                  <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Generated Rules</p>
                  <ul className="space-y-1">
                    {aiPreview.rules.map((rule: string, i: number) => (
                      <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1">
                        <span className="font-bold text-[#7c3aed]">{i+1}.</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Opening Prompt</p>
                  <p className="text-xs text-zinc-800 dark:text-zinc-300 italic">"{aiPreview.opening_prompt}"</p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-1">Crisis Keywords (Silent Scan)</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tracking-tight leading-normal">
                    {aiPreview.crisis_keywords.join(', ')}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex gap-4">
              {!aiPreview ? (
                <button
                  onClick={handleGeneratePreview}
                  disabled={!aiTheme.trim() || generatingAI}
                  className="w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Generate Circle Parameters</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleGeneratePreview}
                    disabled={generatingAI || savingCircle}
                    className="flex-1 py-3 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 rounded-2xl text-xs font-bold transition-all text-zinc-600 dark:text-zinc-400"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleLaunchCircle}
                    disabled={savingCircle}
                    className="flex-1 py-3 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-purple-500/10 flex items-center justify-center gap-1.5 animate-pulse"
                  >
                    {savingCircle ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Launch Circle</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Report Message Reason */}
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

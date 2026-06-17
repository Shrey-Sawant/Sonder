import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Sparkles, Calendar, Plus, Share2, ShieldCheck, Heart, AlertCircle, ArrowLeft, ArrowRight, RotateCw, History } from 'lucide-react';
import api from '../services/api';

interface JournalEntry {
  entry_id: string;
  mood_selected: string;
  prompt_category: string;
  entry_text: string;
  ai_reflection: string | null;
  shared_anonymously: boolean;
  created_at: string;
}

const moodMeta: Record<string, { label: string; emoji: string; bg: string; text: string; gradient: string }> = {
  calm: { label: 'Calm', emoji: '🧘', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-300', gradient: 'from-emerald-400 to-teal-500' },
  anxious: { label: 'Anxious', emoji: '😟', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300', gradient: 'from-amber-400 to-orange-500' },
  sad: { label: 'Sad', emoji: '😢', bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300', gradient: 'from-blue-400 to-indigo-500' },
  frustrated: { label: 'Frustrated', emoji: '😤', bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-300', gradient: 'from-rose-400 to-red-500' },
  hopeful: { label: 'Hopeful', emoji: '🌅', bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-300', gradient: 'from-yellow-400 to-amber-500' },
  numb: { label: 'Numb', emoji: '😑', bg: 'bg-slate-100 dark:bg-slate-900/50', text: 'text-slate-700 dark:text-slate-300', gradient: 'from-slate-400 to-zinc-500' },
  grateful: { label: 'Grateful', emoji: '🙏', bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-700 dark:text-purple-300', gradient: 'from-purple-400 to-indigo-500' },
  overwhelmed: { label: 'Overwhelmed', emoji: '🤯', bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-700 dark:text-indigo-300', gradient: 'from-violet-400 to-fuchsia-500' },
};

const getMoodValue = (mood: string): number => {
  switch (mood) {
    case 'grateful': return 5;
    case 'calm': return 4;
    case 'hopeful': return 4.5;
    case 'numb': return 2.5;
    case 'anxious': return 2;
    case 'sad': return 1.5;
    case 'overwhelmed': return 1;
    case 'frustrated': return 0.5;
    default: return 3;
  }
};

const PROMPT_TEMPLATES: Record<string, string[]> = {
  academic: [
    "What's one thing weighing on you about this semester?",
    "When did you feel most stressed about school this week?",
    "What's one academic goal that excites you right now?",
    "Describe a time this week when you felt unprepared."
  ],
  social: [
    "Did you feel seen by someone today, or unseen?",
    "Who made you feel valued this week?",
    "What's one conversation you wish you'd had?",
    "How did you show up for someone today?"
  ],
  identity: [
    "What version of yourself showed up today?",
    "Where do you feel like yourself, and where don't you?",
    "What part of your identity felt challenged this week?",
    "Who do you want to be becoming?"
  ],
  general: [
    "What do you wish you could say out loud right now?",
    "What brought you peace this week?",
    "If you could change one thing about today, what would it be?",
    "What's something you're grateful for, even if it's small?"
  ]
};

const Journal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'write' | 'history'>('write');
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [promptCategory, setPromptCategory] = useState<string>('');
  const [promptText, setPromptText] = useState<string>('');
  const [entryText, setEntryText] = useState<string>('');
  
  // Submission & Response state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdEntryId, setCreatedEntryId] = useState<string | null>(null);
  const [aiReflection, setAiReflection] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  // History state
  const [history, setHistory] = useState<JournalEntry[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/journal/entries');
      setHistory(res.data);
    } catch (error) {
      console.error('Error fetching journal history:', error);
    }
  };

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    
    // Dynamically choose prompt category based on mood
    // Positive moods map to general or identity, negative moods map to academic, social, general
    let category = 'general';
    if (['anxious', 'overwhelmed', 'frustrated'].includes(mood)) {
      const choices = ['academic', 'social', 'identity'];
      category = choices[Math.floor(Math.random() * choices.length)];
    } else if (['sad', 'numb'].includes(mood)) {
      const choices = ['social', 'identity', 'general'];
      category = choices[Math.floor(Math.random() * choices.length)];
    } else {
      category = 'general';
    }
    
    setPromptCategory(category);
    const prompts = PROMPT_TEMPLATES[category];
    setPromptText(prompts[Math.floor(Math.random() * prompts.length)]);
    setStep(2);
  };

  const shufflePrompt = () => {
    const prompts = PROMPT_TEMPLATES[promptCategory];
    let newPrompt = promptText;
    while (newPrompt === promptText && prompts.length > 1) {
      newPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    }
    setPromptText(newPrompt);
  };

  const handleSaveEntry = async () => {
    if (entryText.trim().length < 50) {
      setSaveError('Your entry must be at least 50 characters long.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await api.post('/journal/entries', {
        mood_selected: selectedMood,
        prompt_category: promptCategory,
        entry_text: entryText
      });
      
      setCreatedEntryId(res.data.entry_id);
      setAiReflection(res.data.ai_reflection);
      setStep(4);
      fetchHistory();
    } catch (error: any) {
      console.error('Error saving entry:', error);
      setSaveError(error.response?.data?.detail || 'An error occurred while saving your entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareAnonymously = async () => {
    if (!createdEntryId || isShared) return;
    setIsSharing(true);
    try {
      await api.post('/journal/share', {
        entry_id: createdEntryId,
        share_anonymously: true
      });
      setIsShared(true);
    } catch (error) {
      console.error('Error sharing entry:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedMood('');
    setPromptCategory('');
    setPromptText('');
    setEntryText('');
    setCreatedEntryId(null);
    setAiReflection(null);
    setIsShared(false);
    setSaveError(null);
  };

  const chartData = [...history]
    .reverse()
    .map(entry => ({
      date: new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: getMoodValue(entry.mood_selected),
      mood: moodMeta[entry.mood_selected]?.label || entry.mood_selected
    }));

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in text-zinc-900 dark:text-zinc-100 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#7c3aed] to-[#fb923c] bg-clip-text text-transparent">Mood Journal</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">A safe space to reflect, offload, and grow.</p>
        </div>
        
        {/* Toggle Tabs */}
        <div className="flex bg-[#f3f0ff] dark:bg-zinc-900 p-1.5 rounded-2xl shadow-inner w-full md:w-auto">
          <button
            onClick={() => setActiveTab('write')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'write' ? 'bg-white dark:bg-zinc-800 text-[#7c3aed] dark:text-[#c084fc] shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            <Plus className="w-4 h-4" />
            Write Entry
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-zinc-800 text-[#7c3aed] dark:text-[#c084fc] shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            <History className="w-4 h-4" />
            History & Trends
          </button>
        </div>
      </div>

      {activeTab === 'write' ? (
        <div className="w-full">
          {/* Step 1: Mood Wheel */}
          {step === 1 && (
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-[#ece9ff] dark:border-zinc-800 shadow-[0_20px_50px_rgba(15,23,42,0.04)] text-center animate-fade-soft">
              <span className="inline-flex px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-semibold tracking-wider uppercase mb-3">Step 1 of 4</span>
              <h2 className="text-2xl font-bold mb-2">How are you feeling right now?</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-lg mx-auto">Select the mood that matches your current state. This helps us tailor your reflection prompts.</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
                {Object.entries(moodMeta).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => handleMoodSelect(key)}
                    className="group flex flex-col items-center justify-center p-6 bg-[#faf9ff] dark:bg-zinc-950 border border-[#ece9ff] dark:border-zinc-800/80 rounded-[24px] hover:border-purple-300 dark:hover:border-purple-800 hover:bg-white dark:hover:bg-zinc-900 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <span className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{meta.emoji}</span>
                    <span className="font-semibold text-sm capitalize text-zinc-800 dark:text-zinc-200">{meta.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Prompt Reveal */}
          {step === 2 && (
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-[#ece9ff] dark:border-zinc-800 shadow-[0_20px_50px_rgba(15,23,42,0.04)] animate-fade-soft">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                  <ArrowLeft className="w-4 h-4" /> Back to mood
                </button>
                <span className="inline-flex px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-semibold tracking-wider uppercase">Step 2 of 4</span>
              </div>

              <div className="max-w-2xl mx-auto text-center py-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  Category: {promptCategory}
                </span>
                
                <blockquote className="text-2xl md:text-3xl font-bold text-zinc-800 dark:text-zinc-100 leading-snug px-4 mb-6">
                  "{promptText}"
                </blockquote>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={shufflePrompt}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-300"
                  >
                    <RotateCw className="w-4 h-4" />
                    Shuffle Prompt
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-500/20 transition-all"
                  >
                    Start Writing
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Journal Writing */}
          {step === 3 && (
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-[#ece9ff] dark:border-zinc-800 shadow-[0_20px_50px_rgba(15,23,42,0.04)] animate-fade-soft">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                  <ArrowLeft className="w-4 h-4" /> Back to prompt
                </button>
                <span className="inline-flex px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-xs font-semibold tracking-wider uppercase">Step 3 of 4</span>
              </div>

              <div className="mb-6 bg-[#faf9ff] dark:bg-zinc-950 border border-[#ece9ff] dark:border-zinc-800/80 p-5 rounded-2xl">
                <p className="text-xs uppercase font-bold tracking-widest text-[#7c3aed] mb-1">Your reflection prompt</p>
                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">"{promptText}"</p>
              </div>

              {saveError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 rounded-2xl flex gap-3 text-sm mb-6 animate-shake">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="relative border border-zinc-200 dark:border-zinc-700/80 rounded-2xl overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-purple-500/50 transition-all bg-[#fafbfd] dark:bg-zinc-950">
                <textarea
                  value={entryText}
                  onChange={(e) => setEntryText(e.target.value)}
                  placeholder="Pour your heart out here... Write whatever comes to mind without judgment."
                  className="w-full min-h-[300px] p-6 bg-transparent text-zinc-800 dark:text-zinc-100 outline-none resize-none leading-relaxed placeholder:text-zinc-400"
                />
                
                {/* Character Count Ring & Overlay */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-800">
                  <span className={`text-xs font-bold ${entryText.length >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                    {entryText.length} / 50 characters {entryText.length >= 50 && '✓'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Entries are securely encrypted
                </div>
                <button
                  onClick={handleSaveEntry}
                  disabled={isSaving || entryText.length < 50}
                  className="px-6 py-3 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving ? 'Generating AI Reflection...' : 'Complete & Reflect'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: AI Reflection & Share */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-soft">
              {/* Reflection Card */}
              <div className="bg-gradient-to-br from-[#7c3aed]/5 to-[#f43f5e]/5 rounded-[32px] p-8 border border-purple-200/50 dark:border-zinc-800 shadow-[0_20px_50px_rgba(124,58,237,0.06)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-400/10 to-transparent rounded-full filter blur-3xl -z-10" />
                
                <div className="flex justify-between items-center mb-6">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Reflective Companion
                  </span>
                  <span className="inline-flex px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wider uppercase">Saved</span>
                </div>

                <div className="prose prose-zinc dark:prose-invert max-w-none mb-6">
                  <p className="text-zinc-700 dark:text-zinc-200 text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                    {aiReflection || "Your reflection is ready, drawing insights on how to build resilience..."}
                  </p>
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-300">
                      <Heart className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">This is private by default.</p>
                      <p className="text-[11px] text-zinc-400">Only you can read this journal entry.</p>
                    </div>
                  </div>

                  <button
                    onClick={resetWizard}
                    className="w-full sm:w-auto px-5 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                  >
                    Done & New Journal
                  </button>
                </div>
              </div>

              {/* Story Share Banner */}
              <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-6 border border-[#ece9ff] dark:border-zinc-800 shadow-[0_10px_30px_rgba(15,23,42,0.03)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <Share2 className="w-5 h-5" /> Share this anonymously?
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl">
                    By sharing, you contribute an anonymous excerpt (first 120 chars) of your entry to the peer story feed. Sharing is completely anonymous—your real name or username will never be attached.
                  </p>
                </div>

                <button
                  onClick={handleShareAnonymously}
                  disabled={isShared || isSharing}
                  className={`w-full md:w-auto px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    isShared
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isSharing ? 'Sharing...' : isShared ? '✓ Shared Anonymously' : 'Share Anonymously'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* History & Trends Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-soft">
          <div className="lg:col-span-2 space-y-6">
            {/* Trend Chart */}
            <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-6 border border-[#ece9ff] dark:border-zinc-800 shadow-sm flex flex-col h-[320px]">
              <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                Mood Tracker
              </h2>
              <p className="text-xs text-zinc-400 mb-6">Historical trends based on your selections</p>
              
              {history.length > 0 ? (
                <div className="flex-1 w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis
                        domain={[0, 6]}
                        ticks={[1, 2, 3, 4, 5]}
                        tickFormatter={(v) => {
                          if (v === 1) return '🤯';
                          if (v === 2) return '😟';
                          if (v === 3) return '😐';
                          if (v === 4) return '🧘';
                          if (v === 5) return '🙏';
                          return '';
                        }}
                        stroke="#94a3b8"
                        fontSize={14}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xl text-xs space-y-1">
                                <p className="font-bold text-zinc-400">{data.date}</p>
                                <p className="text-purple-600 dark:text-purple-400 font-semibold">Mood: {data.mood}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="url(#colorMood)"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#8b5cf6' }}
                        activeDot={{ r: 6 }}
                      />
                      <defs>
                        <linearGradient id="colorMood" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#f43f5e" />
                        </linearGradient>
                      </defs>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <span className="text-3xl">📭</span>
                  <p className="text-xs">Submit journal entries to start tracking your mood.</p>
                </div>
              )}
            </div>

            {/* List of Entries */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Past Entries</h2>
              {history.length > 0 ? (
                history.map((entry) => (
                  <div key={entry.entry_id} className="bg-white dark:bg-zinc-900 rounded-[24px] p-6 border border-[#ece9ff] dark:border-zinc-800/80 hover:shadow-md transition-all">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{moodMeta[entry.mood_selected]?.emoji || '📝'}</span>
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${moodMeta[entry.mood_selected]?.bg} ${moodMeta[entry.mood_selected]?.text}`}>
                            {moodMeta[entry.mood_selected]?.label || entry.mood_selected}
                          </span>
                          <span className="text-[10px] text-zinc-400 ml-2 font-mono uppercase bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded">
                            {entry.prompt_category}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(entry.created_at).toLocaleDateString(undefined, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap border-l-2 border-zinc-100 dark:border-zinc-800 pl-3">
                      {entry.entry_text}
                    </p>

                    {entry.ai_reflection && (
                      <div className="mt-4 p-4 bg-purple-50/50 dark:bg-purple-950/10 rounded-2xl border border-purple-100/30">
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Reflection
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                          "{entry.ai_reflection}"
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-12 border border-[#ece9ff] dark:border-zinc-800 text-center text-zinc-400">
                  <p className="text-sm">You haven't written any entries yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-rose-500/10 rounded-[24px] p-6 border border-purple-500/20 shadow-sm space-y-4">
              <h3 className="font-extrabold text-indigo-700 dark:text-indigo-400">The Power of Journaling</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Writing down thoughts regularly decreases mental clutter, highlights subconscious triggers, and builds emotional resilience.
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Sonder utilizes private, localized AI mapping to provide immediate, gentle reframing without violating your personal confidentiality.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Journal;

import React, { useState, useEffect } from 'react';
import { ArrowRight, Sun, CloudRain, Activity, CalendarCheck, CheckCircle2, Heart, ShieldAlert, GraduationCap, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { ViewState } from '../../types';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { requestNotificationPermission } from '../services/notifications';

interface DashboardProps {
  setView: (view: any) => void;
}

const ProgressRing = ({ radius, stroke, progress, color, label }: { radius: number, stroke: number, progress: number, color: string, label: string }) => {
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle stroke="#e4e4e7" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} className="dark:stroke-zinc-800" />
          <circle 
             stroke={color} 
             fill="transparent" 
             strokeWidth={stroke} 
             strokeDasharray={circumference + ' ' + circumference} 
             style={{ strokeDashoffset }} 
             r={normalizedRadius} 
             cx={radius} 
             cy={radius} 
             strokeLinecap="round"
             className="transition-all duration-1000 ease-in-out"
          />
        </svg>
        <span className="text-xs font-medium text-zinc-500">{label}</span>
      </div>
    );
};

// --- Counsellor Dashboard View ---
const CounsellorDashboard: React.FC<DashboardProps> = ({ setView }) => {
  const { user } = useAuth();
  const [caseloadCount, setCaseloadCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [activeFlagsCount, setActiveFlagsCount] = useState(0);
  const [todaySessionsCount, setTodaySessionsCount] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch caseload count
    api.get('/users/my-students')
      .then(res => {
        setCaseloadCount(res.data.length);
      })
      .catch(err => console.error(err));

    // 2. Fetch pending requests and today's sessions
    api.get('/schedule/')
      .then(res => {
        const pending = res.data.filter((a: any) => a.status === 'pending');
        setPendingRequests(pending.length);

        const acceptedToday = res.data.filter((a: any) => {
          if (a.status !== 'accepted') return false;
          const apptDate = new Date(a.scheduled_time).toDateString();
          const today = new Date().toDateString();
          return apptDate === today;
        });
        setTodaySessionsCount(acceptedToday.length);
      })
      .catch(err => console.error(err));

    // 3. Fetch active alerts and map to activities
    api.get('/checkin/alerts')
      .then(res => {
        setActiveFlagsCount(res.data.length);
        const alertActivities = res.data.slice(0, 5).map((a: any) => ({
          id: a.id,
          username: a.studentName,
          text: `Logged a high risk check-in (PHQ-2 score = ${a.score}).`,
          color: 'bg-red-500'
        }));
        setActivities(alertActivities);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
          Welcome back, {user?.username || 'Clinician'} 🩺
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-lg font-light">
          Here is your clinical caseload overview for today.
        </p>
      </header>

      {/* Caseload Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => setView(ViewState.ALERTS)}
          className="bg-red-50/20 dark:bg-red-950/10 border border-red-200/50 dark:border-red-900/30 p-6 rounded-[2rem] shadow-sm hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">At-Risk Flags</span>
            <ShieldAlert className="text-red-500 w-5 h-5 animate-pulse" />
          </div>
          <span className="text-4xl font-bold text-zinc-900 dark:text-white">{activeFlagsCount}</span>
          <span className="text-xs text-red-500 font-semibold block mt-1.5">{activeFlagsCount} unresolved alerts active</span>
        </div>

        <div 
          onClick={() => setView(ViewState.APPOINTMENTS)}
          className="bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-[2rem] shadow-sm hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Today's Sessions</span>
            <Calendar className="text-indigo-500 w-5 h-5" />
          </div>
          <span className="text-4xl font-bold text-zinc-900 dark:text-white">{todaySessionsCount}</span>
          {pendingRequests > 0 ? (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block mt-1.5">{pendingRequests} booking requests pending</span>
          ) : (
            <span className="text-xs text-zinc-500 font-medium block mt-1.5">No pending requests</span>
          )}
        </div>

        <div 
          onClick={() => setView(ViewState.MY_STUDENTS)}
          className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Caseload Students</span>
            <GraduationCap className="text-zinc-500 w-5 h-5" />
          </div>
          <span className="text-4xl font-bold text-zinc-900 dark:text-white">{caseloadCount}</span>
          <span className="text-xs text-zinc-500 font-medium block mt-1.5">Active assigned casework</span>
        </div>
      </div>

      {/* Caseload Alerts & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wide">Recent Student Activity</h3>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-xs text-zinc-500">No recent student risk activity logged.</p>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-sm">
                  <div className={`w-1.5 h-1.5 rounded-full ${act.color} mt-2 shrink-0`}></div>
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{act.username}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{act.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Clinical Tip Box */}
        <div className="bg-indigo-50/50 dark:bg-zinc-900/40 border border-indigo-100 dark:border-zinc-800 rounded-[2.5rem] p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Heart size={16} /> Clinical Tip
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-light">
              Exam stress is a major trigger for students. Recommend box breathing or present-moment grounding exercises during chats or sessions.
            </p>
          </div>
          <button 
            onClick={() => setView(ViewState.ANALYTICS)}
            className="w-full mt-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1"
          >
            Open Campus Analytics <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};


// --- Student Dashboard View ---
const StudentDashboard: React.FC<DashboardProps> = ({ setView }) => {
  const { user } = useAuth();
  const [intention, setIntention] = useState(localStorage.getItem('daily_intention') || '');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(0);
  const [checkInResult, setCheckInResult] = useState<any>(null);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [isReminderSet, setIsReminderSet] = useState(false);

  const [journalProgress, setJournalProgress] = useState(0);
  const [exerciseProgress, setExerciseProgress] = useState(0);
  const [checkinProgress, setCheckinProgress] = useState(0);

  // 1. Check if user already checked in today
  useEffect(() => {
    api.get('/checkin/history')
      .then(res => {
        const history = res.data;
        if (history.length > 0) {
          const latestDate = new Date(history[0].created_at).toDateString();
          const today = new Date().toDateString();
          if (latestDate === today) {
            setShowCheckIn(false);
            return;
          }
        }
        setShowCheckIn(true);
      })
      .catch(err => {
        console.error(err);
        setShowCheckIn(true);
      });
  }, []);

  // 2. Fetch today's progress for rings
  useEffect(() => {
    const today = new Date().toDateString();
    
    api.get('/journal/history')
      .then(res => {
        const hasToday = res.data.some((j: any) => new Date(j.timestamp).toDateString() === today);
        setJournalProgress(hasToday ? 100 : 0);
      })
      .catch(err => console.error(err));

    api.get('/exercises/history')
      .then(res => {
        const hasToday = res.data.some((e: any) => new Date(e.completed_at).toDateString() === today);
        setExerciseProgress(hasToday ? 100 : 0);
      })
      .catch(err => console.error(err));

    api.get('/checkin/history')
      .then(res => {
        const hasToday = res.data.some((c: any) => new Date(c.created_at).toDateString() === today);
        setCheckinProgress(hasToday ? 100 : 0);
      })
      .catch(err => console.error(err));
  }, [showCheckIn]);

  // 3. Fetch current reminder time
  useEffect(() => {
    api.get('/reminders/current')
      .then(res => {
        setReminderTime(res.data.time_of_day);
        setIsReminderSet(true);
      })
      .catch(() => {
        const localTime = localStorage.getItem('reminder_time');
        if (localTime) {
          setReminderTime(localTime);
          setIsReminderSet(localStorage.getItem('reminder_set') === 'true');
        }
      });
  }, []);

  const handleIntentionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setIntention(e.target.value);
      localStorage.setItem('daily_intention', e.target.value);
  };

  const submitCheckIn = async () => {
      try {
          const res = await api.post('/checkin/', {
              q1_score: q1,
              q2_score: q2
          });
          
          setCheckInResult(res.data);
          setShowCheckIn(false);
      } catch(e) {
          console.error(e);
          if ((e as any).response?.status === 429) {
             setShowCheckIn(false);
          }
      }
  };

  const handleSetReminder = async () => {
      await requestNotificationPermission();
      try {
          const mockSub = { endpoint: 'mock-endpoint', keys: { p256dh: 'mock', auth: 'mock' } };
          await api.post('/reminders/', {
              type: 'daily_checkin',
              time_of_day: reminderTime,
              push_subscription: mockSub
          });
          
          setIsReminderSet(true);
          localStorage.setItem('reminder_time', reminderTime);
          localStorage.setItem('reminder_set', 'true');
      } catch (e) {
          console.error('Error setting reminder', e);
      }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8 relative pb-12">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-rose-50/50 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-rose-950/20 animate-gradient-slow rounded-3xl opacity-60"></div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4 px-2">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            {greeting()}, {user?.username || 'Friend'} {greeting() === "Good evening" ? "🌙" : "☀️"}
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-lg font-light">
            How is your inner weather today?
          </p>
        </div>
        
        <div className="flex gap-6 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/20 dark:border-zinc-800 shadow-sm">
            <ProgressRing radius={30} stroke={4} progress={journalProgress} color="#8b5cf6" label="Journal" />
            <ProgressRing radius={30} stroke={4} progress={exerciseProgress} color="#3b82f6" label="Exercise" />
            <ProgressRing radius={30} stroke={4} progress={checkinProgress} color="#10b981" label="Check-in" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
              {checkInResult?.alert && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-amber-800 dark:text-amber-300 font-semibold text-lg flex items-center gap-2">
                          <Heart className="w-5 h-5" /> Let's pause for a moment
                      </h3>
                      <p className="text-amber-700 dark:text-amber-400 mt-2">{checkInResult.message}</p>
                      <ul className="mt-4 space-y-2">
                          {checkInResult.resources.map((res: string, i: number) => (
                              <li key={i} className="text-amber-800 dark:text-amber-200 text-sm bg-amber-100/50 dark:bg-amber-900/40 p-2 rounded-lg">{res}</li>
                          ))}
                      </ul>
                  </div>
              )}

              <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/30">
                  <h3 className="text-sm font-semibold tracking-wider text-indigo-500 uppercase mb-3">Today's Intention</h3>
                  <textarea 
                      value={intention}
                      onChange={handleIntentionChange}
                      placeholder="What is one small thing you want to focus on today? e.g. 'I will be kind to myself if I make a mistake.'"
                      className="w-full bg-transparent resize-none outline-none text-xl font-medium text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                      rows={2}
                  />
              </div>

              <div className="relative overflow-hidden rounded-3xl bg-zinc-900 dark:bg-zinc-800 text-white p-8 md:p-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full -mr-12 -mt-12"></div>
                <div className="relative z-10 max-w-2xl">
                  <h2 className="text-3xl font-bold mb-3">Feeling overwhelmed?</h2>
                  <p className="text-zinc-400 text-lg mb-6">Sonder is here to listen. No judgment, just a safe space to unpack your thoughts.</p>
                  <button
                    onClick={() => setView(ViewState.COMPANION)}
                    className="bg-white text-zinc-900 px-6 py-3 rounded-xl font-semibold hover:bg-zinc-100 transition-colors flex items-center gap-2"
                  >
                    Talk to Sonder <ArrowRight size={20} />
                  </button>
                </div>
              </div>
          </div>

          <div className="flex flex-col gap-6">
              {showCheckIn ? (
                  <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-md">
                      <h3 className="font-semibold text-lg mb-1">Daily Check-in</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Over the last 2 weeks, how often have you been bothered by:</p>
                      
                      <div className="space-y-6">
                          <div>
                              <p className="text-sm font-medium mb-3">1. Little interest or pleasure in doing things?</p>
                              <div className="flex gap-2">
                                  {[0,1,2,3].map(val => (
                                      <button key={val} onClick={() => setQ1(val)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${q1 === val ? 'bg-indigo-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                          {['Not at all', 'Several days', 'More than half', 'Nearly daily'][val]}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          <div>
                              <p className="text-sm font-medium mb-3">2. Feeling down, depressed, or hopeless?</p>
                              <div className="flex gap-2">
                                  {[0,1,2,3].map(val => (
                                      <button key={val} onClick={() => setQ2(val)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${q2 === val ? 'bg-indigo-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                          {['Not at all', 'Several days', 'More than half', 'Nearly daily'][val]}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          
                          <button onClick={submitCheckIn} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium transition-colors">
                              Save Check-in
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col items-center justify-center text-center gap-3 h-48">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2">
                          <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">Check-in Complete</h3>
                      <p className="text-sm text-emerald-600 dark:text-emerald-500">You've logged your mood for today. Great job showing up for yourself!</p>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setView(ViewState.EXERCISES)} className="p-4 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col items-center gap-2">
                      <CloudRain className="w-6 h-6 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Breathe</span>
                  </button>
                  <button onClick={() => setView(ViewState.JOURNAL)} className="p-4 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors rounded-2xl border border-orange-100 dark:border-orange-900/30 flex flex-col items-center gap-2">
                      <Sun className="w-6 h-6 text-orange-500" />
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Journal</span>
                  </button>
              </div>

              <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm mt-2">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-indigo-500" /> Daily Reminders
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Set a time to be reminded for your daily check-in.</p>
                  
                  <div className="flex gap-4 items-center">
                      <input 
                          type="time" 
                          value={reminderTime} 
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 flex-1 outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <button 
                          onClick={handleSetReminder}
                          className={`px-6 py-2 rounded-xl font-medium transition-colors ${isReminderSet ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                      >
                          {isReminderSet ? 'Updated' : 'Enable'}
                      </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

// --- Main Dashboard Component Switch ---
const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  const { user } = useAuth();

  if (user?.role === 'counsellor') {
    return <CounsellorDashboard setView={setView} />;
  }
  return <StudentDashboard setView={setView} />;
};

export default Dashboard;
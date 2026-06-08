import React, { useState } from 'react';
import { AlertTriangle, MessageSquare, ShieldCheck, User, Calendar, ExternalLink } from 'lucide-react';
import ChatPage from '../components/ChatPage';
import { useAuth } from '../context/AuthContext';

interface StudentAlert {
  id: string;
  studentId: number;
  studentName: string;
  score: number;
  reason: string;
  timestamp: string;
  isResolved: boolean;
}

const Alerts: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<StudentAlert[]>([
    { id: '1', studentId: 11, studentName: 'Alice Johnson', score: 5, reason: 'Answered "Nearly daily" to both interest & depression check-in prompts.', timestamp: '2026-06-08T14:32:00', isResolved: false },
    { id: '2', studentId: 12, studentName: 'Bob Smith', score: 3, reason: 'PHQ-2 score threshold exceeded. Stress indicators elevated.', timestamp: '2026-06-08T09:12:00', isResolved: false },
    { id: '3', studentId: 15, studentName: 'Emma Watson', score: 4, reason: 'Live sentiment analysis filters flagged highly distressed logs.', timestamp: '2026-06-07T18:25:00', isResolved: true }
  ]);

  const [activeChatStudent, setActiveChatStudent] = useState<StudentAlert | null>(null);

  const handleResolve = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isResolved: true } : a));
    alert('Risk alert has been resolved/dismissed.');
  };

  if (activeChatStudent) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-800">
          <button onClick={() => setActiveChatStudent(null)} className="p-2 text-zinc-500 font-semibold hover:text-zinc-700">← Back to Alerts</button>
          <span className="font-bold dark:text-white">Intervention with {activeChatStudent.studentName}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPage
            recipient={{
              id: String(activeChatStudent.studentId),
              name: activeChatStudent.studentName,
              imageUrl: `https://ui-avatars.com/api/?name=${activeChatStudent.studentName}&background=random`,
              specialty: 'Student',
              available: true,
              rating: 5
            }}
            onBack={() => setActiveChatStudent(null)}
            currentUser={user}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Wellness Alerts</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Intervention warnings generated from daily student mood check-ins.</p>
      </div>

      <div className="space-y-4 max-w-4xl">
        {alerts.map((alertItem) => (
          <div 
            key={alertItem.id} 
            className={`p-6 rounded-[2rem] border transition-all ${
              alertItem.isResolved 
                ? 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-60' 
                : 'bg-red-50/20 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/30'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    alertItem.isResolved 
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' 
                      : 'bg-red-100 dark:bg-red-950/40 text-red-600'
                  }`}>
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white leading-tight">
                      At-Risk Flag: {alertItem.studentName}
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                      Flagged: {new Date(alertItem.timestamp).toLocaleString()} | Score: {alertItem.score}/6
                    </p>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-light pl-1">
                  {alertItem.reason}
                </p>
              </div>

              {/* Action commands */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {!alertItem.isResolved ? (
                  <>
                    <button
                      onClick={() => handleResolve(alertItem.id)}
                      className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <ShieldCheck size={14} /> Dismiss
                    </button>
                    <button
                      onClick={() => setActiveChatStudent(alertItem)}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <MessageSquare size={14} /> Reach Out
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-green-600 dark:text-green-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    ✓ Action Completed
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;

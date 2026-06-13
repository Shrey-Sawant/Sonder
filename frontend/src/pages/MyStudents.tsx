import React, { useState, useEffect, useMemo } from 'react';
import { Search, MessageSquare, AlertCircle, Heart, User, CheckCircle } from 'lucide-react';
import api from '../services/api';
import ChatPage from '../components/ChatPage';
import { useAuth } from '../context/AuthContext';

interface CaseworkStudent {
  id: number;
  username: string;
  email: string;
  risk: 'Low' | 'Medium' | 'High';
  lastActive: string;
  moodLabel: string;
}

const MyStudents: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<CaseworkStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<CaseworkStudent | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const res = await api.get('/users/my-students');
        setStudents(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const filtered = students.filter(s => s.username.toLowerCase().includes(search.toLowerCase()));

  const stats = useMemo(() => {
    const total = students.length;
    const activeCount = students.filter(s => s.lastActive !== 'never').length;
    const highRisk = students.filter(s => s.risk === 'High').length;
    const mediumRisk = students.filter(s => s.risk === 'Medium').length;
    const lowRisk = students.filter(s => s.risk === 'Low').length;
    const sadMood = students.filter(s => s.moodLabel === '😔').length;
    const neutralMood = students.filter(s => s.moodLabel === '😐').length;
    const positiveMood = students.filter(s => s.moodLabel === '🙂').length;

    return {
      total,
      activeCount,
      highRisk,
      mediumRisk,
      lowRisk,
      sadMood,
      neutralMood,
      positiveMood,
    };
  }, [students]);

  if (selectedStudent) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b dark:border-zinc-800">
          <button onClick={() => setSelectedStudent(null)} className="p-2 text-zinc-500 font-semibold hover:text-zinc-700">← Back to Caseload</button>
          <span className="font-bold dark:text-white">Chat with {selectedStudent.username}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPage
            recipient={{
              id: String(selectedStudent.id),
              name: selectedStudent.username,
              imageUrl: `https://ui-avatars.com/api/?name=${selectedStudent.username}&background=random`,
              specialty: 'Student',
              available: true,
              rating: 5
            }}
            onBack={() => setSelectedStudent(null)}
            currentUser={user}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">My Students</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage your active clinical caseload and interventions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">Total Students</p>
          <p className="mt-4 text-4xl font-bold text-zinc-900 dark:text-white">{stats.total}</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">All students in your counsellor caseload</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">Recently Active</p>
          <p className="mt-4 text-4xl font-bold text-zinc-900 dark:text-white">{stats.activeCount}</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Students with at least one recent interaction</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">High Risk</p>
          <p className="mt-4 text-4xl font-bold text-red-600 dark:text-red-400">{stats.highRisk}</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Students flagged high risk by latest check-in</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">Mood Summary</p>
          <p className="mt-4 text-4xl font-bold text-zinc-900 dark:text-white">{stats.sadMood}</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sad mood students · {stats.neutralMood} neutral · {stats.positiveMood} positive</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <input 
          type="text" 
          placeholder="Search students in caseload..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-500">Loading student directory...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-3xl">No students found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((student) => (
            <div key={student.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between hover:shadow-lg transition-all shadow-sm">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                      <User size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white leading-tight">{student.username}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">{student.email}</p>
                    </div>
                  </div>
                  <span className="text-2xl" title="Recent Mood">{student.moodLabel}</span>
                </div>

                <div className="flex justify-between text-xs font-semibold pt-2 border-t border-zinc-100 dark:border-zinc-800 text-zinc-500">
                  <span>Last Active: {student.lastActive}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    student.risk === 'High' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' :
                    student.risk === 'Medium' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' :
                    'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400'
                  }`}>
                    {student.risk} Risk
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(student)}
                className="mt-6 w-full py-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <MessageSquare size={14} /> Send Message
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyStudents;

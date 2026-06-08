import React, { useState, useEffect } from 'react';
import { LayoutDashboard, BarChart3, Users as UsersIcon, Flag, FileText, Settings as SettingsIcon, ClipboardList, Check, X, ShieldAlert, Database, Sparkles } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

interface PendingCounsellor {
  id: number;
  username: string;
  email: string;
  experience: number;
  certification: string;
}

interface ReportedJournal {
  id: number;
  student: string;
  text: string;
  timestamp: string;
  reason: string;
}

const AdminDashboard: React.FC = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'insight' | 'users' | 'flags' | 'content' | 'settings' | 'audit'>('dashboard');
  const [pendingCounsellors, setPendingCounsellors] = useState<PendingCounsellor[]>([
    { id: 101, username: 'Dr. Sarah Carter', email: 'sarah.carter@sonder.org', experience: 8, certification: 'Ph.D. in Clinical Psychology' },
    { id: 102, username: 'Marcus Miller', email: 'marcus.m@sonder.org', experience: 5, certification: 'LCSW, Mental Health Counsellor' },
    { id: 103, username: 'Elena Rostova', email: 'elena.r@sonder.org', experience: 6, certification: 'M.S. in Counseling Psychology' }
  ]);

  const [reportedJournals, setReportedJournals] = useState<ReportedJournal[]>([
    { id: 201, student: 'Alice Johnson', text: 'I feel completely hopeless today. No matter what I do, everything feels dark and empty. It is hard to get out of bed.', timestamp: '2026-06-08T14:32:00', reason: 'High Risk Alert (PHQ-2)' },
    { id: 202, student: 'Bob Smith', text: 'Stressed about the upcoming finals, feeling extremely burned out. Havent slept in 48 hours.', timestamp: '2026-06-08T15:10:00', reason: 'Burnout Threshold Exceeded' }
  ]);

  const [storageAlert, setStorageAlert] = useState({
    percent: 82,
    details: 'Daily journal image store is approaching capacity. Unused logs can be archived.',
    status: 'Warning'
  });

  // Modals state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [showSystemAlertModal, setShowSystemAlertModal] = useState(false);
  
  // Real users state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (activeTab === 'users') {
      setLoadingUsers(true);
      api.get('/users/')
        .then(res => setUsersList(res.data))
        .catch(err => console.error(err))
        .finally(() => setLoadingUsers(false));
    }
  }, [activeTab]);

  const handleApproveCounsellor = (id: number) => {
    setPendingCounsellors(prev => prev.filter(c => c.id !== id));
    alert('Counsellor approved successfully.');
  };

  const handleRejectCounsellor = (id: number) => {
    setPendingCounsellors(prev => prev.filter(c => c.id !== id));
    alert('Application rejected.');
  };

  const handleDismissReport = (id: number) => {
    setReportedJournals(prev => prev.filter(r => r.id !== id));
    alert('Journal report dismissed.');
  };

  const handlePurgeLogs = () => {
    setStorageAlert(prev => ({ ...prev, percent: 45, status: 'Healthy', details: 'Storage cleared. Cache is purged.' }));
    setShowSystemAlertModal(false);
    alert('Cache successfully purged. Server storage is now at 45%.');
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-violet-600 selection:text-white">
      {/* Admin Header */}
      <header className="bg-[#0c0c0e] border-b border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#f97316] rounded-full shadow-lg shadow-orange-500/25"></div>
          <span className="font-bold text-xl tracking-tight text-white">Sonder admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={logout} 
            className="text-xs font-semibold text-zinc-500 hover:text-red-500 transition-colors mr-2 cursor-pointer"
          >
            Logout
          </button>
          <span className="bg-violet-950/80 border border-violet-800/60 text-violet-400 font-semibold px-4 py-1.5 rounded-full text-xs tracking-wide">
            Super admin
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Admin Left Sidebar */}
        <aside className="w-full md:w-64 bg-[#0c0c0e] border-r border-zinc-800 flex flex-col p-4 shrink-0">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase px-3 mb-2">Overview</p>
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-zinc-900 text-white border-l-4 border-violet-500 rounded-l-none'
                      : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  }`}
                >
                  <LayoutDashboard size={18} />
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('insight')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'insight'
                      ? 'bg-zinc-900 text-white border-l-4 border-violet-500 rounded-l-none'
                      : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  }`}
                >
                  <BarChart3 size={18} />
                  Insight
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase px-3 mb-2">People</p>
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'users'
                      ? 'bg-zinc-900 text-white border-l-4 border-violet-500 rounded-l-none'
                      : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  }`}
                >
                  <UsersIcon size={18} />
                  Users
                </button>
                <button
                  onClick={() => setActiveTab('flags')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'flags'
                      ? 'bg-zinc-900 text-white border-l-4 border-violet-500 rounded-l-none'
                      : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  }`}
                >
                  <Flag size={18} />
                  Flags
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase px-3 mb-2">System</p>
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('content')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'content'
                      ? 'bg-zinc-900 text-white border-l-4 border-violet-500 rounded-l-none'
                      : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  }`}
                >
                  <FileText size={18} />
                  Content
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'settings'
                      ? 'bg-zinc-900 text-white border-l-4 border-violet-500 rounded-l-none'
                      : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  }`}
                >
                  <SettingsIcon size={18} />
                  Settings
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'audit'
                      ? 'bg-zinc-900 text-white border-l-4 border-violet-500 rounded-l-none'
                      : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  }`}
                >
                  <ClipboardList size={18} />
                  Audit log
                </button>
              </nav>
            </div>
          </div>

          <div className="mt-auto p-3 border-t border-zinc-800 text-xs text-zinc-600 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            System Online
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 bg-[#09090b] p-6 md:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 max-w-5xl">
              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1 */}
                <div className="bg-[#121214] p-5 rounded-2xl border border-zinc-800">
                  <span className="text-3xl font-bold text-white block">1,284</span>
                  <span className="text-[11px] text-zinc-500 block mt-1 uppercase tracking-wide">Total users</span>
                  <span className="text-xs text-green-500 font-semibold mt-2 block">+12 this week</span>
                </div>
                {/* Card 2 */}
                <div className="bg-[#121214] p-5 rounded-2xl border border-zinc-800">
                  <span className="text-3xl font-bold text-white block">47</span>
                  <span className="text-[11px] text-zinc-500 block mt-1 uppercase tracking-wide">Counsellors</span>
                  <span className="text-xs text-green-500 font-semibold mt-2 block">+3 pending</span>
                </div>
                {/* Card 3 */}
                <div className="bg-[#121214] p-5 rounded-2xl border border-zinc-800">
                  <span className="text-3xl font-bold text-white block">8</span>
                  <span className="text-[11px] text-zinc-500 block mt-1 uppercase tracking-wide">Active flags</span>
                  <span className="text-xs text-red-500 font-semibold mt-2 block">2 high risk</span>
                </div>
                {/* Card 4 */}
                <div className="bg-[#121214] p-5 rounded-2xl border border-zinc-800">
                  <span className="text-3xl font-bold text-white block">94%</span>
                  <span className="text-[11px] text-zinc-500 block mt-1 uppercase tracking-wide">Uptime</span>
                  <span className="text-xs text-orange-500 font-semibold mt-2 block">SLA 99.9%</span>
                </div>
              </div>

              {/* Weekly Engagement */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Weekly Engagement</h3>
                <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl flex items-end justify-between h-36 max-w-lg">
                  {/* Bar 1 */}
                  <div className="flex flex-col items-center gap-2 w-8">
                    <div className="bg-zinc-800 w-full h-8 rounded-t-md"></div>
                  </div>
                  {/* Bar 2 */}
                  <div className="flex flex-col items-center gap-2 w-8">
                    <div className="bg-zinc-800 w-full h-12 rounded-t-md"></div>
                  </div>
                  {/* Bar 3 */}
                  <div className="flex flex-col items-center gap-2 w-8">
                    <div className="bg-zinc-800 w-full h-10 rounded-t-md"></div>
                  </div>
                  {/* Bar 4 */}
                  <div className="flex flex-col items-center gap-2 w-8">
                    <div className="bg-violet-500 w-full h-24 rounded-t-md shadow-lg shadow-violet-500/20"></div>
                  </div>
                  {/* Bar 5 */}
                  <div className="flex flex-col items-center gap-2 w-8">
                    <div className="bg-zinc-800 w-full h-16 rounded-t-md"></div>
                  </div>
                  {/* Bar 6 */}
                  <div className="flex flex-col items-center gap-2 w-8">
                    <div className="bg-violet-500 w-full h-28 rounded-t-md shadow-lg shadow-violet-500/20"></div>
                  </div>
                  {/* Bar 7 */}
                  <div className="flex flex-col items-center gap-2 w-8">
                    <div className="bg-violet-500 w-full h-22 rounded-t-md shadow-lg shadow-violet-500/20"></div>
                  </div>
                </div>
              </div>

              {/* Pending Actions */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Pending Actions</h3>
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl divide-y divide-zinc-800">
                  {/* Action 1 */}
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">Counsellor approvals</h4>
                      <p className="text-xs text-zinc-500 mt-1">{pendingCounsellors.length} awaiting review</p>
                    </div>
                    <button
                      onClick={() => setShowApproveModal(true)}
                      className="px-6 py-2.5 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40 text-white rounded-xl text-xs font-bold tracking-wide transition-all"
                    >
                      Review
                    </button>
                  </div>

                  {/* Action 2 */}
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">Content moderation</h4>
                      <p className="text-xs text-zinc-500 mt-1">{reportedJournals.length} journal reports</p>
                    </div>
                    <button
                      onClick={() => setShowModerationModal(true)}
                      className="px-6 py-2.5 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40 text-white rounded-xl text-xs font-bold tracking-wide transition-all"
                    >
                      Review
                    </button>
                  </div>

                  {/* Action 3 */}
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">System alert</h4>
                      <p className="text-xs text-zinc-500 mt-1">Storage at {storageAlert.percent}%</p>
                    </div>
                    <button
                      onClick={() => setShowSystemAlertModal(true)}
                      className="px-6 py-2.5 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40 text-white rounded-xl text-xs font-bold tracking-wide transition-all"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insight' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Mood & Habit Analytics</h2>
                <p className="text-xs text-zinc-500 mt-1">Detailed system insights of user logs and journaling habits.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl text-center">
                  <span className="text-2xl font-bold text-violet-400 block">4.2 / day</span>
                  <span className="text-[11px] text-zinc-500 mt-1 block uppercase">Avg Check-in frequency</span>
                </div>
                <div className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl text-center">
                  <span className="text-2xl font-bold text-orange-400 block">18,520</span>
                  <span className="text-[11px] text-zinc-500 mt-1 block uppercase">Total journals written</span>
                </div>
                <div className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl text-center">
                  <span className="text-2xl font-bold text-green-400 block">84%</span>
                  <span className="text-[11px] text-zinc-500 mt-1 block uppercase">Active journal streaks</span>
                </div>
              </div>

              <div className="bg-[#121214] border border-zinc-800 p-6 rounded-2xl">
                <h3 className="font-bold text-sm text-zinc-400 mb-4">Mood Sentiment Distribution (Aggregated)</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1"><span>Positive (😄 / 🙂)</span><span>62%</span></div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden"><div className="bg-green-500 h-full w-[62%]"></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1"><span>Neutral (😐)</span><span>23%</span></div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden"><div className="bg-zinc-500 h-full w-[23%]"></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1"><span>Negative (😔 / ☹️)</span><span>15%</span></div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden"><div className="bg-red-500 h-full w-[15%]"></div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Registered Users</h2>
                <p className="text-xs text-zinc-500 mt-1">System user credentials and verified roles.</p>
              </div>

              {loadingUsers ? (
                <div className="py-10 text-center text-zinc-500">Loading directory...</div>
              ) : (
                <div className="bg-[#121214] border border-zinc-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase">
                        <th className="p-4">Username</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {usersList.map((usr: any) => (
                        <tr key={usr.id} className="hover:bg-zinc-900/40 text-zinc-300">
                          <td className="p-4 font-semibold text-white">{usr.username}</td>
                          <td className="p-4">{usr.email}</td>
                          <td className="p-4 capitalize">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              usr.role === 'admin' ? 'bg-violet-950 text-violet-400 border border-violet-800' :
                              usr.role === 'counsellor' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>
                              {usr.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="flex items-center gap-1.5 text-xs text-green-500">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'flags' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Active Risk Flags</h2>
                <p className="text-xs text-zinc-500 mt-1">Critical alerts requiring manual clinician assignment or audit.</p>
              </div>

              <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 divide-y divide-zinc-800 space-y-4">
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white flex items-center gap-2"><ShieldAlert size={14} className="text-red-500"/> Student: Alice Johnson</h4>
                    <p className="text-xs text-zinc-500 mt-1">Severity: <span className="text-red-500 font-semibold">High Risk</span> | Flagged on 2026-06-08</p>
                  </div>
                  <span className="bg-red-950 text-red-400 px-3 py-1 rounded-full text-xs font-bold">Unassigned</span>
                </div>
                <div className="pt-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white flex items-center gap-2"><ShieldAlert size={14} className="text-red-500"/> Student: Bob Smith</h4>
                    <p className="text-xs text-zinc-500 mt-1">Severity: <span className="text-orange-500 font-semibold">Medium Risk</span> | Flagged on 2026-06-08</p>
                  </div>
                  <span className="bg-red-950 text-red-400 px-3 py-1 rounded-full text-xs font-bold">Unassigned</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Content Moderation Queue</h2>
                <p className="text-xs text-zinc-500 mt-1">Flags raised automatically by AI sentiment analysis filters.</p>
              </div>

              {reportedJournals.length === 0 ? (
                <div className="bg-[#121214] border border-zinc-800 p-8 text-center rounded-2xl text-zinc-500">
                  All reports settled. Queue is clean.
                </div>
              ) : (
                <div className="space-y-4">
                  {reportedJournals.map((rep) => (
                    <div key={rep.id} className="bg-[#121214] border border-zinc-800 p-6 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-sm">{rep.student}</h4>
                          <span className="text-[10px] text-zinc-500">{new Date(rep.timestamp).toLocaleString()}</span>
                        </div>
                        <span className="bg-yellow-950 text-yellow-400 border border-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded capitalize">
                          {rep.reason}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 italic bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                        "{rep.text}"
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDismissReport(rep.id)}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium"
                        >
                          Dismiss Flag
                        </button>
                        <button
                          onClick={() => handleDismissReport(rep.id)}
                          className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded-lg text-xs font-bold"
                        >
                          Delete Entry
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Global System Settings</h2>
                <p className="text-xs text-zinc-500 mt-1">Admin configuration variables and feature gates.</p>
              </div>

              <div className="bg-[#121214] border border-zinc-800 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Self-Harm Detection Algorithm</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">Scans student journal inputs for acute indicators.</p>
                  </div>
                  <div className="w-12 h-6 bg-violet-600 rounded-full p-1 cursor-pointer flex justify-end">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                  <div>
                    <h4 className="font-bold text-white text-sm">Counselor Referral Prompts</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">Enables suggestions on student mood check-ins.</p>
                  </div>
                  <div className="w-12 h-6 bg-violet-600 rounded-full p-1 cursor-pointer flex justify-end">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Audit Trail Logs</h2>
                <p className="text-xs text-zinc-500 mt-1">Read-only logging of system changes and user security access.</p>
              </div>

              <div className="bg-[#121214] border border-zinc-800 rounded-2xl overflow-hidden text-xs font-mono">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex gap-4 text-zinc-500">
                  <span className="w-20">Time</span>
                  <span className="w-24">User</span>
                  <span className="w-24">Action</span>
                  <span>Payload</span>
                </div>
                <div className="divide-y divide-zinc-800 text-zinc-400">
                  <div className="p-4 flex gap-4">
                    <span className="w-20 text-zinc-600">23:30:24</span>
                    <span className="w-24 text-violet-400 font-semibold">SuperAdmin</span>
                    <span className="w-24 text-white">LOGIN</span>
                    <span>Admin console access verified. TLS handshake complete.</span>
                  </div>
                  <div className="p-4 flex gap-4">
                    <span className="w-20 text-zinc-600">23:28:11</span>
                    <span className="w-24 text-zinc-500">System</span>
                    <span className="w-24 text-yellow-500">ALERT</span>
                    <span>Server storage warning threshold hit (82%).</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS --- */}

      {/* Approve Counsellor Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-zinc-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40">
              <h3 className="font-bold text-white flex items-center gap-2"><Sparkles size={16} className="text-violet-400"/> Pending Approvals</h3>
              <button onClick={() => setShowApproveModal(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              {pendingCounsellors.length === 0 ? (
                <p className="text-zinc-500 text-center py-6 text-sm">No pending approvals left.</p>
              ) : (
                pendingCounsellors.map(c => (
                  <div key={c.id} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex justify-between items-center gap-4">
                    <div>
                      <h4 className="font-bold text-white text-sm">{c.username}</h4>
                      <p className="text-xs text-zinc-400 mt-1">{c.certification}</p>
                      <p className="text-[10px] text-zinc-500">Exp: {c.experience} years | Email: {c.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectCounsellor(c.id)}
                        className="p-2 bg-red-950/40 border border-red-900/60 hover:bg-red-900/60 text-red-400 rounded-lg"
                        title="Reject Application"
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={() => handleApproveCounsellor(c.id)}
                        className="p-2 bg-green-950/40 border border-green-900/60 hover:bg-green-900/60 text-green-400 rounded-lg"
                        title="Approve Counsellor"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content Moderation Modal */}
      {showModerationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-zinc-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40">
              <h3 className="font-bold text-white flex items-center gap-2"><ShieldAlert size={16} className="text-red-500"/> Reported Content Moderation</h3>
              <button onClick={() => setShowModerationModal(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              {reportedJournals.length === 0 ? (
                <p className="text-zinc-500 text-center py-6 text-sm">All moderation cases resolved.</p>
              ) : (
                reportedJournals.map(r => (
                  <div key={r.id} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-white block">{r.student}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(r.timestamp).toLocaleString()}</span>
                      </div>
                      <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold">{r.reason}</span>
                    </div>
                    <p className="text-xs text-zinc-300 italic bg-zinc-900/40 p-3 rounded-lg border border-zinc-800">
                      "{r.text}"
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleDismissReport(r.id)}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-semibold"
                      >
                        Dismiss Report
                      </button>
                      <button
                        onClick={() => handleDismissReport(r.id)}
                        className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-white rounded text-xs font-semibold"
                      >
                        Delete Journal
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Storage Management Modal */}
      {showSystemAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-zinc-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40">
              <h3 className="font-bold text-white flex items-center gap-2"><Database size={16} className="text-violet-400"/> System Disk Management</h3>
              <button onClick={() => setShowSystemAlertModal(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="text-center">
                <span className="text-6xl font-bold text-red-500 block">{storageAlert.percent}%</span>
                <span className="text-[10px] text-zinc-500 uppercase mt-1 block">Storage Used</span>
              </div>
              <p className="text-xs text-zinc-400 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                {storageAlert.details}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSystemAlertModal(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={handlePurgeLogs}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-600/20"
                >
                  Purge Temp & Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

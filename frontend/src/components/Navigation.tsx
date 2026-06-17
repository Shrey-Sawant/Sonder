import React from 'react';
import { Home, MessageCircleHeart, Library, Users, BarChart3, PenTool, Activity, Calendar, ClipboardList, ShieldAlert, GraduationCap, MessageSquare, BookOpen } from 'lucide-react';
import { ViewState } from '../../types';
import logoLight from '../assest/Logo_with_name_light_mode.png';
import logoDark from '../assest/Logo_with_name_dark_mode.png';

interface NavigationProps {
  currentView: string;
  setView: (view: string) => void;
}

import { useAuth } from '../context/AuthContext';

const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return null; // Admin has their own layout in App.tsx
  }

  const studentItems = [
    { id: ViewState.DASHBOARD, icon: Home, label: 'Home' },
    { id: ViewState.JOURNAL, icon: PenTool, label: 'Journal' },
    { id: ViewState.EXERCISES, icon: Activity, label: 'Exercises' },
    { id: ViewState.COMPANION, icon: MessageCircleHeart, label: 'Companion' },
    { id: ViewState.SANCTUARY, icon: Library, label: 'Sanctuary' },
    { id: ViewState.STORY_FEED, icon: BookOpen, label: 'Story Feed' },
    { id: ViewState.PEER_CHAT, icon: MessageSquare, label: 'Peer Chat' },
    { id: ViewState.CONNECT, icon: Users, label: 'Connect' },
  ];

  const counsellorItems = [
    { id: ViewState.DASHBOARD, icon: Home, label: 'Dashboard' },
    { id: ViewState.CONNECT, icon: Users, label: 'Connect' },
    { id: ViewState.MY_STUDENTS, icon: GraduationCap, label: 'My Students' },
    { id: ViewState.APPOINTMENTS, icon: Calendar, label: 'Appointments' },
    { id: ViewState.SESSION_NOTES, icon: ClipboardList, label: 'Session Notes' },
    { id: ViewState.ANALYTICS, icon: BarChart3, label: 'Analytics' },
    { id: ViewState.ALERTS, icon: ShieldAlert, label: 'Alerts' },
  ];

  const navItems = user?.role === 'counsellor' ? counsellorItems : studentItems;

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-20 lg:w-64 h-screen bg-[#faf7ff] dark:bg-zinc-950 fixed left-0 top-0 z-50 shadow-sm transition-colors duration-300">
        <div className="p-6 flex items-center gap-3 bg-white/80 dark:bg-zinc-900/90 rounded-br-[2rem] shadow-sm transition-colors duration-300">
          <div className="w-12 h-12 relative">
            <img src={logoLight} alt="Sonder logo" className="h-full w-full object-contain block dark:hidden" />
            <img src={logoDark} alt="Sonder logo" className="h-full w-full object-contain hidden dark:block" />
          </div>
          <span className="hidden lg:block font-semibold text-2xl tracking-tight text-zinc-900 dark:text-white">Sonder</span>
        </div>

        <div className="flex-1 flex flex-col gap-3 p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-4 p-3 rounded-[18px] transition-all duration-300 ${currentView === item.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-zinc-500 hover:bg-white/90'
                }`}
            >
              <item.icon className={`w-6 h-6 ${currentView === item.id ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
              <span className="hidden lg:block font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 bg-white/80 dark:bg-zinc-900/90 rounded-t-[2rem] transition-colors duration-300">
          <div className="flex items-center gap-3 p-3 rounded-3xl bg-[#f9f8ff] dark:bg-zinc-900/70 shadow-sm transition-colors duration-300">
            <div className="w-10 h-10 rounded-full bg-[#e7e3ff] overflow-hidden">
              <img src="https://picsum.photos/100/100?grayscale" alt="User" className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="hidden lg:block">
              {user?.anon_mode_enabled && user?.anon_id ? (
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                    {user.anon_id}
                  </span>
                  <p className="text-[10px] text-zinc-400 capitalize">Anonymous Mode</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">{user?.username || 'User'}</p>
                  <p className="text-[10px] capitalize text-zinc-500">{user?.role || 'Member'}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-zinc-800 z-50 pb-safe transition-colors duration-300">
        <div className="flex justify-around items-center p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-1 transition-colors ${currentView === item.id
                  ? 'text-indigo-700'
                  : 'text-zinc-400'
                }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Navigation;
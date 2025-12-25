import React from 'react';
import { Home, MessageCircleHeart, Library, Users, BarChart3, LifeBuoy } from 'lucide-react';
import { ViewState } from '../../types';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

import { useAuth } from '../context/AuthContext';

const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const { user } = useAuth();
  const navItems = [
    { id: ViewState.DASHBOARD, icon: Home, label: 'Home' },
    { id: ViewState.COMPANION, icon: MessageCircleHeart, label: 'Companion' },
    { id: ViewState.SANCTUARY, icon: Library, label: 'Sanctuary' },
    { id: ViewState.CONNECT, icon: Users, label: 'Connect' },
    { id: ViewState.INSIGHT, icon: BarChart3, label: 'Insight' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-20 lg:w-64 h-screen border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 fixed left-0 top-0 z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-orange-400 to-rose-500 rounded-full animate-pulse-slow shadow-lg shadow-orange-500/20"></div>
          <span className="hidden lg:block font-bold text-2xl tracking-tighter text-zinc-900 dark:text-white">Sonder.</span>
        </div>

        <div className="flex-1 flex flex-col gap-2 p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group ${currentView === item.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
                }`}
            >
              <item.icon className={`w-6 h-6 ${currentView === item.id ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              <span className="hidden lg:block font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4 p-3 text-zinc-500 dark:text-zinc-400">
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <img src="https://picsum.photos/100/100?grayscale" alt="User" className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">{user?.username || 'User'}</p>
              <p className="text-[10px] capitalize">{user?.role || 'Member'}</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 z-50 pb-safe">
        <div className="flex justify-around items-center p-4">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-1 transition-colors ${currentView === item.id
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-zinc-400 dark:text-zinc-500'
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
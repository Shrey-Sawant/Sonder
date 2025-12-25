import React from 'react';
import { ArrowRight, Sun, CloudRain, Activity, CalendarCheck } from 'lucide-react';
import { ViewState } from '../../types';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  setView: (view: ViewState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  const { user } = useAuth();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {greeting()}, {user?.username || 'Friend'}.
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-lg font-light">
            How is your inner weather today?
          </p>
        </div>
      </header>

      {/* Daily Check-in Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-orange-50 dark:bg-zinc-900/50 border border-orange-100 dark:border-zinc-800 hover:scale-[1.02] transition-transform cursor-pointer group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-orange-500">
              <Sun size={24} />
            </div>
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-full">Daily</span>
          </div>
          <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Mood Check-in</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Log how you're feeling to track patterns over time.</p>
        </div>

        <div className="p-6 rounded-3xl bg-blue-50 dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800 hover:scale-[1.02] transition-transform cursor-pointer group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-blue-500">
              <CloudRain size={24} />
            </div>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">Exercise</span>
          </div>
          <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Breathing Space</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Take 2 minutes to ground yourself with 4-7-8 breathing.</p>
        </div>

        <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-zinc-900/50 border border-emerald-100 dark:border-zinc-800 hover:scale-[1.02] transition-transform cursor-pointer group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-emerald-500">
              <CalendarCheck size={24} />
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">Planner</span>
          </div>
          <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Focus Mode</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Prepare for your upcoming exams with guided focus.</p>
        </div>
      </div>

      {/* AI Call to Action */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 dark:bg-zinc-800 text-white p-8 md:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 blur-3xl rounded-full -mr-12 -mt-12"></div>
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Feeling overwhelmed?</h2>
          <p className="text-zinc-400 text-lg mb-8">Sonder is here to listen. No judgment, just a safe space to unpack your thoughts.</p>
          <button
            onClick={() => setView(ViewState.COMPANION)}
            className="bg-white text-zinc-900 px-8 py-4 rounded-xl font-semibold hover:bg-zinc-100 transition-colors flex items-center gap-2"
          >
            Talk to Sonder <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {/* Recommended Content */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Picked for you</h2>
          <button onClick={() => setView(ViewState.SANCTUARY)} className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline">View all</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="group cursor-pointer">
              <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 mb-3 relative">
                <img src={`https://picsum.photos/300/300?random=${i}`} alt="Content" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg">5 min</div>
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Understanding Anxiety {i}</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Dr. Sarah Chen</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
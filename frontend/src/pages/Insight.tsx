import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Sparkles, Activity, Clock, ShieldAlert, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const Insight: React.FC = () => {
  const { user } = useAuth();

  // Route security gate: Admin only
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Mock analytics data
  const checkinStats = [
    { day: 'Mon', count: 120 },
    { day: 'Tue', count: 145 },
    { day: 'Wed', count: 180 },
    { day: 'Thu', count: 130 },
    { day: 'Fri', count: 95 },
    { day: 'Sat', count: 50 },
    { day: 'Sun', count: 42 }
  ];

  const sentimentData = [
    { date: 'June 1', score: 2.1 },
    { date: 'June 2', score: 1.8 },
    { date: 'June 3', score: 0.9 },
    { date: 'June 4', score: 2.4 },
    { date: 'June 5', score: 3.1 },
    { date: 'June 6', score: 1.5 },
    { date: 'June 7', score: 2.7 }
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12 text-zinc-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">System Insight (Admin)</h1>
        <p className="text-xs text-zinc-500 mt-1">Audit logs of student mood analytics, journaling streaks, and check-in habits.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-violet-950 text-violet-400 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-2xl font-bold text-white block">86%</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Completion Rate</span>
          </div>
        </div>

        <div className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-orange-950 text-orange-400 rounded-xl">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-2xl font-bold text-white block">3,480 min</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Breathing Completed</span>
          </div>
        </div>

        <div className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-green-950 text-green-400 rounded-xl">
            <Award size={20} />
          </div>
          <div>
            <span className="text-2xl font-bold text-white block">18 days</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Top Streak Duration</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl">
          <h3 className="font-bold text-white text-sm mb-4">Mood Sentiment Trend (System Average)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl">
          <h3 className="font-bold text-white text-sm mb-4">Weekly Check-in Habit Volumes</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={checkinStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#fb923c" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Insight;
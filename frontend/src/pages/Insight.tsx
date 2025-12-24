import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { TrendingUp, Users, AlertCircle, Activity } from 'lucide-react';

const Insight: React.FC = () => {
  const stressData = [
    { name: 'Week 1', value: 30 },
    { name: 'Week 2', value: 45 },
    { name: 'Mid-Terms', value: 85 },
    { name: 'Week 4', value: 60 },
    { name: 'Week 5', value: 40 },
    { name: 'Finals', value: 90 },
  ];

  const issueDistribution = [
    { name: 'Anxiety', value: 40 },
    { name: 'Burnout', value: 35 },
    { name: 'Sleep', value: 15 },
    { name: 'Social', value: 10 },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">Institutional Insight</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Anonymized, aggregated data to help plan campus interventions.</p>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-orange-500 mb-2">
            <TrendingUp size={20} />
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Avg Stress Level</span>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">7.2<span className="text-lg text-zinc-400 font-normal">/10</span></p>
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">↑ 12% from last week</p>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-blue-500 mb-2">
            <Users size={20} />
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Active Students</span>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">1,240</p>
          <p className="text-xs text-green-500 mt-1 flex items-center gap-1">↑ 5% engagement</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-purple-500 mb-2">
            <AlertCircle size={20} />
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Risk Alerts</span>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">12</p>
          <p className="text-xs text-zinc-500 mt-1">Interventions triggered</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-emerald-500 mb-2">
            <Activity size={20} />
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Resources Used</span>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">8.5k</p>
          <p className="text-xs text-zinc-500 mt-1">Minutes of content consumed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Chart */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Campus Stress Heatmap</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stressData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fb923c' }}
                />
                <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Chart */}
         <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Top Concerns (Anonymized)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueDistribution} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} width={70} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="bg-indigo-50 dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-xl text-indigo-600 dark:text-indigo-400">
             <Activity />
          </div>
          <div>
             <h4 className="font-bold text-zinc-900 dark:text-white">AI Prediction</h4>
             <p className="text-zinc-600 dark:text-zinc-400 text-sm">Burnout risk is projected to increase by 25% next week due to upcoming finals. Suggested Action: Launch "Study Break" campaign.</p>
          </div>
      </div>
    </div>
  );
};

export default Insight;
import React, { useState } from 'react';
import { Play, Headphones, BookOpen, Search, Filter } from 'lucide-react';
import { Resource } from '../../types';

const Sanctuary: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');

  // Mock Data
  const resources: Resource[] = [
    { id: '1', title: 'Grounding 101: The 5-4-3-2-1 Technique', type: 'video', category: 'Anxiety', duration: '5:20', imageUrl: 'https://picsum.photos/400/300?random=10' },
    { id: '2', title: 'Deep Sleep Hypnosis', type: 'audio', category: 'Sleep', duration: '25:00', imageUrl: 'https://picsum.photos/400/300?random=11' },
    { id: '3', title: 'Understanding Academic Burnout', type: 'article', category: 'Burnout', duration: '8 min read', imageUrl: 'https://picsum.photos/400/300?random=12' },
    { id: '4', title: 'Morning Mindfulness Routine', type: 'video', category: 'Meditation', duration: '10:00', imageUrl: 'https://picsum.photos/400/300?random=13' },
    { id: '5', title: 'Dealing with Social Isolation', type: 'article', category: 'Anxiety', duration: '6 min read', imageUrl: 'https://picsum.photos/400/300?random=14' },
    { id: '6', title: 'Exam Stress Busters', type: 'audio', category: 'Burnout', duration: '12:45', imageUrl: 'https://picsum.photos/400/300?random=15' },
  ];

  const filteredResources = activeTab === 'all' ? resources : resources.filter(r => r.category.toLowerCase() === activeTab.toLowerCase());

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">Sanctuary</h1>
        <p className="text-zinc-500 dark:text-zinc-400">A curated library for your mind. Learn, breathe, and grow.</p>
      </header>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search for topics (e.g. 'sleep', 'panic')" 
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All', 'Anxiety', 'Sleep', 'Burnout', 'Meditation'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.toLowerCase()
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Challenge */}
      <div className="bg-gradient-to-r from-rose-100 to-orange-100 dark:from-rose-900/20 dark:to-orange-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 flex items-center justify-between">
         <div>
            <h3 className="text-rose-900 dark:text-rose-100 font-bold text-lg">Today's Challenge</h3>
            <p className="text-rose-700 dark:text-rose-300 text-sm">Complete a 5-minute gratitude journal entry.</p>
         </div>
         <button className="px-4 py-2 bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 font-semibold rounded-lg shadow-sm hover:bg-rose-50 transition-colors">Start</button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResources.map((resource) => (
          <div key={resource.id} className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-300">
            <div className="relative aspect-video overflow-hidden">
              <img src={resource.imageUrl} alt={resource.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                  <Play fill="white" size={20} />
                </div>
              </div>
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                {resource.category}
              </div>
              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                {resource.type === 'video' ? <Play size={10} /> : resource.type === 'audio' ? <Headphones size={10} /> : <BookOpen size={10} />}
                {resource.duration}
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg leading-tight mb-2 group-hover:text-orange-600 transition-colors">{resource.title}</h3>
              <div className="flex justify-between items-center mt-4">
                 <button className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium">Save for later</button>
                 <button className="text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Start</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sanctuary;
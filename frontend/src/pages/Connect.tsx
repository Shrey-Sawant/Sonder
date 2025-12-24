import React, { useState } from 'react';
import { Phone, Shield, Calendar, Clock, Star, MessageSquare, AlertOctagon, Lock } from 'lucide-react';
import { Counselor } from '../../types';

const Connect: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'counseling' | 'peer'>('counseling');
  const [showSOS, setShowSOS] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const counselors: Counselor[] = [
    { id: '1', name: 'Dr. Emily Stone', specialty: 'Anxiety & Stress', available: true, rating: 4.9, imageUrl: 'https://picsum.photos/100/100?random=20' },
    { id: '2', name: 'Mr. Raj Patel', specialty: 'Academic Burnout', available: false, rating: 4.8, imageUrl: 'https://picsum.photos/100/100?random=21' },
    { id: '3', name: 'Ms. Sarah Al-Fayed', specialty: 'Trauma & Grief', available: true, rating: 5.0, imageUrl: 'https://picsum.photos/100/100?random=22' },
  ];

  return (
    <div className="space-y-8 relative">
      {/* SOS Modal Overlay */}
      {showSOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-red-500">
            <div className="bg-red-600 p-6 text-white text-center">
              <AlertOctagon size={48} className="mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Emergency Support</h2>
              <p className="text-red-100 mt-2">If you are in immediate danger, please call emergency services immediately.</p>
            </div>
            <div className="p-6 space-y-4">
              <button className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <div className="flex items-center gap-3">
                   <Phone className="text-red-500" />
                   <div className="text-left">
                     <p className="font-bold text-zinc-900 dark:text-white">National Suicide Prevention</p>
                     <p className="text-xs text-zinc-500">Available 24/7</p>
                   </div>
                </div>
                <span className="font-mono font-bold text-xl text-zinc-900 dark:text-white">988</span>
              </button>
              <button className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-200 dark:hover:bg-zinc-700">
                 <div className="flex items-center gap-3">
                   <Shield className="text-blue-500" />
                   <div className="text-left">
                     <p className="font-bold text-zinc-900 dark:text-white">Campus Security</p>
                     <p className="text-xs text-zinc-500">University Line</p>
                   </div>
                </div>
                <span className="font-mono font-bold text-xl text-zinc-900 dark:text-white">555-0199</span>
              </button>
              <button onClick={() => setShowSOS(false)} className="w-full py-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">Connect</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Professional help and peer support, on your terms.</p>
        </div>
        <button 
          onClick={() => setShowSOS(true)}
          className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-red-100 transition-colors animate-pulse"
        >
          <AlertOctagon size={20} /> SOS
        </button>
      </header>

      {/* Toggle Switch */}
      <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveSection('counseling')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            activeSection === 'counseling'
              ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Counseling Hub
        </button>
        <button
          onClick={() => setActiveSection('peer')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            activeSection === 'peer'
              ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Peer Community
        </button>
      </div>

      {activeSection === 'counseling' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          {/* Anonymous Mode Toggle */}
          <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-full text-indigo-600 dark:text-indigo-300">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-indigo-900 dark:text-indigo-100">Anonymous Mode</h3>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">Hide your identity when booking appointments.</p>
              </div>
            </div>
            <button 
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`w-12 h-6 rounded-full transition-colors relative ${isAnonymous ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isAnonymous ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {counselors.map((counselor) => (
              <div key={counselor.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4 hover:border-orange-300 dark:hover:border-orange-800 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <img src={counselor.imageUrl} alt={counselor.name} className="w-14 h-14 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white">{counselor.name}</h3>
                      <p className="text-sm text-zinc-500">{counselor.specialty}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                    <Star size={12} className="fill-yellow-400 text-yellow-400" /> {counselor.rating}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-2">
                   <span className={`px-3 py-1 rounded-full text-xs font-medium ${counselor.available ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
                     {counselor.available ? 'Available Today' : 'Next Slot: Tomorrow'}
                   </span>
                </div>

                <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-200 transition-colors">
                    <Calendar size={16} /> Schedule
                  </button>
                  <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 transition-colors">
                    <MessageSquare size={16} /> Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'peer' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-2">Peer Support Circles</h2>
              <p className="text-indigo-100 max-w-lg mb-6">Join moderated group discussions led by trained student mentors. You are not alone in this journey.</p>
              <button className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors">Find a Circle</button>
            </div>
            <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4">
              <MessageSquare size={300} />
            </div>
          </div>

          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Active Communities</h3>
          <div className="space-y-4">
            {['Exam Stress Support', 'International Students', 'Mindfulness Beginners'].map((topic, i) => (
               <div key={i} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl">
                      {['📚', '🌍', '🧘‍♂️'][i]}
                    </div>
                    <div>
                       <h4 className="font-bold text-zinc-900 dark:text-white">{topic}</h4>
                       <p className="text-xs text-zinc-500">24 Online • Moderated by trained peers</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">Join</button>
               </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Connect;
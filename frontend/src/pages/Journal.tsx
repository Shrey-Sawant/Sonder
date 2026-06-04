import React, { useState, useEffect, useCallback } from 'react';
import Sentiment from 'sentiment';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Smile, Frown, Meh, Sparkles } from 'lucide-react';
import axios from 'axios';

const sentiment = new Sentiment();

interface JournalEntry {
  id: number;
  text: string;
  sentiment_score: number;
  sentiment_label: string;
  timestamp: string;
}

const Journal: React.FC = () => {
  const [content, setContent] = useState('');
  const [liveSentiment, setLiveSentiment] = useState<{ score: number, label: string }>({ score: 0, label: '😐' });
  const [history, setHistory] = useState<JournalEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Debounced sentiment analysis
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!content.trim()) {
        setLiveSentiment({ score: 0, label: '😐' });
        return;
      }
      
      const plainText = content.replace(/<[^>]+>/g, '');
      const result = sentiment.analyze(plainText);
      let label = '😐';
      if (result.score > 2) label = '😄';
      else if (result.score > 0) label = '🙂';
      else if (result.score < -2) label = '😔';
      else if (result.score < 0) label = '☹️';
      
      setLiveSentiment({ score: result.score, label });
    }, 500);

    return () => clearTimeout(handler);
  }, [content]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      // Adjust with actual API base url config
      const token = localStorage.getItem('access_token');
      const res = await axios.get('http://localhost:8000/api/v1/journal/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data.reverse()); // Chronological for chart
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.post('http://localhost:8000/api/v1/journal/entry', {
        text: content,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setContent('');
      fetchHistory();
    } catch (error) {
      console.error('Error saving entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const chartData = history.map(entry => ({
    date: new Date(entry.timestamp).toLocaleDateString(),
    score: entry.sentiment_score
  }));

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mood Journal</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Reflect on your day. We'll listen.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              New Entry
            </h2>
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Live Mood:</span>
              <span className="text-xl">{liveSentiment.label}</span>
            </div>
          </div>
          
          <div className="flex-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-shadow">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="How are you feeling right now? ..."
              className="w-full h-full min-h-[250px] p-4 bg-transparent text-zinc-900 dark:text-zinc-100 outline-none resize-y placeholder:text-zinc-400"
            />
          </div>
          
          <div className="flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl transition-all shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-[300px]">
            <h2 className="text-lg font-semibold mb-4">Past 30 Days</h2>
            {history.length > 0 ? (
              <div className="flex-1 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#8b5cf6" 
                      strokeWidth={3} 
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                No entries yet
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl p-6 border border-indigo-500/20 shadow-sm">
            <h3 className="font-semibold text-indigo-700 dark:text-indigo-400 mb-2">Why Journal?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Writing down your thoughts helps offload emotional weight. Our AI analyzes your sentiment privately, helping you track your emotional trends over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Journal;

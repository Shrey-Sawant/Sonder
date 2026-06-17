import React, { useState, useEffect } from 'react';
import { Heart, MessageSquare, ShieldCheck, Sparkles, RefreshCw, Calendar, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Story {
  story_id: string;
  author_anon_id: string;
  mood: string;
  excerpt: string;
  resonance_count: number;
  published_at: string;
}

const moodMeta: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  calm: { label: 'Calm', emoji: '🧘', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-300' },
  anxious: { label: 'Anxious', emoji: '😟', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300' },
  sad: { label: 'Sad', emoji: '😢', bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300' },
  frustrated: { label: 'Frustrated', emoji: '😤', bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-300' },
  hopeful: { label: 'Hopeful', emoji: '🌅', bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-300' },
  numb: { label: 'Numb', emoji: '😑', bg: 'bg-slate-100 dark:bg-slate-900/50', text: 'text-slate-700 dark:text-slate-300' },
  grateful: { label: 'Grateful', emoji: '🙏', bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-700 dark:text-purple-300' },
  overwhelmed: { label: 'Overwhelmed', emoji: '🤯', bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-700 dark:text-indigo-300' },
};

const StoryFeed: React.FC = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [resonatedIds, setResonatedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('resonated_stories');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/stories');
      setStories(res.data);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStories(true);
  };

  const handleResonate = async (storyId: string) => {
    if (resonatedIds.has(storyId)) return;
    
    // Optimistic UI update
    setStories(prev => prev.map(story => {
      if (story.story_id === storyId) {
        return { ...story, resonance_count: story.resonance_count + 1 };
      }
      return story;
    }));

    const newResonated = new Set(resonatedIds).add(storyId);
    setResonatedIds(newResonated);
    localStorage.setItem('resonated_stories', JSON.stringify(Array.from(newResonated)));

    try {
      await api.post(`/stories/${storyId}/resonate`);
    } catch (error) {
      console.error('Error resonating with story:', error);
      // Rollback on error
      setStories(prev => prev.map(story => {
        if (story.story_id === storyId) {
          return { ...story, resonance_count: story.resonance_count - 1 };
        }
        return story;
      }));
      const rolledBack = new Set(resonatedIds);
      rolledBack.delete(storyId);
      setResonatedIds(rolledBack);
      localStorage.setItem('resonated_stories', JSON.stringify(Array.from(rolledBack)));
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!window.confirm("Are you sure you want to remove your shared story from the community feed?")) return;
    try {
      await api.delete(`/stories/${storyId}`);
      setStories(prev => prev.filter(s => s.story_id !== storyId));
    } catch (error) {
      console.error('Error deleting story:', error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in text-zinc-900 dark:text-zinc-100 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">Community Stories</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Read snippets shared anonymously by peers. You are not alone.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50"
          title="Refresh Feed"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-[#fcfaff] dark:bg-zinc-900/50 border border-purple-100/50 dark:border-zinc-800/80 p-5 rounded-[24px] flex items-start gap-4">
        <div className="p-2.5 bg-purple-100 dark:bg-purple-950/40 rounded-xl text-purple-700 dark:text-purple-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-purple-950 dark:text-purple-300">Anonymity & Safety Policy</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            All excerpts are limited to 120 characters and go through automated language safety scanning prior to landing in the feed. No usernames or real identities are linked.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-[#ece9ff] dark:border-zinc-800 p-6 rounded-[28px] h-[200px] animate-pulse flex flex-col justify-between">
              <div className="flex gap-2">
                <div className="w-24 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                <div className="w-16 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              </div>
              <div className="w-full h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
              <div className="w-20 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            </div>
          ))}
        </div>
      ) : stories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stories.map((story) => {
            const meta = moodMeta[story.mood] || { label: story.mood, emoji: '📝', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' };
            const isOwnStory = user?.anon_id === story.author_anon_id;
            const hasResonated = resonatedIds.has(story.story_id);

            return (
              <div
                key={story.story_id}
                className="group bg-white dark:bg-zinc-900 border border-[#ece9ff] dark:border-zinc-800/80 rounded-[28px] p-6 shadow-[0_15px_40px_rgba(15,23,42,0.03)] hover:shadow-xl hover:shadow-[#7c3aed]/5 hover:border-purple-200/50 dark:hover:border-purple-900/30 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                        {story.author_anon_id}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.text}`}>
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    {isOwnStory && (
                      <button
                        onClick={() => handleDeleteStory(story.story_id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Delete shared story"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Excerpt */}
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap italic">
                    "{story.excerpt}..."
                  </p>
                </div>

                {/* Footer Controls */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/80 mt-6 pt-4 flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(story.published_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>

                  <button
                    onClick={() => handleResonate(story.story_id)}
                    disabled={hasResonated}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all select-none ${
                      hasResonated
                        ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 cursor-default'
                        : 'bg-zinc-50 hover:bg-purple-50 hover:text-purple-600 dark:bg-zinc-950 dark:hover:bg-purple-950/20 text-zinc-500 transition-colors'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${hasResonated ? 'fill-purple-600 stroke-purple-600' : ''}`} />
                    <span>I felt this too ({story.resonance_count})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-[#ece9ff] dark:border-zinc-800/80 p-16 rounded-[32px] text-center text-zinc-400">
          <p className="text-base">No stories shared in the last 30 days. Be the first to share one!</p>
        </div>
      )}
    </div>
  );
};

export default StoryFeed;

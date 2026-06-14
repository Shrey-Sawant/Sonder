import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertTriangle } from 'lucide-react';
import { Message } from '../../types';
import api from '../services/api';
import FriendlyCompanion from '../components/FriendlyCompanion';

const Companion: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: "Hi there. I'm Sonder. I'm here to listen, support, and help you navigate whatever is on your mind. This is a safe, private space. How are you feeling right now?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Use real backend API
      const response = await api.post('/chatbot/chat', { message: input });
      // Assuming response.data is the AI text directly or object
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = { id: Date.now().toString(), role: 'model', text: "Sorry, I'm having trouble connecting right now.", timestamp: new Date() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] flex flex-col rounded-[32px] bg-[#fbfbfe] border border-[#e5e7ff] overflow-hidden shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
      {/* Chat Header */}
      <div className="p-4 bg-white/90 backdrop-blur-xl flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[24px] bg-gradient-to-tr from-[#ede9fe] to-[#dbeafe] flex items-center justify-center shadow-sm">
            <Sparkles size={20} className="text-[#4f46e5]" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900 text-xl">Sonder AI</h2>
            <p className="text-xs text-zinc-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Online & Listening
            </p>
          </div>
        </div>
        <FriendlyCompanion className="w-20 h-20 hidden md:flex" />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#f8f6ff]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user'
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-tr-none'
                  : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-tl-none shadow-sm'
                }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-pulse">
            <div className="flex gap-3 max-w-[70%]">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                <Bot size={16} />
              </div>
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 rounded-2xl rounded-tl-none">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white rounded-b-[32px] shadow-inner border-t border-[#e5e7ff]">
        <div className="relative max-w-4xl mx-auto flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share what's on your mind..."
            className="w-full bg-white border border-[#e5e7ff] text-zinc-900 placeholder-zinc-400 rounded-[24px] pl-5 pr-16 py-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] h-[56px] max-h-32"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-3 bg-gradient-to-r from-[#c7d2fe] to-[#fbcfe8] text-zinc-950 rounded-[18px] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-400 mt-3">
          Sonder is an AI assistant and can make mistakes. Always consult a professional for medical advice.
        </p>
      </div>
    </div>
  );
};

export default Companion;
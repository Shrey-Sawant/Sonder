import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Calendar, Clock, Check, X, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface Appointment {
  id: number;
  student_id: number;
  student_name: string;
  scheduled_time: string;
  status: 'pending' | 'accepted' | 'rejected' | 'declined';
  video_meeting_url?: string;
}

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterToday, setFilterToday] = useState(true);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/schedule/');
      setAppointments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleUpdateStatus = async (id: number, newStatus: 'accepted' | 'rejected') => {
    const original = [...appointments];
    // Optimistic UI update
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));

    try {
      await api.put(`/schedule/${id}?status=${newStatus}`);
    } catch (err) {
      console.error(err);
      setAppointments(original); // Rollback
      alert('Failed to update status. Please try again.');
    }
  };

  // Filter today's appointments
  const isToday = (timeStr: string) => {
    const apptDate = new Date(timeStr).toDateString();
    const today = new Date().toDateString();
    return apptDate === today;
  };

  const filteredAppointments = filterToday 
    ? appointments.filter(a => isToday(a.scheduled_time)) 
    : appointments;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Appointments</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Review and manage clinical booking requests from students.</p>
        </div>

        {/* Filter Toggle */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setFilterToday(true)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              filterToday 
                ? 'bg-white dark:bg-zinc-700 shadow text-indigo-600 dark:text-indigo-400' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Today's Sessions
          </button>
          <button
            onClick={() => setFilterToday(false)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              !filterToday 
                ? 'bg-white dark:bg-zinc-700 shadow text-indigo-600 dark:text-indigo-400' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            All Requests
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 p-12 text-center rounded-[2rem] border border-zinc-200 dark:border-zinc-800 text-zinc-400 shadow-sm max-w-2xl mx-auto">
          <Calendar size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
          <h3 className="font-bold text-zinc-800 dark:text-zinc-200">No scheduled sessions found</h3>
          <p className="text-sm mt-1">There are no {filterToday ? "sessions scheduled for today" : "pending or previous requests"}.</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {filteredAppointments.map((appt) => (
            <div 
              key={appt.id} 
              className="bg-white dark:bg-zinc-900 p-5 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center gap-4 w-full">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                  <User size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-zinc-900 dark:text-white leading-tight">
                    Student: {appt.student_name || `User ID ${appt.student_id}`}
                  </h3>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-zinc-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {new Date(appt.scheduled_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {new Date(appt.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {appt.status === 'pending' ? (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleUpdateStatus(appt.id, 'accepted')}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} /> Accept
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(appt.id, 'rejected')}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-zinc-100 hover:bg-red-50 hover:text-red-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/80 rounded-xl text-xs font-bold transition-all"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    appt.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' :
                    'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  }`}>
                    {appt.status}
                  </span>
                )}
              {appt.status === 'accepted' && appt.video_meeting_url && (
                <a
                  href={appt.video_meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 px-4 py-2 text-xs font-semibold transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                >
                  Join Video Call
                </a>
              )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Appointments;

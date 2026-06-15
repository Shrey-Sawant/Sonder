import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Calendar, Clock, Check, X, User } from 'lucide-react';

interface Appointment {
  id: string;
  student_name: string;
  scheduled_time: string;
  status: 'pending' | 'accepted' | 'declined';
  video_meeting_url?: string;
}

const CounsellorAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const fetchAppointments = async () => {
      const res = await api.get('/schedule/');
      setAppointments(res.data);
    };
    fetchAppointments();
  }, []);

  const formatDate = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatus = async (id: string, status: 'accepted' | 'declined') => {
    try {
      await api.put(`/schedule/${id}?status=${status}`);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold mb-4">Upcoming Requests</h2>
      {appointments.length === 0 && <p className="text-zinc-500 text-sm">No bookings found.</p>}
      
      {appointments.map((appt) => (
        <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 rounded-3xl flex flex-col gap-5 md:gap-0 md:flex-row items-start md:items-center justify-between group hover:shadow-2xl transition duration-300 ease-out animate-fade-soft">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-200 transition-transform duration-300 group-hover:scale-105">
              <User size={22} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white text-lg">{appt.student_name}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500 font-medium">
                <span className="flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1">
                  <Calendar size={12}/> {formatDate(appt.scheduled_time)}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1">
                  <Clock size={12}/> {formatTime(appt.scheduled_time)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              {appt.status === 'pending' ? (
                <>
                  <button onClick={() => handleStatus(appt.id, 'accepted')} className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition transform hover:-translate-y-0.5 shadow-sm">
                    <Check size={18}/>
                  </button>
                  <button onClick={() => handleStatus(appt.id, 'declined')} className="p-3 bg-rose-50 text-rose-700 rounded-2xl hover:bg-rose-100 transition transform hover:-translate-y-0.5 shadow-sm">
                    <X size={18}/>
                  </button>
                </>
              ) : (
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${appt.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                  {appt.status}
                </span>
              )}
            </div>
            {appt.status === 'accepted' && appt.video_meeting_url && (
              <a
                href={appt.video_meeting_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 px-4 py-3 text-sm font-semibold transition duration-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900"
              >
                Join Video Call
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CounsellorAppointments;
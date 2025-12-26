import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Calendar, Clock, Check, X, User } from 'lucide-react';

interface Appointment {
  id: string;
  student_name: string;
  scheduled_at: string;
  status: 'pending' | 'accepted' | 'declined';
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

  const handleStatus = async (id: string, status: 'accepted' | 'declined') => {
    try {
      await api.patch(`/schedule/${id}`, { status });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold mb-4">Upcoming Requests</h2>
      {appointments.length === 0 && <p className="text-zinc-500 text-sm">No bookings found.</p>}
      
      {appointments.map((appt) => (
        <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 rounded-3xl flex items-center justify-between group hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white">{appt.student_name}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-medium">
                <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(appt.scheduled_at).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Clock size={12}/> {new Date(appt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {appt.status === 'pending' ? (
              <>
                <button onClick={() => handleStatus(appt.id, 'accepted')} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100"><Check size={20}/></button>
                <button onClick={() => handleStatus(appt.id, 'declined')} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><X size={20}/></button>
              </>
            ) : (
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${appt.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {appt.status}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CounsellorAppointments;
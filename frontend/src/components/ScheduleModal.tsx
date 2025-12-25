import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext'; 

interface ScheduleModalProps {
  counselor: { id: string; name: string };
  onClose: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ counselor, onClose }) => {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const masterSlots = [
    "09:00", "10:00", "11:00", "12:00", 
    "13:00", "14:00", "15:00", "16:00", "17:00"
  ];

  // 1. Fetch busy slots
  useEffect(() => {
    const getAvailableSlots = async () => {
      if (!date) return;
      
      try {
        setFetchingSlots(true);
        const res = await api.get('/schedule/busy-slots', {
          params: { 
            counsellor_id: counselor.id, 
            selected_date: date 
          }
        });
        
        const busySlots: string[] = res.data; 
        const free = masterSlots.filter(slot => !busySlots.includes(slot));
        setAvailableSlots(free);
      } catch (err) {
        console.error("Failed to fetch slots", err);
        setAvailableSlots(masterSlots);
      } finally {
        setFetchingSlots(false);
      }
    };

    getAvailableSlots();
  }, [date, counselor.id]);

  // 2. Handle Scheduling
  const handleSchedule = async () => {
    if (!date || !time || !user) return;
    try {
      setLoading(true);
      
      await api.post('/schedule/', {
        student_id: user.id,
        counsellor_id: parseInt(counselor.id),
        scheduled_time: `${date}T${time}:00`, 
        status: "pending"
      });

      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      console.error("Scheduling failed", err);
      const errorMessage = err.response?.data?.detail || "Could not confirm booking. Please try again.";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800 animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Schedule with {counselor.name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 mx-auto rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <p className="font-bold text-lg text-zinc-900 dark:text-white">Booking Requested!</p>
            <p className="text-sm text-zinc-500">The counselor will review your request.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase ml-1">1. Choose Date</label>
              <input 
                type="date" 
                // Prevents selecting past dates
                min={new Date().toISOString().split('T')[0]}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime(''); 
                }}
                className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase ml-1">2. Available Slots</label>
              <div className="relative mt-1.5">
                <select 
                  disabled={!date || fetchingSlots}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none disabled:opacity-50 dark:text-white"
                >
                  <option value="" disabled>
                    {fetchingSlots ? "Checking availability..." : "Select a time"}
                  </option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot} {parseInt(slot) < 12 ? 'AM' : 'PM'}
                    </option>
                  ))}
                </select>
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
              </div>
              {availableSlots.length === 0 && date && !fetchingSlots && (
                <p className="text-[10px] text-red-500 mt-2 flex items-center gap-1 font-medium">
                  <AlertCircle size={12} /> This day is fully booked.
                </p>
              )}
            </div>

            <button 
              disabled={!date || !time || loading || fetchingSlots}
              onClick={handleSchedule}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Calendar size={18} />}
              Confirm Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleModal;
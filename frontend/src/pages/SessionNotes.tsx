import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Calendar, FileText, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface Note {
  id: string;
  studentId: number;
  studentName: string;
  text: string;
  date: string;
}

const SessionNotes: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/users/my-students');
      setStudents(res.data);
      if (res.data.length > 0) {
        setSelectedStudentId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notes');
      setNotes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchNotes();
  }, []);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !selectedStudentId) return;

    try {
      await api.post('/notes/', {
        student_id: selectedStudentId,
        text: noteText
      });
      setNoteText('');
      fetchNotes();
    } catch (err) {
      console.error(err);
      alert('Failed to save session notes.');
    }
  };

  const handleDeleteNote = async (id: number) => {
    try {
      await api.delete(`/notes/${id}`);
      fetchNotes();
    } catch (err) {
      console.error(err);
      alert('Failed to delete session note.');
    }
  };

  const filteredNotes = notes.filter(n => n.student_id === selectedStudentId);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Session Notes</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Document clinician records and student wellness progress privately.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Note Creator Form */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-5">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-indigo-500 w-5 h-5" /> Write New Log
          </h2>

          <form onSubmit={handleAddNote} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Select Student</label>
              <select
                value={selectedStudentId || ''}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500/20"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.username}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Clinical Notes</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Log observation summaries, therapeutic intervention tools applied, and next session agendas here..."
                rows={6}
                className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500/20 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Plus size={16} /> Save Notes
            </button>
          </form>
        </div>

        {/* Note Roster History */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-[520px]">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
            History Log for {students.find(s => s.id === selectedStudentId)?.username || 'Student'}
          </h2>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {loading ? (
              <div className="text-zinc-400 dark:text-zinc-600 text-center py-20 text-xs">
                Loading logs...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-zinc-400 dark:text-zinc-600 text-center py-20 text-xs">
                No logs recorded for this student.
              </div>
            ) : (
              filteredNotes.map(n => (
                <div key={n.id} className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 relative group">
                  <div className="flex justify-between items-center mb-2 text-[10px] text-zinc-400 font-semibold uppercase">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} /> {new Date(n.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDeleteNote(n.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-light whitespace-pre-wrap">
                    {n.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionNotes;

import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Calendar, FileText, ChevronRight } from 'lucide-react';

interface Note {
  id: string;
  studentId: number;
  studentName: string;
  text: string;
  date: string;
}

const SessionNotes: React.FC = () => {
  const [students] = useState([
    { id: 11, name: 'Alice Johnson' },
    { id: 12, name: 'Bob Smith' },
    { id: 13, name: 'Chloe Bennett' },
    { id: 14, name: 'David Lee' },
    { id: 15, name: 'Emma Watson' }
  ]);

  const [selectedStudentId, setSelectedStudentId] = useState<number>(11);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('counsellor_session_notes');
    return saved ? JSON.parse(saved) : [
      { id: '1', studentId: 11, studentName: 'Alice Johnson', text: 'Reviewed box breathing exercises. Student reports high academic pressure and sleep latency issues. Advised reduced caffeine intake after 4 PM.', date: '2026-06-08' },
      { id: '2', studentId: 12, studentName: 'Bob Smith', text: 'Student showed moderate anxiety indicators. Discussed scheduling structures for final exam preps to counter procrastination triggers.', date: '2026-06-07' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('counsellor_session_notes', JSON.stringify(notes));
  }, [notes]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const studentObj = students.find(s => s.id === selectedStudentId);
    if (!studentObj) return;

    const newNote: Note = {
      id: Date.now().toString(),
      studentId: selectedStudentId,
      studentName: studentObj.name,
      text: noteText,
      date: new Date().toISOString().split('T')[0]
    };

    setNotes([newNote, ...notes]);
    setNoteText('');
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const filteredNotes = notes.filter(n => n.studentId === selectedStudentId);

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
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="w-full mt-1.5 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500/20"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
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
            History Log for {students.find(s => s.id === selectedStudentId)?.name}
          </h2>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {filteredNotes.length === 0 ? (
              <div className="text-zinc-400 dark:text-zinc-600 text-center py-20 text-xs">
                No logs recorded for this student.
              </div>
            ) : (
              filteredNotes.map(n => (
                <div key={n.id} className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 relative group">
                  <div className="flex justify-between items-center mb-2 text-[10px] text-zinc-400 font-semibold uppercase">
                    <span className="flex items-center gap-1"><Calendar size={10} /> {n.date}</span>
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

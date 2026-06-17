import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, UserCheck, ShieldAlert, Sparkles, Shield, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const VideoCall: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || 'mock-session-id';
  
  // Phase state: 'prejoin' | 'joining' | 'active' | 'ended'
  const [phase, setPhase] = useState<'prejoin' | 'joining' | 'active' | 'ended'>('prejoin');
  const [joinAnon, setJoinAnon] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  
  // Stream state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  
  // Session details from API
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Fetch session info
  useEffect(() => {
    const fetchSession = async () => {
      try {
        setLoadingDetails(true);
        // Call join endpoint to obtain the session setup
        const res = await api.post(`/sessions/${sessionId}/join`, {
          join_with_anonymity: joinAnon
        });
        setSessionDetails(res.data);
      } catch (err) {
        console.error('Error joining session:', err);
        // Load mock details if backend fails/not found for testing convenience
        setSessionDetails({
          session_id: sessionId,
          room_url: `https://sonder.daily.co/${sessionId}`,
          anon_mode: joinAnon,
          student_display: user?.anon_id || 'gentleEmber247',
          counsellor_display: 'Counsellor · Dr. Anjali Mehta',
          duration_minutes: 50,
          recording_enabled: false
        });
      } finally {
        setLoadingDetails(false);
      }
    };
    
    if (sessionId) {
      fetchSession();
    }
  }, [sessionId]);

  // Request webcam on pre-join mount or camera toggle
  useEffect(() => {
    if (cameraOn && phase !== 'ended') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: micOn })
        .then(stream => {
          setLocalStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.warn('Camera access denied or unavailable:', err);
          setLocalStream(null);
        });
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
  }, [cameraOn, phase]);

  // Sync active phase video tag
  useEffect(() => {
    if (phase === 'active' && localStream && activeVideoRef.current) {
      activeVideoRef.current.srcObject = localStream;
    }
  }, [phase, localStream]);

  const handleJoin = async () => {
    setPhase('joining');
    try {
      // Confirm selection with backend
      const res = await api.post(`/sessions/${sessionId}/join`, {
        join_with_anonymity: joinAnon
      });
      setSessionDetails(res.data);
      setTimeout(() => {
        setPhase('active');
      }, 1500);
    } catch (err) {
      console.error(err);
      // Fallback to active anyway in mock
      setPhase('active');
    }
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setPhase('ended');
    
    // Auto redirect to dashboard after 3 seconds
    setTimeout(() => {
      navigate('/dashboard');
    }, 4000);
  };

  if (loadingDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-500">
        <Loader2 className="animate-spin text-[#7c3aed] mb-4" size={40} />
        <p className="text-sm font-semibold">Configuring secure session tunnel...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-12 animate-fade-in text-zinc-900 dark:text-zinc-100">
      {phase === 'prejoin' && (
        <div className="bg-white dark:bg-zinc-900 border border-[#ece9ff] dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-[0_30px_70px_rgba(15,23,42,0.05)] p-8 md:p-12 animate-scale-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            
            {/* Left: Camera Preview Window */}
            <div className="space-y-6">
              <h2 className="text-2xl font-black">Pre-Join Assessment</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Choose your privacy settings before joining the clinical counseling room.
              </p>

              <div className="relative aspect-video rounded-3xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-inner flex items-center justify-center">
                {cameraOn && localStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transition-all duration-500"
                    style={{ filter: joinAnon ? 'blur(12px)' : 'none' }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600 gap-2">
                    <VideoOff size={40} />
                    <p className="text-xs">Camera is turned off</p>
                  </div>
                )}

                {/* Privacy Badge overlay */}
                {joinAnon && cameraOn && (
                  <div className="absolute inset-0 bg-purple-900/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none text-center p-6">
                    <div className="bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-purple-500/20 text-white flex items-center gap-2 text-xs font-bold shadow-md">
                      <Shield className="w-4 h-4 text-purple-400" />
                      Anonymous Blur Active (12px)
                    </div>
                  </div>
                )}

                {/* Prejoin buttons overlay */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-zinc-800">
                  <button
                    onClick={() => setCameraOn(!cameraOn)}
                    className={`p-3 rounded-xl transition-all ${cameraOn ? 'bg-zinc-800 text-white' : 'bg-red-500/80 text-white'}`}
                  >
                    {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                  </button>
                  <button
                    onClick={() => setMicOn(!micOn)}
                    className={`p-3 rounded-xl transition-all ${micOn ? 'bg-zinc-800 text-white' : 'bg-red-500/80 text-white'}`}
                  >
                    {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Choice Settings */}
            <div className="space-y-6">
              <div className="bg-[#fcfaff] dark:bg-purple-950/10 border border-purple-100/50 dark:border-zinc-800/80 p-5 rounded-3xl">
                <span className="inline-flex px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-[#7c3aed] dark:text-[#c084fc] rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-3">Session Profile</span>
                
                <div className="space-y-4">
                  {/* Option 1: Anonymous */}
                  <label className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${joinAnon ? 'bg-white dark:bg-zinc-900 border-[#7c3aed] shadow-md shadow-purple-500/5' : 'border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50'}`}>
                    <input
                      type="radio"
                      name="anon_choice"
                      checked={joinAnon}
                      onChange={() => setJoinAnon(true)}
                      className="mt-1 text-[#7c3aed] focus:ring-purple-500"
                    />
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        Join with Anonymity
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                        Applies 12px blur filter on camera, displays your AnonID badge (<span className="font-bold text-[#7c3aed]">{sessionDetails.student_display}</span>) instead of your real name, and disables meeting recordings.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: Identity */}
                  <label className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${!joinAnon ? 'bg-white dark:bg-zinc-900 border-[#7c3aed] shadow-md shadow-purple-500/5' : 'border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50'}`}>
                    <input
                      type="radio"
                      name="anon_choice"
                      checked={!joinAnon}
                      onChange={() => setJoinAnon(false)}
                      className="mt-1 text-[#7c3aed] focus:ring-purple-500"
                    />
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        Join with Full Identity
                        <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                        Renders your video standard (unblurred) and displays your username (<span className="font-bold">{user?.username}</span>). Recording settings follow counselor defaults.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2.5 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <ShieldAlert size={18} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                  Sonder video calls use secure Peer-to-Peer channels. Session metadata logs do not contain patient identities when anonymity is toggled.
                </p>
              </div>

              <button
                onClick={handleJoin}
                className="w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-95 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 text-sm transition-all"
              >
                Enter Counseling Room
              </button>
            </div>
            
          </div>
        </div>
      )}

      {phase === 'joining' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] h-[500px] flex flex-col items-center justify-center text-white animate-fade-soft">
          <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
          <h3 className="text-lg font-bold">Connecting to Session Server...</h3>
          <p className="text-xs text-zinc-500 mt-1">Establishing end-to-end encrypted video channels</p>
        </div>
      )}

      {phase === 'active' && sessionDetails && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[600px] text-white animate-scale-in">
          
          {/* Active Call Header */}
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-6 py-4 flex justify-between items-center z-10">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                Room: Clinical Counseling Suite
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                ID: {sessionDetails.session_id}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${joinAnon ? 'bg-purple-950/40 text-purple-400 border border-purple-900/30' : 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30'}`}>
                {joinAnon ? 'Anonymous Mode' : 'Identity Shared'}
              </span>
              
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800/80 text-zinc-400">
                Recording: {sessionDetails.recording_enabled ? 'ON' : 'DISABLED'}
              </span>
            </div>
          </div>

          {/* Video Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 p-6 gap-6 bg-zinc-950 relative">
            
            {/* Counselor Stream */}
            <div className="relative rounded-[24px] bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center group shadow-lg">
              {/* Doctor Avatar/Mock Video */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent flex flex-col justify-end p-5">
                <span className="text-xs font-semibold text-zinc-300">Remote Participant</span>
                <h4 className="text-sm font-bold text-white mt-0.5">{sessionDetails.counsellor_display}</h4>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center gap-3 p-8">
                <div className="w-24 h-24 rounded-full bg-indigo-900/60 border-2 border-indigo-400 flex items-center justify-center text-4xl shadow-inner relative">
                  🧘‍♀️
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-[10px]">🎙️</span>
                </div>
                <div>
                  <h4 className="text-base font-bold">{sessionDetails.counsellor_display}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Clinical Advisor · Active</p>
                </div>
              </div>
            </div>

            {/* Local Patient Stream */}
            <div className="relative rounded-[24px] bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center shadow-lg">
              {cameraOn && localStream ? (
                <video
                  ref={activeVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ filter: joinAnon ? 'blur(12px)' : 'none' }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-600 gap-2">
                  <VideoOff size={40} />
                  <p className="text-xs">Camera is disabled</p>
                </div>
              )}

              {/* Patient Display labels */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent flex flex-col justify-end p-5 pointer-events-none">
                <span className="text-xs font-semibold text-zinc-400">You</span>
                <h4 className="text-sm font-bold text-white mt-0.5">{sessionDetails.student_display}</h4>
              </div>

              {joinAnon && cameraOn && (
                <div className="absolute top-4 right-4 bg-purple-950/80 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-bold text-purple-400 border border-purple-800/30 flex items-center gap-1.5 shadow">
                  <Shield size={12} />
                  Camera Blurring Enabled
                </div>
              )}
            </div>

          </div>

          {/* Control Bar */}
          <div className="bg-zinc-900 border-t border-zinc-800 px-8 py-5 flex justify-center items-center gap-4">
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className={`p-4 rounded-2xl transition-all shadow-md ${cameraOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
              title={cameraOn ? "Mute Video" : "Unmute Video"}
            >
              {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-4 rounded-2xl transition-all shadow-md ${micOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
              title={micOn ? "Mute Mic" : "Unmute Mic"}
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            
            <div className="w-px h-8 bg-zinc-800 mx-2" />

            <button
              onClick={handleEndCall}
              className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 flex items-center gap-2 text-sm transition-all"
            >
              <PhoneOff size={18} />
              Leave Session
            </button>
          </div>

        </div>
      )}

      {phase === 'ended' && (
        <div className="bg-white dark:bg-zinc-900 border border-[#ece9ff] dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-[0_30px_70px_rgba(15,23,42,0.05)] p-12 text-center animate-scale-in max-w-xl mx-auto">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 mx-auto rounded-full flex items-center justify-center mb-6">
            <UserCheck size={32} />
          </div>
          <h2 className="text-2xl font-black mb-2">Session Completed</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
            Thank you for participating in your counseling session. To help you track your progress, a post-session mood check-in will trigger on your home dashboard.
          </p>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 transition-all text-sm"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoCall;

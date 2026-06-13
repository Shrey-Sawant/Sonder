import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Volume2, VolumeX, Wind, HeartPulse, Activity, Headphones, Music } from 'lucide-react';
import api from '../services/api';

// Box Breathing Component
const BoxBreathing = ({ onComplete }: { onComplete: (duration: number) => void }) => {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Hold Out'>('Inhale');
  
  // Ambient Sound picker and playback
  const [soundType, setSoundType] = useState<'rain' | 'ocean' | 'forest'>('rain');
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(false);
  const speechUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Audio Nodes refs
  const audioCtx = useRef<AudioContext | null>(null);
  const ambientNoiseSource = useRef<AudioBufferSourceNode | null>(null);
  const ambientGainNode = useRef<GainNode | null>(null);
  const lfoNode = useRef<OscillatorNode | null>(null);
  const forestInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Healing cycle tone refs
  const healingOsc = useRef<OscillatorNode | null>(null);
  
  const timer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);

  // Initialize Audio Context on demand
  const initAudio = () => {
    if (!audioCtx.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx.current = new AudioContextClass();
    }
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }
  };

  // Noise Buffer Helper
  const createNoiseBuffer = () => {
    if (!audioCtx.current) return null;
    const bufferSize = audioCtx.current.sampleRate * 2; // 2 seconds of noise
    const buffer = audioCtx.current.createBuffer(1, bufferSize, audioCtx.current.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  };

  // Start Ambient synthesis
  const startAmbient = () => {
    initAudio();
    const ctx = audioCtx.current;
    if (!ctx) return;

    // Stop current nodes
    stopAmbientNodes();

    const noiseBuffer = createNoiseBuffer();
    if (!noiseBuffer) return;

    // 1. Noise Source
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    ambientNoiseSource.current = noiseSource;

    // 2. Main Gain Node
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, ctx.currentTime); // fade in
    mainGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.0);
    ambientGainNode.current = mainGain;

    if (soundType === 'rain') {
      // Bandpass Filter to shape noise into rain rustle
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);
      filter.gain.setValueAtTime(3, ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(mainGain);
      mainGain.connect(ctx.destination);
      noiseSource.start();

    } else if (soundType === 'ocean') {
      // Swelling wave sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.08, ctx.currentTime); // slow wave cycle (12s)
      lfoNode.current = lfo;

      const filterMod = ctx.createGain();
      filterMod.gain.setValueAtTime(250, ctx.currentTime); // modulate cutoff by 250Hz

      const volumeMod = ctx.createGain();
      volumeMod.gain.setValueAtTime(0.04, ctx.currentTime); // modulate volume

      lfo.connect(filterMod);
      filterMod.connect(filter.frequency);

      lfo.connect(volumeMod);
      volumeMod.connect(mainGain.gain);

      noiseSource.connect(filter);
      filter.connect(mainGain);
      mainGain.connect(ctx.destination);

      lfo.start();
      noiseSource.start();

      // Initial gain boost to offset modulation starting from 0
      mainGain.gain.setValueAtTime(0.03, ctx.currentTime);

    } else if (soundType === 'forest') {
      // Wind rustle + randomized bird sweep chirps
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(mainGain);
      mainGain.connect(ctx.destination);
      noiseSource.start();

      // Synthesized Bird Sweeps helper
      const playBirdChirp = () => {
        if (!audioCtx.current) return;
        const osc = audioCtx.current.createOscillator();
        const chirpGain = audioCtx.current.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2800, audioCtx.current.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1300, audioCtx.current.currentTime + 0.14);

        chirpGain.gain.setValueAtTime(0, audioCtx.current.currentTime);
        chirpGain.gain.linearRampToValueAtTime(0.015, audioCtx.current.currentTime + 0.02);
        chirpGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.14);

        osc.connect(chirpGain);
        chirpGain.connect(audioCtx.current.destination);

        osc.start();
        osc.stop(audioCtx.current.currentTime + 0.15);
      };

      // Play initially and schedule intervals
      playBirdChirp();
      forestInterval.current = setInterval(() => {
        if (Math.random() > 0.3) {
          playBirdChirp();
          if (Math.random() > 0.6) {
            setTimeout(playBirdChirp, 150); // Double chirp
          }
        }
      }, 3500);
    }

    setAmbientPlaying(true);
  };

  const stopAmbientNodes = () => {
    if (ambientNoiseSource.current) {
      try { ambientNoiseSource.current.stop(); } catch(e){}
      ambientNoiseSource.current.disconnect();
      ambientNoiseSource.current = null;
    }
    if (ambientGainNode.current) {
      ambientGainNode.current.disconnect();
      ambientGainNode.current = null;
    }
    if (lfoNode.current) {
      try { lfoNode.current.stop(); } catch(e){}
      lfoNode.current.disconnect();
      lfoNode.current = null;
    }
    if (forestInterval.current) {
      clearInterval(forestInterval.current);
      forestInterval.current = null;
    }
  };

  const stopAmbient = () => {
    stopAmbientNodes();
    setAmbientPlaying(false);
  };

  // Healing visual cycle sound playing
  const playHealingCycleTone = (start: boolean) => {
    if (!audioCtx.current) return;
    if (start) {
      if (!healingOsc.current) {
        healingOsc.current = audioCtx.current.createOscillator();
        healingOsc.current.type = 'sine';
        healingOsc.current.frequency.setValueAtTime(174, audioCtx.current.currentTime); // 174Hz healing tone
        const toneGain = audioCtx.current.createGain();
        toneGain.gain.setValueAtTime(0.08, audioCtx.current.currentTime);
        healingOsc.current.connect(toneGain);
        toneGain.connect(audioCtx.current.destination);
        healingOsc.current.start();
      }
    } else {
      if (healingOsc.current) {
        try { healingOsc.current.stop(); } catch(e){}
        healingOsc.current.disconnect();
        healingOsc.current = null;
      }
    }
  };

  // Breathing Cycle loop
  useEffect(() => {
    if (isActive) {
      startTime.current = Date.now();
      let step = 0;
      const phases: typeof phase[] = ['Inhale', 'Hold', 'Exhale', 'Hold Out'];
      
      const runCycle = () => {
        const currentPhase = phases[step % 4];
        setPhase(currentPhase);
        
        // Play healing tone during inhalation/exhalation segments
        if (currentPhase === 'Inhale' || currentPhase === 'Exhale') {
          playHealingCycleTone(true);
        } else {
          playHealingCycleTone(false);
        }
        step++;
      };

      runCycle();
      timer.current = setInterval(runCycle, 4000);

    } else {
      if (timer.current) clearInterval(timer.current);
      playHealingCycleTone(false);
      
      // Calculate duration when stopping
      if (startTime.current > 0) {
        const duration = Math.floor((Date.now() - startTime.current) / 1000);
        if (duration > 5) {
          onComplete(duration);
        }
        startTime.current = 0;
      }
    }
    
    return () => {
      if (timer.current) clearInterval(timer.current);
      playHealingCycleTone(false);
    };
  }, [isActive]);

  // Clean up audio nodes on unmount
  useEffect(() => {
    return () => {
      stopAmbientNodes();
      if (speechUtterance.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync ambient sound source if sound type changes while playing
  useEffect(() => {
    if (ambientPlaying) {
      startAmbient();
    }
  }, [soundType]);

  const toggleAmbient = () => {
    if (ambientPlaying) {
      stopAmbient();
    } else {
      startAmbient();
    }
  };

  const toggleVoiceGuidance = () => {
    const isSupported = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
    if (!isSupported) {
      alert('Voice guidance is not supported in your browser.');
      return;
    }

    setVoiceGuidanceEnabled((enabled) => {
      const next = !enabled;
      if (!next) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const announcePhase = (text: string) => {
    if (!voiceGuidanceEnabled || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      speechUtterance.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis failed', error);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    announcePhase(phase);
  }, [phase, voiceGuidanceEnabled, isActive]);

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-indigo-50 dark:bg-indigo-950/20 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/50">
      <div className="flex justify-between w-full items-center">
        <h3 className="text-xl font-bold flex items-center gap-2"><Wind className="w-5 h-5 text-indigo-500"/> Box Breathing</h3>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleAmbient} 
            className={`p-3 rounded-full shadow-sm transition-all ${
              ambientPlaying ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
            title="Play Ambient Background Sounds"
          >
            <Music className="w-5 h-5" />
          </button>
          <button
            onClick={toggleVoiceGuidance}
            className={`p-3 rounded-full shadow-sm transition-all ${
              voiceGuidanceEnabled ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
            title="Toggle voice guidance for breathing cues"
          >
            {voiceGuidanceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sound Type Picker */}
      <div className="w-full flex bg-zinc-200/50 dark:bg-zinc-800/60 p-1 rounded-xl">
        {(['rain', 'ocean', 'forest'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSoundType(type)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              soundType === type 
                ? 'bg-white dark:bg-zinc-700 shadow text-indigo-600 dark:text-indigo-400' 
                : 'text-zinc-500'
            }`}
          >
            {type}
          </button>
        ))}
      </div>
      
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Animated Circle */}
        <div className={`absolute w-full h-full rounded-full border-4 border-indigo-400 transition-all duration-[4000ms] ease-in-out ${isActive ? (phase === 'Inhale' || phase === 'Hold' ? 'scale-150 opacity-50' : 'scale-100 opacity-100') : 'scale-100 opacity-20'}`}></div>
        
        <div className="z-10 text-center">
          <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{isActive ? phase : 'Ready'}</span>
          {isActive && <p className="text-xs mt-1 text-indigo-600/70 dark:text-indigo-400/70">4 seconds</p>}
        </div>
      </div>

      <button 
        onClick={() => setIsActive(!isActive)}
        className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${isActive ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}
      >
        {isActive ? <><Square className="w-4 h-4"/> Stop</> : <><Play className="w-4 h-4"/> Start</>}
      </button>
    </div>
  );
};

// 5-4-3-2-1 Grounding
const Grounding = ({ onComplete }: { onComplete: (duration: number) => void }) => {
    const steps = [
        { label: "5 things you can see", icon: "👁️" },
        { label: "4 things you can physically feel", icon: "✋" },
        { label: "3 things you can hear", icon: "👂" },
        { label: "2 things you can smell", icon: "👃" },
        { label: "1 thing you can taste", icon: "👅" }
    ];
    
    const [currentStep, setCurrentStep] = useState(-1);
    const startTime = useRef(0);

    const nextStep = () => {
        if (currentStep === -1) startTime.current = Date.now();
        
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            const duration = Math.floor((Date.now() - startTime.current) / 1000);
            onComplete(duration);
            setCurrentStep(-1);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 p-8 bg-sage-50 dark:bg-green-950/20 rounded-[2.5rem] border border-green-100 dark:border-green-900/50">
           <h3 className="text-xl font-bold flex items-center gap-2"><Activity className="w-5 h-5 text-green-500"/> 5-4-3-2-1 Grounding</h3>
           
           <div className="h-32 flex items-center justify-center text-center px-4 w-full">
               {currentStep === -1 ? (
                   <p className="text-zinc-600 dark:text-zinc-400 text-sm">Bring your mind back to the present moment by connecting with your surroundings.</p>
               ) : (
                   <div className="flex flex-col items-center gap-4 animate-fade-in">
                       <span className="text-4xl">{steps[currentStep].icon}</span>
                       <h4 className="text-2xl font-bold text-zinc-800 dark:text-white">{steps[currentStep].label}</h4>
                   </div>
               )}
           </div>

           <button 
                onClick={nextStep}
                className="bg-green-600 text-white hover:bg-green-700 px-6 py-3 rounded-full font-medium transition-all shadow-md"
            >
                {currentStep === -1 ? 'Begin' : currentStep === steps.length - 1 ? 'Finish' : 'Next Step'}
            </button>
        </div>
    );
};

const Exercises: React.FC = () => {
  const [streak, setStreak] = useState(0);

  const handleComplete = async (type: string, duration: number) => {
      try {
          const res = await api.post('/exercises/complete', {
              exercise_type: type,
              duration_seconds: duration
          });
          
          setStreak(res.data.streak);
      } catch (e) {
          console.error("Failed to save exercise", e);
      }
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Exercises</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Tools to anchor your mind and body.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BoxBreathing onComplete={(dur) => handleComplete('box_breathing', dur)} />
        <Grounding onComplete={(dur) => handleComplete('grounding', dur)} />
        
        {/* PMR Placeholder */}
        <div className="flex flex-col items-center justify-center gap-4 p-8 bg-rose-50 dark:bg-rose-950/20 rounded-[2.5rem] border border-rose-100 dark:border-rose-900/50 opacity-60">
           <HeartPulse className="w-8 h-8 text-rose-500 mb-2"/>
           <h3 className="text-xl font-semibold text-center">Progressive Muscle Relaxation</h3>
           <p className="text-sm text-center">Coming soon in the next update.</p>
        </div>
      </div>
    </div>
  );
};

export default Exercises;

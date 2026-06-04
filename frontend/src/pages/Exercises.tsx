import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Volume2, VolumeX, Wind, HeartPulse, Activity } from 'lucide-react';
import api from '../services/api';

// Box Breathing Component
const BoxBreathing = ({ onComplete }: { onComplete: (duration: number) => void }) => {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Hold Out'>('Inhale');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const osc = useRef<OscillatorNode | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);

  useEffect(() => {
    if (isActive) {
      startTime.current = Date.now();
      let step = 0;
      const phases: typeof phase[] = ['Inhale', 'Hold', 'Exhale', 'Hold Out'];
      
      const runCycle = () => {
        setPhase(phases[step % 4]);
        if (soundEnabled && audioCtx.current) {
           if (step % 4 === 0 || step % 4 === 2) {
               // Play soft tone
               if (!osc.current) {
                 osc.current = audioCtx.current.createOscillator();
                 osc.current.type = 'sine';
                 osc.current.frequency.setValueAtTime(174, audioCtx.current.currentTime); // Healing frequency
                 const gain = audioCtx.current.createGain();
                 gain.gain.value = 0.1;
                 osc.current.connect(gain);
                 gain.connect(audioCtx.current.destination);
                 osc.current.start();
               }
           } else {
               if (osc.current) {
                   osc.current.stop();
                   osc.current.disconnect();
                   osc.current = null;
               }
           }
        }
        step++;
      };

      runCycle();
      timer.current = setInterval(runCycle, 4000);

    } else {
      if (timer.current) clearInterval(timer.current);
      if (osc.current) {
          try { osc.current.stop(); } catch(e){}
          osc.current.disconnect();
          osc.current = null;
      }
      
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
        if (osc.current) { try { osc.current.stop(); } catch(e){} }
    };
  }, [isActive, soundEnabled]);

  const toggleSound = () => {
      if (!audioCtx.current) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          audioCtx.current = new AudioContext();
      }
      if (audioCtx.current.state === 'suspended') {
          audioCtx.current.resume();
      }
      setSoundEnabled(!soundEnabled);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
      <div className="flex justify-between w-full items-center">
         <h3 className="text-xl font-semibold flex items-center gap-2"><Wind className="w-5 h-5 text-indigo-500"/> Box Breathing</h3>
         <button onClick={toggleSound} className="p-2 bg-white dark:bg-zinc-800 rounded-full shadow-sm">
             {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
         </button>
      </div>
      
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Animated Circle */}
        <div className={`absolute w-full h-full rounded-full border-4 border-indigo-400 transition-all duration-[4000ms] ease-in-out ${isActive ? (phase === 'Inhale' || phase === 'Hold' ? 'scale-150 opacity-50' : 'scale-100 opacity-100') : 'scale-100 opacity-20'}`}></div>
        
        <div className="z-10 text-center">
          <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{isActive ? phase : 'Ready'}</span>
          {isActive && <p className="text-sm mt-1 text-indigo-600/70">4 seconds</p>}
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
        <div className="flex flex-col items-center gap-6 p-8 bg-sage-50 dark:bg-green-950/20 rounded-2xl border border-green-100 dark:border-green-900/50">
           <h3 className="text-xl font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-green-500"/> 5-4-3-2-1 Grounding</h3>
           
           <div className="h-32 flex items-center justify-center text-center px-4 w-full">
               {currentStep === -1 ? (
                   <p className="text-zinc-600 dark:text-zinc-400">Bring your mind back to the present moment by connecting with your surroundings.</p>
               ) : (
                   <div className="flex flex-col items-center gap-4 animate-fade-in">
                       <span className="text-4xl">{steps[currentStep].icon}</span>
                       <h4 className="text-2xl font-bold">{steps[currentStep].label}</h4>
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
        <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Tools to anchor your mind and body.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BoxBreathing onComplete={(dur) => handleComplete('box_breathing', dur)} />
        <Grounding onComplete={(dur) => handleComplete('grounding', dur)} />
        
        {/* PMR Placeholder */}
        <div className="flex flex-col items-center justify-center gap-4 p-8 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/50 opacity-60">
           <HeartPulse className="w-8 h-8 text-rose-500 mb-2"/>
           <h3 className="text-xl font-semibold text-center">Progressive Muscle Relaxation</h3>
           <p className="text-sm text-center">Coming soon in the next update.</p>
        </div>
      </div>
    </div>
  );
};

export default Exercises;

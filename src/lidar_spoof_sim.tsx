import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Shield, Zap, Activity, Terminal, Settings, Lock, Eye, Server } from 'lucide-react';

// --- Types ---
type ObjectType = {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'pedestrian' | 'vehicle' | 'obstacle' | 'phantom' | 'noise';
  id: string | number;
  hidden?: boolean;
  distance?: number;
  // VSOC specific properties
  flagged?: boolean; 
  correctedX?: number; 
};

type LogEntry = {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
};

const LidarSpoofingSimulator: React.FC = () => {
  // --- Refs & State ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const scrollOffset = useRef<number>(0);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [vsocActive, setVsocActive] = useState<boolean>(false); // NEW: VSOC Toggle
  const [attackType, setAttackType] = useState<'none' | 'phantom' | 'hiding' | 'relay' | 'saturation'>('none');
  
  // Simulation settings
  const [simSpeed, setSimSpeed] = useState<number>(4);
  const [lidarRange, setLidarRange] = useState<number>(350);
  
  // Metrics
  const [detectionRate, setDetectionRate] = useState<number>(100);
  const [collisionRisk, setCollisionRisk] = useState<number>(0);
  const [integrityScore, setIntegrityScore] = useState<number>(100); // NEW: Data Integrity
  const [nearestObjectDist, setNearestObjectDist] = useState<number | null>(null);
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Objects state
  const [objects, setObjects] = useState<ObjectType[]>([
    { x: 600, y: 290, width: 60, height: 40, type: 'vehicle', id: 1 },
    { x: 900, y: 280, width: 30, height: 50, type: 'pedestrian', id: 2 },
  ]);

  // Helper: Add log
  const addLog = (message: string, type: 'info' | 'warning' | 'alert' | 'success') => {
    setLogs(prev => {
      // Prevent duplicate log spam
      if (prev.length > 0 && prev[0].message === message) return prev;
      
      const newLog = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        message,
        type
      };
      return [newLog, ...prev].slice(0, 8); 
    });
  };

  // --- VSOC Logic Hooks ---
  useEffect(() => {
      if (vsocActive && attackType !== 'none') {
          addLog(`VSOC: Analysis started for ${attackType} signature...`, "info");
          setTimeout(() => {
              addLog(`VSOC: Mitigation protocols deployed against ${attackType}.`, "success");
          }, 800);
      } else if (attackType !== 'none') {
          addLog(`WARNING: Unmitigated ${attackType} attack in progress!`, "alert");
      }
  }, [attackType, vsocActive]);

  // --- Animation Loop ---
  const animate = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Update World State
    scrollOffset.current = (scrollOffset.current + simSpeed) % 100; 

    setObjects(prevObjects => {
      // Move objects
      let nextObjects = prevObjects.map(obj => ({
        ...obj,
        x: obj.x - simSpeed,
        // Reset VSOC flags every frame for recalc
        flagged: false, 
        correctedX: undefined 
      }));

      // Respawn logic
      nextObjects.forEach(obj => {
        if (obj.x + obj.width < -100) {
          obj.x = width + 200 + Math.random() * 500;
          obj.hidden = false; 
        }
      });

      // --- ATTACK SIMULATION LOGIC ---
      
      // 1. Saturation (Noise)
      if (attackType === 'saturation') {
        // Clear old noise
        nextObjects = nextObjects.filter(o => o.type !== 'noise');
        // Add heavy noise
        const noiseCount = 20;
        for(let i=0; i<noiseCount; i++) {
             nextObjects.push({
                x: 50 + Math.random() * 500,
                y: 200 + Math.random() * 200,
                width: 4, height: 4, type: 'noise', id: `n-${Math.random()}`,
                flagged: vsocActive // If VSOC is on, we flag noise
             });
        }
      }

      // 2. Phantom Injection
      if (attackType === 'phantom') {
        const hasPhantom = nextObjects.some(o => o.type === 'phantom');
        if (!hasPhantom) {
            nextObjects.push({
                x: 250, y: 300, width: 40, height: 40, type: 'phantom', id: 'phantom',
                flagged: vsocActive // VSOC identifies this has no Camera/Radar correlation
            });
        }
      }

      // 3. Hiding Attack (Cloaking)
      if (attackType === 'hiding') {
         nextObjects = nextObjects.map(obj => {
             // If object is in the "Kill zone" (150-400), it disappears
             const inKillZone = obj.x > 150 && obj.x < 400;
             return {
                 ...obj,
                 hidden: obj.type !== 'phantom' && obj.type !== 'noise' && inKillZone
                 // Note: VSOC can't make it reappear magically, but it can flag "Sensor Blindness"
             };
         });
      }

      // 4. Relay (Position Offset)
      if (attackType === 'relay') {
          // No visual change to logic here, handled in draw
          // But VSOC calculates the "True" position
          nextObjects = nextObjects.map(obj => {
              if (obj.type !== 'phantom' && obj.type !== 'noise') {
                  return { ...obj, correctedX: obj.x }; // Store true X
              }
              return obj;
          });
      }

      return nextObjects;
    });

    // 2. Drawing 
    ctx.fillStyle = '#020617'; // Deepest Slate
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, width, height);
    drawCar(ctx);

    // Draw Objects
    objects.forEach(obj => {
        // --- VISUALIZING THE ATTACK & VSOC CORRECTION ---
        
        let drawX = obj.x;
        let drawY = obj.y;
        let opacity = 1.0;
        
        // Relay Attack Visuals
        if (attackType === 'relay' && obj.type !== 'phantom' && obj.type !== 'noise') {
            // The LiDAR "Sees" it closer than it is
            drawX = obj.x - 120; 
            
            // Draw Ghost/True position if VSOC is active
            if (vsocActive && obj.correctedX) {
                drawCorrectionVector(ctx, drawX, obj.y, obj.correctedX, obj.y);
                // Draw the "Real" ghost faint
                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(obj.correctedX, obj.y, obj.width, obj.height);
                ctx.restore();
            }
        }

        // Saturation Visuals
        if (obj.type === 'noise') {
            opacity = vsocActive ? 0.2 : 1.0; // VSOC filters noise visually
        }

        ctx.globalAlpha = opacity;
        drawObject(ctx, {...obj, x: drawX, y: drawY});
        ctx.globalAlpha = 1.0;
    });

    // LiDAR Rays & Points
    const metrics = calculateLidar(ctx, objects);
    setNearestObjectDist(metrics.minDist);
    
    // 3. Metrics Update
    if (Math.floor(time) % 10 === 0) {
        calculateRiskMetrics(metrics.minDist);
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  // --- Helpers ---

  const drawCorrectionVector = (ctx: CanvasRenderingContext2D, fakeX: number, y: number, trueX: number, trueY: number) => {
      ctx.save();
      ctx.strokeStyle = '#fbbf24'; // Amber
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(fakeX + 20, y + 20);
      ctx.lineTo(trueX + 20, trueY + 20);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10px monospace';
      ctx.fillText("VSOC CORRECTION", (fakeX + trueX)/2 - 40, y - 10);
      ctx.restore();
  }

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Cyberpunk Grid Floor
    const roadTop = 250;
    const roadBot = 450;
    
    // Gradient
    const grad = ctx.createLinearGradient(0, roadTop, 0, roadBot);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, roadTop, w, roadBot - roadTop);

    // Perspective Lines
    ctx.strokeStyle = vsocActive ? '#0ea5e9' : '#334155'; // Blue lines if VSOC is active
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal
    ctx.moveTo(0, 250); ctx.lineTo(w, 250);
    ctx.moveTo(0, 450); ctx.lineTo(w, 450);
    // Vertical perspective
    for(let i=0; i<w; i+=100) {
        ctx.moveTo(i, 250); ctx.lineTo(i - (w/2 - i)*2, 450);
    }
    ctx.stroke();

    // Moving Lane Markers
    ctx.strokeStyle = '#f59e0b'; 
    ctx.lineWidth = 4;
    ctx.setLineDash([40, 60]);
    ctx.lineDashOffset = -scrollOffset.current * 4; 
    ctx.beginPath();
    ctx.moveTo(0, 350);
    ctx.lineTo(w, 350);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawCar = (ctx: CanvasRenderingContext2D) => {
    const x = 100;
    const y = 320;
    
    // Shield Bubble (VSOC Active)
    if (vsocActive) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 70, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }

    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(x - 40, y - 20, 80, 40, 8);
    ctx.fill();
    
    // Sensor Top
    ctx.fillStyle = '#172554';
    ctx.fillRect(x - 15, y - 25, 30, 20);

    // Spinning Lidar
    const time = Date.now() / 80;
    ctx.save();
    ctx.translate(x, y - 25);
    ctx.rotate(time);
    ctx.fillStyle = attackType === 'none' || vsocActive ? '#10b981' : '#ef4444'; // Green if safe, Red if attack & no vsoc
    ctx.fillRect(-12, -3, 24, 6);
    ctx.restore();
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: ObjectType) => {
    if (obj.hidden) return;

    ctx.save();
    
    let color = '#a855f7'; // Default purple
    if (obj.type === 'pedestrian') color = '#22c55e';
    if (obj.type === 'phantom') color = '#ef4444';
    if (obj.type === 'noise') color = '#94a3b8';

    // VSOC Flagging Visuals
    if (obj.flagged && vsocActive) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x - 5, obj.y - 5, obj.width + 10, obj.height + 10);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText("VSOC REJECT", obj.x, obj.y - 10);
        
        // Dim the actual object to show it's ignored
        ctx.globalAlpha = 0.3;
    }

    if (obj.type === 'noise') {
        ctx.fillStyle = color;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(obj.x, obj.y, obj.width, obj.height, 4);
        ctx.fill();
        
        // Tech markings
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    }
    ctx.restore();
  };

  const calculateLidar = (ctx: CanvasRenderingContext2D, currentObjects: ObjectType[]) => {
    const sensorX = 100;
    const sensorY = 295;
    const numRays = 60; 
    const fov = Math.PI / 2.5;
    let minDist = 9999;

    ctx.save();
    
    for (let i = 0; i < numRays; i++) {
      const angle = -fov/2 + (fov * i / numRays);
      const endX = sensorX + Math.cos(angle) * lidarRange;
      const endY = sensorY + Math.sin(angle) * lidarRange;

      let hit = false;
      let hitX = endX;
      let hitY = endY;
      let hitObj: ObjectType | null = null;

      // Raycast against objects
      for (const obj of currentObjects) {
        if (obj.hidden) continue;
        
        // Relay Attack: Logic sees the visual position (drawX handled in loop, but here we use obj.x modified)
        // For simulation simplicity, we Raycast against the object's logic X. 
        // In Relay attack, we modified the visual X, but the logical X remains.
        // To properly simulate Relay, we assume the object moved in the `animate` loop.
        
        const inYRange = (endY > obj.y && endY < obj.y + obj.height);
        
        // Simple Hit Box
        // Relay shift logic for raycast:
        let checkX = obj.x;
        if (attackType === 'relay' && !['phantom','noise'].includes(obj.type)) checkX -= 120;

        if (inYRange && endX > checkX && endX < checkX + obj.width + 20) {
           hit = true;
           hitX = Math.max(sensorX, checkX); 
           hitY = sensorY + Math.tan(angle) * (hitX - sensorX);
           hitObj = obj;
           
           const d = Math.sqrt(Math.pow(hitX - sensorX, 2) + Math.pow(hitY - sensorY, 2));
           if (d < minDist) minDist = d;
           break; 
        }
      }

      ctx.beginPath();
      ctx.moveTo(sensorX, sensorY);
      ctx.lineTo(hitX, hitY);
      
      if (hit) {
          // If VSOC is active and flagged this object, we don't treat it as a valid Lidar hit (Blue instead of Green)
          const isNeutralized = vsocActive && (hitObj?.flagged || hitObj?.type === 'noise');
          
          ctx.strokeStyle = isNeutralized ? '#3b82f6' : '#10b981'; 
          if (hitObj?.type === 'phantom' && !vsocActive) ctx.strokeStyle = '#ef4444'; // Red for danger

          ctx.globalAlpha = isNeutralized ? 0.3 : 0.8;
          ctx.stroke();
      } else {
          ctx.strokeStyle = '#334155'; 
          ctx.globalAlpha = 0.1;
          ctx.stroke();
      }
    }
    
    ctx.restore();
    return { minDist: minDist === 9999 ? null : minDist };
  };

  const calculateRiskMetrics = (dist: number | null) => {
      let risk = 5; // Base risk
      let integrity = 100;
      let detection = 98;

      // --- RISK CALCULATOR ---

      if (attackType === 'none') {
          if (dist && dist < 120) risk = 30;
          if (dist && dist < 60) risk = 60;
      } 
      else {
          // Under Attack
          integrity = 40; 
          detection = 60;

          if (attackType === 'phantom') {
             // Fake braking event
             risk = 80; 
             if (dist && dist < 100) risk = 95;
          }
          if (attackType === 'saturation') {
             risk = 60;
             detection = 10;
          }
          if (attackType === 'relay') {
             risk = 75; // Collision likely due to offset
          }
          if (attackType === 'hiding') {
              risk = 90; // Critical danger (invisible object)
          }
      }

      // --- VSOC MITIGATION FACTOR ---
      if (vsocActive) {
          integrity = 95; // VSOC restores confidence
          
          if (attackType === 'phantom') {
              risk = 10; // We identified it's fake, risk drops
              detection = 100; // We successfully detected the falsity
          }
          if (attackType === 'saturation') {
              detection = 85; // Filtering restores most vision
              risk = 20;
          }
          if (attackType === 'relay') {
              risk = 25; // We know true location, risk managed
          }
          if (attackType === 'hiding') {
              // VSOC detects signal anomaly, slows car down proactively
              risk = 40; 
              addLog("VSOC: Anomaly detected (Signal Drop). Speed reduced.", "warning");
          }
      }

      // Smooth interpolation
      setCollisionRisk(prev => prev + (risk - prev) * 0.1);
      setIntegrityScore(prev => prev + (integrity - prev) * 0.1);
      setDetectionRate(prev => prev + (detection - prev) * 0.1);
  };

  const reset = () => {
    setIsRunning(false);
    setObjects([
        { x: 600, y: 290, width: 60, height: 40, type: 'vehicle', id: 1 },
        { x: 900, y: 280, width: 30, height: 50, type: 'pedestrian', id: 2 },
    ]);
    setAttackType('none');
    setLogs([]);
    addLog("Simulation reset. Systems nominal.", "info");
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 bg-slate-950 text-slate-200 rounded-xl border border-slate-900 shadow-2xl font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-white">
            <Shield className="text-blue-500" size={32} />
            VSOC Defense Simulator <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">PRO</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">Vehicle Security Operations Center - Sensor Fusion Validation</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-lg border border-slate-800">
             <span className="text-xs font-bold text-slate-400 px-2">VSOC STATUS</span>
             <button
                onClick={() => setVsocActive(!vsocActive)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border ${
                    vsocActive
                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' 
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'
                }`}
            >
                {vsocActive ? <Lock size={18} /> : <Lock size={18} className="opacity-50" />}
                {vsocActive ? 'ACTIVE' : 'DISABLED'}
            </button>
        </div>

        <div className="flex gap-3">
             <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all text-sm ${
                    isRunning 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                >
                {isRunning ? <Pause size={18} /> : <Play size={18} />}
                {isRunning ? 'PAUSE' : 'RUN'}
            </button>
            <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
                <RotateCcw size={18} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Controls */}
        <div className="space-y-6">
            
            {/* Attack Panel */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Zap size={100} />
                </div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400 relative z-10">
                    <Zap size={20} /> Threat Injection
                </h3>
                <div className="grid grid-cols-1 gap-2 relative z-10">
                    {[
                        { id: 'none', label: 'No Attack', desc: 'Baseline Operations' },
                        { id: 'phantom', label: 'Phantom Object', desc: 'Injects False Positive' },
                        { id: 'hiding', label: 'Cloaking / Hiding', desc: 'Signal Absorbtion' },
                        { id: 'relay', label: 'Relay / Spoof', desc: 'Position Offset' },
                        { id: 'saturation', label: 'Saturation', desc: 'DDoS / Jamming' },
                    ].map((attack) => (
                        <button
                            key={attack.id}
                            onClick={() => setAttackType(attack.id as any)}
                            className={`text-left p-3 rounded-lg border transition-all flex flex-col ${
                                attackType === attack.id 
                                ? 'bg-red-900/30 border-red-500 text-red-100' 
                                : 'bg-slate-800/50 border-transparent hover:bg-slate-800 text-slate-400'
                            }`}
                        >
                            <span className="font-bold text-sm flex justify-between">
                                {attack.label}
                                {attackType === attack.id && <Activity size={16} className="animate-pulse" />}
                            </span>
                            <span className="text-xs opacity-70">{attack.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Metrics Panel */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
                 <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-400">
                    <Activity size={20} /> Sensor Health
                </h3>
                <div className="space-y-4">
                     {/* Risk Gauge */}
                     <div>
                        <div className="flex justify-between text-sm font-medium mb-1">
                            <span className="text-slate-400">Risk Level</span>
                            <span className={`${collisionRisk > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {collisionRisk.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div 
                                className={`h-full transition-all duration-500 ${collisionRisk > 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${collisionRisk}%` }} 
                            />
                        </div>
                     </div>
                     {/* Integrity Gauge */}
                     <div>
                        <div className="flex justify-between text-sm font-medium mb-1">
                            <span className="text-slate-400">Data Integrity (VSOC)</span>
                            <span className={`${integrityScore < 80 ? 'text-amber-400' : 'text-blue-400'}`}>
                                {integrityScore.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div 
                                className={`h-full transition-all duration-500 ${integrityScore < 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${integrityScore}%` }} 
                            />
                        </div>
                     </div>
                </div>
            </div>
        </div>

        {/* Center Col: Visualization */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Main Canvas Container */}
            <div className="relative bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl group">
                
                {/* HUD Overlay */}
                <div className="absolute top-4 left-4 flex gap-4 pointer-events-none z-20">
                    <div className="bg-black/60 backdrop-blur px-3 py-1 rounded border border-slate-600 text-xs text-slate-300 font-mono">
                        LIDAR_FREQ: 10Hz
                    </div>
                    {vsocActive && (
                        <div className="bg-blue-900/80 backdrop-blur px-3 py-1 rounded border border-blue-500 text-xs text-blue-100 font-bold font-mono animate-pulse flex items-center gap-2">
                            <Server size={12} />
                            CLOUD_ANALYSIS: ONLINE
                        </div>
                    )}
                </div>

                <canvas
                    ref={canvasRef}
                    width={800}
                    height={450}
                    className="w-full h-auto block bg-[#0f172a]"
                />
                
                {/* Attack Warning Banner */}
                {attackType !== 'none' && !vsocActive && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-2 rounded-md font-bold animate-pulse flex items-center gap-2 shadow-[0_0_30px_rgba(220,38,38,0.8)] border border-red-400 z-20">
                        <AlertTriangle size={20} />
                        CRITICAL SENSOR FAILURE
                    </div>
                )}
                {attackType !== 'none' && vsocActive && (
                     <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white px-8 py-2 rounded-md font-bold flex items-center gap-2 shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-400 z-20">
                        <Shield size={20} />
                        THREAT MITIGATED
                    </div>
                )}
            </div>

            {/* Logs Console */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-48 overflow-hidden flex flex-col font-mono text-xs">
                 <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Terminal size={14} /> System Events
                    </h3>
                    <div className="flex gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    </div>
                 </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                    {logs.length === 0 && <span className="text-slate-600 italic">Listening for CAN bus events...</span>}
                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-3 hover:bg-slate-900 p-1 rounded">
                            <span className="text-slate-600">[{log.timestamp}]</span>
                            <span className={`${
                                log.type === 'alert' ? 'text-red-500 font-bold' : 
                                log.type === 'success' ? 'text-emerald-400' : 
                                log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'
                            }`}>
                                {log.type === 'success' ? '✔ ' : log.type === 'alert' ? '✖ ' : '> '}
                                {log.message}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default LidarSpoofingSimulator;
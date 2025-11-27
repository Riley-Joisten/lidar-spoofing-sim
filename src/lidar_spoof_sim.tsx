import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Shield, Zap, Activity, Terminal, Settings, Lock, Server } from 'lucide-react';

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

  // Simulation Controls
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [vsocActive, setVsocActive] = useState<boolean>(false); 
  const [attackType, setAttackType] = useState<'none' | 'phantom' | 'hiding' | 'relay' | 'saturation'>('none');
  
  // Adjustable Parameters
  const [simSpeed, setSimSpeed] = useState<number>(4);
  const [lidarRange, setLidarRange] = useState<number>(400);
  
  // Metrics
  const [collisionRisk, setCollisionRisk] = useState<number>(0);
  const [integrityScore, setIntegrityScore] = useState<number>(100);
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Objects state
  const [objects, setObjects] = useState<ObjectType[]>([
    { x: 600, y: 280, width: 80, height: 50, type: 'vehicle', id: 1 },
    { x: 900, y: 300, width: 30, height: 60, type: 'pedestrian', id: 2 },
  ]);

  // Helper: Add log
  const addLog = (message: string, type: 'info' | 'warning' | 'alert' | 'success') => {
    setLogs(prev => {
      if (prev.length > 0 && prev[0].message === message) return prev;
      const newLog = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        message,
        type
      };
      return [newLog, ...prev].slice(0, 6); 
    });
  };

  // --- VSOC Logic Hooks ---
  useEffect(() => {
      if (vsocActive && attackType !== 'none') {
          addLog(`VSOC: Analysis started for ${attackType} signature...`, "info");
          setTimeout(() => {
              addLog(`VSOC: Counter-measures deployed.`, "success");
          }, 800);
      } else if (attackType !== 'none') {
          addLog(`WARNING: System vulnerable to ${attackType} attack!`, "alert");
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

    // 1. Update World State (Only if Running)
    if (isRunning) {
        scrollOffset.current = (scrollOffset.current + simSpeed) % 50; 

        setObjects(prevObjects => {
        // Move objects (Shift Left to simulate car moving Right)
        let nextObjects: ObjectType[] = prevObjects.map(obj => ({
            ...obj,
            x: obj.x - simSpeed,
            flagged: false, 
            correctedX: undefined 
        }));

        // Respawn logic (Loop objects back to the right)
        nextObjects.forEach(obj => {
            if (obj.x + obj.width < -200) {
            obj.x = width + 100 + Math.random() * 600;
            obj.hidden = false; 
            }
        });

        // --- ATTACK SIMULATION LOGIC ---
        
        // 1. Saturation (Noise)
        if (attackType === 'saturation') {
            nextObjects = nextObjects.filter(o => o.type !== 'noise');
            // Add dynamic noise based on speed
            const noiseCount = 15;
            for(let i=0; i<noiseCount; i++) {
                nextObjects.push({
                    x: Math.random() * width,
                    y: 200 + Math.random() * 250,
                    width: 3, height: 3, type: 'noise', id: `n-${Math.random()}`,
                    flagged: vsocActive 
                });
            }
        }

        // 2. Phantom Injection
        if (attackType === 'phantom') {
            const hasPhantom = nextObjects.some(o => o.type === 'phantom');
            if (!hasPhantom) {
                // Spawn a fake car right in front
                nextObjects.push({
                    x: 350, y: 280, width: 80, height: 50, type: 'phantom', id: 'phantom',
                    flagged: vsocActive 
                });
            }
        }

        // 3. Hiding Attack (Cloaking)
        if (attackType === 'hiding') {
            nextObjects = nextObjects.map(obj => {
                const inKillZone = obj.x > 200 && obj.x < 500;
                return {
                    ...obj,
                    hidden: obj.type !== 'phantom' && obj.type !== 'noise' && inKillZone
                };
            });
        }

        // 4. Relay (Position Offset)
        if (attackType === 'relay') {
            nextObjects = nextObjects.map(obj => {
                if (obj.type !== 'phantom' && obj.type !== 'noise') {
                    return { ...obj, correctedX: obj.x }; // Store true X
                }
                return obj;
            });
        }

        return nextObjects;
        });
    }

    // 2. Drawing (Always Draw, even if paused)
    // Dark Sci-Fi Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, width, height);
    drawCar(ctx);

    // Draw Objects
    objects.forEach(obj => {
        let drawX = obj.x;
        const drawY = obj.y;
        let opacity = 1.0;
        
        // Relay Attack Visuals (Shift the drawing X, but Logic X stays)
        if (attackType === 'relay' && obj.type !== 'phantom' && obj.type !== 'noise') {
            drawX = obj.x - 150; // Visual Spoofery
            
            // Draw Ghost/True position if VSOC is active
            if (vsocActive && obj.correctedX) {
                drawCorrectionVector(ctx, drawX, obj.y, obj.correctedX, obj.y);
                // Draw "True" location ghost
                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.strokeStyle = '#f59e0b';
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(obj.correctedX, obj.y, obj.width, obj.height);
                ctx.restore();
            }
        }

        if (obj.type === 'noise') opacity = vsocActive ? 0.1 : 0.8;

        ctx.globalAlpha = opacity;
        drawObject(ctx, {...obj, x: drawX, y: drawY});
        ctx.globalAlpha = 1.0;
    });

    // LiDAR Rays
    const metrics = calculateLidar(ctx, objects);
    
    // 3. Metrics Update
    if (Math.floor(time) % 10 === 0) {
        calculateRiskMetrics(metrics.minDist);
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  // --- Helpers ---

  const drawCorrectionVector = (ctx: CanvasRenderingContext2D, fakeX: number, y: number, trueX: number, trueY: number) => {
      ctx.save();
      ctx.strokeStyle = '#fbbf24'; 
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(fakeX + 20, y + 20);
      ctx.lineTo(trueX + 20, trueY + 20);
      ctx.stroke();
      
      // Box around the correction
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.fillRect(fakeX, y - 20, (trueX - fakeX), 20);
      
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10px monospace';
      ctx.fillText("GPS RECONCILIATION", (fakeX + trueX)/2 - 50, y - 8);
      ctx.restore();
  }

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const horizonY = 200;
    
    // Road Surface
    const grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Grid Lines (Perspective)
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = vsocActive ? 'rgba(14, 165, 233, 0.3)' : 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;

    const offset = scrollOffset.current;
    
    // Vertical perspective lines
    for(let i = -w; i < w * 2; i+=100) {
        ctx.moveTo(i, horizonY);
        // Fan out towards bottom
        ctx.lineTo(i - (i - w/2) * 1.5, h); 
    }
    
    ctx.stroke();
    
    // Moving Horizontal Lines (Floor effect)
    ctx.beginPath();
    // Only draw a few lines that "move" down
    for(let i=0; i<10; i++) {
        const yPos = horizonY + (i * 30 + offset) % (h-horizonY);
        if(yPos > horizonY) {
            ctx.moveTo(0, yPos);
            ctx.lineTo(w, yPos);
        }
    }
    ctx.stroke();
    ctx.restore();
  };

  const drawCar = (ctx: CanvasRenderingContext2D) => {
    const x = 120;
    const y = 340;
    
    // VSOC Shield Bubble
    if (vsocActive) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x + 20, y, 90, 40, 0, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0ea5e9';
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }

    // Headlights
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + 50, y - 15);
    ctx.lineTo(x + 300, y - 60);
    ctx.lineTo(x + 300, y + 60);
    ctx.lineTo(x + 50, y + 15);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.1)'; // Yellow faint light
    ctx.fill();
    ctx.restore();

    // Car Body (Futuristic Shape)
    ctx.fillStyle = '#3b82f6'; // Blue
    ctx.beginPath();
    // Hood
    ctx.moveTo(x + 60, y);
    ctx.lineTo(x, y - 25);
    ctx.lineTo(x - 60, y - 25);
    ctx.lineTo(x - 60, y + 25);
    ctx.lineTo(x, y + 25);
    ctx.closePath();
    ctx.fill();
    
    // Roof/Cockpit
    ctx.fillStyle = '#1e293b'; // Dark Glass
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x - 20, y - 15);
    ctx.lineTo(x - 50, y - 15);
    ctx.lineTo(x - 50, y + 15);
    ctx.lineTo(x - 20, y + 15);
    ctx.closePath();
    ctx.fill();

    // Sensor Array (Spinning)
    const time = Date.now() / 60;
    ctx.save();
    ctx.translate(x - 10, y);
    ctx.rotate(time);
    ctx.fillStyle = attackType === 'none' || vsocActive ? '#10b981' : '#ef4444'; 
    ctx.fillRect(-12, -4, 24, 8);
    // Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fill();
    ctx.restore();
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: ObjectType) => {
    if (obj.hidden) return;

    ctx.save();
    
    let color = '#a855f7'; 
    if (obj.type === 'pedestrian') color = '#22c55e';
    if (obj.type === 'phantom') color = '#ef4444';
    if (obj.type === 'noise') color = '#cbd5e1';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(obj.x + obj.width/2, obj.y + obj.height - 5, obj.width/2, 8, 0, 0, Math.PI*2);
    ctx.fill();

    // Main Body
    if (obj.type === 'noise') {
        ctx.fillStyle = color;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    } else {
        // 3D-ish Block
        ctx.fillStyle = color;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        // Side/Top shading
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(obj.x, obj.y, obj.width, 5); // Top highlight
    }

    // --- VSOC TARGETING HUD ---
    if (obj.flagged && vsocActive) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // HUD Brackets
        const pad = 10;
        const bx = obj.x - pad;
        const by = obj.y - pad;
        const bw = obj.width + pad*2;
        const bh = obj.height + pad*2;

        // Draw corners
        ctx.beginPath();
        // Top Left
        ctx.moveTo(bx + 10, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + 10);
        // Top Right
        ctx.moveTo(bx + bw - 10, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + 10);
        // Bot Left
        ctx.moveTo(bx + 10, by + bh); ctx.lineTo(bx, by + bh); ctx.lineTo(bx, by + bh - 10);
        // Bot Right
        ctx.moveTo(bx + bw - 10, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - 10);
        ctx.stroke();
        
        // Text Label
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px Courier New';
        ctx.fillText("⚠ VSOC REJECT", bx, by - 8);
        
        // Data lines
        ctx.font = '10px monospace';
        ctx.fillText(`CONF: 99.8%`, bx + bw + 5, by + 10);
        ctx.fillText(`SRC: CAM_01`, bx + bw + 5, by + 22);
        
        ctx.globalAlpha = 0.5; // Dim the fake object
    }
    ctx.restore();
  };

  const calculateLidar = (ctx: CanvasRenderingContext2D, currentObjects: ObjectType[]) => {
    const sensorX = 120;
    const sensorY = 340;
    const numRays = 40; 
    const fov = Math.PI / 3;
    let minDist = 9999;

    ctx.save();
    ctx.globalCompositeOperation = 'screen'; // Make lasers glowy
    
    for (let i = 0; i < numRays; i++) {
      const angle = -fov/2 + (fov * i / numRays);
      const endX = sensorX + Math.cos(angle) * lidarRange;
      const endY = sensorY + Math.sin(angle) * lidarRange;

      let hit = false;
      let hitX = endX;
      let hitY = endY;
      let hitObj: ObjectType | null = null;

      // Raycast
      for (const obj of currentObjects) {
        if (obj.hidden) continue;
        
        // Relay Logic check
        let checkX = obj.x;
        if (attackType === 'relay' && !['phantom','noise'].includes(obj.type)) checkX -= 150;

        const inYRange = (endY > obj.y && endY < obj.y + obj.height);
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
          const isNeutralized = vsocActive && (hitObj?.flagged || hitObj?.type === 'noise');
          
          ctx.strokeStyle = isNeutralized ? '#3b82f6' : '#10b981'; 
          if (hitObj?.type === 'phantom' && !vsocActive) ctx.strokeStyle = '#ef4444'; 

          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          
          // Hit dot
          ctx.beginPath();
          ctx.arc(hitX, hitY, 3, 0, Math.PI*2);
          ctx.fillStyle = '#fff';
          ctx.fill();
      } else {
          ctx.strokeStyle = '#334155'; 
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.1;
          ctx.stroke();
      }
    }
    
    ctx.restore();
    return { minDist: minDist === 9999 ? null : minDist };
  };

  const calculateRiskMetrics = (dist: number | null) => {
      let risk = 5; 
      let integrity = 100;

      // Attack Metrics logic
      if (attackType === 'none') {
          if (dist && dist < 120) risk = 30;
      } else {
          integrity = 40; 
          if (attackType === 'phantom') risk = 80;
          if (attackType === 'saturation') risk = 60;
          if (attackType === 'relay') risk = 75; 
          if (attackType === 'hiding') risk = 90;
      }

      // VSOC Mitigation
      if (vsocActive) {
          integrity = 98; 
          if (attackType === 'phantom') risk = 10;
          if (attackType === 'saturation') risk = 20;
          if (attackType === 'relay') risk = 25; 
          if (attackType === 'hiding') risk = 40; 
      }

      setCollisionRisk(prev => prev + (risk - prev) * 0.1);
      setIntegrityScore(prev => prev + (integrity - prev) * 0.1);
  };

  // Lifecycle for Animation
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isRunning, objects, attackType, simSpeed, lidarRange, vsocActive]); 
  // ^ Added dependencies to ensure loop doesn't get stale

  const reset = () => {
    setIsRunning(false);
    setObjects([
        { x: 600, y: 280, width: 80, height: 50, type: 'vehicle', id: 1 },
        { x: 900, y: 300, width: 30, height: 60, type: 'pedestrian', id: 2 },
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

            {/* RESTORED: Sensor Settings */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
                 <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-400">
                    <Settings size={20} /> Sensor Calibration
                </h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1 text-slate-400">
                            <span>Vehicle Speed</span>
                            <span>{simSpeed} m/s</span>
                        </div>
                        <input 
                            type="range" min="0" max="10" step="1" 
                            value={simSpeed} 
                            onChange={(e) => setSimSpeed(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1 text-slate-400">
                            <span>LiDAR Range</span>
                            <span>{lidarRange} m</span>
                        </div>
                        <input 
                            type="range" min="100" max="600" step="10" 
                            value={lidarRange} 
                            onChange={(e) => setLidarRange(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
                 <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <Activity size={20} /> Integrity Monitor
                </h3>
                <div className="space-y-4">
                     {/* Risk Gauge */}
                     <div>
                        <div className="flex justify-between text-sm font-medium mb-1">
                            <span className="text-slate-400">Collision Risk</span>
                            <span className={`${collisionRisk > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {collisionRisk.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div 
                                className={`h-full transition-all duration-500 ${collisionRisk > 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${collisionRisk}%` }} 
                            />
                        </div>
                     </div>
                     {/* Integrity Gauge */}
                     <div>
                        <div className="flex justify-between text-sm font-medium mb-1">
                            <span className="text-slate-400">VSOC Trust Score</span>
                            <span className={`${integrityScore < 80 ? 'text-amber-400' : 'text-blue-400'}`}>
                                {integrityScore.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
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
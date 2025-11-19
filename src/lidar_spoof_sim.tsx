import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Shield, Zap, Activity, Terminal, Settings } from 'lucide-react';

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
};

type LogEntry = {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
};

const LidarSpoofingSimulator: React.FC = () => {
  // --- Refs & State ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const scrollOffset = useRef<number>(0);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [attackType, setAttackType] = useState<'none' | 'phantom' | 'hiding' | 'relay' | 'saturation'>('none');
  
  // Simulation settings
  const [simSpeed, setSimSpeed] = useState<number>(4);
  const [lidarRange, setLidarRange] = useState<number>(350);
  
  // Metrics
  const [detectionRate, setDetectionRate] = useState<number>(100);
  const [collisionRisk, setCollisionRisk] = useState<number>(0);
  const [nearestObjectDist, setNearestObjectDist] = useState<number | null>(null);
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Objects state
  const [objects, setObjects] = useState<ObjectType[]>([
    { x: 600, y: 290, width: 60, height: 40, type: 'vehicle', id: 1 },
    { x: 900, y: 280, width: 30, height: 50, type: 'pedestrian', id: 2 },
    { x: 1400, y: 310, width: 40, height: 40, type: 'obstacle', id: 3 },
  ]);

  // Helper: Add log
  const addLog = (message: string, type: 'info' | 'warning' | 'alert') => {
    setLogs(prev => {
      const newLog = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        message,
        type
      };
      return [newLog, ...prev].slice(0, 6); // Keep last 6 logs
    });
  };

  // --- Attack Logic ---
  useEffect(() => {
    // Reset objects when attack changes to prevent stuck states
    if (attackType === 'none') {
        setObjects(prev => prev.filter(o => o.type !== 'phantom' && o.type !== 'noise').map(o => ({...o, hidden: false})));
        addLog("System normalized. Attack countermeasures engaged.", "info");
    } else {
        addLog(`WARNING: ${attackType.toUpperCase()} attack signature detected.`, "alert");
    }
  }, [attackType]);

  // --- Animation Loop ---
  const animate = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Update World State (Scrolling)
    scrollOffset.current = (scrollOffset.current + simSpeed) % 100; // Parallax factor

    // Update Objects (Move them left to simulate car moving right)
    setObjects(prevObjects => {
      let nextObjects = prevObjects.map(obj => ({
        ...obj,
        x: obj.x - simSpeed
      }));

      // Respawn objects that go off screen left
      nextObjects.forEach(obj => {
        if (obj.x + obj.width < 0) {
          obj.x = width + 200 + Math.random() * 500; // Respawn far right
          obj.hidden = false; // Unhide on respawn
        }
      });

      // --- Apply Active Attacks Frame-by-Frame ---
      
      // Saturation (Noise)
      if (attackType === 'saturation') {
        // Remove old noise
        nextObjects = nextObjects.filter(o => o.type !== 'noise');
        // Add new random noise
        if (Math.random() > 0.8) {
             nextObjects.push({
                x: 150 + Math.random() * 300,
                y: 250 + Math.random() * 150,
                width: 5, height: 5, type: 'noise', id: Math.random()
             });
        }
      }

      // Phantom Injection
      if (attackType === 'phantom') {
        const hasPhantom = nextObjects.some(o => o.type === 'phantom');
        if (!hasPhantom && Math.random() > 0.98) {
            nextObjects.push({
                x: 300, y: 300, width: 40, height: 40, type: 'phantom', id: 'phantom'
            });
        }
      }

      // Hiding Attack
      if (attackType === 'hiding') {
         nextObjects = nextObjects.map(obj => ({
             ...obj,
             hidden: (obj.type !== 'phantom' && obj.x > 150 && obj.x < 400) // Hide objects in "kill zone"
         }));
      }

      // Relay Attack (Offsetting)
      if (attackType === 'relay') {
          // Visually, we might draw them offset, but logically the car is confused.
          // For this sim, we will handle the visual offset in the draw function.
      }

      return nextObjects;
    });

    // 2. Drawing 
    // Clear
    ctx.fillStyle = '#0f172a'; // Darker Slate
    ctx.fillRect(0, 0, width, height);

    // Grid / Floor
    drawGrid(ctx, width, height);

    // Car
    drawCar(ctx);

    // Objects
    objects.forEach(obj => {
        // Relay attack visual shift
        let drawX = obj.x;
        let drawY = obj.y;
        
        if (attackType === 'relay' && obj.type !== 'phantom' && obj.type !== 'noise') {
            drawX += 80; // Shift apparent position
            ctx.globalAlpha = 0.5; // Real object is "faded" to sensor
        }
        
        drawObject(ctx, {...obj, x: drawX, y: drawY});
        ctx.globalAlpha = 1.0;
    });

    // LiDAR Rays & Points
    const metrics = calculateLidar(ctx, objects);
    setNearestObjectDist(metrics.minDist);
    
    // 3. Update React Metrics State (Throttled slightly visually, but calc is realtime)
    if (Math.floor(time) % 10 === 0) {
        calculateRiskMetrics(metrics.minDist);
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  // --- Helper Drawing Functions ---

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, offset: number) => {
    // Road
    const roadTop = 250;
    const roadBot = 400;
    
    // Gradient Road
    const grad = ctx.createLinearGradient(0, roadTop, 0, roadBot);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, roadTop, w, roadBot - roadTop);

    // Perspective Lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 250); ctx.lineTo(w, 250);
    ctx.moveTo(0, 400); ctx.lineTo(w, 400);
    ctx.stroke();

    // Moving Lane Markers
    ctx.strokeStyle = '#fbbf24'; // Amber
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -offset; // Makes it move
    ctx.beginPath();
    ctx.moveTo(0, 325);
    ctx.lineTo(w, 325);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawCar = (ctx: CanvasRenderingContext2D) => {
    const x = 100;
    const y = 300;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + 25, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#3b82f6'; // Blue 500
    ctx.beginPath();
    ctx.roundRect(x - 40, y - 20, 80, 40, 5);
    ctx.fill();
    
    // Roof/Sensor mount
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(x - 15, y - 25, 30, 20);

    // Rotating LiDAR Sensor
    const time = Date.now() / 100;
    ctx.save();
    ctx.translate(x, y - 25);
    ctx.rotate(time);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-10, -2, 20, 4);
    ctx.restore();
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: ObjectType) => {
    if (obj.hidden) return;

    const isPhantom = obj.type === 'phantom';
    const isNoise = obj.type === 'noise';

    ctx.save();
    if (isPhantom) {
        ctx.strokeStyle = '#f472b6'; // Pink
        ctx.setLineDash([2, 2]);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.2)';
    } else if (isNoise) {
        ctx.fillStyle = '#94a3b8';
    } else {
        ctx.fillStyle = obj.type === 'pedestrian' ? '#22c55e' : '#a855f7'; // Green or Purple
    }

    // Draw simple shape
    if (isNoise) {
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    } else {
        ctx.beginPath();
        ctx.roundRect(obj.x, obj.y, obj.width, obj.height, 4);
        ctx.fill();
        if (isPhantom) ctx.stroke();
        
        // ID Label
        if (!isNoise) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.fillText(obj.type.toUpperCase(), obj.x, obj.y - 5);
        }
    }
    ctx.restore();
  };

  // Raycasting simulation for LiDAR Visualization
  const calculateLidar = (ctx: CanvasRenderingContext2D, currentObjects: ObjectType[]) => {
    const sensorX = 100;
    const sensorY = 275;
    const numRays = 40; // Density of scan
    const fov = Math.PI / 3; // 60 degrees
    let minDist = 9999;

    ctx.save();
    
    // We sweep an arc in front of the car
    for (let i = 0; i < numRays; i++) {
      const angle = -fov/2 + (fov * i / numRays);
      
      // Calculate ray end point (max range)
      const endX = sensorX + Math.cos(angle) * lidarRange;
      const endY = sensorY + Math.sin(angle) * lidarRange;

      let hit = false;
      let hitX = endX;
      let hitY = endY;
      let detectedType = '';

      // Simple check against all objects (Bounding Box check)
      for (const obj of currentObjects) {
        if (obj.hidden) continue; // LiDAR passes through hidden objects

        // Check if ray intersects object box (Simplified logic for visual demo)
        // We check if the "end" of the ray is inside or past the object's left face
        // This is a "fake" raycast that assumes objects are somewhat perpendicular to camera
        
        const inYRange = (endY > obj.y && endY < obj.y + obj.height);
        
        if (inYRange && endX > obj.x && endX < obj.x + obj.width + 50) {
           // Hit detected!
           hit = true;
           // Cap the ray at the object face
           hitX = Math.max(sensorX, obj.x); 
           hitY = sensorY + Math.tan(angle) * (hitX - sensorX);
           
           detectedType = obj.type;
           
           const d = Math.sqrt(Math.pow(hitX - sensorX, 2) + Math.pow(hitY - sensorY, 2));
           if (d < minDist) minDist = d;
           break; 
        }
      }

      // Draw Ray
      ctx.beginPath();
      ctx.moveTo(sensorX, sensorY);
      ctx.lineTo(hitX, hitY);
      
      // Style based on hit or miss
      if (hit) {
          // Object detected color
          ctx.strokeStyle = detectedType === 'phantom' ? '#f472b6' : '#34d399'; 
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          
          // Draw "Point Cloud" dot
          ctx.beginPath();
          ctx.arc(hitX, hitY, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 1;
          ctx.fill();
      } else {
          // Empty space
          ctx.strokeStyle = '#334155'; // Faint grid line
          ctx.globalAlpha = 0.2;
          ctx.stroke();
      }
    }
    
    ctx.restore();
    return { minDist: minDist === 9999 ? null : minDist };
  };

  const calculateRiskMetrics = (dist: number | null) => {
      // 1. Base Calculation
      let risk = 0;
      let detection = 100;

      if (dist !== null) {
          if (dist < 100) risk = 90;
          else if (dist < 200) risk = 40;
          else risk = 10;
      }

      // 2. Attack Modifiers
      switch (attackType) {
          case 'hiding':
            // In hiding, we don't see the object, so detection is low, but ACTUAL risk is high
            // Since "dist" comes from the visual lidar, it will be null if hidden.
            if (dist === null) {
                // We are blind to the danger
                detection = 0; 
                // In a real sim we'd check the 'true' object position. 
                // We'll simulate high true risk if there are objects nearby we can't see.
                const realDanger = objects.some(o => o.x > 100 && o.x < 400);
                if (realDanger) risk = 95; 
            }
            break;
          case 'phantom':
             // We see a ghost. Detection is "working" (seeing the ghost), but it's a False Positive.
             if (dist !== null && dist < 150) {
                 risk = 80; // Hard braking risk
                 detection = 50; // Confused
             }
             break;
          case 'saturation':
             detection = 15; // Blinded
             risk = 60; // Unsafe state
             break;
          case 'relay':
             detection = 60; // Inaccurate
             risk = 75; // Miscalculated braking distance
             break;
      }

      setDetectionRate(prev => prev + (detection - prev) * 0.1); // Smooth transition
      setCollisionRisk(prev => prev + (risk - prev) * 0.1);
  };

  // --- Lifecycle ---
  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRunning, objects, attackType, simSpeed, lidarRange]);

  const reset = () => {
    setIsRunning(false);
    setObjects([
        { x: 600, y: 290, width: 60, height: 40, type: 'vehicle', id: 1 },
        { x: 900, y: 280, width: 30, height: 50, type: 'pedestrian', id: 2 },
    ]);
    setAttackType('none');
    setLogs([]);
    addLog("Simulation reset.", "info");
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-slate-950 text-slate-200 rounded-xl border border-slate-800 shadow-2xl font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
            <Shield className="text-blue-500" size={32} />
            LiDAR Defense Simulator <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">v2.0</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">Autonomous Perception Vulnerability Analysis Workbench</p>
        </div>
        <div className="flex gap-3">
             <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
                    isRunning 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_0_15px_rgba(5,150,105,0.4)]'
                }`}
                >
                {isRunning ? <Pause size={20} /> : <Play size={20} />}
                {isRunning ? 'FREEZE SIM' : 'RUN SIM'}
            </button>
            <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
                <RotateCcw size={20} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Controls */}
        <div className="space-y-6">
            
            {/* Attack Panel */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400">
                    <Zap size={20} /> Threat Injection
                </h3>
                <div className="grid grid-cols-1 gap-2">
                    {[
                        { id: 'none', label: 'No Attack', desc: 'Normal Operation' },
                        { id: 'phantom', label: 'Phantom Object', desc: 'Injects False Positives' },
                        { id: 'hiding', label: 'Cloaking / Hiding', desc: 'Masks Real Objects' },
                        { id: 'relay', label: 'Relay / Spoof', desc: 'Offsets Position' },
                        { id: 'saturation', label: 'Sensor Saturation', desc: 'High Noise Floor' },
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
                            <span className="font-bold text-sm">{attack.label}</span>
                            <span className="text-xs opacity-70">{attack.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Params Panel */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
                 <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-400">
                    <Settings size={20} /> Sensor Parameters
                </h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1 text-slate-400">
                            <span>Vehicle Speed</span>
                            <span>{simSpeed} m/s</span>
                        </div>
                        <input 
                            type="range" min="0" max="10" step="0.1" 
                            value={simSpeed} 
                            onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1 text-slate-400">
                            <span>LiDAR Effective Range</span>
                            <span>{lidarRange} px</span>
                        </div>
                        <input 
                            type="range" min="100" max="600" 
                            value={lidarRange} 
                            onChange={(e) => setLidarRange(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Center Col: Visualization */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Main Canvas Container */}
            <div className="relative bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                {/* Overlay UI */}
                <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur px-3 py-1 rounded border border-slate-600 text-xs text-slate-300 font-mono">
                        LIDAR_FREQ: 10Hz
                    </div>
                    <div className="bg-black/60 backdrop-blur px-3 py-1 rounded border border-slate-600 text-xs text-slate-300 font-mono">
                        POINTS: {objects.length * 42}
                    </div>
                </div>

                <canvas
                    ref={canvasRef}
                    width={800}
                    height={450}
                    className="w-full h-auto block bg-[#0f172a]"
                />
                
                {/* Attack Warning Banner */}
                {attackType !== 'none' && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-2 rounded-full font-bold animate-pulse flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                        <AlertTriangle size={18} />
                        SENSOR INTEGRITY COMPROMISED: {attackType.toUpperCase()}
                    </div>
                )}
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Live Data Feed */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 h-48 overflow-hidden flex flex-col">
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Terminal size={14} /> System Log
                    </h3>
                    <div className="flex-1 overflow-y-auto font-mono text-xs space-y-2 pr-2">
                        {logs.length === 0 && <span className="text-slate-600 italic">System waiting...</span>}
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-2 border-l-2 border-slate-700 pl-2">
                                <span className="text-slate-500">[{log.timestamp}]</span>
                                <span className={`${
                                    log.type === 'alert' ? 'text-red-400' : 
                                    log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'
                                }`}>
                                    {log.message}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Graphs/Gauges */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Activity size={14} /> Real-time Analytics
                    </h3>
                    
                    <div className="space-y-4">
                         {/* Detection Confidence */}
                         <div>
                            <div className="flex justify-between text-sm font-medium mb-1">
                                <span className="text-slate-400">Detection Confidence</span>
                                <span className={`${detectionRate < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {detectionRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${detectionRate < 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${detectionRate}%` }} 
                                />
                            </div>
                         </div>

                         {/* Collision Risk */}
                         <div>
                            <div className="flex justify-between text-sm font-medium mb-1">
                                <span className="text-slate-400">Collision Probability</span>
                                <span className={`${collisionRisk > 70 ? 'text-red-400' : 'text-blue-400'}`}>
                                    {collisionRisk.toFixed(1)}%
                                </span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${collisionRisk > 70 ? 'bg-red-500' : 'bg-blue-500'}`}
                                    style={{ width: `${collisionRisk}%` }} 
                                />
                            </div>
                         </div>

                         {/* Distance Readout */}
                         <div className="flex justify-between items-end pt-2 border-t border-slate-800">
                             <span className="text-xs text-slate-500">NEAREST OBJECT</span>
                             <span className="text-2xl font-mono text-white">
                                 {nearestObjectDist ? nearestObjectDist.toFixed(1) : '---'} <span className="text-sm text-slate-500">m</span>
                             </span>
                         </div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default LidarSpoofingSimulator;
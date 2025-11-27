import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ShieldCheck, Wifi, Server, Car, Zap } from 'lucide-react';

// Types
interface SimObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  id: string | number;
  hidden?: boolean; // True if local sensors can't see it
  vsocDetected?: boolean; // True if external V2X network sees it
  isPhantom?: boolean; // True if it doesn't actually exist
}

interface Peer {
  x: number;
  y: number;
  type: 'camera' | 'car';
  id: number;
  active: boolean;
}

const LidarSpoofingSimulator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Simulation State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [attackType, setAttackType] = useState<string>('none');
  const [time, setTime] = useState<number>(0);
  
  // VSOC / V2X State
  const [vsocActive, setVsocActive] = useState<boolean>(false);
  const [networkStrength, setNetworkStrength] = useState<number>(0);
  const [consensusScore, setConsensusScore] = useState<number>(0);

  // Physical State
  const [carPos, setCarPos] = useState({ x: 100, y: 300 });
  const [objects, setObjects] = useState<SimObject[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  
  const [carSpeed, setCarSpeed] = useState<number>(2);

  // Initialize Scene
  useEffect(() => {
    resetScene();
  }, []);

  // Manage Peers (Cameras/Other Cars) based on VSOC Status
  useEffect(() => {
    if (vsocActive) {
      // Simulate connecting to peers over time
      const interval = setInterval(() => {
        setNetworkStrength(prev => {
            const newVal = Math.min(100, prev + 5);
            // Consensus score tracks network strength but with some simulated variance
            setConsensusScore(Math.floor(newVal * 0.95));
            return newVal;
        });
      }, 100);
      
      setPeers([
        { x: 400, y: 50, type: 'camera', id: 1, active: true }, // Street Camera
        { x: 700, y: 350, type: 'car', id: 2, active: true },   // Oncoming Car
        { x: 200, y: 50, type: 'camera', id: 3, active: true }  // Another Camera
      ]);

      return () => clearInterval(interval);
    } else {
      setNetworkStrength(0);
      setConsensusScore(0);
      setPeers([]);
    }
  }, [vsocActive]);

  // Animation Loop
  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, time, attackType, carPos, objects, vsocActive, networkStrength, carSpeed]);

  const resetScene = () => {
    setObjects([
      { x: 400, y: 280, width: 40, height: 60, type: 'pedestrian', id: 1 },
      { x: 600, y: 290, width: 50, height: 50, type: 'vehicle', id: 2 },
    ]);
    setCarPos({ x: 100, y: 300 });
    setTime(0);
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Draw Environment
    drawRoad(ctx, width, height);

    // 2. Calculate Logic
    let currentObjects = applyAttackLogic();
    
    // 3. Apply VSOC Countermeasures (Data Fusion)
    if (vsocActive && networkStrength > 50) {
      currentObjects = applyVsocAnalysis(currentObjects);
    }

    // Update state for next frame reference if needed, 
    // though for this loop we just draw `currentObjects`
    // setObjects(currentObjects); // Avoid setting state in render loop to prevent flicker/re-render loops

    // 4. Draw Elements
    if (vsocActive) drawPeersAndNetwork(ctx, peers, carPos);
    drawLidarScans(ctx); // Local Car Sensors
    
    // Draw Objects with appropriate status (Real, Hidden, or Identified Fake)
    currentObjects.forEach(obj => {
      drawObject(ctx, obj);
    });

    drawMainCar(ctx);
    drawHUD(ctx);

    // 5. Update Physics
    setCarPos(prev => {
      const newX = prev.x + carSpeed;
      return { ...prev, x: newX > width + 50 ? -50 : newX };
    });
    setTime(prev => prev + 1);

    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const applyAttackLogic = (): SimObject[] => {
    // Explicitly type the array to allow both numbers and strings for IDs
    let simObjects: SimObject[] = [
      { x: 400, y: 280, width: 40, height: 60, type: 'pedestrian', id: 1 },
      { x: 600, y: 290, width: 50, height: 50, type: 'vehicle', id: 2 },
    ];

    switch (attackType) {
      case 'phantom':
        // Add fake object
        simObjects.push({ 
          x: carPos.x + 200, 
          y: 300, 
          width: 40, 
          height: 40, 
          type: 'phantom', 
          id: 'fake1', // String ID is now valid
          isPhantom: true 
        });
        break;
      
      case 'hiding':
        // Mark real objects as hidden from LOCAL sensors
        if (time % 2 !== 0) { // Flicker effect
             simObjects = simObjects.map(obj => ({ ...obj, hidden: true }));
        }
        break;

      case 'relay':
        // Move objects slightly to confuse local sensors
        if (time % 5 === 0) {
            simObjects = simObjects.map(obj => ({ ...obj, x: obj.x + 50, type: 'relayed' }));
        }
        break;
    }
    return simObjects;
  };

  const applyVsocAnalysis = (objects: SimObject[]) => {
    // This function simulates the VSOC cloud comparing local data with peer data
    
    return objects.map(obj => {
      // Logic: External cameras (Peers) always see the "Truth" in this sim
      // 1. If it's a Phantom, Peers see NOTHING. Overlap = 0.
      // 2. If it's Hidden locally, Peers SEE it. Overlap = Mismatch (but safe because detected).
      
      if (obj.isPhantom) {
        // VSOC detects no corresponding object in peer data
        return { ...obj, vsocDetected: false, type: 'identified_fake' };
      } 
      else if (obj.hidden) {
        // VSOC receives data from peers that object exists
        return { ...obj, vsocDetected: true, hidden: false, type: 'remote_detected' };
      } 
      else if (obj.type === 'relayed') {
        // VSOC sees the object at original position (we simulate correction here)
         return { ...obj, x: obj.x - 50, type: 'corrected_pos' };
      }
      
      return { ...obj, vsocDetected: true };
    });
  };

  // --- Drawing Functions ---

  const drawRoad = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);
    
    // Road
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 200, w, 200);
    
    // Lane markers
    ctx.strokeStyle = '#374151';
    ctx.setLineDash([30, 30]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(w, 300);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawMainCar = (ctx: CanvasRenderingContext2D) => {
    // Car Body
    ctx.fillStyle = '#3b82f6'; // Blue car
    ctx.shadowColor = '#2563eb';
    ctx.shadowBlur = 10;
    ctx.fillRect(carPos.x - 20, carPos.y - 15, 40, 30);
    ctx.shadowBlur = 0;

    // Roof / Sensor Dome
    ctx.fillStyle = vsocActive ? '#10b981' : '#f59e0b'; // Green if connected, Orange if local
    ctx.beginPath();
    ctx.arc(carPos.x, carPos.y, 8, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawPeersAndNetwork = (ctx: CanvasRenderingContext2D, peers: Peer[], carPos: {x:number, y:number}) => {
    ctx.strokeStyle = `rgba(6, 182, 212, ${networkStrength / 200})`; // Cyan
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    peers.forEach(peer => {
      // Draw Peer
      ctx.fillStyle = '#06b6d4'; // Cyan
      if (peer.type === 'camera') {
        ctx.beginPath();
        ctx.arc(peer.x, peer.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText("CAM", peer.x - 10, peer.y - 15);
        
        // Draw Camera FOV (Field of View) Cone
        ctx.fillStyle = 'rgba(6, 182, 212, 0.1)';
        ctx.beginPath();
        ctx.moveTo(peer.x, peer.y);
        ctx.lineTo(peer.x - 100, 400);
        ctx.lineTo(peer.x + 100, 400);
        ctx.fill();

      } else {
        ctx.fillRect(peer.x, peer.y, 40, 30);
        ctx.fillText("V2X CAR", peer.x - 20, peer.y - 10);
      }

      // Draw Connection Line to Main Car
      ctx.beginPath();
      ctx.moveTo(peer.x, peer.y);
      ctx.lineTo(carPos.x, carPos.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  };

  const drawLidarScans = (ctx: CanvasRenderingContext2D) => {
    // Draw local sensor arcs
    ctx.strokeStyle = attackType === 'none' ? 'rgba(50, 255, 50, 0.3)' : 'rgba(255, 50, 50, 0.3)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(carPos.x, carPos.y, 150, -0.5, 0.5);
    ctx.stroke();
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: SimObject) => {
    // If hidden locally and VSOC off, don't draw (except maybe a ghost for debug)
    if (obj.hidden && !vsocActive) return;

    let color = '#9ca3af'; // Default gray
    let stroke = 'transparent';
    let label = '';

    if (obj.type === 'identified_fake') {
      color = 'rgba(239, 68, 68, 0.2)'; // Faint Red
      stroke = '#ef4444';
      label = '⚠ SPOOF DETECTED';
    } else if (obj.type === 'remote_detected') {
      color = 'rgba(6, 182, 212, 0.5)'; // Cyan ghost
      stroke = '#06b6d4';
      label = 'V2X REVEALED';
    } else if (obj.type === 'corrected_pos') {
      color = 'rgba(16, 185, 129, 0.5)'; // Green
      stroke = '#10b981';
      label = 'POS CORRECTED';
    } else if (obj.isPhantom) {
        // Attack is active, VSOC is OFF, so car thinks it's real
        color = '#ef4444'; // Red solid
        label = 'OBSTACLE DETECTED';
    }

    // Draw the Object
    ctx.fillStyle = color;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    
    ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    if (stroke !== 'transparent') ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

    // Label
    if (label) {
      ctx.fillStyle = stroke === 'transparent' ? '#fff' : stroke;
      ctx.font = '10px monospace';
      ctx.fillText(label, obj.x, obj.y - 5);
    }
  };

  const drawHUD = (ctx: CanvasRenderingContext2D) => {
    // Top Left Status
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 220, 100);
    ctx.strokeStyle = '#374151';
    ctx.strokeRect(10, 10, 220, 100);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Attack: ${attackType.toUpperCase()}`, 20, 35);
    
    ctx.fillStyle = vsocActive ? '#06b6d4' : '#6b7280';
    ctx.fillText(`VSOC Connection: ${vsocActive ? 'ONLINE' : 'OFFLINE'}`, 20, 55);
    
    if (vsocActive) {
        ctx.fillStyle = networkStrength > 80 ? '#10b981' : '#f59e0b';
        ctx.fillText(`Net Strength: ${networkStrength.toFixed(0)}%`, 20, 75);
        ctx.fillText(`Peer Nodes: ${peers.length}`, 20, 95);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-gray-900 text-white rounded-xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Server className="text-cyan-400" />
            VSOC Cooperative Perception Sim
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Countering LiDAR attacks using Vehicle-to-Everything (V2X) Data Fusion
          </p>
        </div>
        <div className={`px-4 py-2 rounded-full border ${vsocActive ? 'border-cyan-500 bg-cyan-900/30 text-cyan-400' : 'border-red-500 bg-red-900/30 text-red-400'}`}>
            {vsocActive ? "SECURE NETWORK ACTIVE" : "ISOLATED SYSTEM - VULNERABLE"}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="relative mb-6 rounded-lg overflow-hidden border-2 border-gray-700 bg-black">
        <canvas ref={canvasRef} width={800} height={400} className="w-full h-auto block" />
        
        {/* Overlay Warning if Attack Successful */}
        {!vsocActive && attackType !== 'none' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600/80 text-white px-6 py-4 rounded animate-pulse text-center">
                <h3 className="text-xl font-bold">SENSOR COMPROMISED</h3>
                <p>Local Lidar Data Unreliable</p>
            </div>
        )}
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Attack Panel */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="text-yellow-400" size={18} /> Attack Scenarios
          </h3>
          <div className="space-y-2">
            <button 
                onClick={() => setAttackType('phantom')}
                className={`w-full text-left px-3 py-2 rounded transition ${attackType === 'phantom' ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
                1. Phantom Injection (Fake Object)
            </button>
            <button 
                onClick={() => setAttackType('hiding')}
                className={`w-full text-left px-3 py-2 rounded transition ${attackType === 'hiding' ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
                2. Object Hiding (Blind Spot)
            </button>
            <button 
                onClick={() => setAttackType('relay')}
                className={`w-full text-left px-3 py-2 rounded transition ${attackType === 'relay' ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
                3. Relay Attack (Position Shift)
            </button>
            <button 
                onClick={() => setAttackType('none')}
                className={`w-full text-left px-3 py-2 rounded transition ${attackType === 'none' ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
                Reset / Normal Operation
            </button>
          </div>
        </div>

        {/* VSOC Control Center */}
        <div className="bg-gray-800 p-4 rounded-lg border border-cyan-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wifi size={100} />
          </div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="text-cyan-400" size={18} /> VSOC Defense
          </h3>
          
          <button
            onClick={() => setVsocActive(!vsocActive)}
            className={`w-full py-4 rounded-lg font-bold text-lg transition flex items-center justify-center gap-3 mb-4 shadow-lg ${
                vsocActive 
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {vsocActive ? <Wifi className="animate-pulse" /> : <Wifi className="opacity-50" />}
            {vsocActive ? 'DISCONNECT FROM CLOUD' : 'CONNECT TO VSOC CLOUD'}
          </button>

          <div className="space-y-3 text-sm">
             <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-1">
                   <Car size={14} className="text-cyan-400" /> Connected Peers
                </span>
                <span className="font-mono text-cyan-300">{vsocActive ? peers.length : 0} Nodes</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-gray-400">Data Integrity</span>
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all duration-1000" style={{width: `${networkStrength}%`}}></div>
                </div>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-gray-400">Consensus Score</span>
                <span className={`font-mono font-bold ${consensusScore > 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {consensusScore}/100
                </span>
             </div>
          </div>
        </div>

        {/* Simulation Controls */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between">
            <div>
                <h3 className="text-lg font-semibold mb-4">Sim Controls</h3>
                
                {/* Car Speed Control */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Sim Speed</span>
                    <span>{carSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.5"
                    value={carSpeed}
                    onChange={(e) => setCarSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex gap-2 mb-4">
                    <button onClick={() => setIsRunning(!isRunning)} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded flex items-center justify-center gap-2">
                        {isRunning ? <Pause size={18} /> : <Play size={18} />} {isRunning ? "Pause" : "Start"}
                    </button>
                    <button onClick={resetScene} className="bg-gray-600 hover:bg-gray-500 px-4 rounded">
                        <RotateCcw size={18} />
                    </button>
                </div>
            </div>
            
            <div className="bg-black/30 p-3 rounded text-xs text-gray-400 border border-gray-700">
                <p className="mb-2"><strong className="text-cyan-400">How VSOC Works:</strong></p>
                <p>The car cross-references its local LiDAR data with video feeds from street cameras and other vehicles.</p>
                <p className="mt-2 text-yellow-500">
                    {vsocActive 
                     ? "• Inconsistencies are flagged as attacks.\n• Blind spots are filled by peer data." 
                     : "• System reliant solely on local sensors."}
                </p>
            </div>
        </div>

      </div>
    </div>
  );
};

export default LidarSpoofingSimulator;
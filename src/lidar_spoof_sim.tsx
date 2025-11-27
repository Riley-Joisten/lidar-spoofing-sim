import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Shield, Zap } from 'lucide-react';

// Define types for our simulation objects
interface SimObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  id: string | number;
  hidden?: boolean;
}

interface Countermeasures {
  sensorFusion: boolean;
  signalAuth: boolean;
  anomalyDetection: boolean;
  temporalTracking: boolean;
}

interface CarPosition {
  x: number;
  y: number;
}

const LidarSpoofingSimulator: React.FC = () => {
  // Fix: Typed useRef for Canvas and Animation Frame
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [attackType, setAttackType] = useState<string>('none');
  const [detectionRate, setDetectionRate] = useState<number>(100);
  const [collisionRisk, setCollisionRisk] = useState<number>(0);
  const [time, setTime] = useState<number>(0);
  
  const [countermeasures, setCountermeasures] = useState<Countermeasures>({
    sensorFusion: false,
    signalAuth: false,
    anomalyDetection: false,
    temporalTracking: false
  });

  const [carPos, setCarPos] = useState<CarPosition>({ x: 100, y: 300 });
  
  // Fix: Typed useState with the SimObject interface to prevent 'never' type errors
  const [realObjects, setRealObjects] = useState<SimObject[]>([]);
  const [spoofedObjects, setSpoofedObjects] = useState<SimObject[]>([]);
  
  const [carSpeed, setCarSpeed] = useState<number>(2);
  const [lidarRange, setLidarRange] = useState<number>(400);
  const [mitigationScore, setMitigationScore] = useState<number>(0);

  // Initialize objects
  useEffect(() => {
    setRealObjects([
      { x: 400, y: 280, width: 40, height: 60, type: 'pedestrian', id: 1 },
      { x: 600, y: 290, width: 50, height: 50, type: 'vehicle', id: 2 },
      { x: 300, y: 320, width: 30, height: 30, type: 'obstacle', id: 3 }
    ]);
  }, []);

  // Animation Loop Management
  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, time, attackType, carPos, realObjects, spoofedObjects, carSpeed, lidarRange, countermeasures]);

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear and Draw Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(0, 250, width, 150);
    
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(0, 325);
    ctx.lineTo(width, 325);
    ctx.stroke();
    ctx.setLineDash([]);

    applyAttack();
    drawLidarScans(ctx);

    realObjects.forEach(obj => {
      drawObject(ctx, obj, '#00ff88', attackType !== 'none');
    });

    spoofedObjects.forEach(obj => {
      drawObject(ctx, obj, '#ff3366', true, true);
    });

    drawCar(ctx);
    drawDetectionOverlay(ctx);
    updateMetrics();

    // Move Car
    setCarPos(prev => ({ ...prev, x: prev.x + carSpeed }));
    
    if (carPos.x > width + 50) {
      setCarPos({ x: -50, y: 300 });
    }

    setTime(prev => prev + 1);
    
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const applyAttack = () => {
    switch (attackType) {
      case 'phantom':
        if (time % 60 === 0) {
          setSpoofedObjects([
            { x: carPos.x + 200, y: 280, width: 40, height: 60, type: 'phantom', id: 'p1' },
            { x: carPos.x + 350, y: 300, width: 50, height: 50, type: 'phantom', id: 'p2' }
          ]);
        }
        break;
      
      case 'hiding':
        if (time % 5 === 0) {
          setRealObjects(prev => prev.map(obj => ({
            ...obj,
            hidden: Math.abs(obj.x - carPos.x) < 250
          })));
        }
        break;
      
      case 'relay':
        if (time % 3 === 0) {
          setSpoofedObjects(realObjects.map(obj => ({
            ...obj,
            x: obj.x + 100,
            y: obj.y - 50,
            type: 'relayed',
            id: `relay_${obj.id}`
          })));
        }
        break;
      
      case 'saturation':
        if (time % 20 === 0) {
          const noise: SimObject[] = [];
          for (let i = 0; i < 15; i++) {
            noise.push({
              x: carPos.x + 150 + Math.random() * 300,
              y: 260 + Math.random() * 120,
              width: 20,
              height: 20,
              type: 'noise',
              id: `noise_${i}`
            });
          }
          setSpoofedObjects(noise);
        }
        break;
      
      default:
        setSpoofedObjects([]);
        setRealObjects(prev => prev.map(obj => ({ ...obj, hidden: false })));
    }
  };

  // Fix: Explicit type for ctx
  const drawLidarScans = (ctx: CanvasRenderingContext2D) => {
    const scanCount = 16;
    const maxRange = lidarRange;
    
    ctx.save();
    ctx.translate(carPos.x, carPos.y);
    
    for (let i = 0; i < scanCount; i++) {
      const angle = (Math.PI / 2) * (i / scanCount - 0.5);
      const x = Math.cos(angle) * maxRange;
      const y = Math.sin(angle) * maxRange;
      
      ctx.strokeStyle = attackType !== 'none' ? 'rgba(255, 51, 102, 0.2)' : 'rgba(0, 255, 136, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    
    ctx.restore();
  };

  // Fix: Explicit types for arguments
  const drawObject = (
    ctx: CanvasRenderingContext2D, 
    obj: SimObject, 
    color: string, 
    isUnderAttack: boolean, 
    isSpoofed: boolean = false
  ) => {
    if (obj.hidden) return;
    
    ctx.fillStyle = color;
    ctx.globalAlpha = isSpoofed ? 0.7 : 1;
    
    if (obj.type === 'pedestrian' || obj.type === 'phantom') {
      ctx.fillRect(obj.x, obj.y + 40, obj.width, 20);
      ctx.beginPath();
      ctx.arc(obj.x + obj.width/2, obj.y + 20, 15, 0, Math.PI * 2);
      ctx.fill();
    } else if (obj.type === 'vehicle' || obj.type === 'relayed') {
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(obj.x + 5, obj.y + 5, 15, 10);
    } else {
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    }
    
    if (isSpoofed) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(obj.x - 5, obj.y - 5, obj.width + 10, obj.height + 10);
      ctx.setLineDash([]);
    }
    
    // We use isUnderAttack to subtly change the rendering context if needed, 
    // or just to silence the linter if we want to keep the param for future use.
    if(isUnderAttack) {
      // Optional: Add a subtle glitch effect logic here if desired
    }
    
    ctx.globalAlpha = 1;
  };

  const drawCar = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(carPos.x - 25, carPos.y - 15, 50, 30);
    
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(carPos.x, carPos.y - 20, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#333333';
    ctx.fillRect(carPos.x - 20, carPos.y + 15, 10, 5);
    ctx.fillRect(carPos.x + 10, carPos.y + 15, 10, 5);
  };

  const drawDetectionOverlay = (ctx: CanvasRenderingContext2D) => {
    ctx.font = '12px monospace';
    ctx.fillStyle = attackType !== 'none' ? '#ff3366' : '#00ff88';
    ctx.fillText(`Detection Rate: ${detectionRate.toFixed(0)}%`, 10, 20);
    ctx.fillText(`Collision Risk: ${collisionRisk.toFixed(0)}%`, 10, 40);
    ctx.fillText(`Attack: ${attackType === 'none' ? 'None' : attackType.toUpperCase()}`, 10, 60);
  };

  const updateMetrics = () => {
    let baseDetection = 95;
    let baseCollision = 5;
    let mitigation = 0;
    
    switch (attackType) {
      case 'phantom':
        baseDetection = 45;
        baseCollision = 75;
        if (countermeasures.sensorFusion) {
          baseDetection += 25;
          baseCollision -= 30;
          mitigation += 35;
        }
        if (countermeasures.anomalyDetection) {
          baseDetection += 15;
          baseCollision -= 20;
          mitigation += 25;
        }
        if (countermeasures.temporalTracking) {
          baseDetection += 10;
          baseCollision -= 15;
          mitigation += 20;
        }
        break;
      
      case 'hiding':
        baseDetection = 35;
        baseCollision = 90;
        if (countermeasures.sensorFusion) {
          baseDetection += 35;
          baseCollision -= 40;
          mitigation += 45;
        }
        if (countermeasures.temporalTracking) {
          baseDetection += 20;
          baseCollision -= 25;
          mitigation += 30;
        }
        if (countermeasures.anomalyDetection) {
          baseDetection += 10;
          baseCollision -= 15;
          mitigation += 15;
        }
        break;
      
      case 'relay':
        baseDetection = 50;
        baseCollision = 70;
        if (countermeasures.signalAuth) {
          baseDetection += 30;
          baseCollision -= 35;
          mitigation += 40;
        }
        if (countermeasures.sensorFusion) {
          baseDetection += 20;
          baseCollision -= 25;
          mitigation += 30;
        }
        if (countermeasures.temporalTracking) {
          baseDetection += 15;
          baseCollision -= 15;
          mitigation += 20;
        }
        break;
      
      case 'saturation':
        baseDetection = 25;
        baseCollision = 65;
        if (countermeasures.anomalyDetection) {
          baseDetection += 30;
          baseCollision -= 30;
          mitigation += 40;
        }
        if (countermeasures.signalAuth) {
          baseDetection += 25;
          baseCollision -= 25;
          mitigation += 35;
        }
        if (countermeasures.sensorFusion) {
          baseDetection += 15;
          baseCollision -= 15;
          mitigation += 20;
        }
        break;
      
      default:
        baseDetection = 95;
        baseCollision = 5;
        mitigation = 0;
    }

    setDetectionRate(Math.min(100, baseDetection + Math.random() * 5));
    setCollisionRisk(Math.max(0, baseCollision + Math.random() * 5));
    setMitigationScore(Math.min(100, mitigation));
  };

  const reset = () => {
    setIsRunning(false);
    setCarPos({ x: 100, y: 300 });
    setTime(0);
    setSpoofedObjects([]);
    setAttackType('none');
    setRealObjects([
      { x: 400, y: 280, width: 40, height: 60, type: 'pedestrian', id: 1 },
      { x: 600, y: 290, width: 50, height: 50, type: 'vehicle', id: 2 },
      { x: 300, y: 320, width: 30, height: 30, type: 'obstacle', id: 3 }
    ]);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 bg-gray-900 text-white rounded-lg">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="text-blue-400" />
          LiDAR Spoofing Simulator
        </h1>
        <p className="text-gray-400 text-sm md:text-base">
          Educational demonstration of vulnerabilities in autonomous vehicle LiDAR systems.
        </p>
      </div>

      <div className="mb-4 w-full overflow-hidden rounded bg-gray-800 border-2 border-gray-700">
        {/* Responsive Canvas: width 100% to fit container, height auto to maintain ratio */}
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-auto block"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Attack Controls */}
        <div className="bg-gray-800 p-4 rounded shadow-md">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="text-yellow-400" size={20} />
            Attack Controls
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => setAttackType('phantom')}
              className={`p-2 rounded text-sm font-medium ${attackType === 'phantom' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Phantom Object
            </button>
            <button
              onClick={() => setAttackType('hiding')}
              className={`p-2 rounded text-sm font-medium ${attackType === 'hiding' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Object Hiding
            </button>
            <button
              onClick={() => setAttackType('relay')}
              className={`p-2 rounded text-sm font-medium ${attackType === 'relay' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Relay Attack
            </button>
            <button
              onClick={() => setAttackType('saturation')}
              className={`p-2 rounded text-sm font-medium ${attackType === 'saturation' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Saturation
            </button>
            <button
              onClick={() => setAttackType('none')}
              className={`col-span-1 sm:col-span-2 p-2 rounded text-sm font-medium ${attackType === 'none' ? 'bg-green-600' : 'bg-gray-700'} hover:bg-green-500 transition`}
            >
              Normal Operation
            </button>
          </div>
        </div>

        {/* Countermeasures */}
        <div className="bg-gray-800 p-4 rounded shadow-md">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Shield className="text-blue-400" size={20} />
            Countermeasures
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-700 rounded">
              <input
                type="checkbox"
                checked={countermeasures.sensorFusion}
                onChange={(e) => setCountermeasures(prev => ({ ...prev, sensorFusion: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-500"
              />
              <span className="text-sm">Sensor Fusion</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-700 rounded">
              <input
                type="checkbox"
                checked={countermeasures.signalAuth}
                onChange={(e) => setCountermeasures(prev => ({ ...prev, signalAuth: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-500"
              />
              <span className="text-sm">Signal Auth</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-700 rounded">
              <input
                type="checkbox"
                checked={countermeasures.anomalyDetection}
                onChange={(e) => setCountermeasures(prev => ({ ...prev, anomalyDetection: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-500"
              />
              <span className="text-sm">Anomaly ML</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-700 rounded">
              <input
                type="checkbox"
                checked={countermeasures.temporalTracking}
                onChange={(e) => setCountermeasures(prev => ({ ...prev, temporalTracking: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-500"
              />
              <span className="text-sm">Temporal Track</span>
            </label>
          </div>
          
          {attackType !== 'none' && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">Mitigation Effectiveness</span>
                <span className={`text-xs font-bold ${mitigationScore > 60 ? 'text-green-400' : mitigationScore > 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {mitigationScore.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${mitigationScore > 60 ? 'bg-green-500' : mitigationScore > 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${mitigationScore}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded shadow-md">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="text-orange-400" size={20} />
            System Status
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span>Confidence</span>
                <span className={detectionRate < 60 ? 'text-red-400' : 'text-green-400'}>
                  {detectionRate.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${detectionRate < 60 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${detectionRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Risk Level</span>
                <span className={collisionRisk > 50 ? 'text-red-400' : 'text-green-400'}>
                  {collisionRisk.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${collisionRisk > 50 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${collisionRisk}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded shadow-md">
          <h3 className="text-lg font-semibold mb-3">Parameters</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Speed</span>
                <span>{carSpeed.toFixed(1)} m/s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={carSpeed}
                onChange={(e) => setCarSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Lidar Range</span>
                <span>{lidarRange}m</span>
              </div>
              <input
                type="range"
                min="200"
                max="600"
                step="50"
                value={lidarRange}
                onChange={(e) => setLidarRange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="flex-1 flex justify-center items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition shadow-lg"
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? 'Pause Sim' : 'Start Sim'}
        </button>
        <button
          onClick={reset}
          className="flex-none flex justify-center items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded font-semibold transition shadow-lg"
        >
          <RotateCcw size={20} />
          Reset
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded border-l-4 border-blue-500">
        <h3 className="text-lg font-bold mb-2 text-white">Attack Information</h3>
        <p className="text-sm text-gray-300">
          {attackType === 'phantom' && "Phantom Object: Injecting fake points to trigger false braking."}
          {attackType === 'hiding' && "Object Hiding: Masking real obstacles to cause collisions."}
          {attackType === 'relay' && "Relay Attack: Displacing object location data."}
          {attackType === 'saturation' && "Saturation: Flooding sensor with noise to blind the system."}
          {attackType === 'none' && "System operating normally. No active threats detected."}
        </p>
      </div>
    </div>
  );
};

export default LidarSpoofingSimulator;
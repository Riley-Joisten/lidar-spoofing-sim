import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Shield, Zap } from 'lucide-react';

type ObjectType = {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  id: string | number;
  hidden?: boolean;
};

const LidarSpoofingSimulator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [attackType, setAttackType] = useState<'none' | 'phantom' | 'hiding' | 'relay' | 'saturation'>('none');
  const [detectionRate, setDetectionRate] = useState<number>(100);
  const [collisionRisk, setCollisionRisk] = useState<number>(0);
  const [time, setTime] = useState<number>(0);

  const [carPos, setCarPos] = useState<{ x: number; y: number }>({ x: 100, y: 300 });
  const [realObjects, setRealObjects] = useState<ObjectType[]>([]);
  const [spoofedObjects, setSpoofedObjects] = useState<ObjectType[]>([]);
  const [carSpeed] = useState<number>(2);




  useEffect(() => {
    // Initialize real objects
    setRealObjects([
      { x: 400, y: 280, width: 40, height: 60, type: 'pedestrian', id: 1 },
      { x: 600, y: 290, width: 50, height: 50, type: 'vehicle', id: 2 },
      { x: 300, y: 320, width: 30, height: 30, type: 'obstacle', id: 3 }
    ]);
  }, []);

  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRunning, time, attackType, carPos, realObjects, spoofedObjects]);

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw road
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(0, 250, width, 150);

    // Draw lane markings
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(0, 325);
    ctx.lineTo(width, 325);
    ctx.stroke();
    ctx.setLineDash([]);

    // Update and apply attack
    applyAttack();

    // Draw LiDAR scan lines
    drawLidarScans(ctx);

    // Draw real objects
    realObjects.forEach(obj => drawObject(ctx, obj, '#00ff88', attackType !== 'none'));

    // Draw spoofed objects
    spoofedObjects.forEach(obj => drawObject(ctx, obj, '#ff3366', true));

    // Draw autonomous vehicle
    drawCar(ctx);

    // Draw detection overlay
    drawDetectionOverlay(ctx);

    // Update metrics
    updateMetrics();

    // Move car forward
    setCarPos(prev => ({ ...prev, x: prev.x + carSpeed }));

    // Reset if car goes off screen
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
          setRealObjects(prev => prev.map(obj => ({ ...obj, hidden: Math.abs(obj.x - carPos.x) < 250 })));
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
          const noise: ObjectType[] = [];
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

  const drawLidarScans = (ctx: CanvasRenderingContext2D) => {
    const scanCount = 16;
    const maxRange = 400;

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

  const drawObject = (ctx: CanvasRenderingContext2D, obj: ObjectType, color: string, isSpoofed = false) => {

    if (obj.hidden) return;

    ctx.fillStyle = color;
    ctx.globalAlpha = isSpoofed ? 0.7 : 1;

    if (obj.type === 'pedestrian' || obj.type === 'phantom') {
      ctx.fillRect(obj.x, obj.y + 40, obj.width, 20);
      ctx.beginPath();
      ctx.arc(obj.x + obj.width / 2, obj.y + 20, 15, 0, Math.PI * 2);
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
    switch (attackType) {
      case 'phantom':
        setDetectionRate(45 + Math.random() * 15);
        setCollisionRisk(65 + Math.random() * 20);
        break;
      case 'hiding':
        setDetectionRate(30 + Math.random() * 20);
        setCollisionRisk(85 + Math.random() * 10);
        break;
      case 'relay':
        setDetectionRate(55 + Math.random() * 15);
        setCollisionRisk(70 + Math.random() * 15);
        break;
      case 'saturation':
        setDetectionRate(25 + Math.random() * 15);
        setCollisionRisk(60 + Math.random() * 20);
        break;
      default:
        setDetectionRate(95 + Math.random() * 5);
        setCollisionRisk(5 + Math.random() * 5);
    }
  };

  const reset = () => {
    setIsRunning(false);
    setCarPos({ x: 100, y: 300 });
    setTime(0);
    setSpoofedObjects([]);
    setAttackType('none');
  };

  return (
  
 <div className="w-full max-w-6xl mx-auto p-6 bg-gray-900 text-white rounded-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="text-blue-400" />
          LiDAR Spoofing Attack Simulator
        </h1>
        <p className="text-gray-400">
          Educational demonstration of vulnerabilities in autonomous vehicle LiDAR systems
        </p>
      </div>

      <div className="mb-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full border-2 border-gray-700 rounded"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="text-yellow-400" size={20} />
            Attack Controls
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => setAttackType('phantom')}
              className={`w-full p-2 rounded ${attackType === 'phantom' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Phantom Object Injection
            </button>
            <button
              onClick={() => setAttackType('hiding')}
              className={`w-full p-2 rounded ${attackType === 'hiding' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Object Hiding Attack
            </button>
            <button
              onClick={() => setAttackType('relay')}
              className={`w-full p-2 rounded ${attackType === 'relay' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Relay/Displacement Attack
            </button>
            <button
              onClick={() => setAttackType('saturation')}
              className={`w-full p-2 rounded ${attackType === 'saturation' ? 'bg-red-600' : 'bg-gray-700'} hover:bg-red-500 transition`}
            >
              Saturation/Noise Attack
            </button>
            <button
              onClick={() => setAttackType('none')}
              className={`w-full p-2 rounded ${attackType === 'none' ? 'bg-green-600' : 'bg-gray-700'} hover:bg-green-500 transition`}
            >
              No Attack (Normal Operation)
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="text-orange-400" size={20} />
            Vulnerability Analysis
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span>Detection Rate</span>
                <span className={detectionRate < 60 ? 'text-red-400' : 'text-green-400'}>
                  {detectionRate.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${detectionRate < 60 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${detectionRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Collision Risk</span>
                <span className={collisionRisk > 50 ? 'text-red-400' : 'text-green-400'}>
                  {collisionRisk.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${collisionRisk > 50 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${collisionRisk}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
        >
          <RotateCcw size={20} />
          Reset
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-3">Attack Descriptions</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong className="text-red-400">Phantom Object Injection:</strong> Attacker injects false LiDAR returns, making the vehicle detect non-existent obstacles causing unnecessary braking or evasive maneuvers.</p>
          <p><strong className="text-red-400">Object Hiding:</strong> Real objects are masked by spoofed empty space signals, preventing the vehicle from detecting actual pedestrians or obstacles.</p>
          <p><strong className="text-red-400">Relay Attack:</strong> LiDAR returns are captured and retransmitted with modified positions, causing mislocalization of real objects.</p>
          <p><strong className="text-red-400">Saturation Attack:</strong> System is flooded with noise and false positives, overwhelming the perception algorithms and degrading decision-making.</p>
        </div>
      </div>

      <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded">
        <p className="text-yellow-200 text-sm">
          <strong>Educational Purpose:</strong> This simulation demonstrates known vulnerabilities in autonomous vehicle systems for research and awareness. Real systems employ countermeasures including sensor fusion, signal authentication, and anomaly detection.
        </p>
      </div>
    </div>
  );
};

export default LidarSpoofingSimulator;



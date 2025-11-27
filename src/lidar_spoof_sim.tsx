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
  const particlesRef = useRef<Array<{x: number, y: number, vx: number, vy: number, life: number}>>([]);

  // Simulation Controls
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [vsocActive, setVsocActive] = useState<boolean>(false); 
  const [attackType, setAttackType] = useState<'none' | 'phantom' | 'hiding' | 'relay' | 'saturation'>('none');
  const [showAttackInfo, setShowAttackInfo] = useState<boolean>(true);
  
  // Adjustable Parameters
  const [simSpeed, setSimSpeed] = useState<number>(4);
  const [lidarRange, setLidarRange] = useState<number>(400);
  
  // Car behavior state (Restored from first snippet)
  const [carBraking, setCarBraking] = useState<boolean>(false);
  const [carSpeed, setCarSpeed] = useState<number>(simSpeed);
  const [emergencyStop, setEmergencyStop] = useState<boolean>(false);
  
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

  // Sync simSpeed to carSpeed when sliding, unless under attack
  useEffect(() => {
    if (attackType === 'none' || vsocActive) {
        setCarSpeed(simSpeed);
    }
  }, [simSpeed, attackType, vsocActive]);

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
          addLog(`VSOC: Multi-sensor correlation initiated for ${attackType} pattern...`, "info");
          setTimeout(() => {
              addLog(`VSOC: Cross-validated with camera, radar & GPS. Threat neutralized.`, "success");
          }, 800);
      } else if (attackType !== 'none') {
          addLog(`⚠ ALERT: Uncorrelated sensor data detected - ${attackType} signature!`, "alert");
      }
  }, [attackType, vsocActive]);

  // Attack info definitions
  const attackInfo = {
    none: {
      title: "Normal Operation",
      desc: "All sensors operating within normal parameters. LiDAR data is being processed without interference.",
      vsocHelp: "VSOC continuously monitors sensor fusion patterns and validates data integrity across all inputs."
    },
    phantom: {
      title: "Phantom Object Injection",
      desc: "Attacker injects false LiDAR returns that create ghost objects. The vehicle sees obstacles that don't exist, potentially causing unnecessary emergency braking.",
      vsocHelp: "VSOC cross-references LiDAR data with camera vision and radar. Phantom objects that appear only in LiDAR are flagged and rejected from the decision pipeline."
    },
    hiding: {
      title: "Object Hiding/Cloaking",
      desc: "Attackers suppress LiDAR reflections from real objects using signal absorption or jamming. Critical obstacles become invisible to the sensor.",
      vsocHelp: "VSOC detects missing expected returns by comparing camera-detected objects with LiDAR data. Objects visible in camera but absent in LiDAR trigger high-priority alerts."
    },
    relay: {
      title: "Relay/Spoofing Attack",
      desc: "Attackers relay and modify LiDAR signals to report false positions. Objects appear further or closer than they actually are, compromising collision avoidance.",
      vsocHelp: "VSOC uses GPS and IMU data to calculate expected object positions. Discrepancies between visual tracking and LiDAR position data expose the attack."
    },
    saturation: {
      title: "Saturation/Jamming Attack",
      desc: "High-power interference floods the LiDAR sensor with noise, degrading signal quality and potentially blinding the system entirely.",
      vsocHelp: "VSOC identifies abnormal noise patterns and elevated return counts. The system shifts trust to backup sensors (camera/radar) and applies noise filtering algorithms."
    }
  };

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
        // Use carSpeed for scrolling to simulate braking visually
        scrollOffset.current = (scrollOffset.current + carSpeed) % 50; 

        setObjects(prevObjects => {
        // Move objects (Shift Left to simulate car moving Right)
        let nextObjects: ObjectType[] = prevObjects.map(obj => ({
            ...obj,
            x: obj.x - carSpeed,
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
            // Add dynamic noise
            const noiseCount = vsocActive ? 15 : 40;
            for(let i=0; i<noiseCount; i++) {
                nextObjects.push({
                    x: Math.random() * width,
                    y: 200 + Math.random() * 250,
                    width: 3, height: 3, type: 'noise', id: `n-${Math.random()}`,
                    flagged: vsocActive 
                });
            }
            
            // Without VSOC: Car slows down due to sensor confusion
            if (!vsocActive) {
                setCarSpeed(prev => Math.max(1, prev * 0.95));
                setCarBraking(true);
            } else {
                setCarSpeed(simSpeed);
                setCarBraking(false);
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
            
            // Without VSOC: Car emergency brakes for phantom object
            if (!vsocActive) {
                const phantom = nextObjects.find(o => o.type === 'phantom');
                if (phantom && phantom.x < 400) {
                    setEmergencyStop(true);
                    setCarSpeed(0);
                    setCarBraking(true);
                }
            } else {
                setEmergencyStop(false);
                setCarSpeed(simSpeed);
                setCarBraking(false);
            }
        }

        // 3. Hiding Attack (Cloaking)
        if (attackType === 'hiding') {
            nextObjects = nextObjects.map(obj => {
                const inKillZone = obj.x > 200 && obj.x < 500;
                return {
                    ...obj,
                    hidden: obj.type !== 'phantom' && obj.type !== 'noise' && inKillZone && !vsocActive
                };
            });
            
            // Without VSOC: Car continues at normal speed, unaware of hidden obstacles
            if (!vsocActive) {
                setCarSpeed(simSpeed);
                setCarBraking(false);
            }
        }

        // 4. Relay (Position Offset)
        if (attackType === 'relay') {
            nextObjects = nextObjects.map(obj => {
                if (obj.type !== 'phantom' && obj.type !== 'noise') {
                    return { ...obj, correctedX: obj.x }; // Store true X
                }
                return obj;
            });
            
            // Without VSOC: Car misjudges distances, brakes at wrong times
            if (!vsocActive) {
                const anyObjectNearFakePosition = nextObjects.some(o => 
                    o.type !== 'phantom' && o.type !== 'noise' && (o.x - 150) < 300
                );
                if (anyObjectNearFakePosition) {
                    setCarSpeed(prev => Math.max(2, prev * 0.98));
                    setCarBraking(true);
                } else {
                    setCarSpeed(simSpeed);
                    setCarBraking(false);
                }
            } else {
                setCarSpeed(simSpeed);
                setCarBraking(false);
            }
        }

        // Reset car behavior for normal mode
        if (attackType === 'none') {
            setCarSpeed(simSpeed);
            setCarBraking(false);
            setEmergencyStop(false);
        }

        return nextObjects;
        });
    }

    // 2. Drawing (Always Draw, even if paused)
    // Dark Sci-Fi Background with depth
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0e1a');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Starfield effect
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for(let i=0; i<50; i++) {
      const x = (i * 137.5) % width;
      const y = (i * 73.2) % 200;
      const size = Math.random() * 1.5;
      ctx.fillRect(x, y, size, size);
    }

    drawGrid(ctx, width, height);
    drawCar(ctx);

    // Update and draw particles (for attack effects)
    if (attackType === 'saturation') {
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      if (isRunning && Math.random() < 0.3) {
        particlesRef.current.push({
          x: 120 + Math.random() * 400,
          y: 200 + Math.random() * 200,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          life: 30
        });
      }
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = vsocActive ? `rgba(59, 130, 246, ${p.life/30})` : `rgba(239, 68, 68, ${p.life/30})`;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
    } else {
      particlesRef.current = [];
    }

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
    
    // Road Surface with glow
    const grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Grid Lines (Perspective) with glow
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = vsocActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = vsocActive ? 10 : 0;
    ctx.shadowColor = vsocActive ? '#3b82f6' : 'transparent';

    const offset = scrollOffset.current;
    
    // Vertical perspective lines
    for(let i = -w; i < w * 2; i+=100) {
        ctx.moveTo(i, horizonY);
        ctx.lineTo(i - (i - w/2) * 1.5, h); 
    }
    
    ctx.stroke();
    
    // Moving Horizontal Lines with enhanced visibility
    ctx.beginPath();
    ctx.shadowBlur = 5;
    for(let i=0; i<10; i++) {
        const yPos = horizonY + (i * 30 + offset) % (h-horizonY);
        if(yPos > horizonY) {
            const alpha = 1 - (yPos - horizonY) / (h - horizonY);
            ctx.strokeStyle = vsocActive ? `rgba(59, 130, 246, ${alpha * 0.4})` : `rgba(100, 116, 139, ${alpha * 0.2})`;
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
    
    // Brake lights when braking
    if (carBraking) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ef4444';
        ctx.fillRect(x - 65, y - 20, 8, 12);
        ctx.fillRect(x - 65, y + 8, 8, 12);
        ctx.restore();
    }
    
    // Emergency stop indicator
    if (emergencyStop) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, 100, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('EMERGENCY STOP', x - 60, y - 60);
        ctx.restore();
    }
    
    // VSOC Shield Bubble with enhanced animation
    if (vsocActive) {
        ctx.save();
        const pulseTime = Date.now() / 1000;
        const pulse = Math.sin(pulseTime * 2) * 0.2 + 0.8;
        ctx.beginPath();
        ctx.ellipse(x + 20, y, 90 * pulse, 40 * pulse, 0, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#3b82f6';
        ctx.stroke();
        ctx.fill();
        
        // Inner shield ring
        ctx.beginPath();
        ctx.ellipse(x + 20, y, 60 * pulse, 25 * pulse, 0, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    // Enhanced Headlights with better visibility
    ctx.save();
    const lightGrad = ctx.createRadialGradient(x + 50, y, 0, x + 50, y, 300);
    lightGrad.addColorStop(0, 'rgba(253, 224, 71, 0.3)');
    lightGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.1)');
    lightGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.moveTo(x + 50, y - 20);
    ctx.lineTo(x + 400, y - 80);
    ctx.lineTo(x + 400, y + 80);
    ctx.lineTo(x + 50, y + 20);
    ctx.fill();
    ctx.restore();

    // Car Body with improved depth
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    
    // Main body gradient
    const bodyGrad = ctx.createLinearGradient(x - 60, y - 25, x - 60, y + 25);
    bodyGrad.addColorStop(0, '#60a5fa');
    bodyGrad.addColorStop(0.5, '#3b82f6');
    bodyGrad.addColorStop(1, '#2563eb');
    ctx.fillStyle = bodyGrad;
    
    ctx.beginPath();
    ctx.moveTo(x + 60, y);
    ctx.lineTo(x, y - 25);
    ctx.lineTo(x - 60, y - 25);
    ctx.lineTo(x - 60, y + 25);
    ctx.lineTo(x, y + 25);
    ctx.closePath();
    ctx.fill();
    
    // Roof/Cockpit with glass effect
    const glassGrad = ctx.createLinearGradient(x - 50, y - 15, x - 50, y + 15);
    glassGrad.addColorStop(0, '#334155');
    glassGrad.addColorStop(0.5, '#1e293b');
    glassGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x - 20, y - 15);
    ctx.lineTo(x - 50, y - 15);
    ctx.lineTo(x - 50, y + 15);
    ctx.lineTo(x - 20, y + 15);
    ctx.closePath();
    ctx.fill();
    
    // Glass reflection
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x - 48, y - 13, 25, 8);
    ctx.restore();

    // Enhanced Sensor Array with better animation
    const time = Date.now() / 50;
    ctx.save();
    ctx.translate(x - 10, y);
    ctx.rotate(time * 0.05);
    
    // Sensor base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-15, -6, 30, 12);
    
    // Sensor core
    ctx.fillStyle = attackType === 'none' || vsocActive ? '#10b981' : '#ef4444'; 
    ctx.fillRect(-12, -4, 24, 8);
    
    // Enhanced glow
    ctx.shadowBlur = 25;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(-12, -4, 24, 8);
    
    // Sensor details
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for(let i=-8; i<=8; i+=4) {
      ctx.fillRect(i-1, -2, 2, 4);
    }
    
    ctx.restore();
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: ObjectType) => {
    if (obj.hidden) {
        // Show faint outline when hidden (camera can still see it)
        if (vsocActive) {
            ctx.save();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('CAMERA DETECTED', obj.x, obj.y - 5);
            ctx.restore();
        }
        return;
    }

    ctx.save();
    
    let color = '#a855f7'; 
    if (obj.type === 'pedestrian') color = '#22c55e';
    if (obj.type === 'phantom') color = '#ef4444';
    if (obj.type === 'noise') color = '#94a3b8';

    // Enhanced shadow with blur
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.filter = 'blur(4px)';
    ctx.beginPath();
    ctx.ellipse(obj.x + obj.width/2, obj.y + obj.height + 2, obj.width/2 + 5, 10, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.filter = 'none';

    // Main Body with improved rendering
    if (obj.type === 'noise') {
        ctx.fillStyle = color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    } else {
        // 3D-ish Block with gradients
        const objGrad = ctx.createLinearGradient(obj.x, obj.y, obj.x, obj.y + obj.height);
        objGrad.addColorStop(0, color);
        objGrad.addColorStop(1, color + '99');
        ctx.fillStyle = objGrad;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        
        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(obj.x, obj.y, obj.width, 6);
        
        // Side panel
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(obj.x + obj.width - 8, obj.y + 6, 8, obj.height - 6);
        
        // Details for vehicles
        if (obj.type === 'vehicle') {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(obj.x + 10, obj.y + 8, obj.width - 30, 15);
          ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
          ctx.fillRect(obj.x + 5, obj.y + obj.height/2 - 3, 8, 6);
        }
        
        // Details for pedestrians
        if (obj.type === 'pedestrian') {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath();
          ctx.arc(obj.x + obj.width/2, obj.y + 12, 8, 0, Math.PI*2);
          ctx.fill();
        }
    }

    // Enhanced VSOC TARGETING HUD
    if (obj.flagged && vsocActive) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        
        // Animated HUD Brackets
        const pad = 12;
        const bx = obj.x - pad;
        const by = obj.y - pad;
        const bw = obj.width + pad*2;
        const bh = obj.height + pad*2;
        const cornerLen = 15;

        ctx.beginPath();
        // Top Left
        ctx.moveTo(bx + cornerLen, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + cornerLen);
        // Top Right
        ctx.moveTo(bx + bw - cornerLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerLen);
        // Bot Left
        ctx.moveTo(bx + cornerLen, by + bh); ctx.lineTo(bx, by + bh); ctx.lineTo(bx, by + bh - cornerLen);
        // Bot Right
        ctx.moveTo(bx + bw - cornerLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cornerLen);
        ctx.stroke();
        
        // Center crosshair
        ctx.beginPath();
        const cx = bx + bw/2;
        const cy = by + bh/2;
        ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
        ctx.stroke();
        
        // Threat label with background
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillRect(bx - 2, by - 25, 140, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "Courier New"';
        ctx.fillText("⚠ THREAT DETECTED", bx + 3, by - 12);
        
        // Data panel
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(bx + bw + 5, by, 120, 50);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + bw + 5, by, 120, 50);
        
        ctx.fillStyle = '#fca5a5';
        ctx.font = '10px monospace';
        ctx.fillText(`CONFIDENCE: 99.8%`, bx + bw + 10, by + 15);
        ctx.fillText(`SOURCE: LIDAR`, bx + bw + 10, by + 28);
        ctx.fillText(`ACTION: REJECT`, bx + bw + 10, by + 41);
        
        ctx.globalAlpha = 0.4;
    }
    ctx.restore();
  };

  const calculateLidar = (ctx: CanvasRenderingContext2D, currentObjects: ObjectType[]) => {
    const sensorX = 120;
    const sensorY = 340;
    const numRays = 50; 
    const fov = Math.PI / 2.5;
    let minDist = 9999;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
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
          
          if (isNeutralized) {
            ctx.strokeStyle = '#3b82f6';
            ctx.shadowColor = '#3b82f6';
          } else if (hitObj?.type === 'phantom' && !vsocActive) {
            ctx.strokeStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
          } else {
            ctx.strokeStyle = '#10b981';
            ctx.shadowColor = '#10b981';
          }

          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 8;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
          
          // Enhanced hit point
          ctx.beginPath();
          ctx.arc(hitX, hitY, 4, 0, Math.PI*2);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.shadowBlur = 15;
          ctx.fill();
          
          // Inner glow
          ctx.beginPath();
          ctx.arc(hitX, hitY, 2, 0, Math.PI*2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 5;
          ctx.fill();
      } else {
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.15;
          ctx.shadowBlur = 0;
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
  }, [isRunning, objects, attackType, simSpeed, carSpeed, lidarRange, vsocActive]); 

  const reset = () => {
    setIsRunning(false);
    setObjects([
        { x: 600, y: 280, width: 80, height: 50, type: 'vehicle', id: 1 },
        { x: 900, y: 300, width: 30, height: 60, type: 'pedestrian', id: 2 },
    ]);
    setAttackType('none');
    setLogs([]);
    setCarSpeed(4);
    setCarBraking(false);
    setEmergencyStop(false);
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
            
            {/* Attack Info Panel */}
            {showAttackInfo && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-xl border-2 border-blue-500/30 shadow-xl">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} />
                    {attackInfo[attackType].title}
                  </h3>
                  <button 
                    onClick={() => setShowAttackInfo(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-slate-300 leading-relaxed">{attackInfo[attackType].desc}</p>
                  </div>
                  {vsocActive && attackType !== 'none' && (
                    <div className="mt-3 pt-3 border-t border-blue-500/30">
                      <p className="text-blue-300 font-semibold mb-1 flex items-center gap-2">
                        <Shield size={14} /> VSOC Mitigation:
                      </p>
                      <p className="text-slate-300 leading-relaxed">{attackInfo[attackType].vsocHelp}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!showAttackInfo && (
              <button
                onClick={() => setShowAttackInfo(true)}
                className="w-full bg-slate-900 hover:bg-slate-800 p-3 rounded-lg border border-slate-700 text-blue-400 text-sm font-semibold transition-all"
              >
                Show Attack Info
              </button>
            )}

            {/* Attack Panel */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Zap size={100} />
                </div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400 relative z-10">
                    <Zap size={20} /> Attack Vectors
                </h3>
                <div className="grid grid-cols-1 gap-2 relative z-10">
                    {[
                        { id: 'none', label: 'Secure Mode', desc: 'Normal Operations', icon: '✓' },
                        { id: 'phantom', label: 'Phantom Injection', desc: 'False Positives', icon: '👻' },
                        { id: 'hiding', label: 'Object Cloaking', desc: 'Signal Absorbtion', icon: '🚫' },
                        { id: 'relay', label: 'Relay Attack', desc: 'Position Spoofing', icon: '📡' },
                        { id: 'saturation', label: 'Signal Jamming', desc: 'Sensor Overload', icon: '⚡' },
                    ].map((attack) => (
                        <button
                            key={attack.id}
                            onClick={() => setAttackType(attack.id as any)}
                            className={`text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                                attackType === attack.id 
                                ? 'bg-red-900/40 border-red-500 text-red-100 shadow-lg shadow-red-900/20' 
                                : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600 text-slate-300'
                            }`}
                        >
                            <span className="text-2xl">{attack.icon}</span>
                            <div className="flex-1">
                              <span className="font-bold text-sm block">{attack.label}</span>
                              <span className="text-xs opacity-70">{attack.desc}</span>
                            </div>
                            {attackType === attack.id && <Activity size={16} className="animate-pulse text-red-400" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sensor Settings */}
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
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-20">
                    <div className="flex gap-3">
                      <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded border border-slate-600 text-xs text-slate-300 font-mono">
                          <span className="text-emerald-400">●</span> LIDAR: 10Hz
                      </div>
                      {vsocActive && (
                          <div className="bg-blue-900/90 backdrop-blur-sm px-3 py-1.5 rounded border border-blue-400 text-xs text-blue-100 font-bold font-mono flex items-center gap-2 shadow-lg shadow-blue-500/30">
                              <Server size={12} className="animate-pulse" />
                              VSOC ACTIVE
                          </div>
                      )}
                    </div>
                    <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded border border-slate-600 text-xs text-slate-300 font-mono">
                        RANGE: {lidarRange}m
                    </div>
                </div>

                <canvas
                    ref={canvasRef}
                    width={800}
                    height={450}
                    className="w-full h-auto block bg-[#0f172a]"
                />
                
                {/* Attack Warning Banner */}
                {attackType !== 'none' && !vsocActive && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-red-700 text-white px-8 py-3 rounded-lg font-bold animate-pulse flex items-center gap-3 shadow-2xl shadow-red-900/60 border-2 border-red-400 z-20">
                        <AlertTriangle size={24} className="animate-bounce" />
                        <div>
                          <div className="text-sm uppercase tracking-wider">CRITICAL ALERT</div>
                          <div className="text-xs opacity-90">Sensor Integrity Compromised</div>
                        </div>
                    </div>
                )}
                {attackType !== 'none' && vsocActive && (
                     <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-3 shadow-2xl shadow-blue-900/50 border-2 border-blue-300 z-20">
                        <Shield size={24} />
                        <div>
                          <div className="text-sm uppercase tracking-wider">THREAT NEUTRALIZED</div>
                          <div className="text-xs opacity-90">Multi-Sensor Validation Active</div>
                        </div>
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
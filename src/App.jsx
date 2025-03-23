import React, { useState, useEffect, useRef } from 'react';

const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-7;

const canvasSize = 600;
const center = canvasSize / 2;
const mirrorRadius = 50;
const spacing = 150;

const circleMirrors = [];
for (let row = -1; row <= 1; row++) {
  for (let col = -1; col <= 1; col++) {
    if (row === 0 && col === 0) continue;
    circleMirrors.push({
      cx: center + col * spacing,
      cy: center + row * spacing
    });
  }
}

const wallOffset = 50;
const wallSegments = [
  { x1: wallOffset, y1: wallOffset, x2: canvasSize - wallOffset, y2: wallOffset },
  { x1: canvasSize - wallOffset, y1: wallOffset, x2: canvasSize - wallOffset, y2: canvasSize - wallOffset },
  { x1: canvasSize - wallOffset, y1: canvasSize - wallOffset, x2: wallOffset, y2: canvasSize - wallOffset },
  { x1: wallOffset, y1: canvasSize - wallOffset, x2: wallOffset, y2: wallOffset }
];

function lineCircleIntersection(x, y, dx, dy, cx, cy, r) {
  const fx = x - cx;
  const fy = y - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  const t = t1 > EPSILON ? t1 : t2 > EPSILON ? t2 : null;
  if (t === null) return null;
  return {
    x: x + dx * t,
    y: y + dy * t,
    t,
    normal: {
      x: (x + dx * t - cx) / r,
      y: (y + dy * t - cy) / r
    }
  };
}

function lineSegmentIntersection(x, y, dx, dy, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = x - x1;
  const wy = y - y1;
  const det = dx * vy - dy * vx;
  if (Math.abs(det) < EPSILON) return null;
  const t = (vx * wy - vy * wx) / det;
  const s = (dx * wy - dy * wx) / det;
  if (t > EPSILON && s >= 0 && s <= 1) {
    const ix = x + dx * t;
    const iy = y + dy * t;
    const len = Math.sqrt(vx * vx + vy * vy);
    const nx = -vy / len;
    const ny = vx / len;
    return { x: ix, y: iy, t, normal: { x: nx, y: ny } };
  }
  return null;
}

function reflectVector(dx, dy, nx, ny) {
  const dot = dx * nx + dy * ny;
  const rx = dx - 2 * dot * nx;
  const ry = dy - 2 * dot * ny;
  return { dx: rx, dy: ry };
}

export default function OpticalSim() {
  const [angleDeg, setAngleDeg] = useState(0);
  const [trail, setTrail] = useState([]);
  const frame = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      frame.current += 1;
      setTrail((prev) => [
        { angle: angleDeg, timestamp: frame.current },
        ...prev
      ].slice(0, 20));
    }, 500);
    return () => clearInterval(interval);
  }, [angleDeg]);

  const handleSliderChange = (e) => {
    setAngleDeg(parseFloat(e.target.value));
  };

  const adjustAngle = (delta) => {
    setAngleDeg((prev) => (prev + delta + 360) % 360);
  };

  function computePath(angleDeg) {
    const angle = (angleDeg % 360) * DEG_TO_RAD;
    let x = center;
    let y = center;
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    const path = [];
    for (let bounce = 0; bounce < 20; bounce++) {
      let closest = null;
      let minT = Infinity;
      for (const mirror of circleMirrors) {
        const hit = lineCircleIntersection(x, y, dx, dy, mirror.cx, mirror.cy, mirrorRadius);
        if (hit && hit.t < minT) {
          closest = hit;
          minT = hit.t;
        }
      }
      for (const wall of wallSegments) {
        const hit = lineSegmentIntersection(x, y, dx, dy, wall.x1, wall.y1, wall.x2, wall.y2);
        if (hit && hit.t < minT) {
          closest = hit;
          minT = hit.t;
        }
      }
      if (!closest) break;
      path.push({ x1: x, y1: y, x2: closest.x, y2: closest.y });
      const reflected = reflectVector(dx, dy, closest.normal.x, closest.normal.y);
      dx = reflected.dx;
      dy = reflected.dy;
      x = closest.x;
      y = closest.y;
    }
    return path;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">Optisk simulering med cylindriska speglar</h1>
      <div className="mb-4">
        <label className="block mb-1 font-semibold">Vinkel (°): {angleDeg.toFixed(4)}</label>
        <input
          type="range"
          min={0}
          max={360}
          step={0.0001}
          value={angleDeg % 360}
          onChange={handleSliderChange}
          className="w-full mb-2"
        />
        <div className="flex flex-wrap gap-2">
          {[1, 0.1, 0.01, 0.001, 0.0001].map((step) => (
            <>
              <button key={`-step-${step}`} onClick={() => adjustAngle(-step)} className="px-3 py-1 bg-blue-100 rounded">-{step}°</button>
              <button key={`+step-${step}`} onClick={() => adjustAngle(step)} className="px-3 py-1 bg-blue-100 rounded">+{step}°</button>
            </>
          ))}
        </div>
      </div>

      <svg width={canvasSize} height={canvasSize} className="border">
        {circleMirrors.map((m, i) => (
          <circle key={i} cx={m.cx} cy={m.cy} r={mirrorRadius} stroke="black" fill="none" />
        ))}
        {wallSegments.map((w, i) => (
          <line key={`wall-${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="gray" strokeWidth={2} />
        ))}

        {trail.map((entry, i) => {
          const age = frame.current - entry.timestamp;
          const opacity = Math.min(1, 0.8 + (age / 10) * 0.2); // Starta på 0.8, öka mot 1
          const segments = computePath(entry.angle);
          return segments.map((seg, j) => (
            <line
              key={`trail-${i}-${j}`}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={`rgba(150,150,150,${opacity})`}
              strokeWidth={1}
            />
          ));
        })}

        {computePath(angleDeg).map((seg, i) => (
          <line
            key={`live-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={i === 0 ? 'red' : 'blue'}
            strokeWidth={i === 0 ? 2 : 1.5}
          />
        ))}
      </svg>
    </div>
  );
}

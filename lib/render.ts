import type { Game } from './game';
const TAU = Math.PI * 2;
function polygon(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  n: number,
  angle: number,
) {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = angle + (i * TAU) / n;
    i
      ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
function ship(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  scale = 1,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(scale, scale);
  c.shadowColor = '#bcff5c';
  c.shadowBlur = 20;
  c.strokeStyle = '#d2ff97';
  c.fillStyle = '#bcff5c';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(20, 0);
  c.lineTo(-13, -12);
  c.lineTo(-6, 0);
  c.lineTo(-13, 12);
  c.closePath();
  c.fill();
  c.stroke();
  c.shadowBlur = 0;
  c.fillStyle = '#182822';
  c.beginPath();
  c.moveTo(9, 0);
  c.lineTo(-7, -4);
  c.lineTo(-3, 0);
  c.lineTo(-7, 4);
  c.fill();
  c.restore();
}
export function drawGame(
  c: CanvasRenderingContext2D,
  g: Game,
  pw: number,
  ph: number,
  time: number,
) {
  const w = g.width,
    h = g.height;
  c.setTransform(pw / w, 0, 0, ph / h, 0, 0);
  c.fillStyle = '#090e14';
  c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(
    w * 0.55,
    h * 0.48,
    20,
    w * 0.55,
    h * 0.48,
    w * 0.75,
  );
  glow.addColorStop(0, '#152527');
  glow.addColorStop(1, '#080c13');
  c.fillStyle = glow;
  c.fillRect(0, 0, w, h);
  c.lineWidth = 0.7;
  c.strokeStyle = '#25363566';
  c.beginPath();
  for (let x = 0; x <= w; x += 48) {
    c.moveTo(x, 0);
    c.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += 48) {
    c.moveTo(0, y);
    c.lineTo(w, y);
  }
  c.stroke();
  c.fillStyle = '#5a807857';
  for (let x = 48; x < w; x += 144)
    for (let y = 48; y < h; y += 144) {
      c.fillRect(x - 2, y - 0.5, 4, 1);
      c.fillRect(x - 0.5, y - 2, 1, 4);
    }
  c.save();
  if (g.shake > 0)
    c.translate(Math.sin(time * 91) * g.shake, Math.cos(time * 87) * g.shake);
  if (g.phase === 'menu') {
    const cx = w * 0.73,
      cy = h * 0.52;
    c.strokeStyle = '#a4e55926';
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(cx, cy, 110 + i * 67, 160 + i * 60, -0.4, 0, TAU);
      c.stroke();
    }
    c.strokeStyle = '#bcff5c88';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(cx, cy, 177, 220, -0.4, time * 0.12, time * 0.12 + 1.1);
    c.stroke();
    for (let i = 0; i < 32; i++) {
      const a = i * 2.399 + time * 0.035,
        rx = 80 + ((i * 73) % 330),
        ry = 70 + ((i * 41) % 260);
      c.globalAlpha = 0.25 + (i % 4) * 0.15;
      c.fillStyle = i % 4 === 0 ? '#fd678c' : '#bcff5c';
      c.fillRect(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 2, 2);
    }
    c.globalAlpha = 1;
    ship(
      c,
      cx + Math.sin(time * 0.7) * 15,
      cy + Math.cos(time * 0.5) * 16,
      -0.7,
      2.7,
    );
    c.strokeStyle = '#ff678e';
    c.shadowColor = '#ff678e';
    c.shadowBlur = 12;
    polygon(c, cx - 170, cy - 120, 15, 4, time * 0.2);
    c.stroke();
    polygon(c, cx + 180, cy + 100, 20, 3, -time * 0.2);
    c.stroke();
    c.shadowBlur = 0;
  } else {
    for (const z of g.hazards) {
      const active = z.age >= z.warning;
      c.save();
      c.strokeStyle = active ? '#ff5879' : '#ff9871';
      c.fillStyle = active ? '#f542663b' : '#f58c6810';
      c.lineWidth = active ? 3 : 1.5;
      c.setLineDash(active ? [] : [6, 7]);
      c.beginPath();
      c.arc(z.x, z.y, z.r, 0, TAU);
      c.fill();
      c.stroke();
      c.setLineDash([]);
      if (!active) {
        c.lineWidth = 3;
        c.beginPath();
        c.arc(
          z.x,
          z.y,
          z.r,
          -Math.PI / 2,
          -Math.PI / 2 + Math.min(1, z.age / z.warning) * TAU,
        );
        c.stroke();
      }
      c.font = '12px monospace';
      c.textAlign = 'center';
      c.fillStyle = '#ffb49d';
      c.fillText(active ? 'РАЗЛОМ' : 'ВНИМАНИЕ', z.x, z.y + 4);
      c.restore();
    }
    if (g.pulseFlash > 0) {
      c.save();
      c.globalAlpha = g.pulseFlash / 0.45;
      c.strokeStyle = '#76e9ff';
      c.shadowColor = '#76e9ff';
      c.shadowBlur = 20;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(
        g.pulseX,
        g.pulseY,
        g.pulseRadius * (1 - g.pulseFlash / 0.45),
        0,
        TAU,
      );
      c.stroke();
      c.restore();
    }
    for (const d of g.drops) {
      c.save();
      c.translate(d.x, d.y);
      c.rotate(time * 1.5);
      c.fillStyle = '#bcff5c';
      c.shadowColor = '#bcff5c';
      c.shadowBlur = 13;
      c.fillRect(-4, -4, 8, 8);
      c.restore();
    }
    for (const e of g.enemies) {
      const color =
        e.kind === 3
          ? '#bc8dff'
          : e.kind === 5
            ? '#73dafa'
            : e.kind === 4
              ? '#ff764a'
              : e.kind === 2
                ? '#ffb369'
                : '#ff678e';
      c.strokeStyle = e.hit > 0 ? '#ffffff' : color;
      c.fillStyle =
        e.hit > 0 ? '#ffffff' : e.kind === 3 ? '#3b235d' : '#351b2b';
      c.lineWidth = 2;
      c.shadowColor = color;
      c.shadowBlur = 12;
      if (e.age < 0.65) {
        c.globalAlpha = 0.35 + e.age;
        c.beginPath();
        c.arc(e.x, e.y, e.r + 25 * (1 - e.age / 0.65), 0, TAU);
        c.stroke();
        c.globalAlpha = 1;
        c.shadowBlur = 0;
        continue;
      }
      if (e.state === 'windup') {
        c.save();
        c.strokeStyle = color;
        c.globalAlpha = 0.5 + Math.sin(time * 20) * 0.2;
        c.lineWidth = e.kind === 4 ? 3 : 1.5;
        c.setLineDash(e.kind === 4 ? [10, 8] : [3, 7]);
        const length = e.kind === 4 ? 330 : 1500,
          a = e.targetAngle ?? 0;
        c.beginPath();
        c.moveTo(e.x, e.y);
        c.lineTo(e.x + Math.cos(a) * length, e.y + Math.sin(a) * length);
        c.stroke();
        c.restore();
      }
      const rotation =
        e.kind === 4 || e.kind === 5
          ? (e.targetAngle ?? 0)
          : e.kind === 1
            ? Math.atan2(g.player.y - e.y, g.player.x - e.x)
            : time * (e.kind === 3 ? 0.4 : 0.65);
      polygon(
        c,
        e.x,
        e.y,
        e.r,
        e.kind === 3 ? 6 : e.kind === 5 ? 5 : e.kind === 1 ? 3 : 4,
        rotation,
      );
      c.fill();
      c.stroke();
      if (e.kind === 3) {
        polygon(c, e.x, e.y, e.r * 0.55, 6, -rotation);
        c.stroke();
        c.shadowBlur = 0;
        c.fillStyle = '#332541';
        c.fillRect(e.x - 45, e.y - 53, 90, 4);
        c.fillStyle = color;
        c.fillRect(e.x - 45, e.y - 53, (90 * e.hp) / e.maxHp, 4);
        c.font = '12px monospace';
        c.textAlign = 'center';
        c.fillText(
          e.hp < e.maxHp * 0.45 ? 'БОСС · ЯРОСТЬ' : 'СТРАЖ РАЗЛОМА',
          e.x,
          e.y - 62,
        );
      } else {
        c.fillStyle = color;
        c.fillRect(e.x - 2, e.y - 2, 4, 4);
      }
      c.shadowBlur = 0;
    }
    for (const b of g.bullets) {
      c.strokeStyle = b.hostile ? '#ff916f' : b.rail ? '#9fdcff' : '#ceff86';
      c.fillStyle = c.strokeStyle;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 10;
      c.lineWidth = b.hostile ? 3 : b.rail ? 6 : 3.5;
      c.beginPath();
      if (b.hostile) c.arc(b.x, b.y, 4, 0, TAU);
      else {
        c.moveTo(b.x, b.y);
        c.lineTo(
          b.x - b.vx * (b.rail ? 0.085 : 0.019),
          b.y - b.vy * (b.rail ? 0.085 : 0.019),
        );
      }
      c.stroke();
      c.shadowBlur = 0;
    }
    for (const p of g.particles) {
      c.globalAlpha = p.life / p.maxLife;
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.r, p.r);
    }
    c.globalAlpha = 1;
    if (g.player.hp > 0) {
      if (g.weapon === 'rail' && g.railCharge > 0) {
        const p = g.player;
        c.save();
        c.strokeStyle = '#9fdcff';
        c.globalAlpha = 0.3 + g.railCharge * 0.6;
        c.lineWidth = g.railCharge > 0.95 ? 2.5 : 1;
        c.setLineDash([6, 9]);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(
          p.x + Math.cos(p.angle) * 1500,
          p.y + Math.sin(p.angle) * 1500,
        );
        c.stroke();
        c.setLineDash([]);
        c.lineWidth = 3;
        c.beginPath();
        c.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + g.railCharge * TAU);
        c.stroke();
        c.restore();
      }
      c.globalAlpha =
        g.player.invincible > 0 ? 0.55 + 0.45 * Math.sin(time * 28) ** 2 : 1;
      ship(c, g.player.x, g.player.y, g.player.angle);
      c.globalAlpha = 1;
      if (g.player.invincible > 0) {
        c.strokeStyle = '#bcff5c88';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(g.player.x, g.player.y, 27, 0, TAU);
        c.stroke();
      }
    }
  }
  c.restore();
  c.strokeStyle = '#607f653d';
  c.lineWidth = 1;
  c.strokeRect(14, 14, w - 28, h - 28);
  c.strokeStyle = '#bcff5c70';
  c.lineWidth = 2;
  for (const [x, y, dx, dy] of [
    [14, 14, 1, 1],
    [w - 14, 14, -1, 1],
    [14, h - 14, 1, -1],
    [w - 14, h - 14, -1, -1],
  ]) {
    c.beginPath();
    c.moveTo(x + dx * 18, y);
    c.lineTo(x, y);
    c.lineTo(x, y + dy * 18);
    c.stroke();
  }
}

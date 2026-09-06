export type Phase = 'menu' | 'play' | 'paused' | 'upgrade' | 'over' | 'win';
export type UpgradeId =
  | 'rapid'
  | 'power'
  | 'spread'
  | 'shield'
  | 'speed'
  | 'dash';
export const UPGRADES: Record<
  UpgradeId,
  { name: string; description: string; symbol: string }
> = {
  rapid: {
    name: 'Овердрайв',
    description: 'На 20% быстрее стрельба',
    symbol: '»',
  },
  power: {
    name: 'Плазменное ядро',
    description: '+1 к урону каждого выстрела',
    symbol: '✳',
  },
  spread: {
    name: 'Мультивыстрел',
    description: '+1 снаряд в каждом залпе',
    symbol: '⋔',
  },
  shield: {
    name: 'Новый щит',
    description: '+1 к щиту и полное восстановление',
    symbol: '◇',
  },
  speed: {
    name: 'Ионный двигатель',
    description: '+15% к скорости движения',
    symbol: '↗',
  },
  dash: {
    name: 'Фазовый сдвиг',
    description: 'Рывок восстанавливается на 20% быстрее',
    symbol: 'ϟ',
  },
};
export interface Enemy {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  kind: number;
  age: number;
  cooldown: number;
  hit: number;
}
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  hostile: boolean;
}
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  r: number;
}
export interface Drop {
  x: number;
  y: number;
  age: number;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export class Game {
  phase: Phase = 'menu';
  width = 1000;
  height = 680;
  wave = 1;
  score = 0;
  kills = 0;
  elapsed = 0;
  combo = 1;
  comboTime = 0;
  comboKills = 0;
  player = {
    x: 500,
    y: 340,
    hp: 5,
    maxHp: 5,
    angle: -Math.PI / 2,
    invincible: 0,
    speed: 225,
  };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  drops: Drop[] = [];
  events: string[] = [];
  choices: UpgradeId[] = [];
  damage = 1;
  fireInterval = 0.29;
  shotCount = 1;
  fireTime = 0;
  dashCooldown = 0;
  dashInterval = 2.8;
  dashTime = 0;
  dashX = 0;
  dashY = -1;
  moveX = 0;
  moveY = -1;
  shake = 0;
  spawnTime = 0;
  spawnLeft = 0;
  totalWave = 0;
  waveKills = 0;
  rng: () => number;
  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }
  get waveProgress() {
    return this.totalWave ? (this.waveKills / this.totalWave) * 100 : 0;
  }
  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.player.x = clamp(this.player.x, 22, w - 22);
    this.player.y = clamp(this.player.y, 22, h - 22);
  }
  start() {
    this.phase = 'play';
    this.wave = 1;
    this.score = this.kills = this.elapsed = 0;
    this.combo = 1;
    this.comboTime = this.comboKills = 0;
    this.player = {
      x: this.width / 2,
      y: this.height / 2,
      hp: 5,
      maxHp: 5,
      angle: -Math.PI / 2,
      invincible: 1,
      speed: 225,
    };
    this.enemies = [];
    this.bullets = [];
    this.drops = [];
    this.particles = [];
    this.events = [];
    this.choices = [];
    this.damage = 1;
    this.fireInterval = 0.29;
    this.shotCount = 1;
    this.fireTime = 0;
    this.dashCooldown = this.dashTime = 0;
    this.dashInterval = 2.8;
    this.moveX = 0;
    this.moveY = -1;
    this.shake = 0;
    this.beginWave();
  }
  beginWave() {
    this.spawnLeft = 7 + this.wave * 3;
    this.totalWave = this.spawnLeft;
    this.waveKills = 0;
    this.spawnTime = 1.1;
    this.bullets = [];
    this.phase = 'play';
  }
  togglePause() {
    if (this.phase === 'play') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'play';
  }
  dash(x = 0, y = 0) {
    if (this.phase !== 'play' || this.dashCooldown > 0) return false;
    const len = Math.hypot(x, y);
    this.dashX = len > 0.1 ? x / len : this.moveX;
    this.dashY = len > 0.1 ? y / len : this.moveY;
    this.dashTime = 0.18;
    this.dashCooldown = this.dashInterval;
    this.player.invincible = Math.max(this.player.invincible, 0.32);
    this.events.push('dash');
    return true;
  }
  upgrade(id: UpgradeId) {
    if (this.phase !== 'upgrade' || !this.choices.includes(id)) return false;
    if (id === 'rapid')
      this.fireInterval = Math.max(0.1, this.fireInterval * 0.8);
    if (id === 'power') this.damage++;
    if (id === 'spread') this.shotCount = Math.min(5, this.shotCount + 1);
    if (id === 'shield') {
      this.player.maxHp++;
      this.player.hp = this.player.maxHp;
    }
    if (id === 'speed') this.player.speed *= 1.15;
    if (id === 'dash')
      this.dashInterval = Math.max(0.7, this.dashInterval * 0.8);
    this.wave++;
    this.choices = [];
    this.dashCooldown = 0;
    this.player.invincible = 1;
    this.beginWave();
    return true;
  }
  burst(x: number, y: number, color: string, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2,
        s = 40 + this.rng() * 180,
        life = 0.25 + this.rng() * 0.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        color,
        r: 1 + this.rng() * 3,
      });
    }
    if (this.particles.length > 500)
      this.particles.splice(0, this.particles.length - 500);
  }
  spawn() {
    const boss = this.wave % 5 === 0 && this.spawnLeft === this.totalWave;
    const kind = boss
      ? 3
      : this.wave >= 3 && this.rng() < 0.24
        ? 2
        : this.rng() < 0.28
          ? 1
          : 0;
    const side = Math.floor(this.rng() * 4),
      margin = 30;
    let x =
      side === 0
        ? margin
        : side === 1
          ? this.width - margin
          : margin + this.rng() * (this.width - margin * 2);
    let y =
      side === 2
        ? margin
        : side === 3
          ? this.height - margin
          : margin + this.rng() * (this.height - margin * 2);
    if (Math.hypot(x - this.player.x, y - this.player.y) < 190) {
      x = this.width - this.player.x;
      y = this.height - this.player.y;
    }
    const hp =
      kind === 3
        ? this.wave === 10
          ? 110
          : 60
        : kind === 2
          ? 3 + Math.floor(this.wave / 3)
          : 1 + Math.floor(this.wave / 4);
    this.enemies.push({
      x,
      y,
      r: kind === 3 ? 36 : kind === 2 ? 19 : kind === 1 ? 12 : 15,
      hp,
      maxHp: hp,
      kind,
      age: 0,
      cooldown: 1.7,
      hit: 0,
    });
    this.spawnLeft--;
  }
  hurt() {
    if (this.player.invincible > 0 || this.phase !== 'play') return;
    this.player.hp--;
    this.player.invincible = 1.4;
    this.combo = 1;
    this.comboTime = this.comboKills = 0;
    this.shake = 9;
    this.burst(this.player.x, this.player.y, '#ff5e83', 22);
    this.events.push('hit');
    if (this.player.hp <= 0) {
      this.phase = 'over';
      this.dashTime = 0;
    }
  }
  update(dt: number, input: { x: number; y: number; dash: boolean }) {
    if (this.phase !== 'play') return;
    dt = clamp(dt, 0, 0.05);
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 26);
    const p = this.player;
    p.invincible = Math.max(0, p.invincible - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.comboTime -= dt;
    if (this.comboTime <= 0) {
      this.combo = 1;
      this.comboKills = 0;
    }
    let { x, y } = input;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    if (len > 0.05) {
      const n = Math.hypot(x, y);
      this.moveX = x / n;
      this.moveY = y / n;
    }
    if (input.dash) this.dash(x, y);
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      p.x += this.dashX * dt * 900;
      p.y += this.dashY * dt * 900;
      this.burst(p.x, p.y, '#bcff5c', 2);
    } else {
      p.x += x * p.speed * dt;
      p.y += y * p.speed * dt;
    }
    p.x = clamp(p.x, 20, this.width - 20);
    p.y = clamp(p.y, 20, this.height - 20);
    this.spawnTime -= dt;
    if (this.spawnLeft > 0 && this.spawnTime <= 0) {
      this.spawn();
      this.spawnTime = Math.max(0.38, 1.25 - this.wave * 0.07);
    }
    const targets = this.enemies.filter((e) => e.age >= 0.65 && e.hp > 0);
    let nearest: Enemy | undefined,
      dist = Infinity;
    for (const e of targets) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < dist) {
        dist = d;
        nearest = e;
      }
    }
    if (nearest) p.angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    else if (len > 0.05) p.angle = Math.atan2(y, x);
    this.fireTime -= dt;
    if (nearest && this.fireTime <= 0) {
      this.fireTime = this.fireInterval;
      this.events.push('shoot');
      for (let i = 0; i < this.shotCount; i++) {
        const a = p.angle + (i - (this.shotCount - 1) / 2) * 0.15;
        this.bullets.push({
          x: p.x + Math.cos(a) * 19,
          y: p.y + Math.sin(a) * 19,
          vx: Math.cos(a) * 650,
          vy: Math.sin(a) * 650,
          life: 1.8,
          damage: this.damage,
          hostile: false,
        });
      }
    }
    for (const e of this.enemies) {
      e.age += dt;
      e.hit = Math.max(0, e.hit - dt);
      if (e.age < 0.65 || e.hp <= 0) continue;
      const a = Math.atan2(p.y - e.y, p.x - e.x),
        d = Math.hypot(p.x - e.x, p.y - e.y);
      const speed =
        (e.kind === 3 ? 43 : e.kind === 1 ? 125 : e.kind === 2 ? 57 : 78) *
        (1 + this.wave * 0.035);
      const advance = e.kind === 2 && d < 270 ? -0.25 : 1;
      e.x += Math.cos(a) * speed * dt * advance;
      e.y += Math.sin(a) * speed * dt * advance;
      if (e.kind >= 2) {
        e.cooldown -= dt;
        if (e.cooldown <= 0) {
          e.cooldown = e.kind === 3 ? 1.35 : 2.8;
          const count = e.kind === 3 ? 12 : 1;
          for (let i = 0; i < count; i++) {
            const angle = e.kind === 3 ? a + (i * Math.PI * 2) / count : a;
            this.bullets.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(angle) * (e.kind === 3 ? 150 : 185),
              vy: Math.sin(angle) * (e.kind === 3 ? 150 : 185),
              life: 7,
              damage: 1,
              hostile: true,
            });
          }
        }
      }
      if (d < e.r + 12) this.hurt();
    }
    for (const b of this.bullets) {
      const oldX = b.x,
        oldY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (b.hostile) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < 16) {
          this.hurt();
          b.life = 0;
        }
        continue;
      }
      // Swept collision keeps fast shots from passing through small targets.
      const dx = b.x - oldX,
        dy = b.y - oldY,
        dd = dx * dx + dy * dy;
      for (const e of this.enemies) {
        if (e.age < 0.65 || e.hp <= 0) continue;
        const t = dd
          ? clamp(((e.x - oldX) * dx + (e.y - oldY) * dy) / dd, 0, 1)
          : 0;
        if (Math.hypot(oldX + t * dx - e.x, oldY + t * dy - e.y) < e.r + 4) {
          b.life = 0;
          e.hp -= b.damage;
          e.hit = 0.09;
          if (e.hp <= 0) {
            this.kills++;
            this.waveKills++;
            this.comboKills++;
            this.combo = Math.min(5, 1 + Math.floor(this.comboKills / 5));
            this.comboTime = 4;
            this.score +=
              (e.kind === 3 ? 2000 : e.kind === 2 ? 180 : 100) * this.combo;
            this.drops.push({ x: e.x, y: e.y, age: 0 });
            this.burst(
              e.x,
              e.y,
              e.kind === 3 ? '#c79bff' : '#ff678e',
              e.kind === 3 ? 45 : 13,
            );
            this.events.push('kill');
          }
          break;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.bullets = this.bullets.filter(
      (b) =>
        b.life > 0 &&
        b.x > -60 &&
        b.x < this.width + 60 &&
        b.y > -60 &&
        b.y < this.height + 60,
    );
    for (const d of this.drops) {
      d.age += dt;
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (dist < 125 && dist > 0) {
        d.x += ((p.x - d.x) / dist) * dt * 360;
        d.y += ((p.y - d.y) / dist) * dt * 360;
      }
      if (dist < 22) {
        d.age = 99;
        this.score += 35 * this.combo;
        this.comboTime = 4;
        this.events.push('pickup');
      }
    }
    this.drops = this.drops.filter((d) => d.age < 12);
    for (const a of this.particles) {
      a.life -= dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vx *= 1 - dt * 3;
      a.vy *= 1 - dt * 3;
    }
    this.particles = this.particles.filter((a) => a.life > 0);
    if (
      this.phase === 'play' &&
      this.spawnLeft === 0 &&
      this.enemies.length === 0
    ) {
      this.score += this.drops.length * 35 * this.combo;
      this.drops = [];
      this.bullets = [];
      if (this.wave === 10) {
        this.phase = 'win';
        this.score += this.player.hp * 500;
      } else {
        this.phase = 'upgrade';
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter(
          (id) => id !== 'spread' || this.shotCount < 5,
        );
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        this.choices = pool.slice(0, 3);
      }
    }
  }
}

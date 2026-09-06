export type Phase = 'menu' | 'play' | 'paused' | 'upgrade' | 'over' | 'win';
export type Weapon = 'plasma' | 'rail';
export const DIFFICULTIES = {
  easy: {
    name: 'Лёгкая',
    description: '6 щитов · меньше врагов · больше времени на уклонение',
    shield: 6,
    health: 0.7,
    count: 0.75,
    speed: 0.8,
    pressure: 0.8,
    warning: 1.3,
  },
  normal: {
    name: 'Обычная',
    description: '4 щита · прежний баланс · полный набор атак',
    shield: 4,
    health: 1,
    count: 1,
    speed: 1,
    pressure: 1,
    warning: 1,
  },
  hard: {
    name: 'Сложная',
    description: '3 щита · больше и крепче враги · атаки быстрее',
    shield: 3,
    health: 1.35,
    count: 1.25,
    speed: 1.15,
    pressure: 1.2,
    warning: 0.85,
  },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;
export type HeatMode = 'standard' | 'off' | 'custom';
export interface GameSettings {
  difficulty: Difficulty;
  heatMode: HeatMode;
  heatRate: number;
  coolingRate: number;
}
export function normalizeSettings(value: unknown = {}): GameSettings {
  const s =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const rate = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n)
      ? Math.max(25, Math.min(200, Math.round(n / 25) * 25))
      : 100;
  return {
    difficulty:
      s.difficulty === 'easy' || s.difficulty === 'hard'
        ? s.difficulty
        : 'normal',
    heatMode:
      s.heatMode === 'off' || s.heatMode === 'custom' ? s.heatMode : 'standard',
    heatRate: rate(s.heatRate),
    coolingRate: rate(s.coolingRate),
  };
}
export function settingsRecordKey(value: GameSettings) {
  const s = normalizeSettings(value);
  const heat =
    s.heatMode === 'off'
      ? 'off'
      : s.heatMode === 'custom'
        ? `${s.heatRate}-${s.coolingRate}`
        : '100-100';
  return s.difficulty === 'normal' && heat === '100-100'
    ? 'neon-rift-v2-best'
    : `neon-rift-v2-best:${s.difficulty}:${heat}`;
}
export type UpgradeId =
  | 'rapid'
  | 'power'
  | 'spread'
  | 'shield'
  | 'speed'
  | 'dash'
  | 'cooling'
  | 'pulse';
export const UPGRADES: Record<
  UpgradeId,
  { name: string; description: string; symbol: string }
> = {
  rapid: {
    name: 'Овердрайв',
    description: 'Плазма стреляет на 15% быстрее',
    symbol: '»',
  },
  power: {
    name: 'Плазменное ядро',
    description: '+1 к урону. Усиливает оба оружия',
    symbol: '✳',
  },
  spread: {
    name: 'Мультивыстрел',
    description: '+1 плазменный снаряд; +1 пробитие рельсотрона',
    symbol: '⋔',
  },
  shield: {
    name: 'Ремонт щита',
    description: '+1 к максимуму (до 7), восстановить 2 единицы',
    symbol: '◇',
  },
  speed: {
    name: 'Ионный двигатель',
    description: '+12% к скорости движения',
    symbol: '↗',
  },
  dash: {
    name: 'Фазовый сдвиг',
    description: 'Рывок восстанавливается на 15% быстрее',
    symbol: 'ϟ',
  },
  cooling: {
    name: 'Криоконтур',
    description: 'Охлаждение на 25% быстрее',
    symbol: '❄',
  },
  pulse: {
    name: 'Ударная волна',
    description: '+35 к радиусу импульса, +3 к его урону',
    symbol: '◎',
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
  state?: 'seek' | 'windup' | 'charge';
  timer?: number;
  targetAngle?: number;
  stun?: number;
  attack?: number;
}
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  hostile: boolean;
  rail?: boolean;
  pierce?: number;
  hitTargets?: Set<Enemy>;
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
export interface Hazard {
  x: number;
  y: number;
  r: number;
  age: number;
  warning: number;
  duration: number;
}
export interface Input {
  x: number;
  y: number;
  dash: boolean;
  aimX?: number;
  aimY?: number;
  shoot?: boolean;
  pulse?: boolean;
}
export const ENEMY_NAMES = [
  'ОХОТНИК',
  'ФЛАНКЕР',
  'СТРЕЛОК',
  'СТРАЖ РАЗЛОМА',
  'ШТУРМОВИК',
  'СНАЙПЕР',
];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export class Game {
  settings: Readonly<GameSettings> = Object.freeze(normalizeSettings());
  get difficulty() {
    return DIFFICULTIES[this.settings.difficulty];
  }
  get heatEnabled() {
    return this.settings.heatMode !== 'off';
  }
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
    hp: 4,
    maxHp: 4,
    angle: -Math.PI / 2,
    invincible: 0,
    speed: 245,
  };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  drops: Drop[] = [];
  hazards: Hazard[] = [];
  events: string[] = [];
  choices: UpgradeId[] = [];
  damage = 1;
  fireInterval = 0.15;
  shotCount = 1;
  fireTime = 0;
  weapon: Weapon = 'plasma';
  heat = 0;
  overheated = false;
  cooling = 35;
  railCharge = 0;
  wasFiring = false;
  pulseEnergy = 100;
  pulseRadius = 205;
  pulseDamage = 5;
  pulseFlash = 0;
  pulseX = 0;
  pulseY = 0;
  dashCooldown = 0;
  dashInterval = 2.6;
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
  hazardTime = 8;
  waveElapsed = 0;
  rng: () => number;
  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }
  get waveProgress() {
    return this.totalWave ? (this.waveKills / this.totalWave) * 100 : 0;
  }
  resize(w: number, h: number) {
    const ratio = h / this.height;
    this.width = w;
    this.height = h;
    this.player.x = clamp(this.player.x, 22, w - 22);
    this.player.y = clamp(this.player.y * ratio, 22, h - 22);
    for (const e of this.enemies) {
      e.x = clamp(e.x, 20, w - 20);
      e.y = clamp(e.y * ratio, 20, h - 20);
    }
    for (const d of this.drops) d.y = clamp(d.y * ratio, 20, h - 20);
    for (const z of this.hazards) z.y = clamp(z.y * ratio, 20, h - 20);
    for (const b of this.bullets) b.y *= ratio;
    for (const p of this.particles) p.y *= ratio;
    this.pulseY *= ratio;
  }
  start(settings: GameSettings = this.settings) {
    this.settings = Object.freeze(normalizeSettings(settings));
    this.phase = 'play';
    this.wave = 1;
    this.score = this.kills = this.elapsed = 0;
    this.combo = 1;
    this.comboTime = this.comboKills = 0;
    this.player = {
      x: this.width / 2,
      y: this.height / 2,
      hp: this.difficulty.shield,
      maxHp: this.difficulty.shield,
      angle: -Math.PI / 2,
      invincible: 1,
      speed: 245,
    };
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.drops = [];
    this.hazards = [];
    this.events = [];
    this.choices = [];
    this.damage = 1;
    this.fireInterval = 0.15;
    this.shotCount = 1;
    this.fireTime = 0;
    this.weapon = 'plasma';
    this.heat = 0;
    this.overheated = false;
    this.cooling =
      35 *
      (this.settings.heatMode === 'custom'
        ? this.settings.coolingRate / 100
        : 1);
    this.cancelFire();
    this.pulseEnergy = 100;
    this.pulseRadius = 205;
    this.pulseDamage = 5;
    this.pulseFlash = 0;
    this.dashCooldown = this.dashTime = 0;
    this.dashInterval = 2.6;
    this.moveX = 0;
    this.moveY = -1;
    this.shake = 0;
    this.beginWave();
  }
  beginWave() {
    this.spawnLeft = Math.round((14 + this.wave * 4) * this.difficulty.count);
    this.totalWave = this.spawnLeft;
    this.waveKills = 0;
    this.waveElapsed = 0;
    this.spawnTime = 1;
    this.hazardTime = 6 / this.difficulty.pressure;
    this.bullets = [];
    this.hazards = [];
    this.heat = 0;
    this.overheated = false;
    this.cancelFire();
    this.phase = 'play';
  }
  cancelFire() {
    this.railCharge = 0;
    this.wasFiring = false;
  }
  togglePause() {
    if (this.phase === 'play') {
      this.phase = 'paused';
      this.cancelFire();
    } else if (this.phase === 'paused') this.phase = 'play';
  }
  switchWeapon() {
    if (this.phase !== 'play') return false;
    this.weapon = this.weapon === 'plasma' ? 'rail' : 'plasma';
    this.cancelFire();
    this.fireTime = Math.max(this.fireTime, 0.15);
    return true;
  }
  dash(x = 0, y = 0) {
    if (this.phase !== 'play' || this.dashCooldown > 0) return false;
    const len = Math.hypot(x, y);
    this.dashX = len > 0.1 ? x / len : this.moveX;
    this.dashY = len > 0.1 ? y / len : this.moveY;
    this.dashTime = 0.17;
    this.dashCooldown = this.dashInterval;
    this.player.invincible = Math.max(this.player.invincible, 0.26);
    this.events.push('dash');
    return true;
  }
  pulse() {
    if (this.phase !== 'play' || this.pulseEnergy < 100) return false;
    this.pulseEnergy = 0;
    this.pulseFlash = 0.45;
    this.pulseX = this.player.x;
    this.pulseY = this.player.y;
    this.shake = 5;
    this.events.push('pulse');
    this.player.invincible = Math.max(this.player.invincible, 0.35);
    this.bullets = this.bullets.filter(
      (b) =>
        !b.hostile ||
        Math.hypot(b.x - this.player.x, b.y - this.player.y) > this.pulseRadius,
    );
    for (const e of this.enemies) {
      if (e.age < 0.65 || e.hp <= 0) continue;
      const dx = e.x - this.player.x,
        dy = e.y - this.player.y,
        d = Math.hypot(dx, dy);
      if (d < this.pulseRadius + e.r) {
        this.damageEnemy(e, this.pulseDamage);
        if (e.kind !== 3) {
          e.x = clamp(e.x + (dx / Math.max(d, 1)) * 60, 20, this.width - 20);
          e.y = clamp(e.y + (dy / Math.max(d, 1)) * 60, 20, this.height - 20);
          e.stun = 0.7;
          e.state = 'seek';
          e.cooldown = 1.2;
        }
      }
    }
    return true;
  }
  upgrade(id: UpgradeId) {
    if (this.phase !== 'upgrade' || !this.choices.includes(id)) return false;
    if (id === 'rapid')
      this.fireInterval = Math.max(0.085, this.fireInterval * 0.85);
    if (id === 'power') this.damage++;
    if (id === 'spread') this.shotCount = Math.min(4, this.shotCount + 1);
    if (id === 'shield') {
      this.player.maxHp = Math.min(7, this.player.maxHp + 1);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
    }
    if (id === 'speed') this.player.speed *= 1.12;
    if (id === 'dash')
      this.dashInterval = Math.max(1, this.dashInterval * 0.85);
    if (id === 'cooling') this.cooling *= 1.25;
    if (id === 'pulse') {
      this.pulseRadius += 35;
      this.pulseDamage += 3;
    }
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
    const boss = this.wave % 5 === 0 && this.spawnLeft === this.totalWave,
      roll = this.rng();
    const kind = boss
      ? 3
      : this.wave >= 3 && roll < 0.16
        ? 5
        : this.wave >= 2 && roll < 0.35
          ? 4
          : roll < 0.58
            ? 2
            : roll < 0.8
              ? 1
              : 0;
    const side = Math.floor(this.rng() * 4),
      m = 30;
    let x =
      side === 0
        ? m
        : side === 1
          ? this.width - m
          : m + this.rng() * (this.width - 2 * m);
    let y =
      side === 2
        ? m
        : side === 3
          ? this.height - m
          : m + this.rng() * (this.height - 2 * m);
    if (Math.hypot(x - this.player.x, y - this.player.y) < 210) {
      x = this.player.x < this.width / 2 ? this.width - m : m;
      y = this.player.y < this.height / 2 ? this.height - m : m;
    }
    const hp =
      kind === 3
        ? this.wave === 10
          ? 260
          : 140
        : kind === 4
          ? 5 + this.wave
          : kind === 2 || kind === 5
            ? 3 + Math.floor(this.wave * 0.65)
            : 2 + Math.floor(this.wave * 0.45);
    this.enemies.push({
      x,
      y,
      r:
        kind === 3
          ? 40
          : kind === 4
            ? 22
            : kind === 2
              ? 18
              : kind === 5
                ? 16
                : kind === 1
                  ? 12
                  : 15,
      hp: Math.max(1, Math.round(hp * this.difficulty.health)),
      maxHp: Math.max(1, Math.round(hp * this.difficulty.health)),
      kind,
      age: 0,
      cooldown: kind === 3 ? 1.5 : 1 + this.rng(),
      hit: 0,
      state: 'seek',
      timer: 0,
      targetAngle: 0,
      stun: 0,
      attack: 0,
    });
    this.spawnLeft--;
  }
  damageEnemy(e: Enemy, damage: number) {
    if (e.hp <= 0) return;
    e.hp -= damage;
    e.hit = 0.09;
    if (e.hp > 0) return;
    this.kills++;
    this.waveKills++;
    this.comboKills++;
    this.combo = Math.min(5, 1 + Math.floor(this.comboKills / 5));
    this.comboTime = 3;
    this.score += (e.kind === 3 ? 3000 : e.kind >= 2 ? 220 : 120) * this.combo;
    this.drops.push({ x: e.x, y: e.y, age: 0 });
    this.burst(
      e.x,
      e.y,
      e.kind === 3 ? '#c79bff' : '#ff678e',
      e.kind === 3 ? 45 : 13,
    );
    this.events.push('kill');
  }
  hurt() {
    if (this.player.invincible > 0 || this.phase !== 'play') return;
    this.player.hp--;
    this.player.invincible = 0.95;
    this.combo = 1;
    this.comboTime = this.comboKills = 0;
    this.shake = 9;
    this.burst(this.player.x, this.player.y, '#ff5e83', 22);
    this.events.push('hit');
    if (this.player.hp <= 0) {
      this.phase = 'over';
      this.dashTime = 0;
      this.cancelFire();
    }
  }
  hostileShot(e: Enemy, a: number, speed: number) {
    speed *= this.difficulty.speed;
    this.bullets.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 6,
      damage: 1,
      hostile: true,
    });
  }
  addHeat(amount: number) {
    if (!this.heatEnabled) {
      this.heat = 0;
      this.overheated = false;
      return;
    }
    if (this.settings.heatMode === 'custom')
      amount *= this.settings.heatRate / 100;
    this.heat = clamp(this.heat + amount, 0, 100);
    if (this.heat >= 100) {
      this.overheated = true;
      this.events.push('overheat');
    }
  }
  fireRail() {
    if (this.railCharge < 0.2 || this.overheated) {
      this.railCharge = 0;
      return;
    }
    const p = this.player,
      a = p.angle,
      charge = this.railCharge;
    this.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * 1150,
      vy: Math.sin(a) * 1150,
      life: 1.5,
      damage: (2 + charge * 6) * this.damage,
      hostile: false,
      rail: true,
      pierce: 2 + this.shotCount,
      hitTargets: new Set(),
    });
    this.addHeat(18 + charge * 25);
    this.railCharge = 0;
    this.fireTime = 0.3;
    this.events.push('rail');
  }
  update(dt: number, input: Input) {
    if (this.phase !== 'play') return;
    dt = clamp(dt, 0, 0.05);
    this.elapsed += dt;
    this.waveElapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 26);
    this.pulseFlash = Math.max(0, this.pulseFlash - dt);
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
    if (input.pulse) this.pulse();
    this.spawnTime -= dt;
    if (
      this.spawnLeft > 0 &&
      this.spawnTime <= 0 &&
      this.enemies.length < Math.round((22 + this.wave) * this.difficulty.count)
    ) {
      this.spawn();
      this.spawnTime =
        Math.max(0.26, 0.84 - this.wave * 0.048) / this.difficulty.pressure;
    }
    if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY))
      p.angle = Math.atan2(input.aimY! - p.y, input.aimX! - p.x);
    this.heat = Math.max(
      0,
      this.heat -
        dt * this.cooling * (input.shoot && !this.overheated ? 0.12 : 1),
    );
    if (this.overheated && this.heat <= 25) this.overheated = false;
    this.fireTime -= dt;
    if (
      this.weapon === 'plasma' &&
      input.shoot &&
      !this.overheated &&
      this.fireTime <= 0
    ) {
      this.fireTime = this.fireInterval;
      this.events.push('shoot');
      this.addHeat(8 + this.shotCount);
      for (let i = 0; i < this.shotCount; i++) {
        const a = p.angle + (i - (this.shotCount - 1) / 2) * 0.13;
        this.bullets.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * 740,
          vy: Math.sin(a) * 740,
          life: 1.2,
          damage: this.damage,
          hostile: false,
        });
      }
    }
    if (this.weapon === 'rail') {
      if (input.shoot && !this.overheated && this.fireTime <= 0)
        this.railCharge = Math.min(1, this.railCharge + dt / 0.85);
      if (!input.shoot && this.wasFiring) this.fireRail();
    }
    this.wasFiring = !!input.shoot;
    for (const e of this.enemies) {
      e.age += dt;
      e.hit = Math.max(0, e.hit - dt);
      if (e.age < 0.65 || e.hp <= 0) continue;
      if ((e.stun ?? 0) > 0) {
        e.stun = Math.max(0, (e.stun ?? 0) - dt);
        continue;
      }
      const a = Math.atan2(p.y - e.y, p.x - e.x),
        d = Math.hypot(p.x - e.x, p.y - e.y);
      e.cooldown -= dt * this.difficulty.pressure;
      let moveAngle = a,
        speed =
          (e.kind === 3
            ? 57
            : e.kind === 1
              ? 157
              : e.kind === 2
                ? 70
                : e.kind === 5
                  ? 80
                  : e.kind === 4
                    ? 91
                    : 103) *
          (1 + this.wave * 0.045);
      if (e.kind === 1 && d > 110)
        moveAngle += Math.sin(e.age * 1.7) > 0.0 ? 0.65 : -0.65;
      if ((e.kind === 2 || e.kind === 5) && d < (e.kind === 5 ? 400 : 285))
        speed *= -0.45;
      if (e.kind === 4 || e.kind === 5) {
        if (e.state === 'windup') {
          speed = 0;
          e.timer = (e.timer ?? 0) - dt;
          if ((e.timer ?? 0) <= 0) {
            if (e.kind === 4) {
              e.state = 'charge';
              e.timer = 0.55;
              this.events.push('charge');
            } else {
              this.hostileShot(e, e.targetAngle ?? a, 460);
              e.state = 'seek';
              e.cooldown = 2.2;
            }
          }
        } else if (e.state === 'charge') {
          moveAngle = e.targetAngle ?? a;
          speed = 480 + this.wave * 10;
          e.timer = (e.timer ?? 0) - dt;
          if ((e.timer ?? 0) <= 0) {
            e.state = 'seek';
            e.cooldown = 1.6;
          }
        } else if (e.cooldown <= 0) {
          e.state = 'windup';
          e.targetAngle = a;
          e.timer = (e.kind === 4 ? 0.7 : 0.95) * this.difficulty.warning;
          speed = 0;
        }
      }
      speed *= this.difficulty.speed;
      e.x = clamp(e.x + Math.cos(moveAngle) * speed * dt, 18, this.width - 18);
      e.y = clamp(e.y + Math.sin(moveAngle) * speed * dt, 18, this.height - 18);
      if (e.kind === 2 && e.cooldown <= 0) {
        e.cooldown = Math.max(1.1, 2.1 - this.wave * 0.07);
        for (let i = -1; i <= 1; i++)
          this.hostileShot(e, a + i * 0.17, 205 + this.wave * 7);
      }
      if (e.kind === 3 && e.cooldown <= 0) {
        e.attack = (e.attack ?? 0) + 1;
        const enraged = e.hp < e.maxHp * 0.45;
        e.cooldown = enraged ? 0.85 : 1.35;
        const count = enraged ? 20 : 16,
          offset = e.age * 0.43;
        for (let i = 0; i < count; i++)
          this.hostileShot(
            e,
            offset + (i * Math.PI * 2) / count,
            enraged ? 225 : 185,
          );
        if (e.attack % 2 === 0)
          for (let i = -2; i <= 2; i++) this.hostileShot(e, a + i * 0.12, 300);
        if (e.attack % 3 === 0)
          this.hazards.push({
            x: p.x,
            y: p.y,
            r: 85,
            age: 0,
            warning: 1.15 * this.difficulty.warning,
            duration: 1.8,
          });
      }
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 11) this.hurt();
    }
    for (const b of this.bullets) {
      const oldX = b.x,
        oldY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      const dx = b.x - oldX,
        dy = b.y - oldY,
        dd = dx * dx + dy * dy;
      const intersects = (tx: number, ty: number, r: number) => {
        const t = dd
          ? clamp(((tx - oldX) * dx + (ty - oldY) * dy) / dd, 0, 1)
          : 0;
        return Math.hypot(oldX + t * dx - tx, oldY + t * dy - ty) < r;
      };
      if (b.hostile) {
        if (intersects(p.x, p.y, 15)) {
          this.hurt();
          b.life = 0;
        }
        continue;
      }
      for (const e of this.enemies) {
        if (e.age < 0.65 || e.hp <= 0 || b.hitTargets?.has(e)) continue;
        if (intersects(e.x, e.y, e.r + (b.rail ? 6 : 4))) {
          this.damageEnemy(e, b.damage);
          b.hitTargets?.add(e);
          if (b.rail) {
            b.pierce = (b.pierce ?? 1) - 1;
            if (b.pierce <= 0) b.life = 0;
          } else b.life = 0;
          if (b.life <= 0) break;
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
    this.hazardTime -= dt;
    if (this.wave >= 3 && this.hazardTime <= 0) {
      this.hazardTime =
        Math.max(3.5, 6 - this.wave * 0.22) / this.difficulty.pressure;
      this.hazards.push({
        x: clamp(p.x + this.moveX * 70, 70, this.width - 70),
        y: clamp(p.y + this.moveY * 70, 70, this.height - 70),
        r: 65 + this.wave * 2,
        age: 0,
        warning: 1.35 * this.difficulty.warning,
        duration: 2,
      });
    }
    for (const z of this.hazards) {
      z.age += dt;
      if (z.age >= z.warning && Math.hypot(p.x - z.x, p.y - z.y) < z.r + 10)
        this.hurt();
    }
    this.hazards = this.hazards.filter((z) => z.age < z.warning + z.duration);
    for (const d of this.drops) {
      d.age += dt;
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (dist < 95 && dist > 0) {
        const step = Math.min(dist, dt * 340);
        d.x += ((p.x - d.x) / dist) * step;
        d.y += ((p.y - d.y) / dist) * step;
      }
      if (Math.hypot(d.x - p.x, d.y - p.y) < 22) {
        d.age = 99;
        this.score += 40 * this.combo;
        this.pulseEnergy = Math.min(100, this.pulseEnergy + 10);
        this.comboTime = 3;
        this.events.push('pickup');
      }
    }
    this.drops = this.drops.filter((d) => d.age < 18);
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
      this.bullets = [];
      this.hazards = [];
      this.cancelFire();
      if (this.wave === 10) {
        this.phase = 'win';
        this.score += this.player.hp * 600;
      } else {
        this.phase = 'upgrade';
        const pool = (Object.keys(UPGRADES) as UpgradeId[]).filter(
          (id) =>
            (id !== 'spread' || this.shotCount < 4) &&
            (id !== 'cooling' || this.heatEnabled),
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

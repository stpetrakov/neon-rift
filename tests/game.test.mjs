import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, normalizeSettings, settingsRecordKey } from '../lib/game.ts';
const idle = { x: 0, y: 0, dash: false };
const tick = (g, n, input = idle) => {
  for (let i = 0; i < n; i++) g.update(1 / 60, input);
};
function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function enemy(x, y, hp = 1) {
  return { x, y, r: 12, hp, maxHp: hp, kind: 0, age: 1, cooldown: 2, hit: 0 };
}
test('menu stays still; starting resets all run state', () => {
  const g = new Game();
  tick(g, 60);
  assert.equal(g.elapsed, 0);
  g.start();
  tick(g, 60);
  assert.ok(g.elapsed > 0);
  g.score = 400;
  g.damage = 8;
  g.player.hp = 1;
  g.start();
  assert.equal(g.score, 0);
  assert.equal(g.damage, 1);
  assert.equal(g.player.hp, 4);
  assert.equal(g.phase, 'play');
});
test('diagonal movement is normalized and arena boundaries hold', () => {
  const g = new Game();
  g.start();
  const x = g.player.x,
    y = g.player.y;
  tick(g, 30, { x: 1, y: 1, dash: false });
  assert.ok(
    Math.abs(Math.hypot(g.player.x - x, g.player.y - y) - 122.5) < 0.001,
  );
  tick(g, 600, { x: 1, y: 1, dash: false });
  assert.ok(g.player.x <= g.width - 20);
  assert.ok(g.player.y <= g.height - 20);
});
test('pause freezes time, movement, and spawning', () => {
  const g = new Game();
  g.start();
  g.togglePause();
  tick(g, 300, { x: 1, y: 0, dash: true });
  assert.equal(g.elapsed, 0);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.dashCooldown, 0);
  g.togglePause();
  tick(g, 90);
  assert.ok(g.enemies.length > 0);
});
test('dash grants invulnerability and cannot repeat before cooldown', () => {
  const g = new Game();
  g.start();
  assert.equal(g.dash(1, 0), true);
  const hp = g.player.hp;
  g.hurt();
  assert.equal(g.player.hp, hp);
  assert.equal(g.dash(1, 0), false);
  g.spawnLeft = 999;
  g.spawnTime = 99;
  tick(g, 180);
  assert.equal(g.dash(0, 1), true);
});
test('swept collision detects a small enemy crossed within one frame', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.fireTime = 99;
  g.enemies = [enemy(400, 100)];
  g.bullets = [
    { x: 370, y: 100, vx: 1500, vy: 0, life: 1, damage: 1, hostile: false },
  ];
  g.update(0.05, idle);
  assert.equal(g.kills, 1);
  assert.equal(g.enemies.length, 0);
  assert.ok(g.score >= 100);
});
test('one projectile only damages one target', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.fireTime = 99;
  g.enemies = [enemy(400, 100), enemy(400, 100)];
  g.bullets = [
    { x: 395, y: 100, vx: 200, vy: 0, life: 1, damage: 1, hostile: false },
  ];
  g.update(1 / 60, idle);
  assert.equal(g.kills, 1);
  assert.equal(g.enemies.length, 1);
});
test('damage has a grace period; zero shield ends the run', () => {
  const g = new Game();
  g.start();
  g.player.invincible = 0;
  g.hurt();
  g.hurt();
  assert.equal(g.player.hp, 3);
  g.player.hp = 1;
  g.player.invincible = 0;
  g.hurt();
  assert.equal(g.phase, 'over');
  assert.equal(g.player.hp, 0);
  const t = g.elapsed;
  tick(g, 60);
  assert.equal(g.elapsed, t);
});
test('stationary player eventually loses under normal rules', () => {
  const g = new Game(seeded(11));
  g.start();
  for (let i = 0; i < 18000 && g.phase !== 'over'; i++) {
    if (g.phase === 'upgrade') g.upgrade(g.choices[0]);
    g.update(1 / 60, idle);
    g.events = [];
  }
  assert.equal(g.phase, 'over');
});
test('boss spawns first on waves 5 and 10, with radial attacks', () => {
  for (const wave of [5, 10]) {
    const g = new Game(seeded(wave));
    g.start();
    g.wave = wave;
    g.beginWave();
    g.spawn();
    assert.equal(g.enemies[0].kind, 3);
    g.player.invincible = 100;
    g.enemies[0].age = 1;
    g.enemies[0].cooldown = 0;
    g.update(1 / 60, idle);
    assert.equal(g.bullets.filter((b) => b.hostile).length, 16);
  }
});
test('upgrade accepts one offered module; rejects stale/invalid choices', () => {
  const g = new Game();
  g.start();
  assert.equal(g.upgrade('power'), false);
  g.spawnLeft = 0;
  g.enemies = [];
  g.update(1 / 60, idle);
  assert.equal(g.phase, 'upgrade');
  assert.equal(new Set(g.choices).size, 3);
  const choice = g.choices[0];
  assert.equal(g.upgrade(choice), true);
  assert.equal(g.wave, 2);
  assert.equal(g.upgrade(choice), false);
  assert.equal(g.wave, 2);
});
test('all ten waves can complete through the real combat loop', () => {
  const g = new Game(seeded(937));
  g.start();
  const waves = new Set();
  let frames = 0;
  // Infinite shield isolates wave progression; weapons, enemies and collisions stay real.
  while (g.phase !== 'win' && frames++ < 72000) {
    waves.add(g.wave);
    if (g.phase === 'upgrade') {
      const choice = [
        'power',
        'spread',
        'rapid',
        'shield',
        'dash',
        'speed',
        'cooling',
        'pulse',
      ].find((id) => g.choices.includes(id));
      g.upgrade(choice);
    }
    g.player.invincible = 10;
    const target = g.enemies.find((e) => e.age > 0.65);
    const a = target
      ? Math.atan2(target.y - g.player.y, target.x - g.player.x)
      : 0;
    g.update(1 / 60, {
      x: Math.cos(a) * 0.2,
      y: Math.sin(a) * 0.2,
      dash: false,
      aimX: target?.x,
      aimY: target?.y,
      shoot: !!target,
    });
    g.events = [];
    assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.player.y));
    assert.ok(g.bullets.length < 500);
  }
  assert.equal(g.phase, 'win');
  assert.equal(waves.size, 10);
  assert.equal(g.kills, 360);
  assert.ok(g.score > 10000);
});
test('combo expires and restarts after damage', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.combo = 4;
  g.comboKills = 17;
  g.comboTime = 0.1;
  tick(g, 10);
  assert.equal(g.combo, 1);
  assert.equal(g.comboKills, 0);
  g.combo = 5;
  g.comboKills = 20;
  g.player.invincible = 0;
  g.hurt();
  assert.equal(g.comboKills, 0);
});

test('weapons require deliberate fire input and follow the supplied aim', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.enemies = [enemy(800, 300, 999)];
  tick(g, 60);
  assert.equal(g.bullets.length, 0);
  g.update(1 / 60, {
    ...idle,
    aimX: g.player.x,
    aimY: g.player.y - 300,
    shoot: true,
  });
  const shot = g.bullets.find((b) => !b.hostile);
  assert.ok(shot);
  assert.ok(Math.abs(shot.vx) < 0.001);
  assert.ok(shot.vy < 0);
});
test('sustained plasma fire overheats, locks both weapons, and cools down', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  const firing = { ...idle, aimX: 900, aimY: 300, shoot: true };
  for (let i = 0; i < 600 && !g.overheated; i++) g.update(1 / 60, firing);
  assert.equal(g.overheated, true);
  assert.ok(g.heat > 95);
  const count = g.bullets.length;
  g.switchWeapon();
  g.railCharge = 1;
  g.fireRail();
  assert.equal(g.bullets.length, count);
  tick(g, 180);
  assert.equal(g.overheated, false);
  assert.equal(g.heat, 0);
});
test('rail charges while held and fires one piercing round on release', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.switchWeapon();
  tick(g, 70, { ...idle, aimX: 900, aimY: g.player.y, shoot: true });
  assert.equal(g.bullets.length, 0);
  assert.equal(g.railCharge, 1);
  g.update(1 / 60, idle);
  assert.equal(g.bullets.filter((b) => b.rail).length, 1);
  assert.equal(g.railCharge, 0);
  assert.ok(g.heat > 40);
  tick(g, 5);
  assert.equal(g.events.filter((e) => e === 'rail').length, 1);
});
test('a piercing round cannot damage the same enemy on successive frames', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  const e = enemy(400, 100, 100);
  e.stun = 10;
  g.enemies = [e];
  g.bullets = [
    {
      x: 398,
      y: 100,
      vx: 1,
      vy: 0,
      life: 2,
      damage: 8,
      hostile: false,
      rail: true,
      pierce: 3,
      hitTargets: new Set(),
    },
  ];
  tick(g, 5);
  assert.equal(e.hp, 92);
});
test('pulse spends energy, clears nearby hostile shots, and stuns survivors', () => {
  const g = new Game();
  g.start();
  const p = g.player;
  g.enemies = [enemy(p.x + 60, p.y, 50), enemy(p.x + 350, p.y, 50)];
  g.bullets = [
    { x: p.x + 10, y: p.y, vx: 0, vy: 0, life: 2, damage: 1, hostile: true },
    { x: p.x + 350, y: p.y, vx: 0, vy: 0, life: 2, damage: 1, hostile: true },
  ];
  assert.equal(g.pulse(), true);
  assert.equal(g.pulseEnergy, 0);
  assert.equal(g.pulse(), false);
  assert.equal(g.bullets.length, 1);
  assert.equal(g.enemies[0].hp, 45);
  assert.equal(g.enemies[0].stun, 0.7);
  assert.equal(g.enemies[1].hp, 50);
});
test('only collected energy recharges pulse; wave completion does not heal', () => {
  const g = new Game();
  g.start();
  g.pulseEnergy = 0;
  g.player.hp = 2;
  g.spawnTime = 99;
  g.drops = [{ x: g.player.x, y: g.player.y, age: 0 }];
  g.update(1 / 60, idle);
  assert.equal(g.pulseEnergy, 10);
  g.spawnLeft = 0;
  g.enemies = [];
  g.update(1 / 60, idle);
  assert.equal(g.phase, 'upgrade');
  assert.equal(g.player.hp, 2);
});
test('charger locks its attack direction before rushing', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.player.invincible = 100;
  const e = { ...enemy(200, 200, 999), kind: 4, cooldown: 0, state: 'seek' };
  g.enemies = [e];
  g.update(1 / 60, idle);
  assert.equal(e.state, 'windup');
  const angle = e.targetAngle;
  g.player.y = 30;
  tick(g, 45);
  assert.equal(e.state, 'charge');
  assert.equal(e.targetAngle, angle);
  const x = e.x;
  tick(g, 10);
  assert.ok(e.x > x + 40);
});
test('sniper telegraphs before firing and does not track during its warning', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.player.invincible = 100;
  const e = { ...enemy(100, 100, 999), kind: 5, cooldown: 0, state: 'seek' };
  g.enemies = [e];
  g.update(1 / 60, idle);
  const aim = e.targetAngle;
  tick(g, 30);
  assert.equal(g.bullets.filter((b) => b.hostile).length, 0);
  g.player.y = 50;
  tick(g, 35);
  const shot = g.bullets.find((b) => b.hostile);
  assert.ok(shot);
  assert.ok(Math.abs(Math.atan2(shot.vy, shot.vx) - aim) < 0.001);
});
test('rift warning is harmless; active area damages and expires', () => {
  const g = new Game();
  g.start();
  g.spawnTime = 99;
  g.player.invincible = 0;
  g.hazards = [
    { x: g.player.x, y: g.player.y, r: 80, age: 0, warning: 1, duration: 0.4 },
  ];
  tick(g, 50);
  assert.equal(g.player.hp, 4);
  tick(g, 15);
  assert.equal(g.player.hp, 3);
  tick(g, 30);
  assert.equal(g.hazards.length, 0);
});
test('boss rage increases attack density and adds aimed volleys', () => {
  const g = new Game();
  g.start();
  g.wave = 10;
  g.beginWave();
  g.spawn();
  g.spawnTime = 99;
  const boss = g.enemies[0];
  boss.age = 1;
  boss.hp = boss.maxHp * 0.4;
  boss.cooldown = 0;
  boss.attack = 1;
  g.update(1 / 60, idle);
  assert.equal(g.bullets.filter((b) => b.hostile).length, 25);
});
test('pause and restart cancel charged shots and reset new resources', () => {
  const g = new Game();
  g.start();
  g.switchWeapon();
  g.railCharge = 0.9;
  g.wasFiring = true;
  g.togglePause();
  assert.equal(g.railCharge, 0);
  g.togglePause();
  g.update(1 / 60, idle);
  assert.equal(g.bullets.length, 0);
  g.heat = 90;
  g.pulseEnergy = 0;
  g.start();
  assert.equal(g.heat, 0);
  assert.equal(g.pulseEnergy, 100);
  assert.equal(g.weapon, 'plasma');
  assert.equal(g.hazards.length, 0);
});
test('both weapons hit small targets touching the player', () => {
  for (const weapon of ['plasma', 'rail']) {
    const g = new Game();
    g.start();
    g.spawnTime = 99;
    const e = enemy(g.player.x, g.player.y);
    e.stun = 1;
    g.enemies = [e];
    g.weapon = weapon;
    if (weapon === 'rail') {
      g.railCharge = 1;
      g.wasFiring = true;
    }
    g.update(1 / 60, {
      ...idle,
      aimX: g.player.x + 100,
      aimY: g.player.y,
      shoot: weapon === 'plasma',
    });
    assert.equal(g.kills, 1, weapon);
  }
});
test('resizing preserves vertical positions of projectiles and active effects', () => {
  const g = new Game();
  g.start();
  g.bullets = [
    { x: 500, y: 340, vx: 100, vy: 0, life: 1, damage: 1, hostile: true },
  ];
  g.hazards = [{ x: 500, y: 340, r: 80, age: 0, warning: 1, duration: 2 }];
  g.pulseY = 340;
  g.resize(1000, 1360);
  assert.equal(g.player.y, 680);
  assert.equal(g.bullets[0].y, 680);
  assert.equal(g.hazards[0].y, 680);
  assert.equal(g.pulseY, 680);
});

test('difficulty changes shield, enemy count, health, movement and shot speed', () => {
  const runs = ['easy', 'normal', 'hard'].map((difficulty) => {
    const g = new Game(seeded(42));
    g.start(normalizeSettings({ difficulty }));
    const count = g.totalWave;
    g.spawn();
    const hp = g.enemies[0].hp;
    const e = enemy(100, 100, 100);
    g.enemies = [e];
    g.spawnTime = 99;
    g.hostileShot(e, 0, 200);
    const bulletSpeed = g.bullets[0].vx;
    g.update(1 / 60, idle);
    return {
      shield: g.player.hp,
      count,
      hp,
      movement: Math.hypot(e.x - 100, e.y - 100),
      bulletSpeed,
    };
  });
  assert.deepEqual(
    runs.map((r) => r.shield),
    [6, 4, 3],
  );
  assert.deepEqual(
    runs.map((r) => r.count),
    [14, 18, 23],
  );
  for (const field of ['hp', 'movement', 'bulletSpeed']) {
    assert.ok(runs[0][field] < runs[1][field], field);
    assert.ok(runs[1][field] < runs[2][field], field);
  }
});

test('disabled overheating permits sustained plasma and charged rail fire', () => {
  const g = new Game();
  g.start(normalizeSettings({ heatMode: 'off' }));
  g.spawnTime = 99;
  tick(g, 600, { ...idle, shoot: true });
  assert.equal(g.heat, 0);
  assert.equal(g.overheated, false);
  assert.ok(g.events.filter((e) => e === 'shoot').length > 50);
  g.switchWeapon();
  tick(g, 80, { ...idle, shoot: true });
  g.update(1 / 60, idle);
  assert.ok(g.bullets.some((b) => b.rail));
  assert.equal(g.heat, 0);
  g.spawnLeft = 0;
  g.enemies = [];
  g.update(1 / 60, idle);
  assert.equal(g.phase, 'upgrade');
  assert.ok(!g.choices.includes('cooling'));
  g.upgrade(g.choices[0]);
  assert.equal(g.heatEnabled, false);
});

test('custom heat and cooling sliders independently change weapon behavior', () => {
  const make = (heatRate, coolingRate) => {
    const g = new Game();
    g.start(normalizeSettings({ heatMode: 'custom', heatRate, coolingRate }));
    g.spawnTime = 99;
    return g;
  };
  const slow = make(25, 100),
    fast = make(200, 100);
  slow.update(1 / 60, { ...idle, shoot: true });
  fast.update(1 / 60, { ...idle, shoot: true });
  assert.equal(slow.heat, 2.25);
  assert.equal(fast.heat, 18);
  const warm = make(100, 25),
    cold = make(100, 200);
  warm.heat = cold.heat = 50;
  tick(warm, 60);
  tick(cold, 60);
  assert.ok(warm.heat > 40);
  assert.equal(cold.heat, 0);
});

test('settings validate stored values, isolate active runs and separate records', () => {
  assert.deepEqual(normalizeSettings(null), normalizeSettings());
  assert.deepEqual(
    normalizeSettings({
      difficulty: '__proto__',
      heatMode: 'broken',
      heatRate: NaN,
      coolingRate: Infinity,
    }),
    normalizeSettings(),
  );
  const s = normalizeSettings({
    difficulty: 'hard',
    heatMode: 'custom',
    heatRate: -1,
    coolingRate: 999,
  });
  assert.equal(s.heatRate, 25);
  assert.equal(s.coolingRate, 200);
  const g = new Game();
  g.start(s);
  s.difficulty = 'easy';
  assert.equal(g.settings.difficulty, 'hard');
  g.start();
  assert.equal(g.settings.difficulty, 'hard');
  assert.equal(g.cooling, 70);
  const standard = normalizeSettings(),
    custom = normalizeSettings({ heatMode: 'custom' });
  assert.equal(settingsRecordKey(standard), 'neon-rift-v2-best');
  assert.equal(settingsRecordKey(standard), settingsRecordKey(custom));
  const variants = [
    standard,
    normalizeSettings({ difficulty: 'easy' }),
    normalizeSettings({ difficulty: 'hard' }),
    normalizeSettings({ heatMode: 'off' }),
    normalizeSettings({ heatMode: 'custom', heatRate: 50 }),
  ];
  assert.equal(new Set(variants.map(settingsRecordKey)).size, variants.length);
});

test('easy and hard modes can finish all waves with overheating disabled', () => {
  for (const difficulty of ['easy', 'hard']) {
    const g = new Game(seeded(937));
    g.start(normalizeSettings({ difficulty, heatMode: 'off' }));
    let frames = 0;
    while (g.phase !== 'win' && frames++ < 72000) {
      if (g.phase === 'upgrade')
        g.upgrade(
          ['power', 'spread', 'rapid', 'shield', 'dash', 'speed', 'pulse'].find(
            (id) => g.choices.includes(id),
          ),
        );
      g.player.invincible = 10;
      const target = g.enemies.find((e) => e.age > 0.65);
      const a = target
        ? Math.atan2(target.y - g.player.y, target.x - g.player.x)
        : 0;
      g.update(1 / 60, {
        x: Math.cos(a) * 0.2,
        y: Math.sin(a) * 0.2,
        dash: false,
        aimX: target?.x,
        aimY: target?.y,
        shoot: !!target,
      });
      g.events = [];
    }
    assert.equal(g.phase, 'win', difficulty);
    assert.equal(g.wave, 10);
    assert.equal(g.kills, difficulty === 'easy' ? 275 : 455);
  }
});

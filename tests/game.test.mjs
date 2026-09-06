import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../lib/game.ts';
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
  assert.equal(g.player.hp, 5);
  assert.equal(g.phase, 'play');
});
test('diagonal movement is normalized and arena boundaries hold', () => {
  const g = new Game();
  g.start();
  const x = g.player.x,
    y = g.player.y;
  tick(g, 30, { x: 1, y: 1, dash: false });
  assert.ok(
    Math.abs(Math.hypot(g.player.x - x, g.player.y - y) - 112.5) < 0.001,
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
  assert.equal(g.player.hp, 4);
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
    assert.equal(g.bullets.filter((b) => b.hostile).length, 12);
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
    });
    g.events = [];
    assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.player.y));
    assert.ok(g.bullets.length < 500);
  }
  assert.equal(g.phase, 'win');
  assert.equal(waves.size, 10);
  assert.equal(g.kills, 235);
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

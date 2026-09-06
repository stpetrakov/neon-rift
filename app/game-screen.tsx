'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  VolumeX,
  Pause,
  Play,
  Zap,
  Crosshair,
  Trophy,
  MoveUpRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Game, UPGRADES, type UpgradeId } from '@/lib/game';
import { drawGame } from '@/lib/render';

const fmt = (n: number) => Math.floor(n).toLocaleString('ru-RU');
export default function Home() {
  const shellRef = useRef<HTMLElement>(null);
  const fullscreenMode = useRef<'native' | 'fallback' | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const keys = useRef(new Set<string>());
  const touch = useRef({ id: -1, x: 0, y: 0, dx: 0, dy: 0 });
  const soundRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const [sound, setSound] = useState(true);
  const [best, setBest] = useState(0);
  const [view, setView] = useState({
    phase: 'menu',
    wave: 1,
    score: 0,
    hp: 5,
    maxHp: 5,
    dash: 0,
    combo: 1,
    progress: 0,
    kills: 0,
    elapsed: 0,
    choices: [] as UpgradeId[],
  });
  const [stick, setStick] = useState<{
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const choicesRef = useRef<HTMLButtonElement>(null);

  function soundEffect(kind: string) {
    const ac = audioRef.current;
    if (!soundRef.current || !ac || ac.state !== 'running') return;
    const osc = ac.createOscillator(),
      gain = ac.createGain();
    const f =
      kind === 'shoot'
        ? 490
        : kind === 'hit'
          ? 85
          : kind === 'dash'
            ? 160
            : kind === 'pickup'
              ? 980
              : 250;
    osc.type = kind === 'hit' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(f, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'pickup' ? f * 1.5 : f * 0.35,
      ac.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(kind === 'shoot' ? 0.025 : 0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.16);
  }
  function unlockAudio() {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      void audioRef.current.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }
  function clearInput() {
    keys.current.clear();
    touch.current.id = -1;
    touch.current.dx = touch.current.dy = 0;
    setStick(null);
  }
  function start() {
    unlockAudio();
    clearInput();
    gameRef.current?.start();
    canvasRef.current?.focus();
  }
  function pause() {
    gameRef.current?.togglePause();
    clearInput();
  }
  function choose(id: UpgradeId) {
    clearInput();
    gameRef.current?.upgrade(id);
    canvasRef.current?.focus();
  }

  async function toggleFullscreen() {
    const shell = shellRef.current;
    if (!shell || fullscreenPending) return;
    clearInput();
    setFullscreenPending(true);
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      } else if (fullscreenMode.current === 'fallback') {
        fullscreenMode.current = null;
        setExpanded(false);
        setFullscreen(false);
      } else {
        try {
          if (!document.fullscreenEnabled || !shell.requestFullscreen) {
            throw new Error('Fullscreen API unavailable');
          }
          await shell.requestFullscreen();
          fullscreenMode.current = 'native';
          setFullscreen(true);
        } catch {
          // Embedded browsers and some phones can still fill the current tab.
          fullscreenMode.current = 'fallback';
          setExpanded(true);
          setFullscreen(true);
        }
      }
    } catch {
      // Keep the exit control available if the browser refuses an exit request.
      setFullscreen(document.fullscreenElement === shell);
    } finally {
      setFullscreenPending(false);
      if (gameRef.current?.phase === 'play') canvasRef.current?.focus();
    }
  }

  useEffect(() => {
    const syncFullscreen = () => {
      const native = document.fullscreenElement === shellRef.current;
      if (native) fullscreenMode.current = 'native';
      else if (fullscreenMode.current === 'native')
        fullscreenMode.current = null;
      setFullscreen(native || fullscreenMode.current === 'fallback');
      clearInput();
      if (gameRef.current?.phase === 'play') canvasRef.current?.focus();
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () =>
      document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem('neon-rift-best'));
      if (Number.isFinite(stored)) setBest(Math.max(0, stored));
    } catch {}
    const game = new Game();
    gameRef.current = game;
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      game.resize(
        1000,
        Math.max(550, Math.min(1500, (1000 * r.height) / Math.max(1, r.width))),
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && fullscreenMode.current) {
        if (fullscreenMode.current === 'fallback') {
          fullscreenMode.current = null;
          setExpanded(false);
          setFullscreen(false);
          clearInput();
          if (game.phase === 'play') canvasRef.current?.focus();
        }
        return;
      }
      if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
        pause();
        return;
      }
      if (
        e.target instanceof HTMLButtonElement ||
        e.target instanceof HTMLInputElement
      )
        return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (
        !e.repeat &&
        e.code === 'Enter' &&
        ['menu', 'over', 'win'].includes(game.phase)
      )
        start();
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => {
      clearInput();
      if (game.phase === 'play') game.togglePause();
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    let raf = 0,
      last = performance.now(),
      uiTime = 0,
      terminalSaved = false;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = keys.current;
      game.update(dt, {
        x:
          Number(k.has('KeyD') || k.has('ArrowRight')) -
          Number(k.has('KeyA') || k.has('ArrowLeft')) +
          touch.current.dx,
        y:
          Number(k.has('KeyS') || k.has('ArrowDown')) -
          Number(k.has('KeyW') || k.has('ArrowUp')) +
          touch.current.dy,
        dash: k.has('Space'),
      });
      for (const event of game.events.splice(0)) soundEffect(event);
      drawGame(context, game, canvas.width, canvas.height, now / 1000);
      if (now - uiTime > 65) {
        uiTime = now;
        setView({
          phase: game.phase,
          wave: game.wave,
          score: game.score,
          hp: game.player.hp,
          maxHp: game.player.maxHp,
          dash: game.dashCooldown,
          combo: game.combo,
          progress: game.waveProgress,
          kills: game.kills,
          elapsed: game.elapsed,
          choices: [...game.choices],
        });
      }
      if ((game.phase === 'over' || game.phase === 'win') && !terminalSaved) {
        terminalSaved = true;
        setBest((old) => {
          const next = Math.max(old, game.score);
          try {
            localStorage.setItem('neon-rift-best', String(next));
          } catch {}
          return next;
        });
      }
      if (game.phase === 'play') terminalSaved = false;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (view.phase === 'upgrade') {
      clearInput();
      choicesRef.current?.focus();
    } else if (['paused', 'over', 'win'].includes(view.phase))
      actionRef.current?.focus();
    else if (view.phase === 'play') canvasRef.current?.focus();
  }, [view.phase]);

  const active = view.phase === 'play' || view.phase === 'paused';
  return (
    <main ref={shellRef} className={`game-shell${expanded ? ' expanded' : ''}`}>
      <header className="masthead">
        <a href="./" className="brand" aria-label="NEON RIFT — начало">
          <span className="brand-icon">
            <Crosshair size={23} />
          </span>
          <span>
            NEON<span className="brand-light">RIFT</span>
            <small>ARCADE SURVIVAL</small>
          </span>
        </a>
        <div className="header-right">
          <span className="best">
            <Trophy size={15} /> РЕКОРД <b>{fmt(best)}</b>
          </span>
          <button
            className="icon-button"
            aria-label={
              fullscreen ? 'Выйти из полноэкранного режима' : 'Во весь экран'
            }
            title={
              fullscreen
                ? 'Выйти из полноэкранного режима (Esc)'
                : 'Во весь экран'
            }
            aria-pressed={fullscreen}
            disabled={fullscreenPending}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            className="icon-button"
            aria-label={sound ? 'Выключить звук' : 'Включить звук'}
            aria-pressed={sound}
            onClick={() => {
              soundRef.current = !sound;
              setSound(!sound);
              unlockAudio();
              if (gameRef.current?.phase === 'play') canvasRef.current?.focus();
            }}
          >
            {sound ? <AudioLines size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            className="icon-button"
            aria-label={view.phase === 'paused' ? 'Продолжить' : 'Пауза'}
            disabled={!active}
            onClick={pause}
          >
            {view.phase === 'paused' ? <Play size={19} /> : <Pause size={19} />}
          </button>
        </div>
      </header>
      <section className="console" aria-label="Игровая арена">
        <div className="telemetry">
          <div className="wave">
            <span className="live-dot" /> ВОЛНА{' '}
            <b>{String(view.wave).padStart(2, '0')}</b>
            <span className="muted">/ 10</span>
          </div>
          <div className="score-label">
            СЧЁТ <strong>{fmt(view.score).padStart(6, '0')}</strong>
          </div>
          <div className="hull">
            <span>ЩИТ</span>
            <div
              className="health"
              aria-label={`Щит: ${view.hp} из ${view.maxHp}`}
            >
              {Array.from({ length: view.maxHp }, (_, i) => (
                <i key={i} className={i < view.hp ? 'filled' : ''} />
              ))}
            </div>
          </div>
        </div>
        <div className="arena-wrap">
          <canvas
            ref={canvasRef}
            className="arena"
            tabIndex={0}
            aria-label="Игровое поле. WASD или стрелки — движение, пробел — рывок, P — пауза. Стрельба автоматическая."
            onPointerDown={(e) => {
              if (
                e.pointerType === 'mouse' ||
                view.phase !== 'play' ||
                touch.current.id !== -1
              )
                return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = e.currentTarget.getBoundingClientRect();
              touch.current = {
                id: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                dx: 0,
                dy: 0,
              };
              setStick({
                x: e.clientX - r.left,
                y: e.clientY - r.top,
                dx: 0,
                dy: 0,
              });
            }}
            onPointerMove={(e) => {
              if (touch.current.id !== e.pointerId) return;
              const dx = e.clientX - touch.current.x,
                dy = e.clientY - touch.current.y,
                len = Math.max(45, Math.hypot(dx, dy));
              touch.current.dx = dx / len;
              touch.current.dy = dy / len;
              setStick((s) =>
                s ? { ...s, dx: (dx / len) * 34, dy: (dy / len) * 34 } : null,
              );
            }}
            onPointerUp={(e) => {
              if (touch.current.id === e.pointerId) {
                touch.current.id = -1;
                touch.current.dx = touch.current.dy = 0;
                setStick(null);
              }
            }}
            onPointerCancel={() => {
              touch.current.id = -1;
              touch.current.dx = touch.current.dy = 0;
              setStick(null);
            }}
          >
            Для игры нужен браузер с поддержкой Canvas.
          </canvas>
          <div className="arena-coord top-left" aria-hidden="true">
            SECTOR 07 <span>↗</span>
          </div>
          <div className="arena-coord bottom-left" aria-hidden="true">
            {active ? 'AUTO-TARGET ONLINE' : 'AWAITING PILOT'}
          </div>
          <div className="arena-coord bottom-right" aria-hidden="true">
            {Math.floor(view.elapsed / 60)}:
            {String(Math.floor(view.elapsed % 60)).padStart(2, '0')}
          </div>
          {view.phase === 'play' && (
            <>
              <div className="wave-banner" key={view.wave}>
                ВОЛНА {view.wave}
                {view.wave % 5 === 0 ? ' · БОСС' : ''}
              </div>
              {view.combo > 1 && (
                <div className="combo">
                  ×{view.combo} <span>КОМБО</span>
                </div>
              )}
              <button
                className="touch-dash"
                aria-label="Рывок"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gameRef.current?.dash(touch.current.dx, touch.current.dy);
                }}
              >
                <Zap size={24} />
                РЫВОК
              </button>
            </>
          )}
          {stick && (
            <div className="joystick" style={{ left: stick.x, top: stick.y }}>
              <span
                style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }}
              />
            </div>
          )}
          {view.phase === 'menu' && (
            <div className="screen-overlay start-screen">
              <div className="eyebrow">
                <span /> СИГНАЛ ОБНАРУЖЕН
              </div>
              <h1>
                NEON
                <br />
                <span>RIFT</span>
                <i>↗</i>
              </h1>
              <p className="intro">
                Один пилот. Десять волн.
                <br />
                Прорви кольцо. Закрой разлом.
              </p>
              <button className="primary-button" onClick={start}>
                ВОЙТИ В РАЗЛОМ <ArrowUpRight size={23} />
              </button>
              <span className="start-hint">или нажми ENTER</span>
              <div className="start-controls">
                <span>
                  <MoveUpRight size={16} /> Двигайся
                </span>
                <span>
                  <Crosshair size={16} /> Огонь автоматически
                </span>
                <span>
                  <Zap size={16} /> Уклоняйся
                </span>
              </div>
            </div>
          )}
          {view.phase === 'paused' && (
            <div className="screen-overlay modal-screen">
              <span className="eyebrow">СИГНАЛ ПРИОСТАНОВЛЕН</span>
              <h2>Выдохни.</h2>
              <p>Разлом подождёт.</p>
              <button
                className="primary-button"
                ref={actionRef}
                onClick={() => {
                  pause();
                  canvasRef.current?.focus();
                }}
              >
                ПРОДОЛЖИТЬ <Play size={20} />
              </button>
            </div>
          )}
          {view.phase === 'upgrade' && (
            <div className="screen-overlay upgrade-screen">
              <span className="eyebrow">ВОЛНА {view.wave} ПРОЙДЕНА</span>
              <h2>Стань сильнее.</h2>
              <p>Выбери модуль для следующей волны.</p>
              <div className="upgrade-options">
                {view.choices.map((id, i) => (
                  <button
                    key={id}
                    ref={i === 0 ? choicesRef : undefined}
                    className="upgrade-card"
                    onClick={() => choose(id)}
                  >
                    <span className="upgrade-index">0{i + 1} / МОДУЛЬ</span>
                    <span className="upgrade-symbol">
                      {UPGRADES[id].symbol}
                    </span>
                    <strong>{UPGRADES[id].name}</strong>
                    <span>{UPGRADES[id].description}</span>
                    <ArrowUpRight size={20} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {(view.phase === 'over' || view.phase === 'win') && (
            <div className="screen-overlay modal-screen">
              <span className="eyebrow">
                {view.phase === 'win'
                  ? 'ВСЕ 10 ВОЛН ПРОЙДЕНЫ'
                  : `ВОЛНА ${view.wave} · СВЯЗЬ ПОТЕРЯНА`}
              </span>
              <h2>
                {view.phase === 'win' ? 'Разлом закрыт.' : 'Ещё один заход?'}
              </h2>
              <p>
                {view.phase === 'win'
                  ? 'Сектор чист. Ты справился.'
                  : 'Каждый рывок — ещё один шанс.'}
              </p>
              <div className="run-result">
                <div>
                  <span>ТВОЙ СЧЁТ</span>
                  <b>{fmt(view.score)}</b>
                </div>
                <div>
                  <span>УНИЧТОЖЕНО</span>
                  <b>{view.kills}</b>
                </div>
              </div>
              <button
                ref={actionRef}
                className="primary-button"
                onClick={start}
              >
                ИГРАТЬ СНОВА <ArrowUpRight size={23} />
              </button>
            </div>
          )}
        </div>
        <div className="statusbar">
          <div className="dash-status">
            <Zap size={15} />
            <span>{view.dash <= 0 ? 'РЫВОК ГОТОВ' : 'ПЕРЕЗАРЯДКА'}</span>
            <Progress
              aria-label="Готовность рывка"
              value={Math.max(
                0,
                100 -
                  (view.dash / (gameRef.current?.dashInterval || 2.8)) * 100,
              )}
            />
            <kbd>SPACE</kbd>
          </div>
          <span className="wave-progress">
            ЗАЧИСТКА <b>{Math.floor(view.progress)}%</b>
          </span>
        </div>
      </section>
      <footer className="footer">
        <div>
          <span>
            <kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> движение
          </span>
          <span>
            <kbd>SPACE</kbd> рывок
          </span>
          <span>
            <kbd>P</kbd> пауза
          </span>
        </div>
        <span className="footer-tip">Собирай энергию. Держи комбо.</span>
        <span className="mobile-tip">
          Веди пальцем по арене · кнопка ⚡ для рывка
        </span>
      </footer>
    </main>
  );
}

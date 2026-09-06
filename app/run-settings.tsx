'use client';

import {
  DIFFICULTIES,
  type Difficulty,
  type GameSettings,
  type HeatMode,
} from '@/lib/game';

export function RunSettings({
  value,
  onChange,
  onStart,
}: {
  value: GameSettings;
  onChange: (value: GameSettings) => void;
  onStart: () => void;
}) {
  return (
    <section className="run-settings" aria-label="Настройки нового захода">
      <div className="eyebrow">ТВОИ ПРАВИЛА</div>
      <h2>Настрой заход</h2>
      <fieldset className="difficulty-picker">
        <legend>Сложность</legend>
        <div className="difficulty-options">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => (
            <label
              key={id}
              className={value.difficulty === id ? 'selected' : ''}
            >
              <input
                type="radio"
                name="difficulty"
                value={id}
                checked={value.difficulty === id}
                onChange={() => onChange({ ...value, difficulty: id })}
              />
              <span>{DIFFICULTIES[id].name}</span>
            </label>
          ))}
        </div>
        <p>{DIFFICULTIES[value.difficulty].description}</p>
      </fieldset>
      <label className="heat-select" htmlFor="heat-mode">
        Перегрев оружия
      </label>
      <select
        id="heat-mode"
        value={value.heatMode}
        onChange={(e) =>
          onChange({ ...value, heatMode: e.target.value as HeatMode })
        }
      >
        <option value="standard">Стандартный</option>
        <option value="off">Выключен — непрерывный огонь</option>
        <option value="custom">Настроить вручную</option>
      </select>
      {value.heatMode === 'custom' && (
        <div className="heat-tuning">
          <label htmlFor="heat-rate">
            Скорость нагрева{' '}
            <output htmlFor="heat-rate">{value.heatRate}%</output>
          </label>
          <input
            id="heat-rate"
            type="range"
            min="25"
            max="200"
            step="25"
            value={value.heatRate}
            onChange={(e) =>
              onChange({ ...value, heatRate: Number(e.target.value) })
            }
          />
          <label htmlFor="cooling-rate">
            Скорость охлаждения{' '}
            <output htmlFor="cooling-rate">{value.coolingRate}%</output>
          </label>
          <input
            id="cooling-rate"
            type="range"
            min="25"
            max="200"
            step="25"
            value={value.coolingRate}
            onChange={(e) =>
              onChange({ ...value, coolingRate: Number(e.target.value) })
            }
          />
          <p>
            100% — обычная скорость. Меньше нагрев и быстрее охлаждение — дольше
            стреляешь.
          </p>
        </div>
      )}
      {value.heatMode === 'off' && (
        <p className="heat-mode-hint">
          Оба оружия стреляют без перегрева. Рельсотрон по-прежнему нужно
          заряжать.
        </p>
      )}
      <p className="settings-note">
        Для нового захода. Выбор сохраняется, рекорды учитываются отдельно для
        каждого набора правил.
      </p>
      <button className="primary-button settings-start" onClick={onStart}>
        НАЧАТЬ ИГРУ ↗
      </button>
    </section>
  );
}

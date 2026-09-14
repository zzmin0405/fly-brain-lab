import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { animate } from 'animejs'
import './index.css'
import './defense.css'

type Enemy = { position: number; hp: number; max_hp: number; speed?: number }
type Frame = {
  tick: number
  wave: number
  round_ticks: number
  max_rounds: number
  tick_ms: number
  difficulty: { hp: number; speed_multiplier: number; spawn_interval: number }
  gold: number
  lives: number
  kills: number
  towers: number[]
  types: number[]
  enemies: Enemy[]
  action?: number
}
type Replay = {
  frames: Frame[]
  report: {
    manifest: { nodes: number; coalesced_edges: number }
    changed_neuron_gains: number
  }
}
const kinds = [
  {
    name: '바스티온',
    code: 'B01',
    role: '고화력 포격',
    color: '#f1bb72',
    damage: 3.2,
    range: 0.14,
    description: '사거리 안에서 가장 앞선 적에게 집중 포격합니다.',
  },
  {
    name: '롱보우',
    code: 'L02',
    role: '장거리 저격',
    color: '#ab9aff',
    damage: 2.2,
    range: 0.2,
    description: '넓은 경로 구간을 감시하는 장거리 방어 포탑입니다.',
  },
  {
    name: '콜드스냅',
    code: 'C03',
    role: '진행 억제',
    color: '#72dfce',
    damage: 2.2,
    range: 0.14,
    description: '타격마다 적의 경로 진행도를 1.2% 되돌립니다.',
  },
]
const points = [
  [-20, 280],
  [150, 280],
  [215, 140],
  [390, 140],
  [450, 390],
  [630, 390],
  [695, 220],
  [920, 220],
]
const slots = [
  [110, 190],
  [255, 230],
  [355, 60],
  [360, 335],
  [530, 290],
  [620, 470],
  [730, 320],
  [805, 130],
]
const lengths = points
  .slice(1)
  .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]))
const total = lengths.reduce((a, b) => a + b, 0)
function position(progress: number) {
  let d = Math.max(0, Math.min(1, progress)) * total
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i]) {
      const t = d / lengths[i]
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      ]
    }
    d -= lengths[i]
  }
  return points[points.length - 1]
}
function trace(ctx: CanvasRenderingContext2D, start = 0, end = 1) {
  ctx.beginPath()
  for (let i = 0; i <= 180; i++) {
    const [x, y] = position(start + ((end - start) * i) / 180)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
}
function draw(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  next: Frame,
  t: number,
  selected: number,
) {
  ctx.clearRect(0, 0, 900, 540)
  ctx.fillStyle = '#111e24'
  ctx.fillRect(0, 0, 900, 540)
  ctx.strokeStyle = '#ffffff05'
  ctx.lineWidth = 1
  for (let x = 0; x < 900; x += 30) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 540)
    ctx.stroke()
  }
  for (let y = 0; y < 540; y += 30) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(900, y)
    ctx.stroke()
  }
  // 고정 위치의 지형 장식.
  for (let i = 0; i < 40; i++) {
    const x = (i * 173 + 47) % 900,
      y = (i * 97 + 33) % 540
    ctx.fillStyle = i % 2 ? '#223236' : '#1b2b30'
    ctx.beginPath()
    ctx.moveTo(x, y - 8)
    ctx.lineTo(x + 13, y - 3)
    ctx.lineTo(x + 9, y + 9)
    ctx.lineTo(x - 9, y + 7)
    ctx.closePath()
    ctx.fill()
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  trace(ctx)
  ctx.strokeStyle = '#080f15'
  ctx.lineWidth = 64
  ctx.stroke()
  trace(ctx)
  ctx.strokeStyle = '#425053'
  ctx.lineWidth = 54
  ctx.stroke()
  trace(ctx)
  ctx.strokeStyle = '#29363c'
  ctx.lineWidth = 48
  ctx.stroke()
  trace(ctx)
  ctx.strokeStyle = '#6c7c792e'
  ctx.lineWidth = 2
  ctx.setLineDash([3, 15])
  ctx.stroke()
  ctx.setLineDash([])
  const k = kinds[frame.types[selected] ?? 0]
  if (frame.towers[selected]) {
    trace(
      ctx,
      Math.max(0, (selected + 0.5) / 8 - k.range),
      Math.min(1, (selected + 0.5) / 8 + k.range),
    )
    ctx.strokeStyle = k.color + '55'
    ctx.lineWidth = 42
    ctx.stroke()
  }
  ctx.font = 'bold 10px monospace'
  ctx.fillStyle = '#eb9876'
  ctx.fillText('HOSTILE ENTRY', 25, 335)
  ctx.fillStyle = '#72dfce'
  ctx.fillText('NEURAL CORE', 770, 275)
  ctx.save()
  ctx.translate(863, 220)
  ctx.globalAlpha = 0.35 + Math.sin(t * Math.PI * 2) * 0.15
  ctx.beginPath()
  ctx.arc(0, 0, 31 + Math.sin(t * Math.PI) * 7, 0, Math.PI * 2)
  ctx.strokeStyle = '#72dfce66'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.shadowColor = '#72dfce'
  ctx.shadowBlur = 22
  ctx.strokeStyle = '#72dfce'
  ctx.lineWidth = 3
  ctx.strokeRect(-20, -26, 40, 52)
  ctx.fillStyle = '#72dfce'
  ctx.fillRect(-7, -14, 14, 28)
  ctx.restore()
  slots.forEach(([x, y], i) => {
    const level = frame.towers[i],
      kind = kinds[frame.types[i]]
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = '#070e13'
    ctx.beginPath()
    ctx.ellipse(0, 14, 29, 15, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#25383e'
    ctx.strokeStyle = selected === i ? kind.color : '#52666b'
    ctx.lineWidth = selected === i ? 2 : 1
    ctx.beginPath()
    for (let a = 0; a < 6; a++) {
      const angle = (a * Math.PI) / 3
      ctx.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 23)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    if (level) {
      const inRange = frame.enemies.some(
        (enemy) => Math.abs(enemy.position - (i + 0.5) / 8) < kind.range,
      )
      const recoil = inRange ? Math.sin(t * Math.PI) * 2 : 0
      const target = frame.enemies.find(
        (enemy) => Math.abs(enemy.position - (i + 0.5) / 8) < kind.range,
      )
      if (target && inRange) {
        const [tx, ty] = position(target.position)
        ctx.save()
        const muzzleX = frame.types[i] === 1 ? 0 : frame.types[i] === 0 ? 0 : 0
        const muzzleY = frame.types[i] === 1 ? -39 : -18
        // 매 프레임을 발사 사이클로 보고, 탄환이 포탑에서 적까지 날아간다.
        const shotT = Math.min(1, Math.max(0, t * 1.35))
        const projectileX = muzzleX + (tx - x - muzzleX) * shotT
        const projectileY = muzzleY + (ty - y - muzzleY) * shotT
        ctx.globalAlpha = Math.max(0, 1 - shotT * 0.7)
        ctx.strokeStyle = kind.color + 'aa'
        ctx.lineWidth = frame.types[i] === 1 ? 3 : 2
        ctx.setLineDash(frame.types[i] === 2 ? [2, 6] : [])
        ctx.beginPath()
        ctx.moveTo(muzzleX, muzzleY)
        ctx.lineTo(projectileX, projectileY)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.shadowColor = kind.color
        ctx.shadowBlur = 12
        ctx.fillStyle = kind.color
        ctx.beginPath()
        if (frame.types[i] === 0) {
          ctx.moveTo(projectileX, projectileY - 5)
          ctx.lineTo(projectileX + 5, projectileY)
          ctx.lineTo(projectileX, projectileY + 5)
          ctx.lineTo(projectileX - 5, projectileY)
          ctx.closePath()
        } else if (frame.types[i] === 1) {
          ctx.rect(projectileX - 3, projectileY - 3, 6, 6)
        } else {
          ctx.arc(projectileX, projectileY, 5, 0, Math.PI * 2)
        }
        ctx.fill()
        ctx.shadowBlur = 0
        if (shotT > 0.82) {
          ctx.globalAlpha = (shotT - 0.82) / 0.18
          ctx.strokeStyle = '#fff1c4'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(tx - x, ty - y, (shotT - 0.82) * 60, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }
      ctx.translate(0, recoil)
      ctx.fillStyle = '#435962'
      ctx.fillRect(-15, -12, 30, 24)
      ctx.fillStyle = kind.color
      ctx.fillRect(-11, -10, 22, 5)
      if (frame.types[i] === 0) {
        ctx.fillStyle = '#ad936f'
        ctx.fillRect(-10, -29, 7, 23)
        ctx.fillRect(3, -29, 7, 23)
      } else if (frame.types[i] === 1) {
        ctx.fillStyle = '#a19cbe'
        ctx.fillRect(-4, -39, 8, 34)
        ctx.fillStyle = '#e5dfff'
        ctx.fillRect(-2, -38, 4, 8)
      } else {
        ctx.strokeStyle = kind.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, -5, 11, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#b4fff0'
        ctx.fillRect(-3, -10, 6, 10)
      }
      ctx.fillStyle = kind.color
      for (let l = 0; l < level; l++) ctx.fillRect(-9 + l * 8, 19, 5, 3)
    } else {
      ctx.fillStyle = '#6c8287'
      ctx.font = '20px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('+', 0, 7)
    }
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = selected === i ? kind.color : '#80959b'
    ctx.fillText(String(i + 1).padStart(2, '0'), 0, 43)
    ctx.restore()
  })
  frame.enemies.forEach((enemy, i) => {
    const after = next.enemies.find((e) => e.speed === enemy.speed)
    const p =
      enemy.position +
      ((after?.position ?? enemy.position) - enemy.position) * t
    const [x, y] = position(p)
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = '#0008'
    ctx.beginPath()
    ctx.ellipse(0, 9, 13, 6, 0, 0, 7)
    ctx.fill()
    ctx.strokeStyle = '#ae635f'
    ctx.lineWidth = 3
    for (let a = -1; a <= 1; a += 2) {
      ctx.beginPath()
      ctx.moveTo(a * 7, -5)
      ctx.lineTo(a * 15, -10)
      ctx.moveTo(a * 8, 3)
      ctx.lineTo(a * 15, 10)
      ctx.stroke()
    }
    ctx.fillStyle = i % 2 ? '#bc796e' : '#cd8a71'
    ctx.beginPath()
    ctx.moveTo(0, -15)
    ctx.lineTo(10, -4)
    ctx.lineTo(7, 10)
    ctx.lineTo(-7, 10)
    ctx.lineTo(-10, -4)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffe7b5'
    ctx.fillRect(-4, -6, 8, 3)
    ctx.fillStyle = '#071014'
    ctx.fillRect(-14, -25, 28, 3)
    ctx.fillStyle = '#ef9d81'
    ctx.fillRect(-14, -25, 28 * Math.min(1, enemy.hp / enemy.max_hp), 3)
    if (after && after.hp < enemy.hp && t < 0.5) {
      ctx.strokeStyle = '#ffe1af'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, 12 + t * 35, 0, 7)
      ctx.stroke()
      ctx.fillStyle = '#ffd59a'
      for (let shard = 0; shard < 5; shard++) {
        const angle = shard * 1.25 + t * 4
        ctx.fillRect(
          Math.cos(angle) * (15 + t * 12),
          Math.sin(angle) * (15 + t * 12),
          2,
          2,
        )
      }
    }
    ctx.restore()
  })
}
function Battlefield({
  frame,
  next,
  duration,
  playing,
  selected,
  onSelect,
}: {
  frame: Frame
  next: Frame
  duration: number
  playing: boolean
  selected: number
  onSelect: (i: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    el.width = 900 * ratio
    el.height = 540 * ratio
    ctx.scale(ratio, ratio)
    const clock = { t: 0 }
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const render = () => draw(ctx, frame, next, clock.t, selected)
    render()
    if (!playing || reduced) return
    const animation = animate(clock, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: render,
    })
    return () => {
      animation.cancel()
    }
  }, [frame, next, duration, playing, selected])
  return (
    <div className="battlefield">
      <canvas
        ref={canvas}
        aria-label="구불구불한 경로에서 진행되는 자동 방어 리플레이"
      />
      {slots.map(([x, y], i) => (
        <button
          key={i}
          className={`slot-hit ${selected === i ? 'active' : ''}`}
          style={{ left: `${x / 9}%`, top: `${y / 5.4}%` }}
          aria-label={`${i + 1}번 ${kinds[frame.types[i]].name} 포탑 선택`}
          aria-pressed={selected === i}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  )
}
export function DefenseReplay() {
  const [replay, setReplay] = useState<Replay | null>(null),
    [error, setError] = useState(''),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1),
    [selected, setSelected] = useState(3),
    [runId, setRunId] = useState(1)
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/trained-defense.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error('리플레이를 불러오지 못했습니다.')
        return r.json()
      })
      .then(setReplay)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(String(e))
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!replay || !playing) return
    const timer = setInterval(
      () => setIndex((i) => Math.min(i + 1, replay.frames.length - 1)),
      replay.frames[0].tick_ms / speed,
    )
    return () => clearInterval(timer)
  }, [replay, playing, speed])
  useEffect(() => {
    if (
      !replay ||
      !root.current ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    const a = animate(root.current.querySelectorAll('.reveal'), {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 650,
      delay: (_, i) => (i ?? 0) * 70,
      ease: 'outCubic',
    })
    return () => {
      a.cancel()
    }
  }, [replay])
  const frame = replay?.frames[index],
    next = replay?.frames[Math.min(index + 1, replay.frames.length - 1)],
    ended = !!replay && index === replay.frames.length - 1
  const kind = kinds[frame?.types[selected] ?? 0],
    level = frame?.towers[selected] ?? 0
  const startNewGame = () => {
    setRunId((value) => value + 1)
    setIndex(0)
    setSelected(3)
    setSpeed(1)
    setPlaying(true)
  }
  return (
    <main className="defense-app" ref={root}>
      <header className="command-nav">
        <a href="/">
          N<span>O</span>DE<span className="brand-sub">DEFENSE PROTOCOL</span>
        </a>
        <div className="nav-tabs">
          <span className="current">방어 작전</span>
          <a href="/maze.html">미로 실험실 ↗</a>
        </div>
        <span className="session-tag">
          RUN {String(runId).padStart(2, '0')} · FLYWIRE / 783
        </span>
      </header>
      <div className="mission-title reveal">
        <div>
          <p className="overline">SECTOR 07 / NEURAL FRONTIER</p>
          <h1>
            시냅스 방어선<span>작전 기록 #2000</span>
          </h1>
        </div>
        <div className="status-pill">
          <i />
          {ended ? '재생 완료' : playing ? '리플레이 진행 중' : '일시 정지'}
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {!replay && !error && <p>작전 기록 불러오는 중…</p>}
      {frame && next && replay && (
        <>
          <div className="command-layout">
            <section className="combat-panel reveal">
              <div className="combat-hud">
                <div>
                  <small>WAVE</small>
                  <strong>
                    {String(frame.wave).padStart(2, '0')}
                    <em>/{frame.max_rounds}</em>
                  </strong>
                </div>
                <div>
                  <small>기지 내구도</small>
                  <strong className="mint">
                    {frame.lives}
                    <em>/12</em>
                  </strong>
                </div>
                <div>
                  <small>보유 자원</small>
                  <strong className="gold">
                    {frame.gold}
                    <em>G</em>
                  </strong>
                </div>
                <div>
                  <small>처치</small>
                  <strong>{frame.kills}</strong>
                </div>
              </div>
              <div className="round-pressure" aria-live="polite">
                <div>
                  <b>ROUND {frame.wave}</b>
                  <span>
                    {ended
                      ? frame.lives > 0
                        ? '최종 라운드 생존'
                        : '방어선 붕괴'
                      : `다음 라운드 ${Math.ceil(((frame.round_ticks - (Math.max(0, frame.tick - 1) % frame.round_ticks) - 1) * frame.tick_ms) / 1000)}초`}
                  </span>
                </div>
                <progress
                  aria-label="현재 라운드 진행률"
                  max={frame.round_ticks}
                  value={
                    frame.tick === 0
                      ? 0
                      : ((frame.tick - 1) % frame.round_ticks) + 1
                  }
                />
                <small>
                  적 HP {frame.difficulty.hp.toFixed(0)} · 속도 ×
                  {frame.difficulty.speed_multiplier.toFixed(2)} · 출현{' '}
                  {(
                    (frame.difficulty.spawn_interval * frame.tick_ms) /
                    1000
                  ).toFixed(2)}
                  초
                </small>
              </div>
              <Battlefield
                frame={frame}
                next={next}
                duration={frame.tick_ms / speed}
                playing={playing && !ended}
                selected={selected}
                onSelect={setSelected}
              />
              <div className="map-caption">
                <span>
                  <i /> 구간 07 · 굴곡 방어선
                </span>
                <span>포탑을 선택해 유효 경로 확인</span>
              </div>
              <div className="playback">
                <button className="new-game-button" onClick={startNewGame}>
                  ＋ 새 게임
                </button>
                <button
                  className="play-button"
                  onClick={() => {
                    if (ended) setIndex(0)
                    setPlaying(ended ? true : !playing)
                  }}
                >
                  {ended ? '↻ 다시 재생' : playing ? 'Ⅱ 일시 정지' : '▶ 재생'}
                </button>
                <button
                  onClick={() => {
                    setIndex(0)
                    setPlaying(false)
                  }}
                  aria-label="처음으로"
                >
                  ↶
                </button>
                <div className="speed-switch">
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      className={speed === s ? 'chosen' : ''}
                      onClick={() => setSpeed(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <span>
                  {Math.floor((frame.tick * frame.tick_ms) / 1000)}초 /{' '}
                  {frame.max_rounds} 라운드
                </span>
              </div>
              <input
                className="scrubber"
                type="range"
                min="0"
                max={replay.frames.length - 1}
                value={index}
                aria-label="리플레이 탐색"
                onChange={(e) => {
                  setPlaying(false)
                  setIndex(Number(e.target.value))
                }}
              />
            </section>
            <aside
              className="inspector reveal"
              style={{ '--accent': kind.color } as React.CSSProperties}
            >
              <div className="panel-heading">
                TOWER INSPECTOR
                <span>슬롯 {String(selected + 1).padStart(2, '0')}</span>
              </div>
              <div className={`tower-portrait type-${frame.types[selected]}`}>
                <div className="portrait-ring" />
                <div className="large-turret">
                  <i />
                  <b />
                  <em />
                </div>
                <span>{kind.code}</span>
              </div>
              <div className="inspector-body">
                <p className="overline">
                  {kind.role} · {level ? `LEVEL ${level}` : '미배치'}
                </p>
                <h2>{kind.name}</h2>
                <p>{kind.description}</p>
                <div className="specs">
                  <div>
                    <span>공격력 / 틱</span>
                    <b>{level ? (kind.damage * level).toFixed(1) : '—'}</b>
                  </div>
                  <div>
                    <span>경로 사거리</span>
                    <b>±{Math.round(kind.range * 100)}%</b>
                  </div>
                  <div>
                    <span>강화 단계</span>
                    <b>{level} / 3</b>
                  </div>
                </div>
                <div className="level-bars">
                  {[1, 2, 3].map((l) => (
                    <i key={l} className={level >= l ? 'filled' : ''} />
                  ))}
                </div>
                <p className="technical-note">
                  강조한 경로가 실제 판정 구간입니다. 맵 좌표는 리플레이용
                  시각화입니다.
                </p>
              </div>
            </aside>
          </div>
          <section className="deployment reveal">
            <div className="panel-heading">
              DEPLOYMENT
              <span>배치 {frame.towers.filter(Boolean).length} / 8</span>
            </div>
            <div className="slot-roster">
              {frame.towers.map((l, i) => (
                <button
                  key={i}
                  className={selected === i ? 'selected' : ''}
                  onClick={() => setSelected(i)}
                  style={
                    {
                      '--accent': kinds[frame.types[i]].color,
                    } as React.CSSProperties
                  }
                >
                  <small>0{i + 1}</small>
                  <b>{kinds[frame.types[i]].name}</b>
                  <span>{l ? `LV.${l}` : '미배치'}</span>
                </button>
              ))}
            </div>
          </section>
          <div className="operation-log reveal">
            <span>MODEL DECISION</span>
            <b>
              {!frame.action
                ? '자원을 비축하며 전황 관찰'
                : frame.action <= 8
                  ? `${frame.action}번 슬롯 포탑 배치`
                  : `${frame.action - 8}번 슬롯 포탑 강화`}
            </b>
            <small>학습 모델의 기록된 행동</small>
          </div>
          <details className="model-details">
            <summary>연결망 모델 · 리플레이 정보</summary>
            <p>
              FlyWire v783 뉴런 {replay.report.manifest.nodes.toLocaleString()}
              개 · 연결{' '}
              {replay.report.manifest.coalesced_edges.toLocaleString()}개. 학습
              결과를 재생하며 실시간 추론은 아직 연결하지 않았습니다. 모션은
              기록 사이를 보간한 연출입니다.
            </p>
            <p>
              기존 인공 감각·행동 인터페이스를 사용하며 생물학적 행동의 재현을
              의미하지 않습니다.{' '}
              <a href="https://github.com/philshiu/Drosophila_brain_model">
                데이터 출처
              </a>{' '}
              ·{' '}
              <a href="https://edit.flywire.ai/principles.html">CC BY-NC 4.0</a>
            </p>
          </details>
        </>
      )}
      <footer className="command-footer">
        <span>NEURAL SYSTEMS / EXPERIMENT 001</span>
        <span>Anime.js motion engine</span>
      </footer>
    </main>
  )
}
createRoot(document.getElementById('app')!).render(<DefenseReplay />)

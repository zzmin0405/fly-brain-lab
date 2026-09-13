import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

type Frame = {
  tick: number
  wave: number
  gold: number
  lives: number
  kills: number
  towers: number[]
  types: number[]
  enemies: { position: number; hp: number }[]
  action?: number
}
type Replay = {
  frames: Frame[]
  report: {
    manifest: { nodes: number; coalesced_edges: number }
    changed_neuron_gains: number
    before: { mean_score: number }
    after: { mean_score: number }
    validation_teacher_agreement: number
  }
}
const trackPoints = [
  [30, 170], [130, 170], [180, 92], [300, 92], [350, 248],
  [485, 248], [540, 105], [680, 105], [735, 220], [870, 220],
] as const
const trackPath = `M ${trackPoints.map(([x, y]) => `${x} ${y}`).join(' L ')}`
const towerMeta = [
  { name: '블라스트 포탑', role: '범위 폭발', damage: '42', range: '105', rate: '1.2s', color: '#bafa68' },
  { name: '아이리스 레일', role: '단일 저격', damage: '96', range: '150', rate: '2.4s', color: '#aaa7ee' },
  { name: '펄스 앵커', role: '감속 제어', damage: '18', range: '78', rate: '0.8s', color: '#75dce5' },
]
function trackPosition(progress: number) {
  const segments = trackPoints.slice(1).map((point, i) => {
    const [x, y] = trackPoints[i]
    return { x, y, dx: point[0] - x, dy: point[1] - y, length: Math.hypot(point[0] - x, point[1] - y) }
  })
  const total = segments.reduce((sum, segment) => sum + segment.length, 0)
  let distance = Math.max(0, Math.min(1, progress)) * total
  for (const segment of segments) {
    if (distance <= segment.length) return [segment.x + segment.dx * (distance / segment.length), segment.y + segment.dy * (distance / segment.length)]
    distance -= segment.length
  }
  return trackPoints[trackPoints.length - 1]
}
export function DefenseReplay() {
  const [replay, setReplay] = useState<Replay | null>(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    fetch('/trained-defense.json')
      .then((response) => {
        if (!response.ok)
          throw new Error('학습 결과가 아직 준비되지 않았습니다.')
        return response.json()
      })
      .then(setReplay)
      .catch((reason) => setError(String(reason)))
  }, [])
  useEffect(() => {
    if (!replay || !playing) return
    const timer = setInterval(
      () => setIndex((i) => Math.min(i + 1, replay.frames.length - 1)),
      160,
    )
    return () => clearInterval(timer)
  }, [playing, replay])
  const frame = replay?.frames[index]
  return (
    <main className="game-shell">
      <header className="game-nav">
        <a href="/defense.html">BRAIN / DEFENSE</a>
        <a href="/maze.html">미로 실험실 →</a>
      </header>
      <section className="intro game-hero">
        <p className="eyebrow">FULL CONNECTOME / TRAINING REPLAY</p>
        <h1>
          실제 연결망.
          <br />첫 번째 방어 실험.
        </h1>
        <p>
          학습한 모델이 직접 선택한 구매·강화 기록입니다. 실시간 추론과 사용자
          튜닝은 아직 연결하지 않았습니다.
        </p>
      </section>
      {error && <p role="alert">{error}</p>}
      {replay && frame && (
        <>
          <div className="toolbar game-toolbar">
            <button className="primary" onClick={() => setPlaying(!playing)}>
              {playing ? '일시 정지' : '재생'}
            </button>
            <button
              onClick={() => {
                setIndex(0)
                setPlaying(true)
              }}
            >
              처음부터
            </button>
            <span>
              검증 시드 2000 · 웨이브 {frame.wave}/10 · 틱 {frame.tick}/160
            </span>
          </div>
          <div className="wave-strip">
            <span className="wave-strip-label">WAVE {String(frame.wave).padStart(2, '0')}</span>
            <div className="wave-progress"><i style={{ width: `${Math.min(100, (frame.tick / 160) * 100)}%` }} /></div>
            <span className="wave-strip-meta">다음 웨이브까지 {Math.max(0, 160 - frame.tick)}틱</span>
          </div>
          <div className="arena game-arena">
            <div className="bar game-hud">
              <span>♥ {frame.lives} 생명</span>
              <span>◈ {frame.gold} 골드</span>
              <span>{frame.kills} 처치</span>
            </div>
            <svg
              viewBox="0 0 900 340"
              role="img"
              aria-label="전체 연결망 모델의 타워 디펜스 플레이 리플레이"
              style={{ width: '100%', display: 'block' }}
            >
              <defs>
                <linearGradient id="towerGlow" x1="0" x2="1">
                  <stop offset="0" stopColor="#bafa68" />
                  <stop offset="1" stopColor="#4d9c79" />
                </linearGradient>
                <filter id="softGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <path d={trackPath} fill="none" stroke="#57716d" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d={trackPath}
                stroke="#bafa6844"
                strokeWidth="2"
                strokeDasharray="8 8"
              />
              {frame.towers.map((level, i) => (
                <g
                  key={i}
                  transform={`translate(${30 + ((i + 0.5) / 8) * 840},${i % 2 ? 245 : 95})`}
                >
                  <circle r={frame.types[i] === 0 ? 105 : frame.types[i] === 1 ? 150 : 78} fill={frame.types[i] === 1 ? '#aaa7ee12' : frame.types[i] === 2 ? '#75dce512' : '#bafa6810'} stroke={frame.types[i] === 1 ? '#aaa7ee55' : frame.types[i] === 2 ? '#75dce555' : '#bafa6855'} strokeDasharray="5 7" />
                  <rect x="-27" y="-27" width="54" height="54" rx="14" fill="#15272b" stroke="#4d6b67" strokeWidth="2" />
                  {level ? <>{frame.types[i] === 0 && <><path d="M-15 12 L-10 -12 L10 -12 L15 12 Z" fill="url(#towerGlow)" /><path d="M0 -12 V-25" stroke="#dff9b0" strokeWidth="5" strokeLinecap="round" /></>}{frame.types[i] === 1 && <><rect x="-12" y="-13" width="24" height="28" rx="4" fill="#aaa7ee" /><path d="M-12 -9 H12 M-12 0 H12" stroke="#eeeaff" strokeWidth="3" /></>}{frame.types[i] === 2 && <><circle r="14" fill="#75dce5" /><path d="M-19 0 H19 M0 -19 V19" stroke="#d7fbff" strokeWidth="3" /></>}</> : <text textAnchor="middle" y="6" fill="#67827b" fontSize="25">+</text>}
                  {level > 1 && <circle r="20" fill="none" stroke="#bafa68" strokeWidth="2" strokeDasharray="3 5" opacity=".7" filter="url(#softGlow)" />}
                  <text
                    textAnchor="middle"
                    y="5"
                    fill={level ? '#102020' : '#a1b6b0'}
                    fontSize="14"
                  >
                    {level ? `LV${level}` : ''}
                  </text>
                  <text
                    textAnchor="middle"
                    y={i % 2 ? 45 : -37}
                    fill="#adc0b9"
                    fontSize="12"
                  >
                    {['포격', '장거리', '감속'][frame.types[i]]}
                  </text>
                </g>
              ))}
              {frame.enemies.map((enemy, i) => (
                <g
                  key={i}
                  transform={`translate(${trackPosition(enemy.position)[0]},${trackPosition(enemy.position)[1]})`}
                >
                  <rect x="-13" y="-13" width="26" height="26" rx="8" fill={i % 3 === 0 ? '#ef8059' : i % 3 === 1 ? '#e7a45e' : '#d96d92'} stroke="#ffd0a8" strokeWidth="2" transform={`rotate(${i * 17})`} />
                  <rect x="-15" y="-21" width="30" height="4" rx="2" fill="#26383a" /><rect x="-15" y="-21" width={`${Math.max(2, Math.min(30, enemy.hp / 30 * 30))}`} height="4" rx="2" fill="#ef8059" />
                  <text
                    y="-17"
                    textAnchor="middle"
                    fill="#eff4ef"
                    fontSize="10"
                  >
                    {Math.ceil(enemy.hp)}
                  </text>
                </g>
              ))}
              <text x="14" y="215" fill="#adc0b9">
                적 진입
              </text>
              <text x="825" y="215" fill="#bafa68">
                기지
              </text>
            </svg>
            <div className="bar game-decision">
              결정:{' '}
              {!frame.action
                ? '대기'
                : frame.action <= 8
                  ? `${frame.action}번 슬롯 구매`
                  : `${frame.action - 8}번 슬롯 강화`}
            </div>
          </div>
          <section className="tower-deck" aria-label="포탑 도감">
            <div className="tower-deck-heading"><span>DEFENSE LOADOUT</span><small>자동 배치된 포탑의 전투 스펙</small></div>
            <div className="tower-cards">
              {towerMeta.map((tower, i) => <article className="tower-card" key={tower.name} style={{ '--tower-color': tower.color } as React.CSSProperties}>
                <div className="tower-card-top"><span className="tower-icon">{i === 0 ? '◆' : i === 1 ? '╋' : '✦'}</span><div><strong>{tower.name}</strong><small>{tower.role}</small></div><em>{frame.towers[i] ? `LV ${frame.towers[i]}` : 'EMPTY'}</em></div>
                <div className="tower-metrics"><span><b>{tower.damage}</b> DMG</span><span><b>{tower.range}</b> RNG</span><span><b>{tower.rate}</b> CD</span></div>
              </article>)}
            </div>
          </section>
          <section className="history game-stats">
            <h2>실제 실행 결과</h2>
            <p>
              뉴런 {replay.report.manifest.nodes.toLocaleString()}개 · 연결{' '}
              {replay.report.manifest.coalesced_edges.toLocaleString()}개 ·
              학습된 뉴런 gain{' '}
              {replay.report.changed_neuron_gains.toLocaleString()}개
            </p>
            <p>
              동일 평가 시드 점수: 학습 전 {replay.report.before.mean_score} →
              학습 후 {replay.report.after.mean_score}
            </p>
            <p>
              별도 검증 시드에서 교사 행동 일치율:{' '}
              {(replay.report.validation_teacher_agreement * 100).toFixed(1)}%
            </p>
            <p>
              모델: 실제 FlyWire v783 연결망 + 인공 감각/행동 인터페이스 + 3단계
              rate 계산. 초파리의 생물학적 행동을 재현했다는 의미는 아닙니다. 첫
              학습은 수작업 교사의 행동 모방이며 도파민 학습이 아닙니다.
            </p>
            <p>
              데이터:{' '}
              <a href="https://github.com/philshiu/Drosophila_brain_model">
                Shiu 연구진 배포본
              </a>{' '}
              ·{' '}
              <a href="https://edit.flywire.ai/principles.html">
                FlyWire CC BY-NC 4.0
              </a>{' '}
              · 가중치 정규화와 뉴런별 전달 배율 학습 적용
            </p>
          </section>
        </>
      )}
    </main>
  )
}
createRoot(document.getElementById('app')!).render(<DefenseReplay />)

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
    <main>
      <header>
        <a href="/defense.html">BRAIN / DEFENSE</a>
        <a href="/maze.html">미로 실험실 →</a>
      </header>
      <section className="intro">
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
          <div className="toolbar">
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
          <div className="arena">
            <div className="bar">
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
              <path d="M30 170 H870" stroke="#57716d" strokeWidth="44" />
              <path
                d="M30 170 H870"
                stroke="#bafa6844"
                strokeWidth="2"
                strokeDasharray="8 8"
              />
              {frame.towers.map((level, i) => (
                <g
                  key={i}
                  transform={`translate(${30 + ((i + 0.5) / 8) * 840},${i % 2 ? 245 : 95})`}
                >
                  <circle
                    r="25"
                    fill={
                      level
                        ? ['#bafa68', '#aaa7ee', '#75dce5'][frame.types[i]]
                        : '#203236'
                    }
                    stroke="#76918a"
                  />
                  <text
                    textAnchor="middle"
                    y="5"
                    fill={level ? '#102020' : '#a1b6b0'}
                    fontSize="14"
                  >
                    {level ? `LV${level}` : '+'}
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
                  transform={`translate(${30 + enemy.position * 840},170)`}
                >
                  <circle r="10" fill="#ef8059" />
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
            <div className="bar">
              결정:{' '}
              {!frame.action
                ? '대기'
                : frame.action <= 8
                  ? `${frame.action}번 슬롯 구매`
                  : `${frame.action - 8}번 슬롯 강화`}
            </div>
          </div>
          <section className="history">
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

import { useEffect, useRef, useState } from 'react'
import { defaults, Experiment } from './simulation'
import type { Weights } from './simulation'
import { drawMaze } from './drawMaze'
const controls: { key: keyof Weights; name: string; description: string }[] = [
  {
    key: 'odor',
    name: '냄새 반응',
    description: '가까운 통로의 냄새 신호에 반응',
  },
  {
    key: 'explore',
    name: '새 경로 탐색',
    description: '덜 방문한 인접 통로를 선호',
  },
  {
    key: 'persistence',
    name: '방향 유지',
    description: '현재 이동 방향을 계속 유지',
  },
  {
    key: 'caution',
    name: '반복 회피',
    description: '이미 간 길을 피하는 억제 회로',
  },
  {
    key: 'memory',
    name: '기억 유지',
    description: '방문 흔적이 선택에 남는 정도',
  },
  { key: 'noise', name: '신경 잡음', description: '선택에 섞이는 변동성' },
]
type Result = {
  seed: number
  size: number
  steps: number
  status: string
  weights: Weights
  trace: number[]
  score: number
}
const emptyStats = {
  steps: 0,
  visited: 1,
  status: 'running',
  activity: [0, 0, 0, 0],
}
export default function App() {
  const [seed, setSeed] = useState(2026),
    [seedText, setSeedText] = useState('2026')
  const [size, setSize] = useState(9),
    [run, setRun] = useState(0)
  const [weights, setWeights] = useState(defaults),
    [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(8),
    [showOdor, setShowOdor] = useState(false)
  const [records, setRecords] = useState<Result[]>([]),
    [stats, setStats] = useState(emptyStats)
  const [leaderboard, setLeaderboard] = useState<Result[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem('fly-brain-leaderboard') ?? '[]',
      ) as Result[]
    } catch {
      return []
    }
  })
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ weights, paused, speed, showOdor, records })
  useEffect(() => {
    live.current = { weights, paused, speed, showOdor, records }
  }, [weights, paused, speed, showOdor, records])
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const experiment = new Experiment(seed, size)
    let frame = 0,
      last = 0,
      elapsed = 0,
      saved = false,
      reported = -1
    const render = (now: number) => {
      const config = live.current
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
      last = now
      if (!config.paused && experiment.status === 'running') {
        elapsed += dt * config.speed
        while (elapsed >= 1 && experiment.status === 'running') {
          experiment.step(config.weights)
          elapsed--
        }
      }
      if (!saved && experiment.status !== 'running') {
        saved = true
        setRecords((previous) =>
          [
            {
              seed,
              size,
              steps: experiment.steps,
              status: experiment.status,
              weights: { ...config.weights },
              trace: [...experiment.trace],
              score:
                experiment.status === 'success'
                  ? Math.max(1, 10000 - experiment.steps * 10)
                  : 0,
            },
            ...previous,
          ].slice(0, 8),
        )
        if (experiment.status === 'success')
          setLeaderboard((previous) => {
            const entry = {
              seed,
              size,
              steps: experiment.steps,
              status: experiment.status,
              weights: { ...config.weights },
              trace: [...experiment.trace],
              score: Math.max(1, 10000 - experiment.steps * 10),
            }
            const next = [...previous, entry]
              .sort((a, b) => b.score - a.score)
              .slice(0, 20)
            localStorage.setItem('fly-brain-leaderboard', JSON.stringify(next))
            return next
          })
      }
      drawMaze(
        context,
        experiment,
        config.showOdor,
        config.records.find(
          (record) => record.seed === seed && record.size === size,
        )?.trace,
      )
      if (reported !== experiment.steps) {
        reported = experiment.steps
        setStats({
          steps: experiment.steps,
          visited: experiment.visits.filter(Boolean).length,
          status: experiment.status,
          activity: [...experiment.activity],
        })
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [seed, size, run])
  const restart = () => {
    setRun((value) => value + 1)
    setPaused(false)
    setStats(emptyStats)
  }
  const newMaze = () => {
    const next = crypto.getRandomValues(new Uint32Array(1))[0]
    setSeed(next)
    setSeedText(String(next))
    restart()
  }
  const seedValid = /^\d+$/.test(seedText) && Number(seedText) <= 4294967295
  return (
    <main>
      <header>
        <a href="/">FLY / BRAIN LAB</a>
        <span>실험 002 · 랜덤 미로</span>
      </header>
      <section className="intro">
        <p className="eyebrow">MAZE EXPERIMENT</p>
        <h1>
          작은 초파리.
          <br />
          매번 다른 갈림길.
        </h1>
        <p>반응을 조절하고, 같은 미로에서 달라지는 선택을 관찰하세요.</p>
      </section>
      <section className="history leaderboard">
        <h2>
          시드 랭킹{' '}
          <span>
            {seed} · {size} × {size} · 이 브라우저 기록
          </span>
        </h2>
        {leaderboard.filter(
          (entry) => entry.seed === seed && entry.size === size,
        ).length ? (
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>점수</th>
                <th>이동</th>
                <th>가중치 · 냄새 / 탐색 / 유지</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard
                .filter((entry) => entry.seed === seed && entry.size === size)
                .map((entry, index) => (
                  <tr key={`${entry.seed}-${entry.score}-${index}`}>
                    <td>#{index + 1}</td>
                    <td>
                      <b className="score">{entry.score.toLocaleString()}</b>
                    </td>
                    <td>{entry.steps}</td>
                    <td>
                      {entry.weights.odor} / {entry.weights.explore} /{' '}
                      {entry.weights.persistence} / {entry.weights.caution} /{' '}
                      {entry.weights.memory} / {entry.weights.noise}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p>
            이 시드에서 성공한 기록이 아직 없습니다. 같은 시드를 공유하고 더
            높은 점수에 도전하세요.
          </p>
        )}
      </section>
      <div className="toolbar">
        <button className="primary" onClick={newMaze}>
          ↻ 새 랜덤 미로
        </button>
        <button onClick={restart}>같은 미로 재도전</button>
        <label>
          크기{' '}
          <select
            value={size}
            onChange={(event) => {
              setSize(Number(event.target.value))
              restart()
            }}
          >
            <option value={7}>작게 · 7 × 7</option>
            <option value={9}>보통 · 9 × 9</option>
            <option value={13}>크게 · 13 × 13</option>
          </select>
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (seedValid) {
              setSeed(Number(seedText))
              restart()
            }
          }}
        >
          <label htmlFor="seed">시드</label>
          <input
            id="seed"
            value={seedText}
            inputMode="numeric"
            onChange={(event) => setSeedText(event.target.value)}
            aria-invalid={!seedValid}
          />
          <button disabled={!seedValid}>적용</button>
        </form>
      </div>
      <section className="lab">
        <div className="arena">
          <div className="bar">
            <span>
              <i />
              {stats.status === 'success'
                ? '먹이 도착!'
                : stats.status === 'timeout'
                  ? '탐험 종료 · 이동 한도 도달'
                  : paused
                    ? '일시 정지'
                    : '미로 탐험 중'}
            </span>
            <button
              disabled={stats.status !== 'running'}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? '계속 탐험' : '일시 정지'}
            </button>
          </div>
          <canvas
            ref={canvas}
            width={600}
            height={600}
            aria-label="초파리가 자동 탐험하는 랜덤 미로. 녹색 점은 먹이, 연두색 선은 이동 경로입니다."
          />
          <div className="legend">
            <span className="food">● 먹이 / 현재 경로</span>
            <span style={{ color: '#aaa7ee' }}>━ 최근 완료 경로</span>
            <label>
              <input
                type="checkbox"
                checked={showOdor}
                onChange={(event) => setShowOdor(event.target.checked)}
              />{' '}
              냄새 표시
            </label>
          </div>
        </div>
        <aside>
          <p className="eyebrow">CONTROLLER / DEMO</p>
          <h2>행동을 조율하세요</h2>
          <p>감각·기억·억제·잡음 회로의 균형으로 다음 방향을 선택합니다.</p>
          {controls.map((control) => (
            <label key={control.key}>
              <span>
                {control.name}
                <b>{weights[control.key]}</b>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={weights[control.key]}
                onChange={(event) =>
                  setWeights({
                    ...weights,
                    [control.key]: Number(event.target.value),
                  })
                }
              />
              <small>{control.description}</small>
            </label>
          ))}
          <button className="reset" onClick={() => setWeights(defaults)}>
            기본 설정으로 복원
          </button>
          <div className="metrics">
            <div>
              <strong>{stats.steps}</strong>
              <small>이동 횟수</small>
            </div>
            <div>
              <strong>
                {Math.round((stats.visited / (size * size)) * 100)}%
              </strong>
              <small>탐색한 영역</small>
            </div>
          </div>
          <label>
            <span>
              재생 속도<b>{speed}칸 / 초</b>
            </span>
            <input
              type="range"
              min="1"
              max="30"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>
          <div className="signals">
            {['↑', '→', '↓', '←'].map((direction, i) => (
              <div key={direction}>
                <span>{direction}</span>
                <meter min="0" max="3" value={stats.activity[i]} />
              </div>
            ))}
          </div>
          <p className="note">
            게임용 제어기 · 실제 뇌 데이터 미연동
            <br />
            막대는 게임 모델의 활성도입니다. 방문 기억과 감각·운동 연결도 게임을
            위해 설계했습니다.
          </p>
        </aside>
      </section>
      <section className="history">
        <h2>
          실험 기록 <span>최근 8회 · 이번 세션</span>
        </h2>
        {records.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>미로 시드</th>
                  <th>크기</th>
                  <th>결과</th>
                  <th>이동</th>
                  <th>최종 설정 · 냄새 / 탐색 / 유지</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={index}>
                    <td>{record.seed}</td>
                    <td>
                      {record.size} × {record.size}
                    </td>
                    <td>
                      {record.status === 'success' ? '먹이 도착' : '이동 한도'}
                    </td>
                    <td>{record.steps}</td>
                    <td>
                      {record.weights.odor} / {record.weights.explore} /{' '}
                      {record.weights.persistence} / {record.weights.caution} /{' '}
                      {record.weights.memory} / {record.weights.noise}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            먹이에 도착하거나 이동 한도에 도달하면 기록됩니다. 같은 시드로
            재도전하면 최근 완료 경로가 겹쳐 보입니다.
          </p>
        )}
      </section>
      <footer>
        <span>
          구조 참고:{' '}
          <a
            href="https://github.com/nftechie/doomfly"
            target="_blank"
            rel="noreferrer"
          >
            DOOMFLY
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/ornata/fly"
            target="_blank"
            rel="noreferrer"
          >
            Fly64
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/NeLy-EPFL/flygym"
            target="_blank"
            rel="noreferrer"
          >
            FlyGym
          </a>
        </span>
        <span>PROTOTYPE / 0.2</span>
      </footer>
    </main>
  )
}

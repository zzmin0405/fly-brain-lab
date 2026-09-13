import { useEffect, useRef, useState } from 'react'

const initialWeights = { food: 65, explore: 35, avoid: 60 }
const labels = { food: '먹이 추적', explore: '탐색', avoid: '위험 회피' }
type Weights = typeof initialWeights

export default function App() {
  const [weights, setWeights] = useState(initialWeights)
  const [running, setRunning] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const weightsRef = useRef(weights)
  useEffect(() => {
    weightsRef.current = weights
  }, [weights])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    let frame = 0
    let last = 0
    let elapsed = 0
    let x = 160
    let y = 240
    const draw = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      if (running) {
        elapsed += dt
        const w = weightsRef.current
        const distance = Math.hypot(620 - x, 240 - y) || 1
        const danger = Math.hypot(x - 400, y - 240) || 1
        const repel = (Math.max(0, 170 - danger) / 170) * w.avoid * 3
        x +=
          (((620 - x) / distance) * w.food +
            Math.cos(elapsed * 1.7) * w.explore +
            ((x - 400) / danger) * repel) *
          dt
        y +=
          (((240 - y) / distance) * w.food +
            Math.sin(elapsed * 2.3) * w.explore +
            ((y - 240) / danger) * repel) *
          dt
        x = Math.max(16, Math.min(784, x))
        y = Math.max(16, Math.min(464, y))
      }
      context.clearRect(0, 0, 800, 480)
      context.strokeStyle = '#203032'
      for (let i = 0; i < 800; i += 40) {
        context.beginPath()
        context.moveTo(i, 0)
        context.lineTo(i, 480)
        context.stroke()
      }
      for (let i = 0; i < 480; i += 40) {
        context.beginPath()
        context.moveTo(0, i)
        context.lineTo(800, i)
        context.stroke()
      }
      const circle = (
        cx: number,
        cy: number,
        radius: number,
        color: string,
      ) => {
        context.fillStyle = color
        context.beginPath()
        context.arc(cx, cy, radius, 0, Math.PI * 2)
        context.fill()
      }
      circle(400, 240, 95, '#ef805922')
      circle(400, 240, 22, '#ef8059')
      circle(620, 240, 55, '#bafa6820')
      circle(620, 240, 12, '#bafa68')
      circle(x - 7, y - 6, 8, '#e8f0ed99')
      circle(x + 7, y - 6, 8, '#e8f0ed99')
      circle(x, y, 6, '#ffffff')
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [running])

  return (
    <main>
      <header>
        <a href="/">FLY / BRAIN LAB</a>
        <span>실험 001 · 행동 튜닝</span>
      </header>
      <section className="intro">
        <p className="eyebrow">작은 뇌, 다른 선택.</p>
        <h1>
          가중치를 바꾸고.
          <br />
          행동을 관찰하세요.
        </h1>
        <p>나만의 초파리를 설계하는 작은 실험실.</p>
      </section>
      <section className="lab">
        <div className="arena">
          <div className="bar">
            <span>
              <i /> {running ? '시뮬레이션 진행 중' : '정지됨'}
            </span>
            <button onClick={() => setRunning(!running)}>
              {running ? '정지' : '다시 시작'}
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={800}
            height={480}
            aria-label="가중치에 따라 먹이를 향해 움직이는 초파리 시뮬레이션"
          />
          <div className="legend">
            <span>● 초파리</span>
            <span className="food">● 먹이</span>
            <span className="danger">● 위험 영역</span>
          </div>
        </div>
        <aside>
          <p className="eyebrow">행동 설정</p>
          <h2>어떤 뇌를 만들까요?</h2>
          <p>슬라이더를 움직이면 즉시 반영됩니다.</p>
          {(Object.keys(weights) as (keyof Weights)[]).map((key) => (
            <label key={key}>
              <span>
                {labels[key]}
                <b>{weights[key]}</b>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={weights[key]}
                onChange={(event) =>
                  setWeights({ ...weights, [key]: Number(event.target.value) })
                }
              />
            </label>
          ))}
          <button className="reset" onClick={() => setWeights(initialWeights)}>
            기본 가중치로 복원
          </button>
          <p className="note">
            현재는 게임용 행동 모델입니다. 실제 초파리 뇌 연결망 데이터는 아직
            연결되지 않았습니다.
          </p>
        </aside>
      </section>
      <footer>
        먼저 관찰하고, 조금씩 바꾸세요. <span>PROTOTYPE / 0.1</span>
      </footer>
    </main>
  )
}

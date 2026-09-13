export type Weights = { odor: number; explore: number; persistence: number }
export const defaults: Weights = { odor: 60, explore: 65, persistence: 35 }
export const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const
export function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let n = state
    n = Math.imul(n ^ (n >>> 15), n | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}
export type Maze = {
  size: number
  cells: number[]
  odor: number[]
  seed: number
  goal: number
}
export function makeMaze(seed: number, size: number): Maze {
  if (!Number.isInteger(size) || size < 2 || size > 31)
    throw new Error('미로 크기는 2~31 정수여야 합니다.')
  const rng = random(seed)
  const cells = Array<number>(size * size).fill(0)
  const visited = new Set([0]),
    stack = [0]
  while (stack.length) {
    const current = stack[stack.length - 1]
    const choices = directions.flatMap(([dx, dy], d) => {
      const x = (current % size) + dx,
        y = Math.floor(current / size) + dy
      const next = y * size + x
      return x >= 0 && y >= 0 && x < size && y < size && !visited.has(next)
        ? [{ next, d }]
        : []
    })
    if (!choices.length) {
      stack.pop()
      continue
    }
    const { next, d } = choices[Math.floor(rng() * choices.length)]
    cells[current] |= 1 << d
    cells[next] |= 1 << ((d + 2) % 4)
    visited.add(next)
    stack.push(next)
  }
  for (let i = 0; i < cells.length; i++) {
    if (i % size < size - 1 && rng() < 0.08) {
      cells[i] |= 2
      cells[i + 1] |= 8
    }
    if (i < cells.length - size && rng() < 0.08) {
      cells[i] |= 4
      cells[i + size] |= 1
    }
  }
  const goal = cells.length - 1
  // 환경의 단순 확산장. 제어기에 목표 좌표나 최단 경로를 전달하지 않는다.
  let odor = Array<number>(cells.length).fill(0)
  odor[goal] = 1
  for (let iteration = 0; iteration < size * size * 12; iteration++) {
    const next = odor.map((value, i) => {
      if (i === goal) return 1
      let sum = 0,
        count = 0
      directions.forEach(([dx, dy], d) => {
        if (cells[i] & (1 << d)) {
          sum += odor[i + dy * size + dx]
          count++
        }
      })
      return value * 0.5 + (sum / Math.max(count, 1)) * 0.499
    })
    odor = next
  }
  return { size, cells, odor, seed, goal }
}
export type SensoryInput = {
  open: boolean[]
  odor: number[]
  familiarity: number[]
  heading: number
}
export type MotorOutput = { direction: number; activity: number[] }
export interface Controller {
  step(input: SensoryInput, weights: Weights): MotorOutput
}
export class DemoController implements Controller {
  private rng: () => number
  private activity = [0, 0, 0, 0]
  constructor(seed: number) {
    this.rng = random(seed ^ 0x52a79)
  }
  step(input: SensoryInput, weights: Weights): MotorOutput {
    const maximum = Math.max(...input.odor, 0.0000001)
    this.activity = input.open.map((open, direction) => {
      if (!open) return 0
      const smell = input.odor[direction] / maximum
      const novelty = 1 / (1 + input.familiarity[direction])
      const drive =
        (smell * weights.odor) / 100 +
        (novelty * weights.explore) / 100 +
        (direction === input.heading ? weights.persistence / 100 : 0)
      return this.activity[direction] * 0.2 + drive + this.rng() * 0.3
    })
    return {
      direction: this.activity.indexOf(Math.max(...this.activity)),
      activity: [...this.activity],
    }
  }
}
export class Experiment {
  maze: Maze
  position = 0
  heading = 1
  steps = 0
  trace = [0]
  visits: number[]
  activity = [0, 0, 0, 0]
  status: 'running' | 'success' | 'timeout' = 'running'
  controller: Controller
  constructor(seed: number, size: number, controller?: Controller) {
    this.maze = makeMaze(seed, size)
    this.visits = Array<number>(size * size).fill(0)
    this.visits[0] = 1
    this.controller = controller ?? new DemoController(seed)
  }
  step(weights: Weights) {
    if (this.status !== 'running') return
    const { size, cells, odor, goal } = this.maze
    const neighbors = directions.map(
      ([dx, dy]) => this.position + dx + dy * size,
    )
    const open = directions.map((_, d) =>
      Boolean(cells[this.position] & (1 << d)),
    )
    const result = this.controller.step(
      {
        open,
        odor: neighbors.map((n, d) => (open[d] ? odor[n] : 0)),
        familiarity: neighbors.map((n, d) => (open[d] ? this.visits[n] : 0)),
        heading: this.heading,
      },
      weights,
    )
    this.activity = result.activity
    if (open[result.direction]) {
      this.heading = result.direction
      this.position = neighbors[result.direction]
      this.visits[this.position]++
      this.trace.push(this.position)
    }
    this.steps++
    if (this.position === goal) this.status = 'success'
    else if (this.steps >= size * size * 20) this.status = 'timeout'
  }
}

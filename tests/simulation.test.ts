import test from 'node:test'
import assert from 'node:assert/strict'
import {
  makeMaze,
  directions,
  Experiment,
  defaults,
} from '../src/simulation.ts'
test('여러 시드와 크기에서 외벽, 양방향 통로, 전체 도달 가능성을 보장한다', () => {
  for (const size of [7, 9, 13])
    for (let seed = 0; seed < 20; seed++) {
      const maze = makeMaze(seed, size),
        seen = new Set([0]),
        queue = [0]
      for (const i of queue)
        directions.forEach(([dx, dy], d) => {
          if (!(maze.cells[i] & (1 << d))) return
          const x = (i % size) + dx,
            y = Math.floor(i / size) + dy,
            next = y * size + x
          assert.ok(x >= 0 && y >= 0 && x < size && y < size)
          assert.ok(maze.cells[next] & (1 << ((d + 2) % 4)))
          if (!seen.has(next)) {
            seen.add(next)
            queue.push(next)
          }
        })
      assert.equal(seen.size, size * size)
      assert.ok(maze.odor.every((v) => Number.isFinite(v) && v >= 0 && v <= 1))
    }
})
test('같은 시드와 고정 설정은 같은 미로와 이동 경로를 만든다', () => {
  const a = new Experiment(2026, 7),
    b = new Experiment(2026, 7)
  for (let i = 0; i < 400; i++) {
    a.step(defaults)
    b.step(defaults)
  }
  assert.deepEqual(a.maze, b.maze)
  assert.deepEqual(a.trace, b.trace)
  assert.notDeepEqual(a.maze.cells, makeMaze(2027, 7).cells)
})
test('이동은 항상 열린 통로를 지나며 가중치에 따라 경로가 달라진다', () => {
  const a = new Experiment(9, 9),
    b = new Experiment(9, 9)
  for (let i = 0; i < 500; i++) {
    const before = a.position
    a.step(defaults)
    b.step({ odor: 0, explore: 0, persistence: 100 })
    if (a.position !== before)
      assert.ok(a.maze.cells[before] & (1 << a.heading))
  }
  assert.notDeepEqual(a.trace, b.trace)
})
test('정지한 제어기는 제한 내 종료하고 종료 후 상태는 변하지 않는다', () => {
  const e = new Experiment(1, 7, {
    step: () => ({ direction: -1, activity: [0, 0, 0, 0] }),
  })
  for (let i = 0; i < 1000; i++) e.step(defaults)
  assert.equal(e.status, 'timeout')
  assert.equal(e.steps, 980)
  e.step(defaults)
  assert.equal(e.steps, 980)
})
test('국소 입력에 전체 지도나 목표 좌표가 포함되지 않는다', () => {
  const e = new Experiment(3, 7, {
    step: (input) => {
      assert.deepEqual(Object.keys(input).sort(), [
        'familiarity',
        'heading',
        'odor',
        'open',
      ])
      return { direction: input.open.indexOf(true), activity: [0, 0, 0, 0] }
    },
  })
  e.step(defaults)
})

import type { Experiment } from './simulation'
export function drawMaze(
  ctx: CanvasRenderingContext2D,
  e: Experiment,
  showOdor: boolean,
  previous: number[] = [],
) {
  const { maze } = e,
    cell = 600 / maze.size
  const point = (i: number) => [
    ((i % maze.size) + 0.5) * cell,
    (Math.floor(i / maze.size) + 0.5) * cell,
  ]
  ctx.fillStyle = '#142224'
  ctx.fillRect(0, 0, 600, 600)
  maze.cells.forEach((walls, index) => {
    const x = (index % maze.size) * cell,
      y = Math.floor(index / maze.size) * cell
    ctx.fillStyle = showOdor
      ? `rgba(186,250,104,${Math.sqrt(maze.odor[index]) * 0.5})`
      : e.visits[index]
        ? '#bafa6809'
        : '#142224'
    ctx.fillRect(x, y, cell, cell)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#58716c'
    ctx.beginPath()
    if (!(walls & 1)) {
      ctx.moveTo(x, y)
      ctx.lineTo(x + cell, y)
    }
    if (!(walls & 2)) {
      ctx.moveTo(x + cell, y)
      ctx.lineTo(x + cell, y + cell)
    }
    if (!(walls & 4)) {
      ctx.moveTo(x, y + cell)
      ctx.lineTo(x + cell, y + cell)
    }
    if (!(walls & 8)) {
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + cell)
    }
    ctx.stroke()
  })
  const path = (points: number[], color: string, width: number) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.beginPath()
    points.forEach((p, i) => {
      const [x, y] = point(p)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.stroke()
  }
  path(previous, '#aaa7ee66', 5)
  path(e.trace, '#bafa6899', 2)
  const [gx, gy] = point(maze.goal)
  ctx.fillStyle = '#bafa68'
  ctx.beginPath()
  ctx.arc(gx, gy, cell * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#94aaa5'
  ctx.font = `${Math.max(9, cell * 0.16)}px sans-serif`
  ctx.fillText('START', 5, cell - 6)
  const [x, y] = point(e.position)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((e.heading * Math.PI) / 2)
  ctx.scale(cell / 55, cell / 55)
  ctx.strokeStyle = '#dfe8d6'
  ctx.lineWidth = 1.5
  for (let leg = -1; leg <= 1; leg++) {
    ctx.beginPath()
    ctx.moveTo(-3, leg * 4)
    ctx.lineTo(-11, leg * 8 + 3)
    ctx.moveTo(3, leg * 4)
    ctx.lineTo(11, leg * 8 + 3)
    ctx.stroke()
  }
  ctx.fillStyle = '#e7eee899'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * 5, 3, 4, 9, side * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#efe5c3'
  ctx.beginPath()
  ctx.ellipse(0, 1, 3, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ef8059'
  ctx.beginPath()
  ctx.arc(0, -7, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

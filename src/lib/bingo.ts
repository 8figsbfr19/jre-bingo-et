// BINGO columns: B(1-15) I(16-30) N(31-45) G(46-60) O(61-75)
const COLUMN_RANGES: [number, number][] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
]

function pickUnique(min: number, max: number, count: number): number[] {
  const pool: number[] = []
  for (let i = min; i <= max; i++) pool.push(i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

// Returns a 5x5 grid; center [2][2] is null (free space)
export function generateCard(): (number | null)[][] {
  const card: (number | null)[][] = Array.from({ length: 5 }, () => Array(5).fill(null))
  for (let col = 0; col < 5; col++) {
    const [min, max] = COLUMN_RANGES[col]
    const nums = pickUnique(min, max, 5)
    for (let row = 0; row < 5; row++) {
      card[row][col] = nums[row]
    }
  }
  card[2][2] = null // free space
  return card
}

export function checkWin(card: (number | null)[][], called: number[]): boolean {
  const calledSet = new Set(called)
  const hit = (r: number, c: number) => card[r][c] === null || calledSet.has(card[r][c] as number)

  // Rows
  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every((c) => hit(r, c))) return true
  }
  // Columns
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every((r) => hit(r, c))) return true
  }
  // Diagonals
  if ([0, 1, 2, 3, 4].every((i) => hit(i, i))) return true
  if ([0, 1, 2, 3, 4].every((i) => hit(i, 4 - i))) return true

  return false
}

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O']

export function columnLetter(num: number): string {
  if (num <= 15) return 'B'
  if (num <= 30) return 'I'
  if (num <= 45) return 'N'
  if (num <= 60) return 'G'
  return 'O'
}

import { BINGO_LETTERS } from '../lib/bingo'

interface Props {
  card: (number | null)[][]
  calledNumbers: number[]
}

export function BingoCard({ card, calledNumbers }: Props) {
  const calledSet = new Set(calledNumbers)

  return (
    <div className="w-full max-w-xs mx-auto select-none">
      {/* Header row */}
      <div className="grid grid-cols-5 gap-1 mb-1">
        {BINGO_LETTERS.map((l) => (
          <div key={l} className="flex items-center justify-center h-10 rounded bg-brand font-bold text-white text-lg">
            {l}
          </div>
        ))}
      </div>

      {/* Number grid */}
      {card.map((row, r) => (
        <div key={r} className="grid grid-cols-5 gap-1 mb-1">
          {row.map((num, c) => {
            const isFree = num === null
            const isHit = isFree || calledSet.has(num!)
            return (
              <div
                key={c}
                className={[
                  'flex items-center justify-center h-12 rounded font-semibold text-base transition-colors',
                  isFree
                    ? 'bg-brand text-white text-xs'
                    : isHit
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-800',
                ].join(' ')}
              >
                {isFree ? 'FREE' : num}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

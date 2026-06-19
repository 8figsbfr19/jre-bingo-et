const HEADER = ['B', 'I', 'N', 'G', 'O']
const HEADER_BG = [
  'bg-blue-700',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-green-600',
  'bg-red-600',
]

interface Props {
  card: (number | null)[][]
  calledNumbers?: number[]
  cardNumber?: number
  compact?: boolean
}

export function BingoCardDisplay({ card, calledNumbers = [], cardNumber, compact = false }: Props) {
  const calledSet = new Set(calledNumbers)

  const cellSize = compact ? 'h-9 text-sm' : 'h-11 text-base'
  const headerSize = compact ? 'h-9 text-sm' : 'h-11 text-base'

  return (
    <div className="w-full select-none">
      {cardNumber !== undefined && (
        <div className="text-center text-purple-300 text-xs mb-1 font-medium">
          Card No. <span className="text-white font-bold">{cardNumber}</span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1">
        {/* Header row */}
        {HEADER.map((l, i) => (
          <div
            key={l}
            className={`${headerSize} ${HEADER_BG[i]} flex items-center justify-center rounded-lg font-black text-white`}
          >
            {l}
          </div>
        ))}

        {/* Number cells */}
        {card.map((row, r) =>
          row.map((num, c) => {
            const isFree = num === null
            const isHit = isFree || calledSet.has(num!)
            return (
              <div
                key={`${r}-${c}`}
                className={[
                  cellSize,
                  'flex items-center justify-center rounded-lg font-bold transition-all duration-300',
                  isFree
                    ? 'bg-purple-600 text-white text-xs'
                    : isHit
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                    : 'bg-[#2a1f55] text-purple-100',
                ].join(' ')}
              >
                {isFree ? 'FREE' : num}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}

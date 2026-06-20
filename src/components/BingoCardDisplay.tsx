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
  manuallyMarked?: Set<number>
  onCellTap?: (num: number | null) => void
  cardNumber?: number
  compact?: boolean
  autoMark?: boolean // if false: auto-highlight is disabled; player must tap manually
}

export function BingoCardDisplay({
  card,
  calledNumbers = [],
  manuallyMarked,
  onCellTap,
  cardNumber,
  compact = false,
  autoMark = true,
}: Props) {
  const calledSet = new Set(calledNumbers)
  const cellH = compact ? 'h-9 text-xs' : 'h-11 text-sm'
  const headerH = compact ? 'h-9 text-sm' : 'h-11 text-base'

  const wrongTapCount = manuallyMarked
    ? [...manuallyMarked].filter(n => !calledSet.has(n)).length
    : 0

  return (
    <div className="w-full select-none">
      {cardNumber !== undefined && (
        <div className="text-center text-purple-300 text-xs mb-1 font-medium">
          Card No. <span className="text-white font-bold">{cardNumber}</span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1">
        {/* Header */}
        {HEADER.map((l, i) => (
          <div key={l} className={`${headerH} ${HEADER_BG[i]} flex items-center justify-center rounded-lg font-black text-white`}>
            {l}
          </div>
        ))}

        {/* Cells */}
        {card.map((row, r) =>
          row.map((num, c) => {
            const isFree = num === null
            const isCalled = !isFree && calledSet.has(num!)
            const isManual = !isFree && !!manuallyMarked?.has(num!)
            const isWrongTap = isManual && !isCalled

            let cellClass: string
            if (isFree) {
              cellClass = 'bg-purple-600 text-white text-[10px]'
            } else if (autoMark && isCalled) {
              // Auto-mark mode: called number → green automatically
              cellClass = 'bg-emerald-500 text-white ring-2 ring-emerald-300'
            } else if (!autoMark && isManual && isCalled) {
              // Manual mode: player tapped a called number → green
              cellClass = 'bg-emerald-500 text-white ring-2 ring-emerald-300'
            } else if (isWrongTap) {
              // Tapped but NOT called → red warning
              cellClass = 'bg-red-600/80 text-white ring-2 ring-red-400 animate-pulse'
            } else {
              cellClass = 'bg-[#2a1f55] text-purple-100'
            }

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => onCellTap?.(num)}
                disabled={isFree || !onCellTap}
                className={[
                  cellH,
                  'flex items-center justify-center rounded-lg font-bold transition-all duration-200 w-full',
                  cellClass,
                  onCellTap && !isFree ? 'cursor-pointer active:scale-90' : 'cursor-default',
                ].join(' ')}
              >
                {isFree ? 'FREE' : num}
              </button>
            )
          }),
        )}
      </div>

      {/* Warning for wrong taps (manual mode only) */}
      {!autoMark && wrongTapCount > 0 && (
        <p className="text-red-400 text-[10px] text-center mt-1">
          ⚠ {wrongTapCount} marked number{wrongTapCount > 1 ? 's' : ''} not yet called
        </p>
      )}
    </div>
  )
}

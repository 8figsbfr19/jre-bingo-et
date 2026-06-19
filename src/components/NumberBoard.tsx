import { columnLetter } from '../lib/bingo'

interface Props {
  calledNumbers: number[]
}

export function NumberBoard({ calledNumbers }: Props) {
  const calledSet = new Set(calledNumbers)
  const last = calledNumbers[calledNumbers.length - 1]

  return (
    <div className="w-full">
      {last !== undefined && (
        <div className="flex items-center justify-center mb-4">
          <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-brand text-white shadow-lg">
            <span className="text-xs font-bold">{columnLetter(last)}</span>
            <span className="text-3xl font-bold leading-none">{last}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(15,1fr)] gap-0.5">
        {Array.from({ length: 75 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={[
              'flex items-center justify-center text-xs rounded aspect-square font-medium',
              calledSet.has(n)
                ? n === last
                  ? 'bg-brand text-white'
                  : 'bg-green-400 text-white'
                : 'bg-gray-100 text-gray-500',
            ].join(' ')}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  )
}

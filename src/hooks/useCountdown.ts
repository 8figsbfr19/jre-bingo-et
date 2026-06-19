import { useState, useEffect } from 'react'

export function useCountdown(targetIso: string | null, totalSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds)

  useEffect(() => {
    if (!targetIso) {
      setSecondsLeft(totalSeconds)
      return
    }

    const end = new Date(targetIso).getTime() + totalSeconds * 1000

    function tick() {
      const diff = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setSecondsLeft(diff)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso, totalSeconds])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return { secondsLeft, formatted: `${mm}:${ss}`, expired: secondsLeft === 0 }
}

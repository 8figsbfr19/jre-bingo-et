export function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  const hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${day}/${month}/${year} ${h}:${minutes} ${ampm}`
}

export function displayName(player: { first_name?: string | null; telegram_username?: string | null } | null): string {
  return player?.first_name ?? player?.telegram_username ?? 'Player'
}

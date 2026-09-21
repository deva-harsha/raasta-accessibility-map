export function relativeTime(value) {
  if (!value) return 'Not yet reconfirmed'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function reportFreshness(value) {
  const date = new Date(value)
  const ageDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (ageDays <= 0) return 'Reported today'
  if (ageDays === 1) return 'Reported yesterday'
  if (ageDays < 7) return `Reported ${ageDays} days ago`
  return `Reported ${date.toLocaleDateString()}`
}

export function reportIsOutdated(value) {
  return Date.now() - new Date(value).getTime() > 30 * 86_400_000
}

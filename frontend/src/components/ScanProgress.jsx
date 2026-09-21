const STEPS = ['Select profile', 'Scan access point', 'Verify and publish']

export default function ScanProgress({ current }) {
  return (
    <ol className="scan-progress" aria-label={`Step ${current} of 3: ${STEPS[current - 1]}`}>
      {STEPS.map((label, index) => {
        const number = index + 1
        return <li key={label} className={number === current ? 'current' : number < current ? 'complete' : ''} aria-current={number === current ? 'step' : undefined}><span>{String(number).padStart(2, '0')}</span>{label}</li>
      })}
    </ol>
  )
}

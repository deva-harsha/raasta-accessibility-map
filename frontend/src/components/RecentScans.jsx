import { Clock3, Trash2 } from 'lucide-react'
import { PROFILES } from '../profiles'

export default function RecentScans({ scans, onClear }) {
  if (!scans.length) return null

  const confirmClear = () => {
    if (window.confirm('Clear all recent scans saved on this device?')) onClear()
  }

  return (
    <section className="recent-section" aria-labelledby="recent-title">
      <div className="section-heading-row">
        <div><span className="eyebrow">On this device</span><h2 id="recent-title">Recent scans</h2></div>
        <button className="clear-button" type="button" onClick={confirmClear}><Trash2 aria-hidden="true" size={17} /> Clear history</button>
      </div>
      <ul className="scan-list">
        {scans.map((scan) => {
          const profile = PROFILES.find((item) => item.id === scan.profile)?.label || scan.profile
          return (
            <li key={scan.id}>
              <img src={scan.thumbnail} alt="" />
              <div className="scan-copy">
                <div><strong>{scan.verdict}</strong><span>{profile}</span></div>
                <p>{scan.condition}</p>
                <time dateTime={scan.createdAt}><Clock3 aria-hidden="true" size={14} /> {new Date(scan.createdAt).toLocaleString()}</time>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import { ArrowLeft, CheckCircle2, LocateFixed, MapPin, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { MapContainer, Marker, useMapEvents } from 'react-leaflet'
import { MAP_CENTER } from '../mapConfig'
import { PROFILES } from '../profiles'
import ScanProgress from './ScanProgress'
import { api } from '../api'
import ThemeBasemap from './ThemeBasemap'

const DETAIL_OPTIONS = ['Stairs present', 'Ramp unavailable', 'Lift unavailable', 'Narrow entrance', 'Uneven surface', 'Temporary obstruction', 'Other']
const MANUAL_BARRIER_OPTIONS = ['Stairs', 'No ramp', 'Blocked path', 'Pothole', 'Steep curb', 'Construction']
const VERDICT_OPTIONS = ['Likely passable', 'Temporary obstruction', 'Not passable', 'Manual verification needed']
const MANUAL_LIMITATION = 'User-reported community guidance—not an accessibility certification. Conditions can change, so verify the route before travelling.'

function PinChooser({ position, onChange }) {
  useMapEvents({ click: (event) => onChange([event.latlng.lat, event.latlng.lng]) })
  return position ? <Marker position={position} /> : null
}

export default function ReportComposer({ theme, result, profile, imageFile, previewUrl, onCancel, onPublished, manual = false, onProfileChange }) {
  const [label, setLabel] = useState('')
  const [position, setPosition] = useState(null)
  const [stage, setStage] = useState('details')
  const [verified, setVerified] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [note, setNote] = useState('')
  const [locationStatus, setLocationStatus] = useState('')
  const [manualVerdict, setManualVerdict] = useState('')
  const mapRef = useRef(null)
  const profileLabel = PROFILES.find((item) => item.id === profile)?.label

  const showPreview = () => {
    if (!label.trim() || !position || (manual && (!profile || !details.length || !manualVerdict))) return
    setStage('preview')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const publish = async () => {
    if (!verified || !position) return
    setPublishing(true)
    setError('')
    const form = new FormData()
    form.append('image', imageFile)
    form.append('location_label', label.trim())
    form.append('latitude', position[0])
    form.append('longitude', position[1])
    form.append('mobility_profile', profile)
    form.append('verdict', manual ? manualVerdict : result.verdict)
    form.append('condition', manual ? details.join(', ') : result.condition)
    form.append('confidence', manual ? '0' : result.confidence)
    form.append('reason', manual ? 'Details were reported directly by the person who checked this location.' : result.reason)
    form.append('limitation', manual ? MANUAL_LIMITATION : result.limitation)
    form.append('analysis_source', manual ? 'manual' : 'ai')
    form.append('user_verified', 'true')
    details.forEach((detail) => form.append('user_confirmed_details', detail))
    if (note.trim()) form.append('user_note', note.trim())
    try {
      const response = await api.post('/api/reports', form, { timeout: 60000 })
      onPublished(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The report could not be published. Please try again in a moment.')
    } finally {
      setPublishing(false)
    }
  }

  const toggleDetail = (detail) => setDetails((current) => current.includes(detail) ? current.filter((item) => item !== detail) : [...current, detail])

  const useLocation = () => {
    setLocationStatus('Finding your location…')
    if (!navigator.geolocation) {
      setLocationStatus('Location is unavailable. Click the map to place the pin manually.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = [coords.latitude, coords.longitude]
        setPosition(next)
        mapRef.current?.flyTo(next, 17, { duration: 0.8 })
        setLocationStatus('Pin placed at your current location. Adjust it by clicking the map if needed.')
      },
      () => setLocationStatus('Location permission was denied or unavailable. Click the map to place the pin manually.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  if (stage === 'preview') {
    return (
      <main className="composer-page" id="top">
        <ScanProgress current={3} />
        <button className="back-button" type="button" onClick={() => setStage('details')}><ArrowLeft aria-hidden="true" size={18} /> Edit location</button>
        <section className="publish-preview">
          <div className="preview-heading"><span className="eyebrow">Report preview</span><h1>Check before publishing.</h1><p>This will become a community report visible to anyone using this local Raasta instance.</p></div>
          <article className="preview-report-card">
            <img src={previewUrl} alt={`Entrance or path at ${label}`} />
            <div>
              <span className="community-label">Community report</span>
              <h2>{label}</h2>
              <p className="preview-profile">{profileLabel} · {manual ? manualVerdict : result.verdict}</p>
              {manual ? <dl><div><dt>User-reported details</dt><dd>{details.join(', ')}{note.trim() ? ` — ${note.trim()}` : ''}</dd></div><div><dt>Pin</dt><dd>{position[0].toFixed(5)}, {position[1].toFixed(5)}</dd></div></dl> : <dl><div><dt>AI finding</dt><dd>{result.condition}. {result.reason}</dd></div><div><dt>User-confirmed</dt><dd>{details.length ? details.join(', ') : 'No additional details selected'}{note.trim() ? ` — ${note.trim()}` : ''}</dd></div><div><dt>Pin</dt><dd>{position[0].toFixed(5)}, {position[1].toFixed(5)}</dd></div></dl>}
              <p className="report-limitation">{manual ? MANUAL_LIMITATION : result.limitation}</p>
            </div>
          </article>
          <label className="verification-check"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} /><span><strong>I have checked this location and this report is accurate to the best of my knowledge.</strong><small>{manual ? 'These are your observations. No AI finding is attached to this report.' : 'AI suggested the condition; you are responsible for verifying it before publishing.'}</small></span></label>
          {error && <div className="error-box" role="alert"><strong>Publishing failed</strong><p>{error}</p></div>}
          <button className="primary-button" type="button" onClick={publish} disabled={!verified || publishing}>{publishing ? 'Publishing…' : 'Publish community report'} <Send aria-hidden="true" size={19} /></button>
        </section>
      </main>
    )
  }

  return (
    <main className="composer-page" id="top">
      <ScanProgress current={3} />
      <button className="back-button" type="button" onClick={onCancel}><ArrowLeft aria-hidden="true" size={18} /> {manual ? 'Back to analysis error' : 'Back to result'}</button>
      <section className="location-panel">
        <span className="eyebrow">{manual ? 'Manual community report' : 'Add to access map'}</span>
        <h1>{manual ? 'Report what you observed.' : 'Where did you check?'}</h1>
        <p>{manual ? 'Use your real photo and firsthand observations. This report will not contain an AI finding.' : 'Name the entrance clearly and place the pin exactly where the photo was taken.'}</p>
        {manual && <fieldset className="manual-details"><legend>Mobility profile</legend><p>Choose the profile this access report applies to.</p><div className="detail-chips">{PROFILES.map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={profile === id} className={profile === id ? 'selected' : ''} onClick={() => onProfileChange(id)}><Icon aria-hidden="true" size={16} />{label}</button>)}</div></fieldset>}
        <label className="location-field">Location label
          <input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. JNTUH Main Block Entrance" autoComplete="off" />
        </label>
        <fieldset className="manual-details"><legend>{manual ? 'User-reported details' : 'User-confirmed details'} <span>{manual ? 'Required' : 'Optional'}</span></legend><p>{manual ? 'Select only barriers you personally observed. No AI result will be created.' : 'Select only what you personally observed. These are separate from the AI finding.'}</p><div className="detail-chips">{(manual ? MANUAL_BARRIER_OPTIONS : DETAIL_OPTIONS).map((detail) => <button type="button" key={detail} aria-pressed={details.includes(detail)} className={details.includes(detail) ? 'selected' : ''} onClick={() => toggleDetail(detail)}><CheckCircle2 aria-hidden="true" size={16} />{detail}</button>)}</div>{manual && <label className="manual-verdict-field">Passability verdict<select value={manualVerdict} onChange={(event) => setManualVerdict(event.target.value)}><option value="">Choose a verdict</option>{VERDICT_OPTIONS.map((verdict) => <option key={verdict}>{verdict}</option>)}</select></label>}<label>Optional note <span>{note.length}/280</span><textarea value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} placeholder="Add useful context the photo may not show" /></label></fieldset>
        <div className="pin-instruction"><MapPin aria-hidden="true" size={19} /><span><strong>Click the map to place the pin</strong>{position ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : 'No location selected yet'}</span></div>
        <button className="use-location-button" type="button" onClick={useLocation}><LocateFixed aria-hidden="true" size={18} /> Use my location</button>
        {locationStatus && <p className="location-status" role="status">{locationStatus}</p>}
        <MapContainer ref={mapRef} className="pin-map" center={MAP_CENTER} zoom={14} scrollWheelZoom aria-label="Click to choose report location">
          <ThemeBasemap theme={theme} />
          <PinChooser position={position} onChange={setPosition} />
        </MapContainer>
        <button className="primary-button" type="button" disabled={!label.trim() || !position || (manual && (!profile || !details.length || !manualVerdict))} onClick={showPreview}>Preview report <CheckCircle2 aria-hidden="true" size={19} /></button>
      </section>
    </main>
  )
}

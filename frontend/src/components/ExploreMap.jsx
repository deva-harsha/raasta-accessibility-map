import { AlertTriangle, Check, Clipboard, Clock3, FileText, LocateFixed, MapPin, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MAP_CENTER, VERDICT_COLORS, reportMarkerIcon } from '../mapConfig'
import { PROFILES } from '../profiles'
import { relativeTime, reportFreshness, reportIsOutdated } from '../time'
import { api, apiAssetUrl } from '../api'
import ThemeBasemap from './ThemeBasemap'

const VERDICTS = ['Likely passable', 'Temporary obstruction', 'Not passable', 'Manual verification needed']
const CONFIRMED_KEY = 'raasta_confirmed_reports'

function FitReports({ reports }) {
  const map = useMap()
  useEffect(() => {
    if (reports.length === 1) map.setView([reports[0].latitude, reports[0].longitude], 16)
    if (reports.length > 1) map.fitBounds(L.latLngBounds(reports.map((item) => [item.latitude, item.longitude])), { padding: [38, 38], maxZoom: 16 })
  }, [map, reports])
  return null
}

function savedConfirmations() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIRMED_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch { return [] }
}

export default function ExploreMap({ theme, reports, loading, error, onReportUpdate, onStartReport, defaultSelectedId = null }) {
  const [profile, setProfile] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [selectedId, setSelectedId] = useState(defaultSelectedId)
  const [confirming, setConfirming] = useState(false)
  const [confirmedIds, setConfirmedIds] = useState(savedConfirmations)
  const [actionError, setActionError] = useState('')
  const [locationStatus, setLocationStatus] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [civicReportText, setCivicReportText] = useState('')
  const mapRef = useRef(null)

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    return reports.filter((report) =>
      (profile === 'all' || report.mobility_profile === profile) &&
      (verdict === 'all' || report.verdict === verdict) &&
      (!query || [report.location_label, report.condition, report.user_note, ...(report.user_confirmed_details || [])].filter(Boolean).some((value) => value.toLocaleLowerCase().includes(query)))
    )
  }, [reports, profile, verdict, searchQuery])
  const selected = filtered.find((report) => report.id === selectedId) || null
  const profileLabel = selected ? PROFILES.find((item) => item.id === selected.mobility_profile)?.label : ''
  const filtersActive = profile !== 'all' || verdict !== 'all' || searchQuery.trim()
  const lastUpdate = reports.length ? relativeTime(Math.max(...reports.map((report) => new Date(report.last_confirmed_at || report.created_at).getTime()))) : ''
  const severeWheelchairWarning = selected?.mobility_profile === 'wheelchair' && /stairs|no (visible )?ramp/i.test(`${selected.condition} ${selected.reason}`)
  const selectedIsManual = selected?.analysis_source === 'manual'

  const chooseReport = (report) => {
    setSelectedId(report.id)
    mapRef.current?.flyTo([report.latitude, report.longitude], 17, { duration: 0.7 })
  }

  const clearFilters = () => { setProfile('all'); setVerdict('all'); setSearchQuery('') }

  const useLocation = () => {
    setLocationStatus('Finding your location…')
    if (!navigator.geolocation) {
      setLocationStatus('Location is unavailable in this browser. You can still move and zoom the map manually.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.flyTo([coords.latitude, coords.longitude], 16, { duration: 0.8 })
        setLocationStatus('Map centred on your current location.')
      },
      () => setLocationStatus('Location permission was denied or unavailable. You can still move and zoom the map manually.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const confirm = async () => {
    if (!selected || confirmedIds.includes(selected.id)) return
    setConfirming(true); setActionError('')
    try {
      const response = await api.post(`/api/reports/${selected.id}/confirm`)
      const nextIds = [...confirmedIds, selected.id]
      setConfirmedIds(nextIds)
      localStorage.setItem(CONFIRMED_KEY, JSON.stringify(nextIds))
      onReportUpdate(response.data)
    } catch (requestError) {
      setActionError(requestError.response?.data?.detail || 'Could not save your confirmation. Try again.')
    } finally { setConfirming(false) }
  }

  const copySummary = async () => {
    if (!selected) return
    const details = selected.user_confirmed_details?.length ? selected.user_confirmed_details.join(', ') : 'None added'
    const summary = `${selected.location_label}\n${selected.verdict} — ${selected.condition}\nProfile: ${profileLabel}\nUser-confirmed: ${details}\nObserved: ${new Date(selected.created_at).toLocaleString()}\nCommunity report from Raasta. Conditions may have changed.`
    try { await navigator.clipboard.writeText(summary); setCopyStatus('Summary copied.') }
    catch { setCopyStatus('Could not copy automatically. Your browser may block clipboard access.') }
  }

  const createCivicReport = () => {
    if (!selected) return
    const coordinates = `${selected.latitude}, ${selected.longitude}`
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`
    const details = selected.user_confirmed_details?.length ? selected.user_confirmed_details.join(', ') : 'No additional details recorded'
    const finding = selected.analysis_source === 'manual' ? `User-reported details: ${details}` : `AI finding: ${selected.condition} — ${selected.reason}\nUser-confirmed details: ${details}`
    setCivicReportText(`COMMUNITY ACCESSIBILITY REPORT\n\nLocation: ${selected.location_label}\nObserved: ${new Date(selected.created_at).toLocaleString()}\nMobility profile: ${profileLabel}\nAccessibility verdict: ${selected.verdict}\n${finding}${selected.user_note ? `\nUser note: ${selected.user_note}` : ''}\nCoordinates: ${coordinates}\nMap: ${mapLink}\n\nThis text was generated from an existing Raasta community report. It is not an official complaint or accessibility certification.`)
  }

  const copyCivicReport = async () => {
    try { await navigator.clipboard.writeText(civicReportText); setCopyStatus('Civic report copied. You can send it to the relevant organisation.') }
    catch { setCopyStatus('Could not copy automatically. Select the text and copy it manually.') }
  }

  return (
    <main className="explore-page mode-enter" id="top">
      <section className="explore-intro">
        <span className="eyebrow">Community access map</span>
        <h1>Know access before you arrive.</h1>
        <p>Community-verified entrance and path information for planning a more predictable journey.</p>
        <div className="live-summary" aria-live="polite"><strong>{reports.length} community report{reports.length === 1 ? '' : 's'}</strong>{reports.length > 0 && <span>Last update: {lastUpdate}</span>}</div>
      </section>

      <section className="map-filters" aria-label="Filter community reports">
        <div className="profile-filter"><span className="filter-label">Mobility profile</span><div className="filter-chips" role="group" aria-label="Mobility profile filter"><button type="button" aria-pressed={profile === 'all'} className={profile === 'all' ? 'active' : ''} onClick={() => setProfile('all')}>All</button>{PROFILES.map(({ id, label }) => <button type="button" aria-pressed={profile === id} className={profile === id ? 'active' : ''} onClick={() => setProfile(id)} key={id}>{label}</button>)}</div></div>
        <label className="verdict-filter">Verdict<select value={verdict} onChange={(event) => setVerdict(event.target.value)}><option value="all">All verdicts</option>{VERDICTS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="filter-meta"><span>{filtered.length} matching</span>{filtersActive && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>
      </section>

      <label className="place-search"><Search aria-hidden="true" size={18} /><span className="visually-hidden">Search reports by locality or place name</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search locality or place name" /></label>

      {error && <div className="error-box" role="alert"><strong>Reports unavailable</strong><p>{error}</p></div>}
      {!loading && reports.length === 0 && <div className="map-empty-state"><MapPin aria-hidden="true" size={24} /><div><strong>No reports in this view yet.</strong><p>Be the first to add a verified access check.</p></div><button type="button" onClick={onStartReport}>Report access</button></div>}
      {!loading && reports.length > 0 && filtered.length === 0 && <p className="filtered-empty">No reports in this view. Clear the filters to see other verified checks.</p>}

      <div className={`community-map-layout ${selected ? 'has-selection' : ''}`}>
        <div className="map-stage">
          <MapContainer ref={mapRef} className="community-map" center={MAP_CENTER} zoom={13} scrollWheelZoom aria-label="Interactive community accessibility map">
            <ThemeBasemap theme={theme} />
            <FitReports reports={filtered} />
            {filtered.map((report) => <Marker key={report.id} position={[report.latitude, report.longitude]} icon={reportMarkerIcon(report.verdict, report.id === selectedId)} eventHandlers={{ click: () => chooseReport(report) }} title={`${report.location_label}: ${report.verdict}`} />)}
          </MapContainer>
          <button className="locate-control" type="button" onClick={useLocation} aria-label="Use my current location"><LocateFixed aria-hidden="true" size={18} /> Use my location</button>
          {locationStatus && <p className="map-status" role="status">{locationStatus}</p>}
        </div>

        {selected && <article className="report-card" aria-live="polite">
          <div className="report-photo-wrap"><img src={apiAssetUrl(selected.image_url)} alt={`Community report at ${selected.location_label}`} /><span>Community report</span></div>
          <div className="report-card-body">
            <div className="report-heading"><div><span className="eyebrow">{profileLabel}</span><h2>{selected.location_label}</h2></div><span className="verdict-dot" style={{ '--dot-color': VERDICT_COLORS[selected.verdict] }}>{selected.verdict}</span></div>
            <dl className="report-timestamps"><div><dt>Observed</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div><div><dt>Last confirmed</dt><dd>{selected.last_confirmed_at ? `${new Date(selected.last_confirmed_at).toLocaleString()} (${relativeTime(selected.last_confirmed_at)})` : 'Not yet reconfirmed'}</dd></div></dl>
            {reportIsOutdated(selected.last_confirmed_at || selected.created_at) && <div className="outdated-warning" role="note"><Clock3 aria-hidden="true" size={18} /><strong>This report may be outdated. Verify current conditions before travelling.</strong></div>}
            {severeWheelchairWarning && <div className="wheelchair-warning" role="alert"><AlertTriangle aria-hidden="true" size={22} /><strong>Wheelchair warning: stairs are reported here with no visible ramp. Check for another entrance before travelling.</strong></div>}
            <section className="finding-section"><span>{selectedIsManual ? 'User-reported details' : 'AI finding'}</span><h3>{selected.condition}</h3><p>{selectedIsManual ? 'Reported directly by the person who checked this location.' : selected.reason}</p>{!selectedIsManual && <small>Model confidence estimate: {selected.confidence}%</small>}{selectedIsManual && selected.user_note && <p className="user-note">“{selected.user_note}”</p>}</section>
            {!selectedIsManual && <section className="confirmed-section"><span>User-confirmed details</span>{selected.user_confirmed_details?.length ? <ul>{selected.user_confirmed_details.map((detail) => <li key={detail}><Check aria-hidden="true" size={15} />{detail}</li>)}</ul> : <p>No additional details were selected.</p>}{selected.user_note && <p className="user-note">“{selected.user_note}”</p>}</section>}
            <p className="report-limitation">{selected.limitation}</p>
            <div className="report-tools"><a href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" size={17} /> View in Google Maps</a><button type="button" onClick={copySummary}><Clipboard aria-hidden="true" size={17} /> Copy report summary</button></div>
            <button className="civic-report-button" type="button" onClick={createCivicReport}><FileText aria-hidden="true" size={18} /> Create civic report</button>
            {civicReportText && <div className="civic-report-draft"><label htmlFor="civic-report-text">Copyable community summary</label><textarea id="civic-report-text" readOnly value={civicReportText} /><button type="button" onClick={copyCivicReport}><Clipboard aria-hidden="true" size={17} /> Copy civic report</button><small>No complaint has been filed automatically.</small></div>}
            {copyStatus && <p className="copy-status" role="status">{copyStatus}</p>}
            <div className="confirmation-row"><span><strong>{selected.confirmation_count}</strong> community confirmation{selected.confirmation_count === 1 ? '' : 's'}</span><button type="button" onClick={confirm} disabled={confirming || confirmedIds.includes(selected.id)}><Check aria-hidden="true" size={18} />{confirmedIds.includes(selected.id) ? 'You confirmed this report' : confirming ? 'Saving…' : 'This matches what I found'}</button>{confirmedIds.includes(selected.id) && <strong className="confirmed-feedback">You confirmed this report.</strong>}</div>
            {actionError && <p className="inline-error" role="alert">{actionError}</p>}
          </div>
        </article>}
      </div>

      <div className="map-legend" aria-label="Map marker legend">{VERDICTS.map((item) => <span key={item}><i style={{ background: VERDICT_COLORS[item] }} />{item}</span>)}</div>
      {filtered.length > 0 && <section className="report-list" aria-labelledby="report-list-title"><div className="report-list-heading"><h2 id="report-list-title">Reports in this view</h2><span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span></div><ul>{filtered.map((report) => { const reportProfile = PROFILES.find((item) => item.id === report.mobility_profile)?.label; const confirmedDetail = report.user_confirmed_details?.[0] || report.user_note || 'No additional user-confirmed detail'; const outdated = reportIsOutdated(report.last_confirmed_at || report.created_at); return <li key={report.id}><button type="button" className={report.id === selectedId ? 'selected' : ''} onClick={() => chooseReport(report)} aria-pressed={report.id === selectedId}><img src={apiAssetUrl(report.image_url)} alt="" /><span className="list-report-copy"><strong>{report.location_label}</strong><span className="list-verdict"><i style={{ background: VERDICT_COLORS[report.verdict] }} />{report.verdict}</span><small>{reportProfile} · {reportFreshness(report.created_at)}{outdated ? ' · May be outdated' : ''}</small><small>{report.confirmation_count} confirmation{report.confirmation_count === 1 ? '' : 's'}</small><small className="list-confirmed-detail">User-confirmed: {confirmedDetail}</small></span></button></li> })}</ul></section>}
    </main>
  )
}

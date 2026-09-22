import { ArrowRight, CircleCheckBig, Map, Moon, Plus, ShieldCheck, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import './App.css'
import ExploreMap from './components/ExploreMap'
import ImagePicker from './components/ImagePicker'
import ProfileSelector from './components/ProfileSelector'
import RecentScans from './components/RecentScans'
import ReportComposer from './components/ReportComposer'
import ResultPanel from './components/ResultPanel'
import ScanProgress from './components/ScanProgress'
import { api } from './api'

const STORAGE_KEY = 'raasta_recent_scans'
const THEME_KEY = 'raasta_theme'

function initialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function readScans() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.slice(0, 5) : []
  } catch { return [] }
}

function makeThumbnail(file) {
  return new Promise((resolve) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 128
      const scale = Math.max(size / image.width, size / image.height)
      const width = image.width * scale
      const height = image.height * scale
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d').drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    image.onerror = () => { URL.revokeObjectURL(objectUrl); resolve('') }
    image.src = objectUrl
  })
}

function App() {
  const [mode, setMode] = useState('explore')
  const [profile, setProfile] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [flow, setFlow] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [scans, setScans] = useState(readScans)
  const [currentScanId, setCurrentScanId] = useState(null)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState('')
  const [publishNotice, setPublishNotice] = useState('')
  const [publishedReport, setPublishedReport] = useState(null)
  const [focusedReportId, setFocusedReportId] = useState(null)
  const [theme, setTheme] = useState(initialTheme)
  const currentFeedback = scans.find((scan) => scan.id === currentScanId)?.feedback || ''

  useEffect(() => {
    api.get('/api/reports')
      .then((response) => setReports(response.data))
      .catch((requestError) => setReportsError(requestError.response?.data?.detail || 'Could not reach the configured report service.'))
      .finally(() => setReportsLoading(false))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const selectFile = (selected) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setError('')
  }
  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl('')
  }
  const saveScans = (next) => {
    setScans(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* History is optional. */ }
  }

  const analyze = async () => {
    if (!file || !profile) return
    setFlow('loading')
    setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('mobility_profile', profile)
      const [response, thumbnail] = await Promise.all([api.post('/api/analyze', form, { timeout: 180000 }), makeThumbnail(file)])
      const id = crypto.randomUUID?.() || `${Date.now()}`
      const scan = { id, profile, thumbnail, createdAt: new Date().toISOString(), feedback: '', ...response.data }
      saveScans([scan, ...scans].slice(0, 5))
      setCurrentScanId(id)
      setResult(response.data)
      setFlow('success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not reach the Raasta analysis service. Please try again in a moment.')
      setFlow('error')
    }
  }

  const resetScan = () => {
    clearFile(); setResult(null); setCurrentScanId(null); setPublishedReport(null); setFlow('idle'); setError('')
  }
  const updateReport = (updated) => setReports((current) => current.map((item) => item.id === updated.id ? updated : item))
  const published = (report) => {
    setReports((current) => [report, ...current])
    setPublishedReport(report)
    setFlow('published')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const viewPublishedReport = () => {
    const reportId = publishedReport?.id
    resetScan()
    setFocusedReportId(reportId)
    setPublishNotice('Your community report is now visible on the access map.')
    setMode('explore')
  }

  const reportView = () => {
    if (flow === 'manual' && file) return <ReportComposer theme={theme} manual profile={profile} onProfileChange={setProfile} imageFile={file} previewUrl={previewUrl} onCancel={() => setFlow('error')} onPublished={published} />
    if (flow === 'compose' && result && file) return <ReportComposer theme={theme} result={result} profile={profile} imageFile={file} previewUrl={previewUrl} onCancel={() => setFlow('success')} onPublished={published} />
    if (flow === 'published' && publishedReport) return <main className="publish-success-page mode-enter" id="top"><ScanProgress current={3} /><section className="publish-success"><CircleCheckBig aria-hidden="true" size={42} /><span className="eyebrow">Community report published</span><h1>One clearer route for the next person.</h1><div><span>Location</span><strong>{publishedReport.location_label}</strong></div><div><span>Published verdict</span><strong>{publishedReport.verdict}</strong></div><p>This is community guidance, not accessibility certification. Conditions can change.</p><div className="publish-success-actions"><button className="primary-button" type="button" onClick={viewPublishedReport}><Map aria-hidden="true" size={18} /> View on map</button><button className="secondary-button" type="button" onClick={resetScan}><Plus aria-hidden="true" size={18} /> Add another report</button></div></section></main>
    return (
      <main id="top" className="report-page mode-enter">
        <ScanProgress current={flow === 'success' ? 2 : 1} />
        {flow !== 'success' && <section className="hero-section"><span className="eyebrow">Report access</span><h1>Help the next person know before they go.</h1><p>Scan an entrance, ramp, or footpath, verify the result, then place it on the community map.</p><div className="privacy-line"><ShieldCheck aria-hidden="true" size={18} /> Vision analysis runs locally—no cloud AI API.</div></section>}
        {flow === 'success' && result ? (
          <ResultPanel result={result} feedback={currentFeedback} onFeedback={(feedback) => saveScans(scans.map((scan) => scan.id === currentScanId ? { ...scan, feedback } : scan))} onReset={resetScan} onAddMap={() => setFlow('compose')} />
        ) : flow === 'loading' ? (
          <section className="loading-panel" aria-live="polite" aria-busy="true"><div className="loader" aria-hidden="true"><span /><span /><span /></div><h2>Checking visible barriers with local vision AI…</h2><p>The first analysis may take longer while the CLIP model loads.</p></section>
        ) : (
          <section className="scan-panel" aria-label="New accessibility scan"><ProfileSelector value={profile} onChange={setProfile} /><div className="photo-section"><h2>Add a clear photo</h2><p className="section-help">Include the whole route where possible, not just the doorway.</p><ImagePicker file={file} previewUrl={previewUrl} onSelect={selectFile} onClear={clearFile} /></div>{flow === 'error' && <div className="error-box" role="alert"><strong>Analysis didn’t complete</strong><p>{error}</p></div>}<button className="primary-button" type="button" disabled={!file || !profile} onClick={analyze}>{flow === 'error' ? 'Retry analysis' : 'Check this path'} <ArrowRight aria-hidden="true" size={20} /></button>{flow === 'error' && <button className="secondary-button manual-fallback-button" type="button" onClick={() => setFlow('manual')}><Map aria-hidden="true" size={19} /> Continue as a manual community report</button>}<p className="decision-note">AI suggests a condition. You verify it before publishing. Raasta is not accessibility certification.</p></section>
        )}
        {flow !== 'loading' && <RecentScans scans={scans} onClear={() => saveScans([])} />}
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setMode('explore')} aria-label="Raasta access map">Raasta</button>
        <div className="header-actions"><nav aria-label="Primary navigation"><button type="button" className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')}><Map aria-hidden="true" size={18} /> Explore map</button><button type="button" className={mode === 'report' ? 'active' : ''} onClick={() => setMode('report')}><Plus aria-hidden="true" size={18} /> Report access</button></nav><button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}</button></div>
      </header>
      {publishNotice && mode === 'explore' && <div className="success-notice" role="status">{publishNotice}<button type="button" onClick={() => setPublishNotice('')} aria-label="Dismiss notification">×</button></div>}
      {mode === 'explore' ? <ExploreMap key={focusedReportId || 'explore'} theme={theme} defaultSelectedId={focusedReportId} reports={reports} loading={reportsLoading} error={reportsError} onReportUpdate={updateReport} onStartReport={() => setMode('report')} /> : reportView()}
      <footer>Community reports can be wrong or outdated · Vision analysis runs on the configured Raasta backend · Map tiles require internet</footer>
    </div>
  )
}

export default App

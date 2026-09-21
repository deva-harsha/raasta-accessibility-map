import { MapPinned, RotateCcw, Volume2 } from 'lucide-react'

export default function ResultPanel({ result, feedback, onFeedback, onReset, onAddMap }) {
  const tone = {
    'Likely passable': 'positive',
    'Temporary obstruction': 'warning',
    'Not passable': 'danger',
    'Manual verification needed': 'neutral',
  }[result.verdict] || 'neutral'

  const readAloud = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const text = `${result.verdict}. ${result.condition}. ${result.reason} ${result.profile_note} ${result.limitation}`
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
  }

  return (
    <section className="result-panel" aria-labelledby="result-title" aria-live="polite">
      <div className={`verdict ${tone}`}><span className="eyebrow">Local vision analysis</span><h2 id="result-title">{result.verdict}</h2></div>
      <dl className="result-details">
        <div><dt>Detected condition</dt><dd>{result.condition}</dd></div>
        <div><dt>Model confidence estimate</dt><dd>{result.confidence}%</dd></div>
      </dl>
      <div className="result-copy">
        <div><h3>Why this result</h3><p>{result.reason}</p></div>
        <div><h3>For your profile</h3><p>{result.profile_note}</p></div>
        <div className="limitation"><h3>Keep in mind</h3><p>{result.limitation}</p></div>
      </div>
      <button className="text-button" type="button" onClick={readAloud}><Volume2 aria-hidden="true" size={20} /> Read result aloud</button>
      <div className="feedback-block">
        <h3>Does this match what you see?</h3>
        <div className="feedback-actions">
          <button className={feedback === 'matches' ? 'chosen' : ''} type="button" onClick={() => onFeedback('matches')}>Result matches what I see</button>
          <button className={feedback === 'correction' ? 'chosen' : ''} type="button" onClick={() => onFeedback('correction')}>Needs correction</button>
        </div>
        {feedback && <p className="feedback-note">Saved on this device. Feedback does not retrain the model.</p>}
      </div>
      <div className="result-actions">
        <button className="primary-button" type="button" onClick={onAddMap}><MapPinned aria-hidden="true" size={19} /> Add this to the access map</button>
        <button className="secondary-button" type="button" onClick={onReset}><RotateCcw aria-hidden="true" size={19} /> Scan another path</button>
      </div>
    </section>
  )
}

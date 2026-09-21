import { PROFILES } from '../profiles'

export default function ProfileSelector({ value, onChange }) {
  return (
    <fieldset className="profile-fieldset">
      <legend>How are you travelling?</legend>
      <p className="section-help">Your profile helps Raasta highlight access risks that matter for your journey.</p>
      <div className="profile-grid">
        {PROFILES.map(({ id, label, Icon }) => (
          <button
            aria-pressed={value === id}
            className={`profile-option ${value === id ? 'selected' : ''}`}
            key={id}
            onClick={() => onChange(id)}
            type="button"
          >
            <Icon aria-hidden="true" size={25} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

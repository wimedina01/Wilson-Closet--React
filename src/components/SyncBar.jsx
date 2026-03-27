export default function SyncBar({ state, text }) {
  if (!state) return null
  return (
    <div className={`sync-bar show ${state}`}>
      {state === 'syncing' && <div className="spinner" />}
      <span>{text}</span>
    </div>
  )
}

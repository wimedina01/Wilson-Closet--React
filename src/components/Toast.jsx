export default function ToastContainer({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type ? 'toast-' + t.type : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

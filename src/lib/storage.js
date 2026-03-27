export const ls = {
  get:    k      => localStorage.getItem(k),
  set:    (k, v) => localStorage.setItem(k, v),
  rm:     k      => localStorage.removeItem(k),
  getJ:   (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } },
  setJ:   (k, v) => localStorage.setItem(k, JSON.stringify(v)),
}

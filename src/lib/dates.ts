/** Value for <input type="datetime-local"> in local time. */
export const nowLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
export const toIso = (local: string) => new Date(local).toISOString()

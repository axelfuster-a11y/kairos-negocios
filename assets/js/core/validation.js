function numOrDefault(id, defaultValue = 0) {
  const raw = V(id)
  if (raw === '' || raw === null || raw === undefined) return defaultValue
  const n = Number(raw)
  return Number.isFinite(n) ? n : defaultValue
}

function numOrDefault(id, defaultValue = 0) {
  const raw = V(id)
  if (raw === '' || raw === null || raw === undefined) return defaultValue
  const n = Number(raw)
  return Number.isFinite(n) ? n : defaultValue
}

function movementHasAmount(row) {
  return Number(row?.monto) > 0
}

function movementAmountText(row) {
  if (!movementHasAmount(row)) return 'Sin monto'
  return `${row.tipo === 'ingreso' ? '+' : '-'}$${fmt(row.monto)}`
}


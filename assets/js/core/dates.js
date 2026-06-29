function today() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function getMes() {
  const n = new Date()
  return { m: n.getMonth() + 1, y: n.getFullYear() }
}


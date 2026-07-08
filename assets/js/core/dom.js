function V(id) {
  const e = document.getElementById(id)
  return e ? e.value : ''
}

function S(id, v) {
  const e = document.getElementById(id)
  if (e) e.textContent = v
}


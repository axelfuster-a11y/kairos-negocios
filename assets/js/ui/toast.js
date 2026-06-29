let toastT

function toast(msg, isErr = false) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = isErr ? 'on err' : 'on'
  clearTimeout(toastT)
  toastT = setTimeout(() => t.className = '', 3500)
}

function toastErr(msg) {
  toast(msg, true)
}


// Grid overlay: G toggles the columns, M the module grid. The choice is remembered.
const overlay = {
  columns: document.querySelector('.grid-overlay__columns'),
  module: document.querySelector('.grid-overlay__module'),
}
const keys = { g: 'columns', m: 'module' }

function load(name) {
  try {
    return localStorage.getItem(`grid-${name}`) !== 'off'
  } catch {
    return true
  }
}

function save(name, isOn) {
  try {
    localStorage.setItem(`grid-${name}`, isOn ? 'on' : 'off')
  } catch {}
}

for (const name of Object.keys(overlay)) {
  overlay[name].hidden = !load(name)
}

document.addEventListener('keydown', event => {
  const name = keys[event.key.toLowerCase()]
  const isTyping = event.target.closest('input, textarea, [contenteditable]')
  if (!name || isTyping || event.metaKey || event.ctrlKey || event.altKey) return

  overlay[name].hidden = !overlay[name].hidden
  save(name, !overlay[name].hidden)
})

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

// ?grid=off in the URL hides the overlay without changing the saved choice
const isForcedOff = new URLSearchParams(location.search).get('grid') === 'off'

for (const name of Object.keys(overlay)) {
  overlay[name].hidden = isForcedOff || !load(name)
}

document.addEventListener('keydown', event => {
  const name = keys[event.key.toLowerCase()]
  const isTyping = event.target.closest('input, textarea, [contenteditable]')
  if (!name || isTyping || event.metaKey || event.ctrlKey || event.altKey) return

  overlay[name].hidden = !overlay[name].hidden
  save(name, !overlay[name].hidden)
})

// Shopping bag: fixed 24px above the bottom of the screen, but it never goes onto the
// black ending. Once the black section comes close, the bag stops 100px above it
// and scrolls away with the page.
const bag = document.querySelector('.bag')
const blackout = document.querySelector('.blackout')
const BAG_SCREEN_GAP = 24  // from the bottom of the screen
const BAG_BLACK_GAP = 100  // from the top of the black section

function placeBag() {
  const blackTop = blackout.getBoundingClientRect().top
  const overlap = window.innerHeight - blackTop
  bag.style.bottom = `${Math.max(BAG_SCREEN_GAP, overlap + BAG_BLACK_GAP)}px`
}

if (bag && blackout) {
  placeBag()
  window.addEventListener('scroll', placeBag, { passive: true })
  window.addEventListener('resize', placeBag)
}

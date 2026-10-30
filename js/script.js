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

// SALAD title: right after load the letters flash their hover look one after another,
// left to right, in under a second. Skipped for reduced motion.
const title = document.querySelector('.title')
const WAVE_STEP_MS = 80  // between one letter lighting up and the next
const WAVE_LIT_MS = 160  // how long each letter stays lit

function waveTitle() {
  const letters = [...title.querySelectorAll('.title__word')]
  title.classList.add('is-waving')

  letters.forEach((letter, i) => {
    setTimeout(() => letter.classList.add('is-lit'), i * WAVE_STEP_MS)
    setTimeout(() => letter.classList.remove('is-lit'), i * WAVE_STEP_MS + WAVE_LIT_MS)
  })

  // Back to the normal hover hold once the last letter has settled
  const end = (letters.length - 1) * WAVE_STEP_MS + WAVE_LIT_MS + 300
  setTimeout(() => title.classList.remove('is-waving'), end)
}

if (title && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.fonts.ready.then(waveTitle)
}

// Black ending: a grid of ASCII fruits and veggies (js/produce.js), as many as fit on
// the screen, each the same size. Refilled when the window resizes.
const field = document.querySelector('.blackout__produce')

function fillProduce() {
  const kinds = Object.values(PRODUCE)
  const tile = document.createElement('pre')
  tile.className = 'blackout__item'
  tile.textContent = kinds[0].join('\n')
  field.replaceChildren(tile)
  const { width, height } = tile.getBoundingClientRect()

  const cols = Math.max(1, Math.floor(field.clientWidth / width))
  const rows = Math.max(1, Math.floor(field.clientHeight / height))
  field.style.setProperty('--cols', cols)

  // Steps through the list with a stride, so the same kind never sits next to itself
  // in a row or a column
  const tiles = Array.from({ length: cols * rows }, (_, i) => {
    const item = tile.cloneNode()
    item.textContent = kinds[(i * 5) % kinds.length].join('\n')
    return item
  })
  field.replaceChildren(...tiles)
}

if (field && typeof PRODUCE !== 'undefined') {
  fillProduce()
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(fillProduce, 150)
  })
}

// Product feed: a column of ASCII fruits and veggies on each side of the content,
// one after another, sized to fill the three side columns. The left one always moves
// up and the right one down, and both speed up with the scroll: the faster the page
// scrolls, the faster they go. Still for reduced motion.
const feedSides = [...document.querySelectorAll('.feed__side')]
const FEED_SPEED = 40  // px per second at rest
const FEED_SCROLL_BOOST = 0.6  // extra feed speed per px/s of scroll speed
const FEED_EASE = 6  // how quickly the boost follows the scroll (per second)
const feedLoops = []  // one set's height per side
const FEED_GAP_LINES = 2  // empty lines between two drawings

function fillFeed() {
  const kinds = Object.values(PRODUCE)
  const probe = document.createElement('pre')
  probe.className = 'blackout__item'
  probe.style.fontSize = '100px'
  feedSides[0].append(probe)
  const tilePerPx = probe.getBoundingClientRect().width / 100  // a 40ch tile's width per px of font
  probe.remove()

  feedSides.forEach((side, s) => {
    const track = side.querySelector('.feed__track')
    const fontSize = side.clientWidth / tilePerPx
    const lineHeight = fontSize * 1.111
    const gap = FEED_GAP_LINES * lineHeight
    const step = 20 * lineHeight + gap  // one drawing plus the gap after it
    const count = Math.ceil(side.clientHeight / step) + 1

    // The right side starts further along the list, so the two columns differ
    const set = Array.from({ length: count }, (_, i) => {
      const item = document.createElement('pre')
      item.className = 'blackout__item'
      item.textContent = kinds[(i * 3 + s * 8) % kinds.length].join('\n')
      return item
    })
    track.replaceChildren(...set, ...set.map(item => item.cloneNode(true)))

    track.style.setProperty('--feed-font', `${fontSize}px`)
    track.style.setProperty('--feed-gap', `${gap}px`)

    // One set's real height (from the first copy to the second), so the loop is seamless
    const loop = track.children[count].getBoundingClientRect().top - track.children[0].getBoundingClientRect().top
    feedLoops[s] = loop
  })
}

function runFeed() {
  const tracks = feedSides.map(side => side.querySelector('.feed__track'))
  let travel = 0
  let boost = 0
  let lastTime = performance.now()
  let lastScroll = window.scrollY

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1)  // capped after a hidden tab
    lastTime = now
    const scrollSpeed = dt > 0 ? Math.abs(window.scrollY - lastScroll) / dt : 0
    lastScroll = window.scrollY
    boost += (scrollSpeed - boost) * Math.min(1, dt * FEED_EASE)

    travel += (FEED_SPEED + boost * FEED_SCROLL_BOOST) * dt
    tracks.forEach((track, s) => {
      const offset = travel % feedLoops[s]
      // Left: up from 0 to minus one set; right: down from minus one set to 0
      const y = s === 0 ? -offset : offset - feedLoops[s]
      track.style.translate = `0 ${y}px`
    })
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

if (feedSides.length && typeof PRODUCE !== 'undefined') {
  fillFeed()
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) runFeed()
  let feedTimer
  window.addEventListener('resize', () => {
    clearTimeout(feedTimer)
    feedTimer = setTimeout(fillFeed, 150)
  })
}

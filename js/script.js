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

// Typing intro: in the first second the workshop strip and the intro text appear letter
// by letter. Letters roughly follow reading order but each gets a random nudge, so they
// pop in scattered, like fast messy typing. Afterwards the original text goes back.
const TYPE_BLOCKS = '.workshop, .intro'
const TYPE_ORDER_MS = 525   // spread along reading order
const TYPE_JITTER_MS = 300  // random nudge per letter
const RULE_JITTER_MS = 250

function typeIn() {
  const root = document.documentElement
  const runs = []
  const chars = []

  for (const block of document.querySelectorAll(TYPE_BLOCKS)) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode)
    }

    for (const node of nodes) {
      const run = document.createElement('span')
      for (const char of node.textContent) {
        if (/\s/.test(char)) {
          run.append(char)
          continue
        }
        const span = document.createElement('span')
        span.className = 'type-char'
        span.textContent = char
        run.append(span)
        chars.push(span)
      }
      node.replaceWith(run)
      runs.push([run, node])
    }

    for (const rule of block.querySelectorAll('.rule')) {
      rule.style.setProperty('--delay', `${Math.random() * RULE_JITTER_MS}ms`)
    }
  }

  chars.forEach((span, i) => {
    const delay = (i / chars.length) * TYPE_ORDER_MS + Math.random() * TYPE_JITTER_MS
    span.style.setProperty('--delay', `${delay}ms`)
  })

  root.classList.replace('is-typing', 'is-typing-run')

  setTimeout(() => {
    for (const [run, node] of runs) run.replaceWith(node)
    root.classList.remove('is-typing-run')
  }, TYPE_ORDER_MS + TYPE_JITTER_MS + 150)
}

if (document.documentElement.classList.contains('is-typing')) {
  // Wait for the fonts (at most 800ms) so letters do not switch font mid-typing
  Promise.race([document.fonts.ready, new Promise(done => setTimeout(done, 800))]).then(typeIn)
}

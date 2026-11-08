// Grid overlay (off by default): G toggles the columns, M the module grid. The choice is remembered.
const overlay = {
  columns: document.querySelector('.grid-overlay__columns'),
  module: document.querySelector('.grid-overlay__module'),
}
const keys = { g: 'columns', m: 'module' }

function load(name) {
  try {
    return localStorage.getItem(`grid-${name}`) === 'on'
  } catch {
    return false
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

// Always open at the very top, zigzag and all: browsers (Safari on iPhone above all) put
// a reloaded or reopened page back where it was scrolled. A link to a #spot still works
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
if (!location.hash) scrollTo(0, 0)

// Status bar strip (iOS): Safari takes the bar colour from it while the page loads, then
// it hides while the white sheet is still below the zigzag, so it never covers the teeth
const statusTint = document.querySelector('.status-tint')
const page = document.querySelector('.page')
const STATUS_TINT_H = 6
const STATUS_TINT_READ_MS = 500  // after load, time for Safari to read the colour

function placeStatusTint() {
  const sheetTop = page.getBoundingClientRect().top + parseFloat(getComputedStyle(page).paddingTop)
  statusTint.classList.toggle('is-hidden', sheetTop >= STATUS_TINT_H)
}

if (statusTint && page) {
  window.addEventListener('load', () => setTimeout(() => {
    placeStatusTint()
    window.addEventListener('scroll', placeStatusTint, { passive: true })
    window.addEventListener('resize', placeStatusTint)
  }, STATUS_TINT_READ_MS))
}

// Shopping bag: fixed 24px above the bottom of the screen, but it never goes onto the
// black ending. Once the black section comes close, the bag stops 100px above it
// and scrolls away with the page. On phones it stays put and the black ending slides
// over it instead: everything below the black section's top edge is cut away.
const bag = document.querySelector('.bag')
const blackout = document.querySelector('.blackout')
const isPhone = matchMedia('(max-width: 770px)')
const BAG_SCREEN_GAP = 24  // from the bottom of the screen
const BAG_BLACK_GAP = 100  // from the top of the black section

function placeBag() {
  // the black ending can be switched off (hidden): then there's no black to stop above
  const blackTop = blackout.hidden ? Infinity : blackout.getBoundingClientRect().top

  if (isPhone.matches) {
    bag.style.bottom = ''
    // From the bag's bottom edge; unclipped while the black is below it
    const cut = bag.getBoundingClientRect().bottom - blackTop
    bag.style.setProperty('--bag-cut', cut > 0 ? `${cut}px` : '')
    if (blackTop < window.innerHeight) openBag(false)  // the poster goes back once the black shows
    return
  }

  bag.style.removeProperty('--bag-cut')
  const overlap = window.innerHeight - blackTop
  bag.style.bottom = `${Math.max(BAG_SCREEN_GAP, overlap + BAG_BLACK_GAP)}px`
}

if (bag && blackout) {
  placeBag()
  window.addEventListener('scroll', placeBag, { passive: true })
  window.addEventListener('resize', placeBag)
  isPhone.addEventListener('change', placeBag)
}

// The poster comes out of the bag (.is-open): on hover on desktop, on tap on phones.
// On desktop a click on the bag or poster scrolls down to the buy section. On phones a
// tap only brings the poster out and the next tap hides it again. A tap anywhere else
// or Escape puts the poster back.
const buy = document.querySelector('.buy')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

function openBag(isOpen) {
  bag.classList.toggle('is-open', isOpen)
}

// Our own smooth scroll: the browser's is slow over a long page and can't be sped up.
// This one always takes SCROLL_TIME, easing in and out. A wheel or touch stops it.
const SCROLL_TIME = 450

function goToBuy() {
  openBag(false)
  if (!buy) return
  const from = scrollY
  const to = from + buy.getBoundingClientRect().top
  if (reduceMotion.matches) {
    scrollTo(0, to)
    return
  }
  const start = performance.now()
  let isStopped = false
  const stop = () => (isStopped = true)
  addEventListener('wheel', stop, { once: true, passive: true })
  addEventListener('touchstart', stop, { once: true, passive: true })
  const step = now => {
    if (isStopped) return
    const t = Math.min((now - start) / SCROLL_TIME, 1)
    const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    scrollTo(0, from + (to - from) * eased)
    if (t < 1) requestAnimationFrame(step)
    else {
      removeEventListener('wheel', stop)
      removeEventListener('touchstart', stop)
    }
  }
  requestAnimationFrame(step)
}

if (bag) {
  bag.addEventListener('mouseenter', () => !isPhone.matches && openBag(true))
  bag.addEventListener('mouseleave', () => !isPhone.matches && openBag(false))

  bag.addEventListener('click', () => {
    if (isPhone.matches) openBag(!bag.classList.contains('is-open'))
    else goToBuy()
  })

  // Keyboard: Enter or Space on the focused bag does the same as a click
  bag.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      goToBuy()
    }
  })

  document.addEventListener('click', event => {
    if (!bag.contains(event.target)) openBag(false)
  })

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') openBag(false)
  })

  isPhone.addEventListener('change', () => openBag(false))
}

// Topic header: both parts always wrap onto the same number of lines. When they don't by
// themselves, each gets a width (never narrower than its longest word, never wider than
// 330px) so that both have the smallest line count they can share while fitting the row.
// If no count fits side by side, the two parts stack as on phones (.is-stacked)
const topicTexts = [...document.querySelectorAll('.topic__text')]
const TOPIC_MAX_W = 330

function countLines(el) {
  return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))
}

// Tries to give both parts the same line count in the row's current arrangement
function fitTopicLines(row) {
  for (const text of topicTexts) text.style.flex = ''
  if (countLines(topicTexts[0]) === countLines(topicTexts[1])) return true

  const stacked = getComputedStyle(row).flexDirection === 'column'
  const rowWidth = row.clientWidth
  // Bracket and gap beside each text
  const aside = topicTexts.map(t => t.parentElement.getBoundingClientRect().width - t.getBoundingClientRect().width)
  const room = rowWidth - (parseFloat(getComputedStyle(row).columnGap) || 0) - aside[0] - aside[1]

  const linesAt = (t, width) => {
    t.style.flex = `0 0 ${width}px`
    return countLines(t)
  }
  // Binary search over [lo, hi] for the edge where `ok` flips
  const edge = (lo, hi, okAtLo, ok) => {
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2
      if (ok(mid) === okAtLo) lo = mid
      else hi = mid
    }
    return okAtLo ? lo : hi
  }

  const parts = topicTexts.map((t, i) => {
    t.style.flex = '0 0 0px'
    const lo = t.scrollWidth  // its longest word
    const hi = Math.max(lo, Math.min(TOPIC_MAX_W, stacked ? rowWidth - aside[i] : TOPIC_MAX_W))
    return { t, lo, hi, most: linesAt(t, lo), least: linesAt(t, hi) }
  })
  const [p, q] = parts

  for (let lines = Math.max(p.least, q.least); lines <= Math.min(p.most, q.most); lines++) {
    // Narrowest width that needs no more than `lines`, widest that still needs that many
    const range = part => [
      edge(part.lo, part.hi, false, w => linesAt(part.t, w) <= lines),
      edge(part.lo, part.hi, true, w => linesAt(part.t, w) >= lines),
    ]
    const [pMin, pMax] = range(p)
    const [qMin, qMax] = range(q)
    if (linesAt(p.t, pMin) !== lines || linesAt(q.t, qMin) !== lines) continue
    if (!stacked && pMin + qMin > room) continue

    // As wide as each can be, sharing the row
    const pWidth = stacked ? pMax : Math.max(pMin, Math.min(pMax, room - qMin))
    const qWidth = stacked ? qMax : Math.min(qMax, room - pWidth)
    p.t.style.flex = `0 0 ${pWidth}px`
    q.t.style.flex = `0 0 ${qWidth}px`
    return true
  }

  for (const text of topicTexts) text.style.flex = ''
  return false
}

function evenTopicLines() {
  const row = document.querySelector('.topics')
  row.classList.remove('is-stacked')
  if (fitTopicLines(row)) return
  // Side by side nothing works: stack them and even them out that way
  row.classList.add('is-stacked')
  fitTopicLines(row)
}

if (topicTexts.length === 2) {
  let topicsWidth = 0
  evenTopicLines()
  document.fonts.ready.then(evenTopicLines)
  // Only when the row gets wider or narrower, not when the evening-out changes its height
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === topicsWidth) return
    topicsWidth = entry.contentRect.width
    evenTopicLines()
  }).observe(document.querySelector('.topics'))
}

// Week 2 rows: the text column is as tall as the day block beside it. If its text doesn't
// fit, the note's +++ goes (.is-tight); if it still doesn't fit, the column grows (.is-tall)
const dayBodies = document.querySelectorAll('.wday__body')

function fitDayBodies() {
  for (const body of dayBodies) {
    body.classList.remove('is-tight', 'is-tall')
    const overflows = () => body.scrollHeight > body.clientHeight + 0.5
    if (overflows()) body.classList.add('is-tight')
    if (overflows()) body.classList.add('is-tall')
  }
}

if (dayBodies.length) {
  fitDayBodies()
  document.fonts.ready.then(fitDayBodies)
  new ResizeObserver(fitDayBodies).observe(document.querySelector('.week__days--big'))
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

// On phones the wave also replays every few seconds
const WAVE_REPEAT_MS = 8000

if (title && !reduceMotion.matches) {
  document.fonts.ready.then(waveTitle)
  setInterval(() => {
    if (isPhone.matches && !document.hidden) waveTitle()
  }, WAVE_REPEAT_MS)
}

// A tap on a letter plays its hover look for a moment, then it goes back by itself.
// Cancelling the touch stops the browser's own tap-hover, which would stay until the next
// tap somewhere else. A touch that moves (a scroll) doesn't count as a tap
const TAP_LIT_MS = 600
const TAP_MOVE_PX = 10
let tapStart = null

if (title) {
  title.addEventListener('touchstart', event => {
    const touch = event.touches[0]
    tapStart = { x: touch.clientX, y: touch.clientY }
  }, { passive: true })

  title.addEventListener('touchend', event => {
    const word = event.target.closest('.title__word')
    const touch = event.changedTouches[0]
    if (!word || !tapStart) return
    if (Math.hypot(touch.clientX - tapStart.x, touch.clientY - tapStart.y) > TAP_MOVE_PX) return
    event.preventDefault()
    word.classList.add('is-lit')
    clearTimeout(word.tapTimer)
    word.tapTimer = setTimeout(() => word.classList.remove('is-lit'), TAP_LIT_MS)
  })
}

// Stickers: Safari draws an SVG inside <img> as a flat picture, so stickers with masks and
// filters come out soft on retina screens. Swap each marked <img> for the same SVG drawn
// inline, which stays sharp at any zoom. Ids get a per-sticker prefix so masks and filters
// of different stickers don't collide. If the fetch fails the <img> simply stays.
function inlineSvg(img, prefix) {
  fetch(img.src)
    .then(response => (response.ok ? response.text() : Promise.reject()))
    .then(text => {
      const source = text
        .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
        .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
        .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
      const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
      if (svg.nodeName !== 'svg') return
      svg.removeAttribute('style')
      svg.setAttribute('class', img.className)
      // Keep the <img>'s alt as the sticker's name for screen readers
      if (img.alt) {
        svg.setAttribute('role', 'img')
        svg.setAttribute('aria-label', img.alt)
      } else {
        svg.setAttribute('aria-hidden', 'true')
      }
      img.replaceWith(svg)
    })
    .catch(() => {})
}

document.querySelectorAll('img[data-inline-svg]').forEach((img, index) => inlineSvg(img, `s${index}-`))

// iPhone Safari only applies :active (the pressed look the button text swap uses on
// phones) when the page listens for touches; an empty listener is enough
document.addEventListener('touchstart', () => {}, { passive: true })

// Sticker burst: a sticker between the sections throws a pile of stickers across the
// screen, flying out of it, and pulls them back in again. Desktop: on hover, with a mouse.
// Phones and tablets: a tap bursts, the next tap anywhere pulls them back.
// Each layout is a Figma frame: name, size, the fake browser bar on top (desktop), and
// [sticker, x, y, width, height] in that frame, back to front. Positions scale with the
// window (x by its width, y by its height), sizes by its width.
const BURST_LAYOUTS = {
  // "screen" 414:690, 1512 x 982 with a 33px browser bar
  desktop: {
    width: 1512,
    top: 33,
    height: 982 - 33,
    stickers: [
      ['pound', 1266.2, 13.8, 81, 111],
      ['pizza', 11.2, -159.5, 293, 386],
      ['cherries', 1349.4, 47.5, 303, 509],
      ['bunny', 16.5, 754.8, 399, 490],
      ['lightning', 1265.2, 604.9, 324, 373],
      ['tomato', 582.7, 833.2, 251, 274],
      ['dollar', 130.8, 282, 75, 126],
      ['ruble', 958.1, 345.7, 96, 108],
      ['yen', 1352.3, 837.9, 87, 109],
      ['euro', 361.2, 794.9, 84, 111],
      ['order-now', 253.6, 193.1, 425, 225],
      ['mwah', 151.6, 348.1, 481, 360],
      ['hotdog', 684.1, 11.8, 268, 332],
      ['deal', 995.3, 129.1, 324, 208],
      ['fukus', 488.6, 582.4, 265, 195],
      ['sale', 984, 401.1, 307, 321],
      ['go', 850.1, 592.7, 319, 262],
    ],
    // Order Now!!! or GO would show up twice (in the middle and in the pile), so their
    // copy in the pile is swapped for Today Sale, centred on the copy's spot
    standIns: {
      'order-now': [319.2, 227.4, 294, 156],
      go: [862.8, 645.7, 294, 156],
    },
  },
  // "iPhone 13 & 14 - 6" 426:1786, 390 x 844: nine of the same stickers, same sizes
  phone: {
    width: 390,
    top: 0,
    height: 844,
    stickers: [
      ['mwah', 29.6, 360.1, 481, 360],
      ['hotdog', 172.5, 669.2, 268, 332],
      ['dollar', -27.4, 402.2, 75, 126],
      ['euro', 11.4, -27.1, 84, 111],
      ['ruble', 32.9, 722.2, 96, 108],
      ['pound', 302, 565.8, 81, 111],
      ['yen', 337.3, 288, 87, 109],
      ['sale', 122.9, -46.3, 307, 321],
      ['deal', -155, 143.7, 324, 208],
    ],
    standIns: {},
  },
}
const STICKER_SPRING_MS = 620
const STICKER_STAGGER_MS = 22
const burstTriggers = document.querySelectorAll('.order')
const canHoverBurst = matchMedia('(hover: hover) and (min-width: 771px)')
let burst = null
let burstMode = ''
let burstBackTimer = 0

const burstModeNow = () => (isPhone.matches ? 'phone' : 'desktop')

// Built after the page has loaded, for the current layout only. The stickers are plain
// <img>s (they have no masks or filters, so Safari draws them sharp): a browser paints an
// image once and then only moves it, which keeps the flight smooth in Safari and on
// phones, where inline SVG was repainted path by path
function buildBurst() {
  const mode = burstModeNow()
  if (burst && burstMode === mode) return
  burst?.remove()
  burstMode = mode
  const layout = BURST_LAYOUTS[mode]
  burst = document.createElement('div')
  burst.className = 'burst'
  burst.setAttribute('aria-hidden', 'true')
  burst.style.setProperty('--last', layout.stickers.length - 1)
  const addItem = (src, [x, y, w, h], index) => {
    const item = document.createElement('div')
    item.className = 'burst__item'
    item.style.left = `${(x / layout.width) * 100}vw`
    item.style.top = `${((y - layout.top) / layout.height) * 100}vh`
    item.style.width = `${(w / layout.width) * 100}vw`
    item.style.aspectRatio = `${w} / ${h}`
    item.style.setProperty('--i', index)
    // a little turn of its own while it flies, alternating sides
    item.style.setProperty('--turn', `${(index % 2 ? 1 : -1) * (12 + (index * 7) % 18)}deg`)
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    img.decoding = 'async'
    img.decode?.().catch(() => {})  // ready before the first burst, no paint mid-flight
    item.append(img)
    burst.append(item)
    return item
  }
  layout.stickers.forEach(([name, ...box], index) => {
    addItem(`assets/images/burst/${name}.svg?v=20261108-2`, box, index).dataset.name = name
    const standIn = layout.standIns[name]
    if (standIn) {
      const item = addItem('assets/images/sticker-today-sale.svg?v=20261108-2', standIn, index)
      item.dataset.standsIn = name
      item.hidden = true
    }
  })
  document.body.append(burst)
}

function startBurst(sticker) {
  buildBurst()
  clearTimeout(burstBackTimer)
  const from = sticker.getBoundingClientRect()
  const cx = from.left + from.width / 2
  const cy = from.top + from.height / 2
  // order--order-now -> 'order-now'; Today Sale has no copy in the pile
  const picked = [...sticker.classList].find(name => name.startsWith('order--'))?.slice(7)
  for (const item of burst.children) {
    if (item.dataset.standsIn) item.hidden = item.dataset.standsIn !== picked
    else item.hidden = item.dataset.name === picked && picked in BURST_LAYOUTS[burstMode].standIns
  }
  for (const item of burst.children) {
    if (item.hidden) continue
    item.style.setProperty('--dx', `${cx - (item.offsetLeft + item.offsetWidth / 2)}px`)
    item.style.setProperty('--dy', `${cy - (item.offsetTop + item.offsetHeight / 2)}px`)
  }
  burstTriggers.forEach(other => other.classList.toggle('is-bursting', other === sticker))
  // the start positions are set before the class flips, so they fly from the sticker
  requestAnimationFrame(() => burst.classList.add('is-on'))
}

// The sticker stays on top until the last one has flown back in behind it
function endBurst() {
  if (!burst?.classList.contains('is-on')) return
  burst.classList.remove('is-on')
  clearTimeout(burstBackTimer)
  const backMs = (burst.children.length - 1) * STICKER_STAGGER_MS + STICKER_SPRING_MS
  burstBackTimer = setTimeout(() => {
    burstTriggers.forEach(sticker => sticker.classList.remove('is-bursting'))
  }, backMs)
}

const isBurstOn = () => burst?.classList.contains('is-on')

burstTriggers.forEach(sticker => {
  sticker.addEventListener('mouseenter', () => canHoverBurst.matches && startBurst(sticker))
  sticker.addEventListener('mouseleave', () => canHoverBurst.matches && endBurst())
})

// Phones and tablets (no hover): a tap on a sticker bursts; while the pile is out, any
// tap pulls it back
document.addEventListener('click', event => {
  if (canHoverBurst.matches) return
  if (isBurstOn()) {
    endBurst()
    return
  }
  const sticker = event.target.closest('.order')
  if (sticker) startBurst(sticker)
})

isPhone.addEventListener('change', () => {
  endBurst()
  burst?.remove()
  burst = null
})
canHoverBurst.addEventListener('change', endBurst)

// Haze: text below the haze line (HAZE_LINE of the way down the screen) is grey;
// once a line scrolls above it, it turns black (see .haze-on in the CSS).
// Every word gets its own span, so the words of one line flip together; the ===== rules,
// the buttons, the black day blocks and the +++ / ----- rows drawn by ::before / ::after
// count as lines too.
// Near the end of the page the line slides down to the bottom of the screen, so the last
// lines turn black as well
const HAZE_LINE = 0.7
const HAZE_ROOTS = '.workshop, .stack'
// one line as a whole: the rules, the buttons and the black day blocks (grey in Figma)
const HAZE_WHOLE = '.rule, .crew__link, .buy__link, .ask, .wday__name, .wday__range'
const HAZE_SKIP = `.order, .buy__top, .bag, svg, ${HAZE_WHOLE}`  // no words wrapped inside
const hazeLines = []  // { el, cls, edge: 'middle' | 'top' | 'bottom', y, isRead }

function wrapWords(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => (node.parentElement.closest(HAZE_SKIP) || !node.data.trim()
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const texts = []
  while (walker.nextNode()) texts.push(walker.currentNode)
  for (const text of texts) {
    // split at ordinary spaces only: a non-breaking space keeps its words together
    const parts = text.data.split(/([ \t\n\r]+)/)
    const frag = document.createDocumentFragment()
    for (const part of parts) {
      if (!part) continue
      if (/^[ \t\n\r]+$/.test(part)) {
        frag.append(part)
        continue
      }
      const word = document.createElement('span')
      word.className = 'hz'
      word.textContent = part
      frag.append(word)
      hazeLines.push({ el: word, cls: 'is-read', edge: 'middle' })
    }
    text.replaceWith(frag)
  }
}

function setupHaze() {
  const roots = document.querySelectorAll(HAZE_ROOTS)
  for (const root of roots) {
    wrapWords(root)
    for (const el of root.querySelectorAll(HAZE_WHOLE)) {
      el.classList.add('hz')
      hazeLines.push({ el, cls: 'is-read', edge: 'middle' })
    }
    // +++ above and ----- under some blocks: their own lines, at the block's top / bottom
    for (const el of root.querySelectorAll('*')) {
      if (el.closest(HAZE_SKIP)) continue
      if (getComputedStyle(el, '::before').content !== 'none') {
        el.classList.add('hz-before')
        hazeLines.push({ el, cls: 'is-read-before', edge: 'top' })
      }
      if (getComputedStyle(el, '::after').content !== 'none') {
        el.classList.add('hz-after')
        hazeLines.push({ el, cls: 'is-read-after', edge: 'bottom' })
      }
    }
  }
  document.documentElement.classList.add('haze-on')
}

// Page positions, measured again only when the layout changes
function measureHaze() {
  for (const line of hazeLines) {
    const box = line.el.getBoundingClientRect()
    const y = line.edge === 'top' ? box.top + 10
      : line.edge === 'bottom' ? box.bottom - 10
      : (box.top + box.bottom) / 2
    line.y = y + scrollY
  }
  updateHaze()
}

function updateHaze() {
  const screen = innerHeight
  const endZone = screen * (1 - HAZE_LINE)
  const left = document.documentElement.scrollHeight - (scrollY + screen)
  const share = left < endZone ? 1 - (left / endZone) * (1 - HAZE_LINE) : HAZE_LINE
  const hazeY = scrollY + screen * share
  for (const line of hazeLines) {
    const isRead = line.y < hazeY
    if (isRead === line.isRead) continue
    line.isRead = isRead
    line.el.classList.toggle(line.cls, isRead)
  }
}

let hazeFrame = 0
const queueHaze = () => {
  if (!hazeFrame) hazeFrame = requestAnimationFrame(() => {
    hazeFrame = 0
    updateHaze()
  })
}

setupHaze()
measureHaze()
addEventListener('scroll', queueHaze, { passive: true })
new ResizeObserver(() => measureHaze()).observe(document.body)
document.fonts.ready.then(measureHaze)
addEventListener('load', measureHaze)
addEventListener('load', () => {
  const later = window.requestIdleCallback || (fn => setTimeout(fn, 300))
  later(buildBurst)
})

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
// On desktop a click on the bag scrolls down to the buy section (the poster lets the mouse
// through, see .bag__poster in the CSS). On phones a
// tap only brings the poster out and the next tap hides it again. A tap anywhere else
// or Escape puts the poster back.
const buy = document.querySelector('.buy')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

function openBag(isOpen) {
  bag.classList.toggle('is-open', isOpen)
}

// Hover animations always play to the end: a fast cursor going in and out over a trigger
// used to cut them off midway, over and over, and they stuttered or froze. Now a trigger
// remembers only where the cursor is now (want), and once the running animation has
// finished it plays the next one towards that, if it's still needed.
// settled(): resolves when the CSS transitions and animations playing in an element (and
// inside it) are over; it waits two frames first, so ones that start next frame count.
// Fun mode's colour flashes are plain animations, not CSS ones, so they don't hold it up
function settled(element) {
  return new Promise(frame => requestAnimationFrame(() => requestAnimationFrame(frame)))
    .then(() => Promise.all(element.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition || animation instanceof CSSAnimation)
      .map(animation => animation.finished.catch(() => {}))))
}

// show(want) starts the animation towards want and resolves once it's over; shown() says
// what's on screen now (which may also change by a click, Escape and so on)
function hoverGate(show, shown) {
  let want = null
  let isBusy = false
  return async next => {
    want = next
    if (isBusy) return
    isBusy = true
    while (want !== shown()) await show(want)
    isBusy = false
  }
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

// Smooth wheel scroll (desktop, mouse or trackpad): a wheel turn moves a target, and the
// page glides after it, covering WHEEL_GLIDE_MS-worth of the way each moment, so the
// stops of a mouse wheel melt into one soft movement. Anything else that scrolls the page
// (keys, the scrollbar, the bag's scroll down) takes over: the glide just lets go.
// Phones keep their own touch scroll; zoom (ctrl + wheel) and sideways wheels pass by.
const WHEEL_GLIDE_MS = 70
const smoothWheel = matchMedia('(hover: hover) and (pointer: fine)')
let wheelTarget = 0
let wheelAt = -1     // where the glide has the page (exactly, unrounded); -1 while it isn't gliding
let wheelLast = 0

function wheelStep(now) {
  if (wheelAt < 0) return
  if (Math.abs(scrollY - wheelAt) > 2) {
    wheelAt = -1  // someone else scrolled the page meanwhile
    return
  }
  const dt = Math.max(0, Math.min(now - wheelLast, 50))
  wheelLast = now
  const left = wheelTarget - wheelAt
  wheelAt = Math.abs(left) < 0.5 ? wheelTarget : wheelAt + left * (1 - Math.exp(-dt / WHEEL_GLIDE_MS))
  scrollTo(0, wheelAt)
  if (wheelAt === wheelTarget) wheelAt = -1
  else requestAnimationFrame(wheelStep)
}

addEventListener('wheel', event => {
  if (!smoothWheel.matches || reduceMotion.matches || event.ctrlKey) return
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
  event.preventDefault()
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
  const max = document.documentElement.scrollHeight - innerHeight
  const from = wheelAt < 0 ? scrollY : wheelTarget
  wheelTarget = Math.max(0, Math.min(max, from + event.deltaY * unit))
  if (wheelAt < 0) {
    wheelAt = scrollY
    wheelLast = performance.now()
    requestAnimationFrame(wheelStep)
  }
}, { passive: false })

// The pill that says what got switched (F key; three or more taps on phones), for TOAST_MS; made on the first press
const TOAST_MS = 1400
let toast = null
let toastTimer = 0

function showToast(key, label, isOn) {
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'toast'
    toast.setAttribute('role', 'status')
    toast.innerHTML = '<span class="toast__key" aria-hidden="true"></span>'
      + '<span class="toast__label"></span><span class="toast__dot" aria-hidden="true"></span>'
    document.body.append(toast)
    toast.offsetWidth  // its hidden look is drawn once, so the first pop animates too
  }
  toast.querySelector('.toast__key').textContent = key
  toast.querySelector('.toast__label').textContent = `${label} ${isOn ? 'on' : 'off'}`
  toast.classList.toggle('is-off', !isOn)
  toast.classList.add('is-shown')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('is-shown'), TOAST_MS)
}

// A plain press of a letter key, not typed into a field (by the key's place, any layout)
const isKeyPress = (event, code) => event.code === code && !event.repeat
  && !event.ctrlKey && !event.metaKey && !event.altKey
  && !event.target.closest?.('input, textarea, select, [contenteditable]')

if (bag) {
  const hoverBag = hoverGate(isOpen => {
    openBag(isOpen)
    return settled(bag)
  }, () => bag.classList.contains('is-open'))
  bag.addEventListener('mouseenter', () => !isPhone.matches && hoverBag(true))
  bag.addEventListener('mouseleave', () => !isPhone.matches && hoverBag(false))

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
      ['bunny', 4.1, 748.1, 425, 525],
      ['lightning', 1265.2, 604.9, 346, 373],
      ['tomato', 582.7, 833.2, 251, 274],
      ['dollar', 130.8, 282, 75, 126],
      ['ruble', 958.1, 345.7, 96, 108],
      ['yen', 1352.3, 837.9, 87, 109],
      ['euro', 361.2, 794.9, 84, 111],
      ['order-now', 247.1, 193.1, 431, 230],
      ['mwah', 151.6, 348.1, 481, 360],
      ['hotdog', 684.1, 11.8, 268, 332],
      ['deal', 995.3, 129.1, 324, 208],
      ['fuck-u', 488.6, 582.4, 265, 195],
      ['sale', 984, 401.1, 307, 321],
      ['go', 850.1, 592.7, 319, 262],
    ],
    // Order Now!!!, GO or FUCK U! would show up twice (in the middle and in the pile), so
    // their copy in the pile is swapped for Today Sale, centred on the copy's spot
    standIns: {
      'order-now': [319.2, 227.4, 294, 156],
      go: [862.8, 645.7, 294, 156],
      'fuck-u': [474.1, 601.9, 294, 156],
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
const STICKER_SPRING_MS = 450
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
    addItem(`assets/images/burst/${name}.svg?v=20261108-4`, box, index).dataset.name = name
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

// Hover: the pile always finishes flying out, and back in, before the next move; going
// straight from one sticker to another, the pile goes back into the first, then out of
// the next. burstFrom is the sticker the pile is out of (null while it's in)
let burstFrom = null
const hoverBurst = hoverGate(sticker => {
  if (burstFrom) {
    endBurst()
    burstFrom = null
  } else {
    startBurst(sticker)
    burstFrom = sticker
  }
  return settled(burst)
}, () => (isBurstOn() ? burstFrom : (burstFrom = null)))

burstTriggers.forEach(sticker => {
  sticker.addEventListener('mouseenter', () => canHoverBurst.matches && hoverBurst(sticker))
  sticker.addEventListener('mouseleave', () => canHoverBurst.matches && hoverBurst(null))
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

// Every word of the text gets its own span, for the idle glitch further down
const GLITCH_ROOTS = '.workshop, .stack'
// no words wrapped inside these
const GLITCH_SKIP = '.order, .buy__top, .bag, svg, .rule, .crew__link, .buy__link, .ask, .wday__name, .wday__range'

function wrapWords(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => (node.parentElement.closest(GLITCH_SKIP) || !node.data.trim()
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
      word.className = 'glitch-word'
      word.textContent = part
      frag.append(word)
    }
    text.replaceWith(frag)
  }
}

document.querySelectorAll(GLITCH_ROOTS).forEach(wrapWords)

addEventListener('load', () => {
  const later = window.requestIdleCallback || (fn => setTimeout(fn, 300))
  later(buildBurst)
})

// Typing intro: in the first second the workshop strip and the intro text appear letter
// by letter. Letters roughly follow reading order but each gets a random nudge, so they
// pop in scattered, like fast messy typing. Most of the letters (80%) are there from the
// start (TYPE_SHOWN), so only the rest type in, each in a random colour of the project (TYPE_COLORS) that turns
// into the text colour a moment later. Afterwards the original text goes back.
// (From the typing-intro branch, Oct 28.)
const TYPE_BLOCKS = '.workshop, .olive, .intro'
const TYPE_ORDER_MS = 420   // spread along reading order
const TYPE_JITTER_MS = 240  // random nudge per letter
const TYPE_TINT_MS = 200    // a typed letter shows in a colour this long, then turns text colour
// The colours of the project: the crew cards and the SALAD letters' hover looks
const TYPE_COLORS = ['#ff9633', '#f74980', '#ff66ca', '#00aa58', '#0083fe', '#fb5e24', '#18c1f0', '#1164ff', '#00d4fe', '#fe9ace', '#7200fe', '#6a4336']
const RULE_JITTER_MS = 250
const TYPE_SHOWN = 0.8      // share of letters already there; only the rest (20%) type in

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
        // spaces, and about half of the letters, are there from the start
        if (/\s/.test(char) || Math.random() < TYPE_SHOWN) {
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
    span.style.setProperty('--tint', TYPE_COLORS[Math.floor(Math.random() * TYPE_COLORS.length)])
  })

  root.classList.replace('is-typing', 'is-typing-run')

  setTimeout(() => {
    for (const [run, node] of runs) run.replaceWith(node)
    root.classList.remove('is-typing-run')
  }, TYPE_ORDER_MS + TYPE_JITTER_MS + TYPE_TINT_MS + 150)
}

if (document.documentElement.classList.contains('is-typing')) {
  // Wait for the fonts (at most 800ms) so letters do not switch font mid-typing
  Promise.race([document.fonts.ready, new Promise(done => setTimeout(done, 800))]).then(typeIn)
}

// Idle glitch: while the page is open, random letters of the visible text flip to a
// symbol (GLITCH_SYMBOLS) in a random project colour for a moment, then come back. Only
// the monospace text (GT Pressura Mono) takes part, so a swapped letter never moves the
// layout. Starts after the typing intro; rests while the tab is hidden; off for reduced
// motion
const GLITCH_SYMBOLS = [...'!@#$%^&*()_+=-']
const GLITCH_EVERY_MS = [1000, 3000]  // wait before the next flip (random in between)
const GLITCH_HOLD_MS = [120, 320]   // how long a flipped letter stays (random in between)
const GLITCH_START_MS = 1500        // after the fonts are in, past the typing intro
const pick = list => list[Math.floor(Math.random() * list.length)]
const glitching = new Set()
let glitchWords = []

function glitchOnce() {
  if (document.hidden || !glitchWords.length || isFun) return
  for (let tries = 0; tries < 12; tries++) {
    const word = pick(glitchWords)
    if (glitching.has(word)) continue
    const box = word.getBoundingClientRect()
    if (!box.width || box.bottom < 0 || box.top > innerHeight) continue
    const text = word.textContent
    const chars = [...text]
    const spots = chars.flatMap((char, i) => (/\S/.test(char) ? [i] : []))
    if (!spots.length) continue
    const at = pick(spots)
    const symbol = document.createElement('span')
    symbol.textContent = pick(GLITCH_SYMBOLS)
    symbol.style.color = pick(TYPE_COLORS)
    word.replaceChildren(chars.slice(0, at).join(''), symbol, chars.slice(at + 1).join(''))
    glitching.add(word)
    const [min, max] = GLITCH_HOLD_MS
    setTimeout(() => {
      word.textContent = text
      glitching.delete(word)
    }, min + Math.random() * (max - min))
    return
  }
}

function startGlitch() {
  glitchWords = [...document.querySelectorAll('.glitch-word')].filter(word =>
    getComputedStyle(word).fontFamily.includes('Pressura'))
  const [min, max] = GLITCH_EVERY_MS
  const next = () => setTimeout(() => {
    glitchOnce()
    next()
  }, min + Math.random() * (max - min))
  next()
}

if (!reduceMotion.matches) {
  document.fonts.ready.then(() => setTimeout(startGlitch, GLITCH_START_MS))
}

// Button hover (with a mouse): the label doesn't swap to its hover look at once.
// Its letters scramble out instead, like the typing intro the other way round: each, at
// its own random moment (within SWAP_SPREAD_MS), flickers through SWAP_FLIPS random
// symbols in project colours, SWAP_STEP_MS each, and goes. Meanwhile the hover look comes
// in piece by piece, mixed in with them: from SWAP_MIX_FROM of the way through, each
// piece (a ❀, a ✰, the ✎ and each ﹏, a character of €(130)€) shows up at its own moment
// in a project colour, then turns its own colour TYPE_TINT_MS later. €(130)€'s characters
// also turn up among the flickering symbols. Leaving is the mirror: the pieces flash a
// colour and go, while the letters type back in (symbols first, then the letter in a
// colour for a moment, then the text colour). Every letter keeps its width, so nothing
// moves. A new hover or leave takes over from where it is. Keyboard focus and phones
// keep the plain swap (CSS); reduced motion swaps at once.
// The glyphs are one drawing each, so they're cut into pieces by data-pieces on their
// .swap__alt: where the glyphs sit across the drawing, in its own units (measured from
// the gaps between them; the ﹏﹏﹏﹏ line is one stroke, cut in four)
const SWAP_SPREAD_MS = 220
const SWAP_STEP_MS = 55
const SWAP_FLIPS = 2
const SWAP_MIX_FROM = 0.45
const SWAP_ALL_MS = SWAP_SPREAD_MS + SWAP_FLIPS * SWAP_STEP_MS
const hasMouse = matchMedia('(hover: hover)')

// A glyph drawing as clipped copies of itself, one per piece, stacked on the original
// (which is the first piece); text as one span per character, marks kept on it
function swapPieces(alt) {
  const glyph = alt.querySelector('.swap__glyph')
  if (glyph && alt.dataset.pieces) {
    const cuts = alt.dataset.pieces.split(' ').map(Number)
    const full = cuts[cuts.length - 1]
    const clip = i => `inset(0 ${(100 * (full - cuts[i + 1]) / full).toFixed(3)}% 0 ${(100 * cuts[i] / full).toFixed(3)}%)`
    const pieces = [glyph]
    for (let i = 1; i < cuts.length - 1; i++) {
      const copy = glyph.cloneNode(true)
      copy.style.position = 'absolute'
      copy.style.left = getComputedStyle(glyph).left
      copy.style.clipPath = clip(i)
      alt.append(copy)
      pieces.push(copy)
    }
    glyph.style.clipPath = clip(0)
    return pieces
  }
  const text = alt.textContent
  alt.textContent = ''
  return text.match(/\P{M}\p{M}*/gu).map(char => {
    const span = document.createElement('span')
    span.className = 'swap__piece'
    span.textContent = char
    alt.append(span)
    return span
  })
}

function setUpSwap(link) {
  const swap = link.querySelector('.swap')
  const label = swap?.querySelector('.swap__label')
  const alt = swap?.querySelector('.swap__alt')
  if (!label || !alt) return
  const text = label.textContent
  label.textContent = ''
  const chars = []
  for (const char of text) {
    if (/\s/.test(char)) {
      label.append(char)
      continue
    }
    const span = document.createElement('span')
    span.className = 'swap__char'
    span.textContent = char
    label.append(span)
    chars.push([span, char])
  }
  // the hover look's own characters (€(130)€) join the flickering symbols
  const altChars = alt.querySelector('.swap__glyph') ? [] : [...new Set(alt.textContent.match(/\P{M}/gu))]
  // made at the first hover: the glyphs are drawn inline by then (inlineSvg)
  let pieces = null
  const tint = (piece, color) => {
    if (piece.matches('span')) piece.style.color = color
    else piece.querySelectorAll('path').forEach(path => (path.style.fill = color))
  }

  let timers = []
  const later = (ms, fn) => timers.push(setTimeout(fn, ms))
  const resetLabel = () => {
    for (const [span, char] of chars) {
      span.textContent = char
      span.style.color = ''
      span.style.visibility = ''
      span.style.width = ''
    }
  }
  const resetPieces = () => {
    for (const piece of pieces) {
      piece.style.visibility = ''
      tint(piece, '')
    }
  }
  const reset = () => {
    timers.forEach(clearTimeout)
    timers = []
    swap.classList.remove('is-mixing')
    resetLabel()
    resetPieces()
  }
  // each letter keeps its width while it plays (measured now: the size can change with
  // the window), so a symbol in its place moves nothing
  const holdWidths = () => {
    const widths = chars.map(([span]) => span.getBoundingClientRect().width)
    chars.forEach(([span], i) => (span.style.width = `${widths[i]}px`))
  }
  // later on, the hover look's characters turn up more often among the symbols
  const symbolAt = ms => (altChars.length && Math.random() < ms / SWAP_ALL_MS ? pick(altChars) : pick(GLITCH_SYMBOLS))
  const flicker = (span, start, withAlt) => {
    for (let flip = 0; flip < SWAP_FLIPS; flip++) {
      const at = start + flip * SWAP_STEP_MS
      later(at, () => {
        span.style.visibility = ''
        span.textContent = withAlt ? symbolAt(at) : pick(GLITCH_SYMBOLS)
        span.style.color = pick(TYPE_COLORS)
      })
    }
  }

  link.addEventListener('mouseenter', () => {
    if (!hasMouse.matches) return
    pieces ??= swapPieces(alt)
    reset()
    if (reduceMotion.matches) return swap.classList.add('is-alt')
    holdWidths()
    let last = 0
    for (const [span] of chars) {
      const start = Math.random() * SWAP_SPREAD_MS
      flicker(span, start, true)
      const gone = start + SWAP_FLIPS * SWAP_STEP_MS
      later(gone, () => (span.style.visibility = 'hidden'))
      last = Math.max(last, gone)
    }
    // the hover look's pieces come in during the second half, each in a colour first
    swap.classList.add('is-mixing')
    for (const piece of pieces) {
      piece.style.visibility = 'hidden'
      const start = SWAP_ALL_MS * (SWAP_MIX_FROM + Math.random() * (1 - SWAP_MIX_FROM))
      later(start, () => {
        piece.style.visibility = ''
        tint(piece, pick(TYPE_COLORS))
      })
      later(start + TYPE_TINT_MS, () => tint(piece, ''))
    }
    later(last, () => {
      swap.classList.add('is-alt')
      swap.classList.remove('is-mixing')
      resetLabel()
    })
  })

  link.addEventListener('mouseleave', () => {
    if (!hasMouse.matches) return
    pieces ??= swapPieces(alt)
    reset()
    swap.classList.remove('is-alt')
    if (reduceMotion.matches) return
    holdWidths()
    // the pieces flash a colour and go in the first half
    swap.classList.add('is-mixing')
    for (const piece of pieces) {
      const start = Math.random() * SWAP_ALL_MS * (1 - SWAP_MIX_FROM)
      later(start, () => tint(piece, pick(TYPE_COLORS)))
      later(start + SWAP_STEP_MS, () => (piece.style.visibility = 'hidden'))
    }
    for (const [span, char] of chars) {
      const start = Math.random() * SWAP_SPREAD_MS
      span.style.visibility = 'hidden'
      flicker(span, start, false)
      const landed = start + SWAP_FLIPS * SWAP_STEP_MS
      later(landed, () => {
        span.textContent = char
        span.style.color = pick(TYPE_COLORS)
      })
      later(landed + TYPE_TINT_MS, () => (span.style.color = ''))
    }
    later(SWAP_ALL_MS + TYPE_TINT_MS, reset)
  })
}

document.querySelectorAll('.crew__link, .buy__link, .ask').forEach(setUpSwap)

// Fun mode (F key, again to stop): every letter and symbol on the page keeps flashing in
// the project colours, like the letters of the typing intro, for as long as it's on.
// Each letter gets its own span; every FUN_EVERY_MS a share of the letters on screen
// (FUN_SHARE) lights up in a random colour for FUN_TINT_MS. Off puts the text back.
// The SALAD letters (SVG outlines) flash too, by their fill; the = rules (CSS) keep their
// look. With reduced motion the letters take one colour each and stay that way
const FUN_SKIP = 'script, style, noscript, svg, .toast, .burst, .idle-stickers'
const FUN_EVERY_MS = 50
const FUN_SHARE = 0.04
const FUN_TINT_MS = 260
let isFun = false
let funRuns = []          // [the span the text went into, the original text]
let funSeen = new Set()   // runs on screen
let funObserver = null
let funLoop = 0
let funTitle = []         // the SALAD letters' outlines

function startFun() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: node => (node.parentElement.closest(FUN_SKIP) || !node.data.trim()
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  funObserver = new IntersectionObserver(entries => {
    for (const entry of entries) funSeen[entry.isIntersecting ? 'add' : 'delete'](entry.target)
  })
  for (const node of nodes) {
    const run = document.createElement('span')
    for (const part of node.data.split(/(\s+)/)) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        run.append(part)
        continue
      }
      for (const char of part) {
        const span = document.createElement('span')
        span.className = 'fun-char'
        span.textContent = char
        if (reduceMotion.matches) span.style.color = pick(TYPE_COLORS)
        run.append(span)
      }
    }
    node.replaceWith(run)
    funRuns.push([run, node])
    funObserver.observe(run)
  }
  funTitle = [...document.querySelectorAll('.title__plain')]
  if (reduceMotion.matches) for (const letter of funTitle) letter.style.fill = pick(TYPE_COLORS)
  else funLoop = setInterval(funFlash, FUN_EVERY_MS)
}

function funFlash() {
  if (document.hidden) return
  const chars = [...funSeen].flatMap(run => [...run.children])
  const count = Math.ceil(chars.length * FUN_SHARE)
  for (let i = 0; i < count; i++) {
    const color = pick(TYPE_COLORS)
    pick(chars).animate([{ color }, { color }], { duration: FUN_TINT_MS, easing: 'steps(1)' })
  }
  // each SALAD letter gets the same chance as a letter of the text, while the title shows
  if (funTitle.length && funTitle[0].getBoundingClientRect().bottom < 0) return
  for (const letter of funTitle) {
    if (Math.random() >= FUN_SHARE) continue
    const fill = pick(TYPE_COLORS)
    letter.animate([{ fill }, { fill }], { duration: FUN_TINT_MS, easing: 'steps(1)' })
  }
}

function stopFun() {
  clearInterval(funLoop)
  funObserver?.disconnect()
  funObserver = null
  funSeen = new Set()
  for (const [run, node] of funRuns) run.replaceWith(node)
  funRuns = []
  for (const letter of funTitle) {
    letter.style.fill = ''
    for (const animation of letter.getAnimations()) animation.cancel()
  }
  funTitle = []
}

// The pill's key cap: F on a keyboard, 3x for taps
function toggleFun(key) {
  // not while the typing intro has the text in pieces
  const root = document.documentElement.classList
  if (root.contains('is-typing') || root.contains('is-typing-run')) return
  isFun = !isFun
  if (isFun) startFun()
  else stopFun()
  showToast(key, 'fun mode', isFun)
}

addEventListener('keydown', event => isKeyPress(event, 'KeyF') && toggleFun('F'))

// Phones: three or more quick taps anywhere do the same (each within TAP_GAP_MS of the
// last). It switches on the third tap; more taps in the same run don't switch it back,
// so a run of any length (3, 5, 10 taps) switches it once. A tap that scrolls isn't a
// click, so it doesn't count
const TAP_GAP_MS = 400
const isTouchOnly = matchMedia('(hover: none) and (pointer: coarse)')
let taps = 0
let lastTap = 0

addEventListener('click', () => {
  if (!isTouchOnly.matches) return
  const now = performance.now()
  taps = now - lastTap < TAP_GAP_MS ? taps + 1 : 1
  lastTap = now
  if (taps === 3) toggleFun('3x')
})

// Idle stickers: after IDLE_AFTER_MS without any interaction, stickers start landing on
// the screen one after another, at random spots and tilts, piling over each other, for
// as long as nobody touches the page. Any mouse move, scroll, tap or key drops the pile:
// the stickers fall off the bottom of the screen, and the wait starts over. The oldest go once there are IDLE_MAX, so it can run forever
const IDLE_AFTER_MS = 40000
const IDLE_EVERY_MS = [1200, 2500]  // wait before the next sticker (random in between)
const IDLE_MAX = 150
const IDLE_TURN_DEG = 25          // tilt, either way
const IDLE_FALL_MS = [400, 600]   // how long one takes to fall off the screen
const IDLE_FALL_STAGGER_MS = 150  // they don't all let go at once
const IDLE_STICKERS = [
  ...BURST_LAYOUTS.desktop.stickers.map(([name, , , w]) => [`assets/images/burst/${name}.svg?v=20261108-4`, w]),
  ['assets/images/sticker-today-sale.svg?v=20261108-2', 294],
]
let idleTimer = 0
let idleLoop = 0
let idleLayer = null

function idleStick() {
  if (!idleLayer) return
  const [src, width] = pick(IDLE_STICKERS)
  const sticker = document.createElement('img')
  sticker.className = 'idle-sticker'
  sticker.src = src
  sticker.alt = ''
  // Figma size on a 1512px screen, smaller on narrower ones (not below 45%)
  sticker.style.width = `${width * Math.min(1, Math.max(0.45, innerWidth / 1512))}px`
  sticker.style.left = `${Math.random() * 100}%`
  sticker.style.top = `${Math.random() * 100}%`
  sticker.style.setProperty('--turn', `${((Math.random() * 2 - 1) * IDLE_TURN_DEG).toFixed(1)}deg`)
  idleLayer.append(sticker)
  while (idleLayer.childElementCount > IDLE_MAX) idleLayer.firstElementChild.remove()
  const [min, max] = IDLE_EVERY_MS
  idleLoop = setTimeout(idleStick, min + Math.random() * (max - min))
}

function startIdle() {
  idleLayer = document.createElement('div')
  idleLayer.className = 'idle-stickers'
  idleLayer.setAttribute('aria-hidden', 'true')
  document.body.append(idleLayer)
  idleStick()
}

function stopIdle() {
  clearTimeout(idleLoop)
  if (!idleLayer) return
  const layer = idleLayer
  idleLayer = null
  // each falls in its own time, with a last little spin
  let longest = 0
  for (const sticker of layer.children) {
    const delay = Math.random() * IDLE_FALL_STAGGER_MS
    const time = IDLE_FALL_MS[0] + Math.random() * (IDLE_FALL_MS[1] - IDLE_FALL_MS[0])
    sticker.style.setProperty('--fall-delay', `${delay}ms`)
    sticker.style.setProperty('--fall-ms', `${time}ms`)
    sticker.style.setProperty('--fall-turn', `${((Math.random() * 2 - 1) * 40).toFixed(1)}deg`)
    longest = Math.max(longest, delay + time)
  }
  layer.classList.add('is-leaving')
  setTimeout(() => layer.remove(), longest + 50)
}

function wake() {
  stopIdle()
  clearTimeout(idleTimer)
  idleTimer = setTimeout(startIdle, IDLE_AFTER_MS)
}

for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
  addEventListener(type, wake, { passive: true })
}
wake()

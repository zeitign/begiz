import type { Directive } from 'vue'

const measuringContext = document.createElement('canvas').getContext('2d')

/** Pulls text left by its first letter's side bearing, so its ink, not the letter's box, sits on the
 * grid line. Monospace letters are centred in their cell, and at large sizes the gap shows (an "L" at
 * 64px starts 6px in). Each letter has its own bearing, so it is measured, not set in CSS. */
function alignFirstLetter(element: HTMLElement) {
  const firstLetter = element.textContent?.trim().charAt(0)
  if (!firstLetter || !measuringContext) return
  const style = getComputedStyle(element)
  measuringContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const leftBearing = -measuringContext.measureText(firstLetter).actualBoundingBoxLeft
  element.style.marginLeft = `${-Math.max(0, leftBearing)}px`
}

export const vOpticalAlign: Directive<HTMLElement> = {
  mounted(element) {
    alignFirstLetter(element)
    // The first measure may use the fallback font; measure again once the web font is ready.
    document.fonts.ready.then(() => alignFirstLetter(element))
  },
  updated: alignFirstLetter,
}

import { reactive } from 'vue'

export type InfoWindow = {
  webId: string
  x: number
  y: number
  /** null until the user resizes the window. The height always follows the content. */
  width: number | null
  isMaximized: boolean
  isMinimized: boolean
  stackOrder: number
}

const FIRST_WINDOW_POSITION = { x: 48, y: 72 }
const CASCADE_OFFSET = 24
const CASCADE_STEPS = 8

let highestStackOrder = 0

/** Read-only windows open on top of the app. Several can be open at once, one per web. */
export const infoWindows = reactive<InfoWindow[]>([])

function findInfoWindow(webId: string) {
  return infoWindows.find((infoWindow) => infoWindow.webId === webId)
}

export function bringInfoWindowToFront(webId: string) {
  const infoWindow = findInfoWindow(webId)
  if (infoWindow) infoWindow.stackOrder = ++highestStackOrder
}

/** Opens the window of a web, or shows it again where it was if it was already open or minimized. */
export function openInfoWindow(webId: string) {
  const existingWindow = findInfoWindow(webId)
  if (existingWindow) {
    existingWindow.isMinimized = false
    bringInfoWindowToFront(webId)
    return
  }
  const cascadeStep = infoWindows.length % CASCADE_STEPS
  infoWindows.push({
    webId,
    x: FIRST_WINDOW_POSITION.x + cascadeStep * CASCADE_OFFSET,
    y: FIRST_WINDOW_POSITION.y + cascadeStep * CASCADE_OFFSET,
    width: null,
    isMaximized: false,
    isMinimized: false,
    stackOrder: ++highestStackOrder,
  })
}

export function moveInfoWindow(webId: string, x: number, y: number) {
  const infoWindow = findInfoWindow(webId)
  if (!infoWindow) return
  infoWindow.x = x
  infoWindow.y = y
}

export function resizeInfoWindow(webId: string, x: number, width: number) {
  const infoWindow = findInfoWindow(webId)
  if (!infoWindow) return
  infoWindow.x = x
  infoWindow.width = width
}

export function minimizeInfoWindow(webId: string) {
  const infoWindow = findInfoWindow(webId)
  if (infoWindow) infoWindow.isMinimized = true
}

export function toggleMaximizeInfoWindow(webId: string) {
  const infoWindow = findInfoWindow(webId)
  if (infoWindow) infoWindow.isMaximized = !infoWindow.isMaximized
}

export function closeInfoWindow(webId: string) {
  const windowIndex = infoWindows.findIndex((infoWindow) => infoWindow.webId === webId)
  if (windowIndex !== -1) infoWindows.splice(windowIndex, 1)
}

export function closeAllInfoWindows() {
  infoWindows.splice(0)
}

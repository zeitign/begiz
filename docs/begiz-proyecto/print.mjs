// Prints an HTML file to PDF through Chrome DevTools, with a page-number footer.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [htmlPath, pdfPath] = process.argv.slice(2)
const targets = await (await fetch('http://127.0.0.1:9333/json')).json()
const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve))
let messageId = 0
function send(method, params = {}) {
  const id = ++messageId
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => socket.addEventListener('message', function onMessage(event) {
    const message = JSON.parse(event.data)
    if (message.id !== id) return
    socket.removeEventListener('message', onMessage)
    message.error ? reject(new Error(message.error.message)) : resolve(message.result)
  }))
}
await send('Page.enable')
await send('Page.navigate', { url: pathToFileURL(htmlPath).href })
await new Promise((resolve) => setTimeout(resolve, 2000))
await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
const footer = `<div style="width:100%;margin:0 16mm;display:flex;justify-content:space-between;font-family:'DejaVu Sans Mono',monospace;font-size:7px;letter-spacing:0.08em;text-transform:uppercase;border-top:0.5px solid #000;padding-top:4px">
  <span>Begiz — proyecto</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
const { data } = await send('Page.printToPDF', {
  paperWidth: 8.27, paperHeight: 11.69, preferCSSPageSize: true, printBackground: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer,
})
writeFileSync(pdfPath, Buffer.from(data, 'base64'))
socket.close()

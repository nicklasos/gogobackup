// Writes the wordmarks from docs/images/logo.svg and renders logo.png with the frontend's Playwright.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const images = path.join(root, 'docs/images')
const { chromium } = createRequire(path.join(root, 'frontend/package.json'))('playwright')

const logo = fs.readFileSync(path.join(images, 'logo.svg'), 'utf8')
const mark = logo.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

const wordmark = (ink) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 256" role="img" aria-label="Gogobackup">
  <svg x="0" y="0" width="256" height="256" viewBox="0 0 256 256">${mark}</svg>
  <text x="284" y="164" textLength="636" lengthAdjust="spacingAndGlyphs" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="108" font-weight="700"><tspan fill="#00ADD8">Gogo</tspan><tspan fill="${ink}">backup</tspan></text>
</svg>
`
fs.writeFileSync(path.join(images, 'logo-wordmark.svg'), wordmark('#16313D'))
fs.writeFileSync(path.join(images, 'logo-wordmark-dark.svg'), wordmark('#E6EDF3'))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
await page.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}" width="512" height="512" style="display:block"></body>`)
await page.screenshot({ path: path.join(images, 'logo.png'), omitBackground: true })
await browser.close()
console.log('wrote logo-wordmark.svg, logo-wordmark-dark.svg, logo.png')

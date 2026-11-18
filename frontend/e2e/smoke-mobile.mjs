import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'screenshots/mobile-01-dashboard.png', fullPage: true })

await page.goto('http://localhost:5173/players/2544', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'screenshots/mobile-02-profile.png', fullPage: true })

console.log('mobile errors:', errors.length, [...new Set(errors)])
await browser.close()

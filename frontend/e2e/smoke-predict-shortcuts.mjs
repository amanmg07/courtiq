import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } })
const errors = []
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

await page.goto('http://localhost:5173/predict', { waitUntil: 'networkidle' })
await page.getByPlaceholder(/search/i).first().fill('LeBron James')
await page.waitForTimeout(500)
await page.getByText('LeBron James', { exact: true }).first().click()
await page.waitForTimeout(1500) // let upcoming games load
await page.screenshot({ path: 'screenshots/12-predict-shortcuts.png', fullPage: true })

// click first shortcut
const shortcut = page.locator('button', { hasText: /vs|@/ }).first()
if (await shortcut.count() > 0) {
  await shortcut.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'screenshots/13-predict-shortcut-clicked.png', fullPage: true })
}

console.log('errors:', errors.length, [...new Set(errors)])
await browser.close()

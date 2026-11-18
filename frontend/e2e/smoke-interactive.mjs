import { chromium } from 'playwright'

const browser = await chromium.launch()

async function withPage(fn) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  await fn(page)
  const unique = [...new Set(errors)]
  console.log(`  errors: ${errors.length}`, unique.slice(0, 3))
  await page.close()
}

async function selectPlayer(page, name) {
  await page.getByPlaceholder(/search|add a player/i).first().fill(name)
  await page.waitForTimeout(500)
  await page.getByText(name, { exact: true }).first().click()
}

// Matchup: LeBron vs DEN
await withPage(async (page) => {
  await page.goto('http://localhost:5173/matchup', { waitUntil: 'networkidle' })
  await selectPlayer(page, 'LeBron James')
  await page.locator('select').selectOption('DEN')
  await page.waitForTimeout(1000)
  // Belt-and-suspenders against a screenshot-capture race (seen before: DOM/
  // computed styles are correct at this point, but the compositor hasn't
  // necessarily painted the latest SVG frame yet) -- force a paint flush.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.screenshot({ path: 'screenshots/07-matchup-filled.png', fullPage: true })
  console.log('captured matchup-filled')
})

// Compare: LeBron + Giannis, career
await withPage(async (page) => {
  await page.goto('http://localhost:5173/compare', { waitUntil: 'networkidle' })
  await selectPlayer(page, 'LeBron James')
  await page.waitForTimeout(300)
  await selectPlayer(page, 'Giannis Antetokounmpo')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'screenshots/08-compare-filled.png', fullPage: true })
  console.log('captured compare-filled')
})

// Predict: LeBron vs DEN, click Generate -> expect graceful 503 handling
await withPage(async (page) => {
  await page.goto('http://localhost:5173/predict', { waitUntil: 'networkidle' })
  await selectPlayer(page, 'LeBron James')
  await page.locator('select').selectOption('DEN')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'screenshots/09-predict-context.png', fullPage: true })
  await page.getByRole('button', { name: /generate prediction/i }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'screenshots/10-predict-503.png', fullPage: true })
  console.log('captured predict states')
})

await browser.close()

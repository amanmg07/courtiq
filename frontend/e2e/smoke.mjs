import { chromium } from 'playwright'

const pages = [
  { url: 'http://localhost:5173/', name: '01-dashboard' },
  { url: 'http://localhost:5173/players', name: '02-players' },
  { url: 'http://localhost:5173/players/2544', name: '03-player-profile' },
  { url: 'http://localhost:5173/compare', name: '04-compare' },
  { url: 'http://localhost:5173/matchup', name: '05-matchup' },
  { url: 'http://localhost:5173/predict', name: '06-predict' },
]

for (const p of pages) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  await page.goto(p.url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `screenshots/${p.name}.png` })
  console.log(`captured ${p.name} -- ${errors.length} console errors`)
  // de-duplicate repeated error text so a loop doesn't flood the log
  const unique = [...new Set(errors)]
  unique.slice(0, 5).forEach((e) => console.log('   -', e.slice(0, 200)))

  await browser.close()
}

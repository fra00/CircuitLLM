import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'docs', 'screenshots')
const baseUrl = 'http://localhost:5173/'

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

await page.screenshot({ path: path.join(outDir, '01-overview.png') })

await page.getByRole('button', { name: 'LLM', exact: true }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(outDir, '02-llm-panel.png') })

await page.getByTitle('Settings').click()
await page.getByRole('button', { name: 'LLM settings' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: path.join(outDir, '03-llm-settings.png') })
await page.getByRole('button', { name: 'Chiudi' }).click()

await page.getByRole('button', { name: 'Componenti' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(outDir, '04-components-palette.png') })

await page.getByRole('button', { name: 'Contesto LLM' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(outDir, '05-llm-context.png') })

await browser.close()
console.log('Screenshots saved to', outDir)

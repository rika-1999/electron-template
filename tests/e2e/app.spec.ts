import { test, expect } from './fixtures/electronApp'
import { waitForWindowReady } from './helpers/windowHelpers'

test('app launches, creates main window, and loads React app with resources', async ({
  electronApp,
  mainProcessLogs,
}) => {
  const window = await waitForWindowReady(electronApp)

  const consoleErrors: string[] = []

  window.on('console', (msg) => {
    const msgType = msg.type()
    if (msgType === 'error') {
      const errorText = msg.text()
      consoleErrors.push(errorText)
    }
  })

  const title = await window.title()
  expect(title).toBeTruthy()

  const appElement = window.locator('#root').first()

  await expect(appElement).toBeVisible()

  const loadedResources = await window.evaluate(() => {
    return {
      hasReactRoot: !!document.getElementById('root'),
    }
  })
  expect(loadedResources.hasReactRoot).toBe(true)
  expect(consoleErrors).toEqual([])

  // Verify main process logged window creation
  const hasMainLog = mainProcessLogs.some((l) => l.includes('Main window created successfully'))
  expect(hasMainLog).toBe(true)
})

test('counter UI renders correctly and buttons are clickable', async ({
  electronApp,
}) => {
  const window = await waitForWindowReady(electronApp)

  // Verify heading is visible
  const heading = window.locator('h1')
  await expect(heading).toBeVisible()
  await expect(heading).toHaveText('Electron Counter')

  // Verify initial count is 0
  const countDisplay = window.locator('p.text-6xl')
  await expect(countDisplay).toBeVisible()
  await expect(countDisplay).toHaveText('0')

  // Verify both buttons exist
  const buttons = window.locator('button')
  await expect(buttons).toHaveCount(2)
  await expect(buttons.nth(0)).toHaveText('-')
  await expect(buttons.nth(1)).toHaveText('+')

  // Verify footer text
  const footer = window.locator('p.text-sm')
  await expect(footer).toBeVisible()
  await expect(footer).toHaveText('Powered by Zustand + Tailwind CSS + shadcn/ui + IPC')
})

test('counter buttons trigger IPC and update count', async ({
  electronApp,
  mainProcessLogs,
}) => {
  const window = await waitForWindowReady(electronApp)

  // Capture renderer console errors
  const consoleErrors: string[] = []
  window.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  const countDisplay = window.locator('p.text-6xl')
  const incrementBtn = window.locator('button', { hasText: '+' }).first()
  const decrementBtn = window.locator('button', { hasText: '-' }).first()

  // Initial state
  await expect(countDisplay).toHaveText('0')

  // Click increment → count should become 1
  await incrementBtn.click()
  await expect(countDisplay).toHaveText('1')

  // Click increment again → count should become 2
  await incrementBtn.click()
  await expect(countDisplay).toHaveText('2')

  // Click decrement → count should become 1
  await decrementBtn.click()
  await expect(countDisplay).toHaveText('1')

  // Click decrement → count should become 0
  await decrementBtn.click()
  await expect(countDisplay).toHaveText('0')

  // Click decrement → count should become -1
  await decrementBtn.click()
  await expect(countDisplay).toHaveText('-1')

  // Verify no renderer errors
  expect(consoleErrors).toEqual([])

  // Verify IPC round-trip was logged in main process
  const hasIncrementLog = mainProcessLogs.some((l) =>
    l.includes('CounterMainApi:increment ← request'),
  )
  expect(hasIncrementLog).toBe(true)
})

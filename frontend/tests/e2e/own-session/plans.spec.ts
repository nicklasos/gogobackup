import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'
import { test, expect } from '@playwright/test'
import { assertTestDatabasePath } from '../helpers/db-helper'
import { dbHelper, loginAs } from '../helpers/test-helpers'
import { AppShell } from '../pages/AppShell'
import { PlanEditorPage } from '../pages/PlanEditorPage'
import { PlansPage } from '../pages/PlansPage'
import { StoragesPage } from '../pages/StoragesPage'

/** A local storage the API can write to, named so cleanup finds it. */
async function storage(label: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gogobackup-e2e-plan-'))
  return dbHelper.createStorage(`E2E ${label} ${Date.now()}`, dir)
}

/** A port nothing listens on, so a connection is refused at once. */
async function closedPort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise((resolve) => server.close(resolve))
  return port
}

test.describe('Backup plans as an admin', () => {
  test('creates a SQLite plan with two schedules, tests it, edits it and deletes it', async ({ page }) => {
    await loginAs(page, 'admin')
    const target = await storage('Plan target')
    const name = `E2E Plan ${Date.now()}`
    const list = new PlansPage(page)
    const editor = new PlanEditorPage(page)

    await list.gotoList()
    await list.clickAdd()
    await editor.nameInput.fill(name)
    await editor.chooseKind('sqlite')
    await editor.sqlitePathInput.fill(assertTestDatabasePath(process.env.TEST_DATABASE_PATH))
    await editor.testConnection()
    await expect(editor.testPassed).toBeVisible()
    await expect(editor.serverVersion).toBeVisible()
    await expect(editor.toolVersion).toHaveAttribute('data-found', 'true')

    await expect(editor.scheduleRows).toHaveCount(1)
    await editor.setTime(0, '03:00')
    await editor.addScheduleButton.click()
    await expect(editor.scheduleRows).toHaveCount(2)
    await editor.setTime(1, '18:00')
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) await editor.toggleDay(1, day)
    await expect(editor.nextRun).toBeVisible()
    await expect(editor.nextRun).toHaveAttribute('data-next', /T(03|18):00:00\.000Z$/)

    await editor.chooseStorage(target.name)
    await editor.setRetention(30, 8, 12)
    await expect(editor.retentionSummary).toContainText('30')
    await editor.save()

    await expect(list.row(name)).toBeVisible()
    await expect(list.schedule(name)).toContainText('03:00')
    await expect(list.schedule(name)).toContainText('18:00')
    await expect(list.nextRun(name)).toContainText('UTC')
    await expect(list.row(name)).toContainText(target.name)

    await list.edit(name)
    await expect(editor.sqlitePathInput).toHaveValue(assertTestDatabasePath(process.env.TEST_DATABASE_PATH))
    await expect(editor.scheduleRows).toHaveCount(2)
    await editor.removeSchedule(1)
    await expect(editor.scheduleRows).toHaveCount(1)
    await editor.save()
    await expect(list.schedule(name)).toContainText('03:00')
    await expect(list.schedule(name)).not.toContainText('18:00')

    await list.delete(name)
  })

  test('fills a Postgres source from a pasted URL and reports a refused connection', async ({ page }) => {
    await loginAs(page, 'admin')
    const port = await closedPort()
    const list = new PlansPage(page)
    const editor = new PlanEditorPage(page)

    await list.gotoList()
    await list.clickAdd()
    await editor.chooseKind('postgres')
    await editor.urlInput.fill(`postgres://shop:s3cret@127.0.0.1:${port}/shop?sslmode=require`)
    await editor.urlInput.press('Enter')
    await expect(editor.urlInput).toHaveValue('')
    await expect(editor.hostInput).toHaveValue('127.0.0.1')
    await expect(editor.portInput).toHaveValue(String(port))
    await expect(editor.databaseInput).toHaveValue('shop')
    await expect(editor.userInput).toHaveValue('shop')
    await expect(editor.passwordInput).toHaveValue('s3cret')

    await editor.testConnection()
    await expect(editor.testFailed).toHaveAttribute('data-step', 'connect')
  })

  test('shows a name that is taken under the name field', async ({ page }) => {
    await loginAs(page, 'admin')
    const target = await storage('Plan names')
    const taken = await dbHelper.createPlan(`E2E Taken ${Date.now()}`, target.id)
    const list = new PlansPage(page)
    const editor = new PlanEditorPage(page)

    await list.gotoList()
    await list.clickAdd()
    await editor.nameInput.fill(taken.name.toUpperCase())
    await editor.chooseKind('files')
    await page.getByTestId('plan-files-path-input-0').fill(os.tmpdir())
    await editor.chooseStorage(target.name)
    await editor.saveButton.click()
    await expect(editor.nameInput).toHaveAttribute('aria-invalid', 'true')
    await expect(editor.root).toBeVisible()
  })

  test('a storage that a plan uses cannot be deleted, and the page says which plan', async ({ page }) => {
    await loginAs(page, 'admin')
    const used = await storage('Used')
    const plan = await dbHelper.createPlan(`E2E Uses storage ${Date.now()}`, used.id)
    const storages = new StoragesPage(page)

    await storages.gotoList()
    await storages.row(used.name).locator('[data-testid^="delete-storage-button-"]').click()
    await page.locator('[data-testid^="confirm-delete-storage-button-"]').click()
    await expect(page.getByTestId('storage-in-use-alert')).toContainText(plan.name)
    await expect(storages.row(used.name)).toBeVisible()
  })
})

test.describe('Backup plans as a plain user', () => {
  test('sees no plans menu and is refused on the pages', async ({ page }) => {
    await loginAs(page, 'user')
    const shell = new AppShell(page)
    const list = new PlansPage(page)

    await shell.goto('/')
    await expect(shell.navItem('dashboard')).toBeVisible()
    await expect(shell.navItem('plans')).toHaveCount(0)

    for (const target of ['/plans', '/plans/new', '/plans/1/edit']) {
      await list.goto(target)
      await expect(list.forbidden).toBeVisible()
    }
  })
})

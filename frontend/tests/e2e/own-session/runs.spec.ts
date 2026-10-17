import fs from 'fs'
import os from 'os'
import path from 'path'
import { test, expect } from '@playwright/test'
import { assertTestDatabasePath } from '../helpers/db-helper'
import { dbHelper, loginAs } from '../helpers/test-helpers'
import { PlanEditorPage } from '../pages/PlanEditorPage'
import { PlansPage } from '../pages/PlansPage'

/** A run takes a moment and the list polls every few seconds. */
const RUN_TIMEOUT = 30_000

async function sqlitePlanToNewDirectory(label: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gogobackup-e2e-run-'))
  const stamp = Date.now()
  const storage = await dbHelper.createStorage(`E2E ${label} storage ${stamp}`, dir)
  const plan = await dbHelper.createSQLitePlan(`E2E ${label} ${stamp}`, storage.id, assertTestDatabasePath(process.env.TEST_DATABASE_PATH))
  return { dir, plan }
}

function archivesIn(dir: string): string[] {
  return (fs.readdirSync(dir, { recursive: true }) as string[]).filter((name) => name.endsWith('.db.gz'))
}

test.describe('Running backup plans', () => {
  test('Run now backs up the test database into the storage and the tag follows the run', async ({ page }) => {
    await loginAs(page, 'admin')
    const { dir, plan } = await sqlitePlanToNewDirectory('Run now')
    const list = new PlansPage(page)

    await list.gotoList()
    await expect(list.runStatus(plan.name)).toHaveAttribute('data-status', 'none')
    await list.runNow(plan.name)
    await expect(list.runStatus(plan.name)).toHaveAttribute('data-status', 'succeeded', { timeout: RUN_TIMEOUT })

    const archives = archivesIn(dir)
    expect(archives).toHaveLength(1)
    const archive = fs.readFileSync(path.join(dir, archives[0]))
    expect(archive.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))
  })

  test('a plan whose storage directory is gone shows its run as failed', async ({ page }) => {
    await loginAs(page, 'admin')
    const { dir, plan } = await sqlitePlanToNewDirectory('Broken')
    fs.rmSync(dir, { recursive: true, force: true })
    const list = new PlansPage(page)
    const editor = new PlanEditorPage(page)

    await list.gotoList()
    await list.edit(plan.name)
    await editor.runButton.click()
    await expect(editor.runStatus).toHaveAttribute('data-status', 'failed', { timeout: RUN_TIMEOUT })
    await expect(editor.runButton).toBeEnabled()

    await list.gotoList()
    await expect(list.runStatus(plan.name)).toHaveAttribute('data-status', 'failed')
  })
})

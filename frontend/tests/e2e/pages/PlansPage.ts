import { expect, type Locator } from '@playwright/test'
import { BasePage } from './BasePage'

export class PlansPage extends BasePage {
  get root(): Locator {
    return this.page.getByTestId('plans-page')
  }

  get table(): Locator {
    return this.page.getByTestId('plans-table')
  }

  get addButton(): Locator {
    return this.page.getByTestId('plans-add-button')
  }

  get forbidden(): Locator {
    return this.page.getByTestId('forbidden-result')
  }

  row(name: string): Locator {
    return this.table.locator('tr[data-row-key]').filter({ hasText: name })
  }

  schedule(name: string): Locator {
    return this.row(name).locator('[data-testid^="plan-schedule-"]')
  }

  nextRun(name: string): Locator {
    return this.row(name).locator('[data-testid^="plan-next-run-"]')
  }

  /** The status tag of the latest run; its `data-status` is queued, running, succeeded, failed or none. */
  runStatus(name: string): Locator {
    return this.row(name).locator('[data-testid^="plan-run-status-"]')
  }

  async runNow(name: string): Promise<void> {
    await this.row(name).locator('[data-testid^="run-plan-button-"]').click()
  }

  async gotoList(): Promise<void> {
    await this.goto('/plans')
    await expect(this.root).toBeVisible()
  }

  async clickAdd(): Promise<void> {
    await this.addButton.click()
    await expect(this.page.getByTestId('plan-editor-page')).toBeVisible()
  }

  async edit(name: string): Promise<void> {
    await this.row(name).locator('[data-testid^="edit-plan-button-"]').click()
    await expect(this.page.getByTestId('plan-editor-page')).toBeVisible()
  }

  async delete(name: string): Promise<void> {
    await this.row(name).locator('[data-testid^="delete-plan-button-"]').click()
    await this.page.locator('[data-testid^="confirm-delete-plan-button-"]').click()
    await expect(this.row(name)).toHaveCount(0)
  }
}

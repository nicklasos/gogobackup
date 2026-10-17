import { expect, type Locator } from '@playwright/test'
import { BasePage } from './BasePage'

export type PlanTab = 'runs' | 'archives' | 'storages'

export class PlanPage extends BasePage {
  get root(): Locator {
    return this.page.getByTestId('plan-page')
  }

  /** The plan's health tag; `data-health` carries the value. */
  get health(): Locator {
    return this.page.getByTestId('plan-health')
  }

  get runButton(): Locator {
    return this.page.getByTestId('plan-run-button')
  }

  get editButton(): Locator {
    return this.page.getByTestId('plan-edit-button')
  }

  get enabledToggle(): Locator {
    return this.page.getByTestId('plan-enabled-toggle')
  }

  get scheduleSummary(): Locator {
    return this.page.getByTestId('plan-schedule-summary')
  }

  get nextRun(): Locator {
    return this.page.getByTestId('plan-next-run')
  }

  get chartBars(): Locator {
    return this.page.locator('[data-testid^="plan-runs-chart-bar-"]')
  }

  get runRows(): Locator {
    return this.page.getByTestId('plan-runs-table').locator('tr[data-row-key]')
  }

  get drawer(): Locator {
    return this.page.getByTestId('run-drawer')
  }

  get drawerStatus(): Locator {
    return this.page.getByTestId('run-drawer-status')
  }

  get log(): Locator {
    return this.page.getByTestId('run-log')
  }

  get runError(): Locator {
    return this.page.getByTestId('run-error')
  }

  get archiveRows(): Locator {
    return this.page.getByTestId('plan-archives-table').locator('tr[data-row-key]')
  }

  runRow(runId: number): Locator {
    return this.page.getByTestId('plan-runs-table').locator(`tr[data-row-key="${runId}"]`)
  }

  downloadButton(archiveId: number): Locator {
    return this.page.getByTestId(`archive-download-button-${archiveId}`)
  }

  archiveBrowseLink(archiveId: number): Locator {
    return this.page.getByTestId(`archive-browse-link-${archiveId}`)
  }

  storageBrowseLink(storageId: number): Locator {
    return this.page.getByTestId(`plan-storage-browse-${storageId}`)
  }

  async gotoPlan(planId: number): Promise<void> {
    await this.goto(`/plans/${planId}`)
    await expect(this.root).toBeVisible()
  }

  async openTab(tab: PlanTab): Promise<void> {
    await this.page.getByTestId(`plan-tab-${tab}`).click()
  }
}

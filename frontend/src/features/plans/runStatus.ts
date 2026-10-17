import type { LastRun, Plan, RunStatus } from './types'

/** Tag colours: grey while waiting, blue while it runs, then green or red. */
export const RUN_STATUS_COLOR: Record<RunStatus, string> = {
  queued: 'default',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
}

/** How often a page asks again while a run it shows is queued or running. */
export const RUN_POLL_MS = 3000

export function isRunActive(run: LastRun | null | undefined): boolean {
  return run?.status === 'queued' || run?.status === 'running'
}

/** Whether any plan on the page has a run in progress, which is when the page polls. */
export function anyRunActive(plans: readonly Plan[] | undefined): boolean {
  return (plans ?? []).some((plan) => isRunActive(plan.last_run))
}

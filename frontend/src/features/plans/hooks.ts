import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/api/queryKeys'
import type { ID, PageParams } from '@/api/types'
import { startDownload } from '@/shared/utils/download'
import { downloadUrl, plansApi, STORAGE_CHOICES } from './api'
import { lastRunOf, withRunQueued } from './health'
import { anyRunActive, dashboardPollMs, isRunActive, LOG_POLL_MS, RUN_POLL_MS } from './runStatus'
import type { Dashboard, Plan, PlanRequest, SourceRequest } from './types'

export function useDashboard() {
  return useQuery({
    queryKey: qk.plans.dashboard,
    queryFn: () => plansApi.dashboard(),
    refetchInterval: (query) => dashboardPollMs(query.state.data),
  })
}

export function usePlan(id: ID | undefined) {
  return useQuery({
    queryKey: qk.plans.detail(id ?? 0),
    queryFn: () => plansApi.get(id as ID),
    enabled: id != null,
    meta: { silent: true },
    refetchInterval: (query) => (isRunActive(query.state.data?.last_run) ? RUN_POLL_MS : false),
  })
}

/** Polls while a run on the page is queued or running, so its row follows it. */
export function usePlanRuns(id: ID, params: PageParams) {
  return useQuery({
    queryKey: qk.plans.runs(id, params),
    queryFn: () => plansApi.runs(id, params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (anyRunActive(query.state.data?.data) ? RUN_POLL_MS : false),
  })
}

/** The run with its log, followed every few seconds while it is queued or running. */
export function useRun(id: ID | undefined) {
  return useQuery({
    queryKey: qk.plans.run(id ?? 0),
    queryFn: () => plansApi.getRun(id as ID),
    enabled: id != null,
    refetchInterval: (query) => (isRunActive(query.state.data) ? LOG_POLL_MS : false),
  })
}

export function usePlanArchives(id: ID, params: PageParams, storageId?: ID) {
  return useQuery({
    queryKey: qk.plans.archives(id, params, storageId),
    queryFn: () => plansApi.archives(id, params, storageId),
    placeholderData: keepPreviousData,
  })
}

/**
 * The plan shows as running at once, on the dashboard and its page, which then poll fast until
 * the run ends. A 409 (a run already queued or running) shows the global error toast.
 */
export function useRunPlan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => plansApi.run(id),
    onSuccess: (run, id) => {
      client.setQueryData<Dashboard>(qk.plans.dashboard, (dashboard) => dashboard && withRunQueued(dashboard, id, run))
      client.setQueryData<Plan>(qk.plans.detail(id), (plan) => plan && { ...plan, health: 'running', last_run: lastRunOf(run) })
      client.invalidateQueries({ queryKey: qk.plans.runsOf(id) })
    },
  })
}

export function useSetPlanEnabled() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: ID; enabled: boolean }) => plansApi.setEnabled(id, enabled),
    onSuccess: (plan) => {
      client.setQueryData(qk.plans.detail(plan.id), plan)
      client.invalidateQueries({ queryKey: qk.plans.dashboard })
    },
  })
}

/**
 * The browser saves the archive itself, straight to disk, from a link that works for a minute:
 * a fetch would hold the whole archive in memory first.
 */
export function useDownloadArchive() {
  return useMutation({
    mutationFn: (archiveId: ID) => plansApi.downloadLink(archiveId),
    onSuccess: (link) => startDownload(downloadUrl(link)),
  })
}

/** Shares the storages list cache, so a storage added in another tab shows up after invalidation there. */
export function usePlanStorageChoices() {
  return useQuery({
    queryKey: qk.storages.list(STORAGE_CHOICES),
    queryFn: () => plansApi.storages(),
  })
}

/** Field errors are shown in the form, so the global error toast is silenced. */
export function useSavePlan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: ID; body: PlanRequest }) => (id ? plansApi.update(id, body) : plansApi.create(body)),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.plans.all }),
    meta: { silent: true },
  })
}

/** A source that cannot be reached is a result shown next to the button; only a rejected form is an error. */
export function useTestPlanSource() {
  return useMutation({
    mutationFn: ({ planId, body }: { planId?: ID; body: SourceRequest }) => plansApi.test(body, planId),
    meta: { silent: true },
  })
}

export function useDeletePlan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => plansApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.plans.all }),
  })
}

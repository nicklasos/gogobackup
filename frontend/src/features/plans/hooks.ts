import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/api/queryKeys'
import type { ID, PageParams } from '@/api/types'
import { plansApi, STORAGE_CHOICES } from './api'
import type { PlanRequest, SourceRequest } from './types'

export function usePlans(params: PageParams) {
  return useQuery({
    queryKey: qk.plans.list(params),
    queryFn: () => plansApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function usePlan(id: ID | undefined) {
  return useQuery({
    queryKey: qk.plans.detail(id ?? 0),
    queryFn: () => plansApi.get(id as ID),
    enabled: id != null,
    meta: { silent: true },
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

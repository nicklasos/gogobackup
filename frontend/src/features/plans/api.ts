import { api } from '@/api/client'
import type { InternalStoragesStorageResponse } from '@/api/schema'
import type { ID, MessageResponse, PageParams } from '@/api/types'
import type { Plan, PlanRequest, SourceRequest, SourceTestResult } from './types'

/** The storages a plan can upload to: the first page of them, which is all of them in practice. */
export const STORAGE_CHOICES: PageParams = { page: 1, page_size: 100 }

export const plansApi = {
  list: (params: PageParams) => api.getPage<Plan>('/plans', { query: params }),
  get: (id: ID) => api.get<Plan>(`/plans/${id}`),
  create: (body: PlanRequest) => api.post<Plan>('/plans', body),
  update: (id: ID, body: PlanRequest) => api.put<Plan>(`/plans/${id}`, body),
  remove: (id: ID) => api.del<MessageResponse>(`/plans/${id}`),
  /** Tests a form's source; on an edit form `planId` lets a blank password mean the stored one. */
  test: (body: SourceRequest, planId?: ID) => api.post<SourceTestResult>('/plans/test', body, { query: { plan_id: planId } }),
  storages: () => api.getPage<InternalStoragesStorageResponse>('/storages', { query: STORAGE_CHOICES }),
}

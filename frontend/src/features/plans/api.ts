import { API_BASE_URL, api } from '@/api/client'
import type { InternalStoragesStorageResponse } from '@/api/schema'
import type { ID, MessageResponse, PageParams } from '@/api/types'
import type { Archive, Dashboard, DownloadLink, Plan, PlanRequest, Run, RunDetail, SourceRequest, SourceTestResult } from './types'

/** The storages a plan can upload to: the first page of them, which is all of them in practice. */
export const STORAGE_CHOICES: PageParams = { page: 1, page_size: 100 }

export const plansApi = {
  dashboard: () => api.get<Dashboard>('/dashboard'),
  get: (id: ID) => api.get<Plan>(`/plans/${id}`),
  create: (body: PlanRequest) => api.post<Plan>('/plans', body),
  update: (id: ID, body: PlanRequest) => api.put<Plan>(`/plans/${id}`, body),
  setEnabled: (id: ID, enabled: boolean) => api.put<Plan>(`/plans/${id}/enabled`, { enabled }),
  remove: (id: ID) => api.del<MessageResponse>(`/plans/${id}`),
  /** Tests a form's source; on an edit form `planId` lets a blank password mean the stored one. */
  test: (body: SourceRequest, planId?: ID) => api.post<SourceTestResult>('/plans/test', body, { query: { plan_id: planId } }),
  /** Queues a backup now; a 409 `plans.run_in_progress` when one is queued or running already. */
  run: (id: ID) => api.post<Run>(`/plans/${id}/run`),
  runs: (id: ID, params: PageParams) => api.getPage<Run>(`/plans/${id}/runs`, { query: params }),
  getRun: (id: ID) => api.get<RunDetail>(`/runs/${id}`),
  archives: (id: ID, params: PageParams, storageId?: ID) =>
    api.getPage<Archive>(`/plans/${id}/archives`, { query: { ...params, storage_id: storageId } }),
  downloadLink: (archiveId: ID) => api.post<DownloadLink>(`/archives/${archiveId}/download-link`),
  storages: () => api.getPage<InternalStoragesStorageResponse>('/storages', { query: STORAGE_CHOICES }),
}

/** Where the browser downloads an archive with a link's token: no session needed. */
export const downloadUrl = (link: DownloadLink) => `${API_BASE_URL}/downloads/${encodeURIComponent(link.token)}`

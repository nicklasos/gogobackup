import type {
  InternalPlansDashboardPlanResponse,
  InternalPlansDashboardResponse,
  InternalPlansDayResponse,
  InternalPlansHealth,
  InternalPlansHealthSummaryResponse,
  InternalPlansLastRunResponse,
  InternalPlansPlanRequest,
  InternalPlansPlanResponse,
  InternalPlansSchedule,
  InternalPlansSourceKind,
  InternalPlansSourceRequest,
  InternalPlansSourceTestResponse,
  InternalPlansWeekday,
  InternalRunsArchiveResponse,
  InternalRunsDownloadLinkResponse,
  InternalRunsRunDetailResponse,
  InternalRunsRunResponse,
} from '@/api/schema'

export type Plan = InternalPlansPlanResponse
export type PlanRequest = InternalPlansPlanRequest
export type SourceRequest = InternalPlansSourceRequest
export type SourceKind = InternalPlansSourceKind
export type SourceTestResult = InternalPlansSourceTestResponse
export type Schedule = InternalPlansSchedule
export type Weekday = InternalPlansWeekday
export type LastRun = InternalPlansLastRunResponse
export type RunStatus = LastRun['status']
export type Run = InternalRunsRunResponse
export type RunDetail = InternalRunsRunDetailResponse
export type Archive = InternalRunsArchiveResponse
export type DownloadLink = InternalRunsDownloadLinkResponse
export type Health = InternalPlansHealth
export type HealthSummary = InternalPlansHealthSummaryResponse
export type Dashboard = InternalPlansDashboardResponse
export type DashboardPlan = InternalPlansDashboardPlanResponse
export type Day = InternalPlansDayResponse

export const SOURCE_KINDS: readonly SourceKind[] = ['postgres', 'mysql', 'sqlite', 'files']

/** Every day, in the order a schedule lists them. Index 0 is Monday. */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

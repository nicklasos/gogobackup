import type {
  InternalPlansPlanRequest,
  InternalPlansPlanResponse,
  InternalPlansSchedule,
  InternalPlansSourceKind,
  InternalPlansSourceRequest,
  InternalPlansSourceTestResponse,
  InternalPlansWeekday,
} from '@/api/schema'

export type Plan = InternalPlansPlanResponse
export type PlanRequest = InternalPlansPlanRequest
export type SourceRequest = InternalPlansSourceRequest
export type SourceKind = InternalPlansSourceKind
export type SourceTestResult = InternalPlansSourceTestResponse
export type Schedule = InternalPlansSchedule
export type Weekday = InternalPlansWeekday

export const SOURCE_KINDS: readonly SourceKind[] = ['postgres', 'mysql', 'sqlite', 'files']

/** Every day, in the order a schedule lists them. Index 0 is Monday. */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

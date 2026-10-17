package runs

import (
	"time"

	"app/internal/plans"
)

// Due is the scheduled slot a plan should run now, if any: the latest slot at or before now,
// when it is later than both the last slot already enqueued and the plan's creation. After
// downtime that is the latest missed slot, once, never one run per missed slot.
func Due(schedules []plans.Schedule, enabled bool, createdAt time.Time, lastScheduled *time.Time, now time.Time) (time.Time, bool) {
	if !enabled {
		return time.Time{}, false
	}
	slot, ok := plans.PrevRun(schedules, now)
	if !ok || !slot.After(createdAt) {
		return time.Time{}, false
	}
	if lastScheduled != nil && !slot.After(*lastScheduled) {
		return time.Time{}, false
	}
	return slot, true
}

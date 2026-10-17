// Package runs runs backup plans: it enqueues them on their schedules and by hand, dumps the
// source to every storage of the plan at once, keeps the log and the archives, and applies the
// plan's retention.
package runs

import (
	"context"
	"database/sql"
	"time"

	"app/internal/db"
)

// Status is where a run is in its life: queued, then running, then succeeded or failed. Each
// step is one conditional UPDATE on the current status, so a run moves forward once however
// many workers or processes try.
type Status string

const (
	StatusQueued    Status = "queued"
	StatusRunning   Status = "running"
	StatusSucceeded Status = "succeeded"
	StatusFailed    Status = "failed"
)

type Trigger string

const (
	TriggerSchedule Trigger = "schedule"
	TriggerManual   Trigger = "manual"
)

const (
	ErrInterruptedRestart = "interrupted: the service restarted"
	ErrInterruptedStop    = "interrupted: the service stopped"
)

// Claim moves a queued run to running. False when another worker claimed it first, or when
// another run of its plan is running: runs of one plan never overlap.
func Claim(ctx context.Context, q *db.Queries, id int64, at time.Time) (bool, error) {
	n, err := q.ClaimRun(ctx, db.ClaimRunParams{ID: id, StartedAt: sql.NullTime{Time: at.UTC(), Valid: true}})
	return n == 1, err
}

// Outcome is how a run ended. A nil Err is a success.
type Outcome struct {
	Err  error
	Size sql.NullInt64
	Log  string
}

// Finish moves a running run to succeeded or failed. False when it was not running, such as a
// run that recovery already failed.
func Finish(ctx context.Context, q *db.Queries, id int64, outcome Outcome, at time.Time) (bool, error) {
	params := db.FinishRunParams{
		ID:         id,
		Status:     string(StatusSucceeded),
		FinishedAt: sql.NullTime{Time: at.UTC(), Valid: true},
		SizeBytes:  outcome.Size,
		Log:        outcome.Log,
	}
	if outcome.Err != nil {
		params.Status = string(StatusFailed)
		params.Error = sql.NullString{String: outcome.Err.Error(), Valid: true}
	}
	n, err := q.FinishRun(ctx, params)
	return n == 1, err
}

// Recover fails every run left running by a process that ended without finishing it. Only one
// process runs the worker, so at its start no run can still be running anywhere.
func Recover(ctx context.Context, q *db.Queries, at time.Time) (int64, error) {
	return q.FailRunningRuns(ctx, db.FailRunningRunsParams{
		FinishedAt: sql.NullTime{Time: at.UTC(), Valid: true},
		Error:      sql.NullString{String: ErrInterruptedRestart, Valid: true},
	})
}

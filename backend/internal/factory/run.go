package factory

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"time"

	"app/internal/db"
	"app/internal/runs"
)

type runAttrs struct {
	trigger      runs.Trigger
	scheduledFor sql.NullTime
	status       runs.Status
	startedAt    sql.NullTime
	finishedAt   sql.NullTime
	errText      sql.NullString
}

type RunOption func(*runAttrs)

// WithRunStatus sets where the run is. Running and finished runs get a start time, finished
// ones an end time, and a failed one an error.
func WithRunStatus(status runs.Status) RunOption { return func(a *runAttrs) { a.status = status } }

// ScheduledFor makes it the scheduled run of a slot.
func ScheduledFor(slot time.Time) RunOption {
	return func(a *runAttrs) {
		a.trigger, a.scheduledFor = runs.TriggerSchedule, sql.NullTime{Time: slot.UTC(), Valid: true}
	}
}

// Run creates a run of the plan: a queued manual one unless options say otherwise.
func (f *Factory) Run(plan *db.Plan, opts ...RunOption) *db.Run {
	f.t.Helper()

	attrs := runAttrs{trigger: runs.TriggerManual, status: runs.StatusQueued}
	for _, opt := range opts {
		opt(&attrs)
	}
	now := sql.NullTime{Time: time.Now().UTC(), Valid: true}
	if attrs.status != runs.StatusQueued && !attrs.startedAt.Valid {
		attrs.startedAt = now
	}
	if (attrs.status == runs.StatusSucceeded || attrs.status == runs.StatusFailed) && !attrs.finishedAt.Valid {
		attrs.finishedAt = now
	}
	if attrs.status == runs.StatusFailed && !attrs.errText.Valid {
		attrs.errText = sql.NullString{String: "factory: failed", Valid: true}
	}

	var run db.Run
	err := f.conn.QueryRowContext(ctx,
		`INSERT INTO runs (plan_id, trigger, scheduled_for, status, started_at, finished_at, error)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 RETURNING id, plan_id, trigger, scheduled_for, status, started_at, finished_at, size_bytes, log, error, created_at`,
		plan.ID, string(attrs.trigger), attrs.scheduledFor, string(attrs.status), attrs.startedAt, attrs.finishedAt, attrs.errText,
	).Scan(&run.ID, &run.PlanID, &run.Trigger, &run.ScheduledFor, &run.Status, &run.StartedAt, &run.FinishedAt,
		&run.SizeBytes, &run.Log, &run.Error, &run.CreatedAt)
	if err != nil {
		f.t.Fatalf("factory.Run: %v", err)
	}
	return &run
}

type archiveAttrs struct {
	key       string
	content   []byte
	createdAt time.Time
}

type ArchiveOption func(*archiveAttrs)

// ArchiveKey is the object's key in the storage. The factory records the archive; it does not
// write the object.
func ArchiveKey(key string) ArchiveOption { return func(a *archiveAttrs) { a.key = key } }

// ArchiveContent sets size_bytes and sha256 to those of content.
func ArchiveContent(content []byte) ArchiveOption {
	return func(a *archiveAttrs) { a.content = content }
}

func ArchiveCreatedAt(at time.Time) ArchiveOption {
	return func(a *archiveAttrs) { a.createdAt = at.UTC() }
}

// Archive records an archive of the run on the storage, created now unless an option says otherwise.
func (f *Factory) Archive(run *db.Run, storage *db.Storage, opts ...ArchiveOption) *db.Archive {
	f.t.Helper()

	attrs := archiveAttrs{key: "factory/archive-" + unique() + ".tar.gz", createdAt: time.Now().UTC()}
	for _, opt := range opts {
		opt(&attrs)
	}
	sum := sha256.Sum256(attrs.content)

	var archive db.Archive
	err := f.conn.QueryRowContext(ctx,
		`INSERT INTO archives (run_id, plan_id, storage_id, object_key, size_bytes, sha256, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 RETURNING id, run_id, plan_id, storage_id, object_key, size_bytes, sha256, created_at, deleted_at`,
		run.ID, run.PlanID, storage.ID, attrs.key, len(attrs.content), hex.EncodeToString(sum[:]), attrs.createdAt,
	).Scan(&archive.ID, &archive.RunID, &archive.PlanID, &archive.StorageID, &archive.ObjectKey, &archive.SizeBytes,
		&archive.Sha256, &archive.CreatedAt, &archive.DeletedAt)
	if err != nil {
		f.t.Fatalf("factory.Archive: %v", err)
	}
	return &archive
}

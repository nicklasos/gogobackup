package factory

import (
	"encoding/json"
	"os"

	"app/internal/db"
	"app/internal/plans"
)

type planAttrs struct {
	name        string
	kind        plans.SourceKind
	config      any
	secret      any
	schedules   []plans.Schedule
	maxAgeDays  int64
	keepWeekly  int64
	keepMonthly int64
	storageIDs  []int64
	enabled     bool
}

type PlanOption func(*planAttrs)

func WithPlanName(name string) PlanOption { return func(a *planAttrs) { a.name = name } }

// FilesSource backs up paths on the server, the default kind (the system temp directory).
func FilesSource(paths ...string) PlanOption {
	return func(a *planAttrs) {
		a.kind, a.config, a.secret = plans.SourceFiles, plans.FilesConfig{Paths: paths, Excludes: []string{}}, nil
	}
}

func SQLiteSource(path string) PlanOption {
	return func(a *planAttrs) {
		a.kind, a.config, a.secret = plans.SourceSQLite, plans.SQLiteConfig{Path: path}, nil
	}
}

func PostgresSource(config plans.PostgresConfig, password string) PlanOption {
	return func(a *planAttrs) {
		a.kind, a.config, a.secret = plans.SourcePostgres, config, plans.DatabaseSecret{Password: password}
	}
}

func MySQLSource(config plans.MySQLConfig, password string) PlanOption {
	return func(a *planAttrs) {
		a.kind, a.config, a.secret = plans.SourceMySQL, config, plans.DatabaseSecret{Password: password}
	}
}

// WithSchedules replaces the default 03:00 every day; none makes a plan that only runs by hand.
func WithSchedules(schedules ...plans.Schedule) PlanOption {
	return func(a *planAttrs) { a.schedules = schedules }
}

func WithRetention(maxAgeDays, keepWeekly, keepMonthly int64) PlanOption {
	return func(a *planAttrs) { a.maxAgeDays, a.keepWeekly, a.keepMonthly = maxAgeDays, keepWeekly, keepMonthly }
}

// WithStorages sets where the plan uploads. Without it the factory creates a local storage.
func WithStorages(storages ...*db.Storage) PlanOption {
	return func(a *planAttrs) {
		a.storageIDs = nil
		for _, storage := range storages {
			a.storageIDs = append(a.storageIDs, storage.ID)
		}
	}
}

func Disabled() PlanOption { return func(a *planAttrs) { a.enabled = false } }

// Plan creates a backup plan: the temp directory as files, 03:00 every day, kept 30 days, to a
// new local storage, unless options say otherwise. A password is sealed with the factory's key.
func (f *Factory) Plan(opts ...PlanOption) *db.Plan {
	f.t.Helper()

	attrs := planAttrs{
		name:       "Plan " + unique(),
		schedules:  []plans.Schedule{{Time: 3 * 60, Days: []plans.Weekday{}}},
		maxAgeDays: 30,
		enabled:    true,
	}
	FilesSource(os.TempDir())(&attrs)
	for _, opt := range opts {
		opt(&attrs)
	}
	if attrs.storageIDs == nil {
		attrs.storageIDs = []int64{f.Storage().ID}
	}
	if attrs.schedules == nil {
		attrs.schedules = []plans.Schedule{}
	}

	config, err := json.Marshal(attrs.config)
	if err != nil {
		f.t.Fatalf("factory.Plan: %v", err)
	}
	schedules, err := json.Marshal(attrs.schedules)
	if err != nil {
		f.t.Fatalf("factory.Plan: %v", err)
	}
	var secret []byte
	if attrs.secret != nil {
		plain, err := json.Marshal(attrs.secret)
		if err != nil {
			f.t.Fatalf("factory.Plan: %v", err)
		}
		secret = f.secrets.Seal(plain)
	}

	var plan db.Plan
	err = f.conn.QueryRowContext(ctx,
		`INSERT INTO plans (name, source_kind, source_config, source_secret, schedules, max_age_days, keep_weekly, keep_monthly, enabled)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id, name, source_kind, source_config, source_secret, schedules, max_age_days, keep_weekly, keep_monthly, enabled, created_at, updated_at`,
		attrs.name, string(attrs.kind), string(config), secret, string(schedules),
		attrs.maxAgeDays, attrs.keepWeekly, attrs.keepMonthly, attrs.enabled,
	).Scan(&plan.ID, &plan.Name, &plan.SourceKind, &plan.SourceConfig, &plan.SourceSecret, &plan.Schedules,
		&plan.MaxAgeDays, &plan.KeepWeekly, &plan.KeepMonthly, &plan.Enabled, &plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		f.t.Fatalf("factory.Plan: %v", err)
	}
	for _, storageID := range attrs.storageIDs {
		var linked int64
		err := f.conn.QueryRowContext(ctx,
			`INSERT INTO plan_storages (plan_id, storage_id) VALUES (?, ?) RETURNING plan_id`, plan.ID, storageID,
		).Scan(&linked)
		if err != nil {
			f.t.Fatalf("factory.Plan: %v", err)
		}
	}
	return &plan
}

package runs

import (
	"context"
	"sync"
	"time"

	"app/config"
	"app/internal/db"
	"app/internal/logger"
	"app/internal/mail"
	"app/internal/plans"
	"app/internal/secretbox"
	"app/internal/storages"
	"app/internal/tools"
)

const (
	// pollInterval is how often the worker looks for queued runs it was not woken for: runs the
	// API queued while the worker lives in cmd/cron.
	pollInterval = 5 * time.Second
	// logFlushInterval is how often a running run's log is written, for a page that shows it live.
	logFlushInterval = 2 * time.Second
	// finishTimeout bounds the writes after a run, which go on after a stop has cancelled it.
	finishTimeout = 30 * time.Second
)

// Deps is what a worker needs. The API and cmd/cron fill it from their own setup.
type Deps struct {
	Config  *config.Config
	Queries *db.Queries
	Tx      *db.TxRunner
	Secrets *secretbox.Box
	Tools   tools.Finder
	Mail    mail.Sender
	Logger  *logger.Logger
}

// Worker runs queued runs, at most Config.RunnerConcurrency at once and never two of one plan.
// It lives in the process that runs the scheduler and starts and stops with it.
type Worker struct {
	queries     *db.Queries
	plans       *plans.PlanService
	storages    *storages.StorageService
	mail        mail.Sender
	logger      *logger.Logger
	concurrency int
	appName     string
	frontendURL string
	now         func() time.Time

	wake   chan struct{}
	cancel context.CancelFunc
	done   chan struct{}
}

func NewWorker(d Deps) *Worker {
	return &Worker{
		queries:     d.Queries,
		plans:       plans.NewPlanService(d.Queries, d.Tx, d.Secrets, d.Tools),
		storages:    storages.NewStorageService(d.Queries, d.Secrets),
		mail:        d.Mail,
		logger:      d.Logger,
		concurrency: max(d.Config.RunnerConcurrency, 1),
		appName:     d.Config.AppName,
		frontendURL: d.Config.FrontendURL,
		now:         time.Now,
		wake:        make(chan struct{}, 1),
	}
}

// Wake makes the worker look for queued runs now instead of at its next poll.
func (w *Worker) Wake() {
	select {
	case w.wake <- struct{}{}:
	default:
	}
}

// Start fails the runs a previous process left running, then runs queued runs until Stop.
func (w *Worker) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	if n, err := Recover(ctx, w.queries, w.now()); err != nil {
		cancel()
		return err
	} else if n > 0 {
		w.logger.Warn("Marked runs interrupted by a restart as failed", "runs", n)
	}
	w.cancel = cancel
	w.done = make(chan struct{})
	go w.loop(ctx)
	w.logger.Info("Runner started", "concurrency", w.concurrency)
	return nil
}

// Stop cancels the runs in progress, which kills their dump programs and fails them, and waits
// for them to be recorded.
func (w *Worker) Stop() {
	if w.cancel == nil {
		return
	}
	w.cancel()
	<-w.done
	w.logger.Info("Runner stopped")
}

func (w *Worker) loop(ctx context.Context) {
	defer close(w.done)
	slots := make(chan struct{}, w.concurrency)
	var running sync.WaitGroup
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		w.dispatch(ctx, slots, &running)
		select {
		case <-ctx.Done():
			running.Wait()
			return
		case <-w.wake:
		case <-ticker.C:
		}
	}
}

// dispatch starts queued runs while there are free slots.
func (w *Worker) dispatch(ctx context.Context, slots chan struct{}, running *sync.WaitGroup) {
	for {
		select {
		case slots <- struct{}{}:
		default:
			return
		}
		run, ok := w.claimNext(ctx)
		if !ok {
			<-slots
			return
		}
		running.Add(1)
		go func() {
			defer running.Done()
			w.execute(ctx, run)
			<-slots
			w.Wake()
		}()
	}
}

// Drain runs every queued run that can be claimed, one after another, and returns when none
// is left. Tests use it to drive the worker without timing.
func (w *Worker) Drain(ctx context.Context) {
	for {
		run, ok := w.claimNext(ctx)
		if !ok {
			return
		}
		w.execute(ctx, run)
	}
}

// claimNext claims the oldest queued run whose plan is not running, if there is one.
func (w *Worker) claimNext(ctx context.Context) (db.Run, bool) {
	if ctx.Err() != nil {
		return db.Run{}, false
	}
	candidates, err := w.queries.ListClaimableRuns(ctx, 10)
	if err != nil {
		w.logger.Error("Could not list queued runs", "error", err)
		return db.Run{}, false
	}
	for _, run := range candidates {
		ok, err := Claim(ctx, w.queries, run.ID, w.now())
		if err != nil {
			w.logger.Error("Could not claim a run", "run", run.ID, "error", err)
			return db.Run{}, false
		}
		if !ok {
			continue
		}
		claimed, err := w.queries.GetRunByID(ctx, run.ID)
		if err != nil {
			w.logger.Error("Could not load a claimed run", "run", run.ID, "error", err)
			return db.Run{}, false
		}
		return claimed, true
	}
	return db.Run{}, false
}

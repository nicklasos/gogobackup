# Gogobackup plan

Gogobackup replaces the backup shell scripts this repository started with by one service and a web page. You add storages and backup plans in the browser. The service runs each plan on its schedule, keeps the history, prunes old archives and restores them on request. It runs on the same server as the projects it backs up, so it has the dump tools and the network access those projects already have.

This file is the plan. Each phase is one pull request that ends with `make test` green.

## Phases

| # | Phase | Ends when |
|---|---|---|
| 1 | SQLite instead of PostgreSQL | `make test` passes with no Postgres anywhere: backend, E2E, CI, deploy |
| 2 | Subtract template weight | No Redis, uploads module gone, scheduler in the API by default |
| 3 | Storages | Local, S3 and GCS storages can be added, tested and browsed in the UI |
| 4 | Plans | A plan with a source, schedules and retention can be created and edited |
| 5 | Runner | Scheduled and manual runs produce archives, logs and pruning |
| 6 | Dashboard | Plan cards with status colour and run chart, plan page with runs and logs |
| 7 | Restore | Pick an archive, pick a target, watch the restore log |
| 8 | Self-deploy | `deploy/` installs Gogobackup and Gogobackup backs up its own database |

Phase 1 also removed the gopulse monitoring dashboard. Phase 2 comes before the features on purpose. The `uploads` module and Redis existed for the template, not for a backup service. Removing them first means phases 3 to 7 build on a smaller base. The scheduler runs inside the API by default; `ENABLE_SCHEDULER=false` (`scheduler_in_api: false` in deploy) moves it to the separate `cmd/cron` process. Phase 4 removed the `examples` demo module before adding plans; `internal/storages` is the reference module since. Phase 8 removed the shell scripts: every deploy runs `gogo-cli self-backup`, which makes sure the plan "Gogobackup itself" backs up the service's own database, instead of their cron job.

## Data model

Every row below is a table in SQLite. Kinds are closed sets, and each kind has its own typed config, stored as JSON and parsed at the API boundary.

**Storage.** `id`, `name`, `kind` (`local`, `s3`, `gcs`), `config` (bucket, region, prefix, endpoint, or a directory), `secret` (access keys or service-account JSON, encrypted with a key from `.env`).

**Plan.** `id`, `name` (`myproject-dev`), `source_kind` (`postgres`, `mysql`, `sqlite`, `files`), `source_config` (a database URL, or a list of paths and exclude patterns), `enabled`, and:

- `schedules`: a list, one entry per line in the form. Each entry is a time of day in UTC plus the days it applies to (every day, or chosen weekdays). "03:00 every day" and "18:00 every day" are two entries.
- `retention`: `max_age_days` (delete archives older than this), `keep_weekly` and `keep_monthly` (beyond `max_age_days`, keep the first archive of each of the last N weeks or months). Zero turns a rule off.
- `storages`: one or more storage ids. An archive is uploaded to each.

**Run.** `id`, `plan_id`, `trigger` (`schedule` or `manual`), `scheduled_for`, `status`, `started_at`, `finished_at`, `size_bytes`, `log`, `error`. Status is a state machine: `queued` to `running` to `succeeded` or `failed`, each step one conditional UPDATE. A unique key on `(plan_id, scheduled_for)` for scheduled runs stops a restart, or a second process, from queueing the same slot twice.

**Archive.** `id`, `run_id`, `plan_id`, `storage_id`, `object_key`, `size_bytes`, `sha256`, `created_at`, `deleted_at`. One row per storage that stored a run's archive. The retention rule reads this table, not the bucket listing, so pruning never touches objects Gogobackup did not create. Deleting a storage forgets its rows and leaves its objects.

**Restore.** `id`, `archive_id`, `target_config` (the plan's source by default, editable, for example to restore into `myproject_copy`), `status`, `log`.

## Code shape

- Sources are a registry: `map[SourceKind]source`, where a source can dump to an `io.Writer` and, from phase 7, restore from an `io.Reader`. Postgres uses `pg_dump -Fc` and `pg_restore`, MySQL uses `mysqldump` and `mysql`, SQLite uses `sqlite3 .backup`, files use tar. Adding a database type is one new entry.
- Storages are a registry too: `Put`, `Open`, `List`, `Delete` per kind.
- A dump streams from the tool through gzip and sha256 straight to every storage of the plan at once, one pipe per storage, with no temp file. A storage that fails is dropped and the others finish.
- Retention is a pure function: `Prune(archives, policy, now) (remove)`. It never removes the newest archive. It has table tests for the weekly and monthly rules, across month and year boundaries.
- The scheduler ticks once a minute, in the API process or in `cmd/cron`, finds the latest due slot of each plan, and inserts a `queued` run. A worker in the same process runs them, a few at once, and never two runs of one plan at once.
- A plan card is green when its last run succeeded, red when it failed, grey when it never ran, and amber when the last success is older than its schedule allows.

## Restore speed

A Postgres archive is restored with `pg_restore --jobs N`, which needs a seekable file. The restore therefore downloads the archive to a temp file first, then restores in parallel. MySQL and file restores stream.

## Open decisions

- Dump tools run on the host. `pg_dump` must be at least the server's major version, so the plan page shows the tool version and the server version side by side. Running the dump inside the database's Docker container is the alternative for projects that only exist in Docker.
- Failure alerts. The mail module already works, so phase 5 sends an email on a failed run. Telegram or Slack can come later.
- Users. The template has super admins, admins and users. A backup service probably needs one admin role. Phase 2 can drop the rest.

package runs

import (
	"database/sql"
	"net/http"
	"strconv"

	"app/internal"
	"app/internal/db"
	"app/internal/errs"
	"app/internal/middleware"
	"app/internal/storages"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *RunService
}

func NewHandler(service *RunService) *Handler {
	return &Handler{service: service}
}

func runResponse(run db.Run) RunResponse {
	response := RunResponse{
		ID:           run.ID,
		PlanID:       run.PlanID,
		Trigger:      Trigger(run.Trigger),
		Status:       Status(run.Status),
		ScheduledFor: internal.FormatOptionalTime(run.ScheduledFor),
		StartedAt:    internal.FormatOptionalTime(run.StartedAt),
		FinishedAt:   internal.FormatOptionalTime(run.FinishedAt),
		CreatedAt:    internal.FormatTime(run.CreatedAt),
	}
	if run.SizeBytes.Valid {
		response.SizeBytes = &run.SizeBytes.Int64
	}
	if run.Error.Valid {
		response.Error = &run.Error.String
	}
	return response
}

func archiveResponse(a db.Archive, storageName, storageKind string) ArchiveResponse {
	return ArchiveResponse{
		ID:          a.ID,
		RunID:       a.RunID,
		PlanID:      a.PlanID,
		StorageID:   a.StorageID,
		StorageName: storageName,
		StorageKind: storages.Kind(storageKind),
		ObjectKey:   a.ObjectKey,
		SizeBytes:   a.SizeBytes,
		SHA256:      a.Sha256,
		CreatedAt:   internal.FormatTime(sql.NullTime{Time: a.CreatedAt, Valid: true}),
		DeletedAt:   internal.FormatOptionalTime(a.DeletedAt),
	}
}

// RunPlan queues a run of a plan now
//
//	@Summary		Run a backup plan now
//	@Description	Queues a manual run, which the runner starts within seconds. A plan with a run queued or running already is a 409 plans.run_in_progress. Disabled plans can be run by hand. Admins only.
//	@Tags			runs
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		int	true	"Plan ID"
//	@Success		202	{object}	RunDataResponse
//	@Failure		400	{object}	errs.ErrorResponse
//	@Failure		401	{object}	errs.ErrorResponse
//	@Failure		403	{object}	errs.ErrorResponse
//	@Failure		404	{object}	errs.ErrorResponse
//	@Failure		409	{object}	errs.ErrorResponse
//	@Failure		500	{object}	errs.ErrorResponse
//	@Router			/api/v1/plans/{id}/run [post]
func (h *Handler) RunPlan(c *gin.Context) {
	id, ok := middleware.PathID(c, "id")
	if !ok {
		return
	}

	run, err := h.service.RunNow(c.Request.Context(), id)
	if err != nil {
		errs.RespondWithError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, RunDataResponse{Data: runResponse(*run)})
}

// ListRuns lists the runs of a plan, newest first
//
//	@Summary		List the runs of a plan (paginated)
//	@Description	Newest first, without logs. Admins only.
//	@Tags			runs
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id			path		int	true	"Plan ID"
//	@Param			page		query		int	false	"Page number (default: 1)"					default(1)
//	@Param			page_size	query		int	false	"Page size (default: 20, min: 1, max: 100)"	default(20)
//	@Success		200			{object}	PaginatedRunsResponse
//	@Failure		400			{object}	errs.ErrorResponse
//	@Failure		401			{object}	errs.ErrorResponse
//	@Failure		403			{object}	errs.ErrorResponse
//	@Failure		404			{object}	errs.ErrorResponse
//	@Failure		500			{object}	errs.ErrorResponse
//	@Router			/api/v1/plans/{id}/runs [get]
func (h *Handler) ListRuns(c *gin.Context) {
	id, ok := middleware.PathID(c, "id")
	if !ok {
		return
	}
	page, ok := middleware.Page(c)
	if !ok {
		return
	}

	result, err := h.service.ListRuns(c.Request.Context(), id, page.Page, page.PageSize)
	if err != nil {
		errs.RespondWithError(c, err)
		return
	}
	items := make([]RunResponse, len(result.Data))
	for i, row := range result.Data {
		items[i] = runResponse(db.Run(row))
	}
	c.JSON(http.StatusOK, PaginatedRunsResponse{
		Data:       items,
		Pagination: internal.NewPaginationMeta(result.Total, page.Page, page.PageSize),
	})
}

// GetRun retrieves a run with its log
//
//	@Summary		Get a run with its log
//	@Description	The log is written while the run goes on, every few seconds, so polling this shows it live. archives lists what the run stored, per storage. Admins only.
//	@Tags			runs
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		int	true	"Run ID"
//	@Success		200	{object}	RunDetailDataResponse
//	@Failure		400	{object}	errs.ErrorResponse
//	@Failure		401	{object}	errs.ErrorResponse
//	@Failure		403	{object}	errs.ErrorResponse
//	@Failure		404	{object}	errs.ErrorResponse
//	@Failure		500	{object}	errs.ErrorResponse
//	@Router			/api/v1/runs/{id} [get]
func (h *Handler) GetRun(c *gin.Context) {
	id, ok := middleware.PathID(c, "id")
	if !ok {
		return
	}

	run, err := h.service.GetRun(c.Request.Context(), id)
	if err != nil {
		errs.RespondWithError(c, err)
		return
	}
	archives := make([]ArchiveResponse, len(run.Archives))
	for i, row := range run.Archives {
		archives[i] = archiveResponse(row.Archive, row.StorageName, row.StorageKind)
	}
	c.JSON(http.StatusOK, RunDetailDataResponse{Data: RunDetailResponse{
		RunResponse: runResponse(run.Run),
		Log:         run.Log,
		Archives:    archives,
	}})
}

// ListArchives lists the archives of a plan that retention has not deleted
//
//	@Summary		List the archives of a plan (paginated)
//	@Description	Archives still kept, newest first, one entry per storage. storage_id narrows the list to one storage. Admins only.
//	@Tags			runs
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id			path		int	true	"Plan ID"
//	@Param			storage_id	query		int	false	"Only the archives on this storage"
//	@Param			page		query		int	false	"Page number (default: 1)"					default(1)
//	@Param			page_size	query		int	false	"Page size (default: 20, min: 1, max: 100)"	default(20)
//	@Success		200			{object}	PaginatedArchivesResponse
//	@Failure		400			{object}	errs.ErrorResponse
//	@Failure		401			{object}	errs.ErrorResponse
//	@Failure		403			{object}	errs.ErrorResponse
//	@Failure		404			{object}	errs.ErrorResponse
//	@Failure		500			{object}	errs.ErrorResponse
//	@Router			/api/v1/plans/{id}/archives [get]
func (h *Handler) ListArchives(c *gin.Context) {
	id, ok := middleware.PathID(c, "id")
	if !ok {
		return
	}
	page, ok := middleware.Page(c)
	if !ok {
		return
	}
	var storageID int64
	if raw := c.Query("storage_id"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || parsed <= 0 {
			errs.RespondWithError(c, errs.FieldError("storage_id", "invalid"))
			return
		}
		storageID = parsed
	}

	result, err := h.service.ListArchives(c.Request.Context(), id, storageID, page.Page, page.PageSize)
	if err != nil {
		errs.RespondWithError(c, err)
		return
	}
	items := make([]ArchiveResponse, len(result.Data))
	for i, row := range result.Data {
		items[i] = archiveResponse(row.Archive, row.StorageName, row.StorageKind)
	}
	c.JSON(http.StatusOK, PaginatedArchivesResponse{
		Data:       items,
		Pagination: internal.NewPaginationMeta(result.Total, page.Page, page.PageSize),
	})
}

package runs

import (
	"app/internal"
	"app/internal/middleware"
	"app/internal/storages"
)

func RegisterRoutes(app *internal.App) {
	service := NewRunService(app.Queries, app.Tx, app.WakeWorker)
	archives := NewArchiveService(app.Queries, storages.NewStorageService(app.Queries, app.Secrets), app.Secrets)
	handler := NewHandler(service, archives)

	admin := app.Api.Group("")
	admin.Use(app.AuthMiddleware, middleware.RequireRole(middleware.RoleAdmin))
	{
		admin.POST("/plans/:id/run", handler.RunPlan)
		admin.GET("/plans/:id/runs", handler.ListRuns)
		admin.GET("/plans/:id/archives", handler.ListArchives)
		admin.GET("/runs/:id", handler.GetRun)
		admin.GET("/archives/:id/download", handler.DownloadArchive)
		admin.POST("/archives/:id/download-link", handler.CreateDownloadLink)
	}

	// The token is the permission: a browser following a link sends no Authorization header.
	app.Api.GET("/downloads/:token", handler.DownloadByLink)
}

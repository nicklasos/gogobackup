package runs

import (
	"app/internal"
	"app/internal/middleware"
)

func RegisterRoutes(app *internal.App) {
	service := NewRunService(app.Queries, app.Tx, app.WakeWorker)
	handler := NewHandler(service)

	admin := app.Api.Group("")
	admin.Use(app.AuthMiddleware, middleware.RequireRole(middleware.RoleAdmin))
	{
		admin.POST("/plans/:id/run", handler.RunPlan)
		admin.GET("/plans/:id/runs", handler.ListRuns)
		admin.GET("/plans/:id/archives", handler.ListArchives)
		admin.GET("/runs/:id", handler.GetRun)
	}
}

# Error Handling Guide

Simple guide for using the `errs` package for consistent error handling.

## Quick Start

### 1. Define Errors in Services

```go
package storages

import "app/internal/errs"

var (
    ErrStorageNotFound = errs.NewNotFoundError(errs.ErrKeyStoragesNotFound, "Storage not found")
)
```

### 2. Return Errors from Services

```go
func (s *StorageService) GetStorage(ctx context.Context, id int64) (*db.Storage, error) {
    storage, err := s.queries.GetStorageByID(ctx, id)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, ErrStorageNotFound
    }
    if err != nil {
        return nil, errs.WrapDatabaseError(err)
    }
    return &storage, nil
}
```

### 3. Handle Errors in Handlers

```go
func (h *Handler) GetStorage(c *gin.Context) {
    storage, err := h.service.GetStorage(c.Request.Context(), id)
    if err != nil {
        errs.RespondWithError(c, err)
        return
    }
    h.respondStorage(c, storage)
}
```

## Error Types

```go
// Not Found (404)
errs.NewNotFoundError(key, message)

// Bad Request (400)
errs.NewBadRequestError(key, message)

// Unauthorized (401)
errs.NewUnauthorizedError(key, message)

// Forbidden (403)
errs.NewForbiddenError(key, message)

// Internal Error (500)
errs.NewInternalError(key, message)
```

## Error Keys

Add error keys in `internal/errs/keys.go`:

```go
const (
    ErrKeyStoragesNotFound = "storages.not_found"
)
```

Keys are grouped by module (`auth.*`, `users.*`, `storages.*`, `validation.*`). Clients translate them, so treat a key as part of the API contract.

| Key | Status | When |
|---|---|---|
| `storages.not_found` | 404 | No storage with this ID |
| `storages.name_taken` | 400, as a field error on `name` | Another storage has this name (case-insensitive) |
| `storages.invalid_prefix` | 400 | `?prefix=` of a listing climbs out with `..` or is absolute |
| `storages.unreachable` | 502 | Listing a storage failed; `details.reason` says why |

Validation failures have their own shape and always return 400:

```json
{
  "message": "The given data was invalid.",
  "error_key": "validation.failed",
  "errors": { "email": ["validation.email.required"] }
}
```

A service reports such a failure itself with `errs.Fields`, which `RespondWithError` answers in the same shape:

```go
return nil, errs.FieldError("local.path", "invalid")         // validation.local.path.invalid
return nil, errs.Fields{"name": {errs.ErrKeyStoragesNameTaken}}
```

A field inside a nested block is named by its path, `s3.bucket`, both from binding and from `errs.Fields`.

## Handler Helpers

```go
// Validation errors
errs.RespondWithValidationError(c, err)

// Quick responses
errs.RespondWithUnauthorized(c, "Unauthorized")
errs.RespondWithBadRequest(c, key, message)
```

## Wrapping Errors

```go
// Prefer WrapDatabaseError for sqlc errors (sql.ErrNoRows → 404, else 500)
if err != nil {
    return nil, errs.WrapDatabaseError(err)
}

// Or wrap with an explicit key/message
if err != nil {
    return nil, errs.WrapInternal(key, "Failed to create", err)
}

// Map unique constraint violations to stable domain errors
if domainErr := errs.DomainErrorFromUniqueViolation(err); domainErr != nil {
    return nil, ErrUserAlreadyExists
}
```

## Response Format

All errors return:

```json
{
  "error_key": "storages.not_found",
  "message": "Storage not found",
  "status": 404,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Reference

`internal/storages/storage_service.go` and `internal/storages/handler.go` use all of the above.

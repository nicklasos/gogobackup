# Gogo API Tests

Tests run against a real SQLite database. Each test gets its own freshly migrated database file in
`t.TempDir()`, removed when the test ends: the same idea as Laravel's `RefreshDatabase`. The schema is
migrated once per test binary and copied for each test, so this costs a file copy.

## Writing a test

Everything starts from `testkit.New(t)`. There is nothing to close and no context to pass around.

An API test (`tests/integration`):

```go
func TestExampleAPI_CreateExample(t *testing.T) {
    app := testkit.New(t)
    user := app.Create.User()

    app.As(user).POST("/api/v1/examples", example.CreateExampleRequest{Title: "Hello"}).
        AssertOK().
        AssertJSONPath("data.title", "Hello")

    app.POST("/api/v1/examples", example.CreateExampleRequest{Title: "Hello"}).AssertUnauthorized()
    app.As(user).POST("/api/v1/examples", `{}`).AssertInvalid("title")

    app.AssertDatabaseHas("examples", testkit.Row{"user_id": user.ID, "title": "Hello"})
}
```

A service test (`tests/unit`):

```go
func TestExampleService_GetExample(t *testing.T) {
    app := testkit.New(t)
    user := app.Create.User()
    record := app.Create.Example(user.ID)
    service := example.NewExampleService(app.Queries, nil)

    result, err := service.GetExample(app.Ctx, testkit.Actor(user), record.ID)

    require.NoError(t, err)
    assert.Equal(t, record.Title, result.Title)
}
```

## Cheat sheet

| Laravel | Here |
|---|---|
| `use RefreshDatabase` | `app := testkit.New(t)` |
| `User::factory()->create()` | `app.Create.User()` |
| `User::factory()->admin()->create(['email' => $e])` | `app.Create.User(factory.Admin(), factory.WithEmail(e))` |
| `$this->getJson($url)` | `app.GET("/api/v1/examples/%d", id)` |
| `$this->actingAs($user)->postJson($url, $data)` | `app.As(user).POST("/api/v1/examples", data)` |
| `->assertOk()`, `->assertForbidden()` | `.AssertOK()`, `.AssertForbidden()` |
| `->assertJsonPath('data.0.title', 'Hi')` | `.AssertJSONPath("data.0.title", "Hi")` |
| `->assertJsonCount(3, 'data')` | `.AssertJSONCount("data", 3)` |
| `->assertJsonValidationErrors(['title'])` | `.AssertInvalid("title")` |
| `$this->assertDatabaseHas('examples', [...])` | `app.AssertDatabaseHas("examples", testkit.Row{...})` |
| `Mail::fake()` / `Mail::assertSent` | `app.Mail.Sent()` |
| `config(['app.x' => false])` | `testkit.New(t, func(cfg *config.Config) { cfg.X = false })` |

### `app` (`tests/testkit/app.go`)

- `app.Create` — the factories, below
- `app.Ctx`, `app.Queries`, `app.DB` (`*sql.DB`, for raw SQL with `?` placeholders), `app.TxRunner`, `app.Config`, `app.Logger`, `app.Cache` — what a service constructor asks for
- `app.Mail.Sent()` — every email the application sent during the test
- `app.Token(user)`, `testkit.Actor(user)`, `testkit.JPEG`, `testkit.PDF`

### Requests (`tests/testkit/request.go`)

- `app.GET(path, args...)`, `app.DELETE(path, args...)`
- `app.POST(path, body, args...)`, `PUT`, `PATCH` — the body is a struct, a map or a string of raw JSON; `nil` sends none
- `app.As(user)` — the same verbs, logged in as the user
- `app.WithToken(token)`, `app.WithHeader(key, value)`

The path takes `fmt.Sprintf` arguments: `app.PUT("/api/v1/examples/%d", body, id)`.

### Response (`tests/testkit/response.go`)

Every `Assert` stops the test on failure, prints the response body, and returns the response so calls chain.

- `AssertOK()`, `AssertBadRequest()`, `AssertUnauthorized()`, `AssertForbidden()`, `AssertNotFound()`, `AssertTooManyRequests()`, `AssertStatus(code)`
- `AssertError(status, errs.ErrKeyX)` — status and `error_key`
- `AssertInvalid(fields...)` — validation failed, and each field has an error
- `AssertJSONPath(path, want)`, `AssertJSONCount(path, n)`, `AssertJSONMissing(path)`
- `JSON(&v)` decodes the body when you want the typed struct; `resp.StatusCode`, `resp.Body`, `resp.Header` are there too

### Database (`tests/testkit/database.go`)

- `app.AssertDatabaseHas(table, testkit.Row{...})`
- `app.AssertDatabaseMissing(table, testkit.Row{...})`
- `app.AssertDatabaseCount(table, n)` or `app.AssertDatabaseCount(table, n, testkit.Row{...})`

### Factories (`internal/factory`)

| Factory | Options |
|---|---|
| `app.Create.User()` | `WithEmail`, `WithName`, `WithPassword`, `WithRoles`, `Admin()`, `SuperAdmin()`, `Unverified()` |
| `app.Create.Example(userID)` | `WithTitle`, `WithDescription` |
| `app.Create.Examples(userID, count, prefix)` | |

A user has the password `factory.DefaultPassword`. Tests never write `INSERT` by hand: a new table gets a factory.

## Adding a factory

One file in `internal/factory`, copied from `example.go`:

```go
type orderAttrs struct {
    status string
}

type OrderOption func(*orderAttrs)

func WithStatus(status string) OrderOption { return func(a *orderAttrs) { a.status = status } }

func (f *Factory) Order(userID int64, opts ...OrderOption) *db.Order {
    f.t.Helper()

    attrs := orderAttrs{status: "new"}
    for _, opt := range opts {
        opt(&attrs)
    }

    var order db.Order
    err := f.conn.QueryRowContext(ctx,
        `INSERT INTO orders (user_id, status) VALUES (?, ?) RETURNING id, user_id, status, created_at`,
        userID, attrs.status,
    ).Scan(&order.ID, &order.UserID, &order.Status, &order.CreatedAt)
    if err != nil {
        f.t.Fatalf("factory.Order: %v", err)
    }
    return &order
}
```

## Things to know

- A failed statement (a unique violation, say) does not spoil the rest of the test: nothing is wrapped in a shared transaction.
- Raw SQL in a test writes timestamps with `CURRENT_TIMESTAMP` or `datetime('now', '-1 minute')`.
- The test server is the production engine and routes (`server.NewEngine`, `server.RegisterRoutes`) and starts on the first request.
- `tests/unit` holds service, policy and pure-logic tests; `tests/integration` holds HTTP tests. Both use the database.
- A helper used by one test file lives at the top of that file (see `newAuthService` in `tests/unit/auth_service_test.go`).

## Running Tests

Nothing to set up: no database server, no environment variables.

```bash
# Run all tests
make test

# Run only unit tests
make test-unit

# Run only integration tests
make test-integration

# Run with verbose output
make test-verbose

# Run specific test
go test -v ./tests/unit -run TestAuthService_Register
```

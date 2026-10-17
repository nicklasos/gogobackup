package integration

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"

	"app/internal/factory"
	"app/internal/plans"
	"app/internal/runs"
	"app/tests/testkit"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// serverURL is a database server for the tests that dump a real database, or a skip. The tests
// create a database of their own on it and drop it when they end.
func serverURL(t *testing.T, env string) *url.URL {
	t.Helper()
	raw := os.Getenv(env)
	if raw == "" {
		t.Skipf("%s is not set: set it to a server the test may create and drop databases on to dump a real database", env)
	}
	u, err := url.Parse(raw)
	require.NoError(t, err, env)
	return u
}

func throwawayName() string {
	b := make([]byte, 4)
	rand.Read(b)
	return "gogobackup_test_" + hex.EncodeToString(b)
}

func port(t *testing.T, u *url.URL, fallback int) int {
	t.Helper()
	if u.Port() == "" {
		return fallback
	}
	n, err := strconv.Atoi(u.Port())
	require.NoError(t, err)
	return n
}

func TestRuns_PostgresDump(t *testing.T) {
	server := serverURL(t, "TEST_POSTGRES_URL")
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, server.String())
	require.NoError(t, err)
	t.Cleanup(func() { admin.Close(context.Background()) })
	name := throwawayName()
	_, err = admin.Exec(ctx, "CREATE DATABASE "+name)
	require.NoError(t, err)
	t.Cleanup(func() { admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)") })

	target := *server
	target.Path = "/" + name
	conn, err := pgx.Connect(ctx, target.String())
	require.NoError(t, err)
	_, err = conn.Exec(ctx, "CREATE TABLE invoices (id serial PRIMARY KEY, customer text NOT NULL); INSERT INTO invoices (customer) VALUES ('Acme Corp'), ('Globex Ltd')")
	require.NoError(t, err)
	conn.Close(ctx)

	app := testkit.New(t)
	app.UseRealTool("pg_dump")
	user := app.Create.User(factory.Admin())
	password, _ := server.User.Password()
	sslMode := server.Query().Get("sslmode")
	if sslMode == "" {
		sslMode = "disable"
	}
	config := plans.PostgresConfig{Host: server.Hostname(), Port: port(t, server, 5432), User: server.User.Username(), Database: name, SSLMode: sslMode}
	dir := t.TempDir()
	plan := app.Create.Plan(factory.PostgresSource(config, password), factory.WithStorages(app.Create.Storage(factory.LocalStorage(dir))))

	run := runPlan(t, app, user, plan)

	require.Equal(t, runs.StatusSucceeded, run.Status, run.Log)
	require.Len(t, run.Archives, 1)
	archive := filepath.Join(dir, run.Archives[0].ObjectKey)
	assert.Regexp(t, `\.dump$`, archive)
	pgRestore, err := exec.LookPath("pg_restore")
	require.NoError(t, err, "pg_restore reads the archive back")
	list, err := exec.Command(pgRestore, "--list", archive).CombinedOutput()
	require.NoError(t, err, string(list))
	assert.Contains(t, string(list), "TABLE DATA public invoices")
	data, err := exec.Command(pgRestore, "--data-only", "--table=invoices", "--file=-", archive).CombinedOutput()
	require.NoError(t, err, string(data))
	assert.Contains(t, string(data), "Acme Corp")
	assert.Contains(t, string(data), "Globex Ltd")
	t.Logf("pg_dump archive %s, %d bytes; pg_restore --list:\n%s", run.Archives[0].ObjectKey, run.Archives[0].SizeBytes, list)
	t.Logf("run log:\n%s", run.Log)

	t.Run("an older pg_dump than the server fails clearly", func(t *testing.T) {
		real, err := app.Tools.Find(app.Ctx, "pg_dump")
		require.NoError(t, err)
		app.Tools.Install("pg_dump", real.Path, "pg_dump (PostgreSQL) 9.6.24")
		failed := runPlan(t, app, user, plan)

		require.Equal(t, runs.StatusFailed, failed.Status)
		assert.Contains(t, *failed.Error, "pg_dump 9 is older than the server")
	})
}

func TestRuns_MySQLDump(t *testing.T) {
	server := serverURL(t, "TEST_MYSQL_URL")
	password, _ := server.User.Password()
	cfg := mysql.NewConfig()
	cfg.User = server.User.Username()
	cfg.Passwd = password
	cfg.Net = "tcp"
	cfg.Addr = net.JoinHostPort(server.Hostname(), strconv.Itoa(port(t, server, 3306)))
	cfg.MultiStatements = true
	admin, err := sql.Open("mysql", cfg.FormatDSN())
	require.NoError(t, err)
	t.Cleanup(func() { admin.Close() })
	name := throwawayName()
	_, err = admin.Exec("CREATE DATABASE " + name)
	require.NoError(t, err)
	t.Cleanup(func() { admin.Exec("DROP DATABASE IF EXISTS " + name) })
	_, err = admin.Exec("CREATE TABLE " + name + ".orders (id INT AUTO_INCREMENT PRIMARY KEY, item VARCHAR(50), photo BLOB); " +
		"INSERT INTO " + name + ".orders (item, photo) VALUES ('Blue widget', x'00ff10'), ('Red gadget', NULL)")
	require.NoError(t, err)

	app := testkit.New(t)
	app.UseRealTool("mysqldump")
	user := app.Create.User(factory.Admin())
	config := plans.MySQLConfig{Host: server.Hostname(), Port: port(t, server, 3306), User: server.User.Username(), Database: name}
	dir := t.TempDir()
	plan := app.Create.Plan(factory.MySQLSource(config, password), factory.WithStorages(app.Create.Storage(factory.LocalStorage(dir))))

	run := runPlan(t, app, user, plan)

	require.Equal(t, runs.StatusSucceeded, run.Status, run.Log)
	require.Len(t, run.Archives, 1)
	data, err := os.ReadFile(filepath.Join(dir, run.Archives[0].ObjectKey))
	require.NoError(t, err)
	dump := string(gunzip(t, data))
	assert.Contains(t, dump, "CREATE TABLE `orders`")
	assert.Contains(t, dump, "INSERT INTO `orders`")
	assert.Contains(t, dump, "'Blue widget',0x00FF10")
	assert.Contains(t, dump, "'Red gadget',NULL")
	if password != "" {
		assert.NotContains(t, run.Log, password, "the password stays out of the log")
	}
	t.Logf("mysqldump archive %s, %d bytes compressed, %d bytes of SQL", run.Archives[0].ObjectKey, run.Archives[0].SizeBytes, len(dump))
	t.Logf("run log:\n%s", run.Log)
}

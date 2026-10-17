// Package tools finds the command-line programs backups run on this server (pg_dump,
// mysqldump, sqlite3) and reports their versions. The runner and the connection tests take
// a Finder, so tests swap in a Fake instead of depending on what is installed.
package tools

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// ErrNotFound is returned by Find when the program is not on PATH.
var ErrNotFound = errors.New("not found on PATH")

// Tool is a program found on this server. Version is the first line of `<name> --version`.
type Tool struct {
	Name    string
	Path    string
	Version string
}

type Finder interface {
	Find(ctx context.Context, name string) (Tool, error)
}

// versionTimeout bounds `--version`, so a program that hangs cannot hold a request open.
const versionTimeout = 5 * time.Second

// System looks programs up on the PATH of the API process.
type System struct{}

func (System) Find(ctx context.Context, name string) (Tool, error) {
	path, err := exec.LookPath(name)
	if err != nil {
		return Tool{Name: name}, ErrNotFound
	}

	ctx, cancel := context.WithTimeout(ctx, versionTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, path, "--version").Output()
	if err != nil {
		return Tool{Name: name, Path: path}, fmt.Errorf("%s --version: %w", name, err)
	}
	return Tool{Name: name, Path: path, Version: firstLine(out)}, nil
}

// Fake answers Find from a map of program name to `--version` output; a name it does not
// have is not installed.
type Fake struct {
	versions map[string]string
}

func NewFake(versions map[string]string) *Fake {
	fake := &Fake{versions: map[string]string{}}
	for name, version := range versions {
		fake.Set(name, version)
	}
	return fake
}

// Set installs a program with the given `--version` output.
func (f *Fake) Set(name, version string) { f.versions[name] = version }

// Remove uninstalls a program.
func (f *Fake) Remove(name string) { delete(f.versions, name) }

func (f *Fake) Find(_ context.Context, name string) (Tool, error) {
	version, ok := f.versions[name]
	if !ok {
		return Tool{Name: name}, ErrNotFound
	}
	return Tool{Name: name, Path: "/usr/bin/" + name, Version: version}, nil
}

func firstLine(out []byte) string {
	line, _, _ := bufio.NewReader(bytes.NewReader(out)).ReadLine()
	return strings.TrimSpace(string(line))
}

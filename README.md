# Gogobackup

Built from [Gogokit](https://github.com/nicklasos/gogokit): a Go API (`backend/`), a React admin panel
(`frontend/`), database backups (`backup/`) and Ansible deployment (`deploy/`).

## Run it locally

You need Go 1.25+, Node.js 22+, Docker (for a mail catcher) and Make.
The database is SQLite: a file under `backend/data/`, created on first run.

```bash
git clone git@github.com:nicklasos/gogobackup.git && cd gogobackup

# Backend
cd backend
cp .env.example .env
make sqlc-install air-install   # once: sqlc, air
make up                                         # a mail catcher in Docker
make migrate-up
make seed                                       # admin@example.com / password123, and sample data
make dev                                        # http://localhost:8181

# Frontend, in a second terminal
cd frontend
cp .env.example .env
npm install
npm run dev                                     # http://localhost:5173
```

Sign in at http://localhost:5173 with `admin@example.com` / `password123`.

| | |
|---|---|
| Admin panel | http://localhost:5173 |
| API documentation | http://localhost:8181/swagger/index.html |
| Caught emails | http://localhost:8025 |

Run every test with `make test` from the root.

## Deploy to a new server

A fresh Ubuntu 22.04 or 24.04 server, a domain pointing at it, and Ansible on your machine:

```bash
cd deploy
ansible-galaxy collection install -r requirements.yml
cp inventory/hosts.example.yml inventory/hosts.yml       # the server's address
cp secrets.example.yml group_vars/all/secrets.yml        # passwords: openssl rand -hex 32
$EDITOR group_vars/all/main.yml                          # app name, domain, repository, TLS mode
ansible-playbook provision.yml
```

That installs Go, Node.js, nginx, supervisor and the sqlite3 CLI, creates the directories
(the SQLite database lives in `shared/database/`), builds the API and the admin panel, obtains a
certificate, and schedules the backups. To release new code afterwards:

```bash
ansible-playbook deploy.yml                              # or, from the root: make deploy-remote
```

### A server that already runs other things

When Go, Node.js, nginx and supervisor are already there, `install.yml` adds only
this application: the checkout in `/var/www/<app>`, the two `.env` files, one supervisor program and
one nginx site. It installs no packages. The migrations create the SQLite database. Put `jwt_secret` in
`secrets.yml`, then:

```bash
ansible-playbook install.yml                             # or, from the root: make install-remote
```

Releases on such a server are run on it: `cd /var/www/<app> && make deploy` pulls, builds, migrates
and restarts the API. The same install as commands to type yourself is in
[deploy/MANUAL_INSTALL.md](deploy/MANUAL_INSTALL.md), with ready files in [deploy/examples](deploy/examples).

Everything about it, including the three TLS modes and what ends up where on the server, is in
[deploy/README.md](deploy/README.md).

> The playbooks pass Ansible's syntax check and the nginx configuration they generate is validated,
> but they have not been run against a real server yet. Do the first run on one you can throw away.

## More

- [backend/README.md](backend/README.md): API endpoints, configuration, patterns
- [frontend/README.md](frontend/README.md): structure, commands, conventions
- [backup/README.md](backup/README.md): storage backends, restore
- [deploy/README.md](deploy/README.md): provisioning and releasing
- [deploy/MANUAL_INSTALL.md](deploy/MANUAL_INSTALL.md): installing by hand on a server you already have
- [AGENTS.md](AGENTS.md): the guide for coding agents

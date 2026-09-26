# Access Provisioning & Audit Portal

An internal tool for managing user access levels, with an audit log of who changed
what and when.

## Tech Stack

- Express 5
- TypeScript
- PostgreSQL 16
- Vue 3
- Docker

## Quickstart

```bash
docker compose up         # start  
```

Open **http://localhost:8080**

**Note:** if you need to use a different port, create a `.env` at the project root with `WEB_PORT=` — see `.env.example`.

```bash
docker compose down       # stop
docker compose down -v    # stop and wipe the database
```

## Tests

From project root:
```bash
docker compose up -d postgres
cd backend && npm install && npm test
```

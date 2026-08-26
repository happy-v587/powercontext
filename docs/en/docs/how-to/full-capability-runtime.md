---
title: Full-capability Quick Start
description: Start all PowerContext capabilities in five minutes.
---

# Full-capability Quick Start

## Minimal versus full capability

`powercontext server run` starts a minimal Server without any configuration. It stays up and accepts Sources, but the
capabilities that need models stay off. The guided `config init` flow writes one `.env` that turns everything on:

| Capability | Default minimal server | Full-capability runtime |
| --- | --- | --- |
| Source capture | Enabled | Enabled |
| Memory extraction | Disabled; Sources stay pending | Enabled; Scheduler processes Sources every 60 s |
| Search modes | `auto, fts` only | `auto, fts, vector, hybrid` |
| Dashboard Scopes | None configured | `project:quickstart` visible |
| MCP endpoint | `/mcp` enabled | `/mcp` enabled |

Both modes use SQLite by default. Vector search additionally uses the bundled `sqlite-vec` extension; when the
Embedding model or its profile is not configured, the Server falls back to SQLite FTS and reports
`Search modes: auto, fts`. Recall still works through FTS, but semantic and hybrid search need the Embedding model.

## Choose the Scope ID first

The Scope ID is PowerContext's data namespace. Think of it as the project ID. Sources, Memories, and Handoffs belong to
a Scope; the Dashboard and Coding Agent must use the same Scope ID for Agent-written data to appear in the web UI.

A Server can store multiple Scopes. The Server configuration determines which Scopes the Dashboard can display, while
the Coding Agent configuration determines which Scope the current session reads and writes:

```text
Coding Agent ── read/write ──> project:quickstart <── display ── Dashboard
```

Use any short, stable, non-empty string. Do not include keys or other secrets. For example:

```text
project:quickstart
git:github.com/oceanbase/powercontext
team:payment-service
```

This Quick Start uses:

```text
project:quickstart
```

## Quick Start

### Part 1: Start the Server

#### 1. Install

```bash
uv tool install "powercontext[cli,server] @ git+https://github.com/oceanbase/powercontext.git@master"
```

#### 2. Generate the configuration

```bash
powercontext config init --output .env
```

When finished, the command prints setup and launch commands for Codex, Claude Code, DeepSeek Harness, OpenCode, and Pi.
The generated `.env` groups every setting you would otherwise assemble by hand: Server HTTP, Dashboard, Scope,
Generation model, Embedding model with profile ID and dimension, database kind and location, scheduler interval, and
per-host integration URLs. Inspect it any time with `powercontext config show --env-file .env`; credentials print as
`<redacted>`, and `powercontext config validate --env-file .env` checks the syntax and model settings.

#### 3. Start the Server

```bash
powercontext server run --env-file .env
```

#### 4. Verify the Server

Run this in a second terminal:

```bash
set -a
. ./.env
set +a
powercontext doctor
powercontext ready
powercontext capabilities
```

Confirm these results:

```text
package: ok - powercontext <version>
server liveness: ok - http://127.0.0.1:8000 status=ok
server readiness: ok - http://127.0.0.1:8000 status=ready
Status: ready
Memory extraction: enabled
Search modes: auto, fts, vector, hybrid
```

The full-capability runtime is ready when `doctor` reports all checks as `ok`, `Status: ready`,
`Memory extraction: enabled`, all four search modes are listed, and the Dashboard at
<http://127.0.0.1:8000/> contains `Quick Start`.

### Part 2: Verify the Memory loop

Extraction runs when Sources are flushed, so verify one full round trip before starting a Coding Agent. With the same
environment loaded, capture a Source:

```bash
curl -X POST http://127.0.0.1:8000/v1/sources/content \
  -H 'content-type: application/json' \
  -d '{"scope_id":"project:quickstart","source_id":"quickstart-1","content":"PowerContext quick start check: prefer small, verifiable steps."}'
```

The Server replies `202` with `"status":"accepted"`. Then flush the Scope, which runs Memory extraction:

```bash
curl -X POST http://127.0.0.1:8000/v1/memory/flush \
  -H 'content-type: application/json' \
  -d '{"scope_id":"project:quickstart"}'
```

Expect `"status":"processed"` and `"processed_source_count":1`. Confirm the inventory:

```bash
powercontext stats --scope-id project:quickstart
```

```text
Sources: 1 total, 1 memory processed, 0 memory pending
Memory entries: 1 total, 1 active, 0 inactive
```

At least one active Memory entry means Generation and Embedding both work end to end.

### Part 3: Start a Coding Agent

The Config Generator prints setup and launch commands for every supported Coding Agent. Open a new terminal, choose an
Agent, and copy the two commands under it. The first installs the PowerContext integration; the second loads the
generated `.env` and starts the Agent, so you do not need to enter the Scope ID again.

After the Coding Agent starts, send an ordinary prompt in the project. The integration first recalls relevant Memory
from `project:quickstart`, then saves the prompt as a Source. The Scheduler extracts Memory from new Sources within
about 60 seconds, so the flush from Part 2 is only needed once to prove the loop.

## Where data lives

The generated configuration leaves the database unset, so the Server stores data in the user data directory instead of
a project-local file. With `POWERCONTEXT_HOME` unset, SQLite keeps `powercontext.db` and the scheduler state in
`scheduler.db` under:

- macOS: `~/Library/Application Support/powercontext/`
- Linux: `~/.local/share/powercontext/`

Set `POWERCONTEXT_HOME` before starting the Server to relocate all of this. Changing the database URL later points the
Server at a different (possibly empty) database; keep the previous value if you need the old data.

## Stop and restart

Press `Ctrl+C` in the Server terminal to stop it. Data persists in SQLite across restarts. To resume, load the same
`.env` and run `powercontext server run --env-file .env` again; pending Sources are processed on the next Scheduler run
or flush.

## Quick troubleshooting

| Symptom | Action |
| --- | --- |
| Dashboard is empty | Compare the complete Dashboard and Agent Scope strings |
| `ready` is `degraded` | Check the Generation and Embedding models, keys, and Base URLs |
| No `vector` or `hybrid` search | Configure the Embedding model, profile ID, and dimension together; without them recall stays on FTS (`auto, fts`) |
| Sources remain pending | Enable the Scheduler or call `/v1/memory/flush` |
| Existing data is missing | Restore the previous database URL or `POWERCONTEXT_HOME` |

See [Troubleshooting](troubleshoot.md) for error states and [Configuration](../reference/configuration.md) for all
variables.

---
title: Full-capability Quick Start
description: Start all PowerContext capabilities in five minutes.
---

# Full-capability Quick Start

## Quick Start

### 1. Generate the configuration

```bash
powercontext config init --output .env
```

The short setup asks for the Scope ID, API protocol, Base URL, API key, and plain model names. It derives internal
provider adapters and environment-variable names automatically. Provider choices describe stable API contracts, not
cloud vendors: Alibaba Cloud Model Studio, a local vLLM service, and other OpenAI-compatible endpoints use the same
OpenAI-compatible path. Press Enter to accept the working SQLite defaults.
After writing `.env`, the command prints setup and launch commands for Codex, Claude Code, DeepSeek Harness,
OpenCode, and Pi. Choose one block; the wizard no longer asks for a single Coding Agent.

Inspect or validate the generated environment file:

```bash
powercontext config show --env-file .env
powercontext config validate --env-file .env
```

`show` always redacts credentials.

### 2. Start

```bash
powercontext server run --env-file .env
```

Keep this terminal running, then open <http://127.0.0.1:8000/>.

### 3. Verify

In a second terminal, run:

```bash
set -a
. ./.env
set +a

powercontext doctor
powercontext ready
powercontext capabilities
```

A successful full-capability start includes:

```text
Status: ready
database: ready
inference.embedding: ready
inference.generation: ready
Memory extraction: enabled
Search modes: auto, fts, vector, hybrid
```

The runtime is ready when the Dashboard shows the project scope and these checks agree.

## Verify Source-to-Memory processing

Replace `SCOPE_ID` with the exact value used in `.env`:

```bash
SCOPE_ID=git:github.com/your-org/your-repo

curl -fsS http://127.0.0.1:8000/v1/sources/content \
  -H 'Content-Type: application/json' \
  --data @- <<JSON
{"scope_id":"$SCOPE_ID","source_id":"full-runtime-check-1","content":"The project keeps its full runtime configuration in a local .env file."}
JSON

curl -fsS http://127.0.0.1:8000/v1/memory/flush \
  -H 'Content-Type: application/json' \
  --data "{\"scope_id\":\"$SCOPE_ID\"}"

powercontext stats --scope-id "$SCOPE_ID"
```

Capture returns HTTP `202`. After flush, `stats` should show the Source as processed. The extraction policy can decide
that no new Memory is warranted, so a processed Source without new Memory is valid. Use a new `source_id` when
repeating the test.

## What each setting enables

| Setting | Enabled capability | When missing |
| --- | --- | --- |
| Generation model | Source extraction and Experience, Skill, and Handoff generation | Sources are stored but not extracted |
| Embedding model/profile/dimension | Vector and hybrid search | FTS remains available |
| Schedule seconds | Background Source processing | Flush must be called manually |
| Dashboard scopes | Project entries in the web UI | Dashboard shows an empty state |
| MCP enabled/path | Agent MCP tools | HTTP API and Dashboard still run |

SQLite vector search uses `sqlite-vec` bundled with `powercontext[server]`; no extension path is required.

## Keep the Scope ID consistent

The Dashboard does not discover scopes automatically. It, HTTP requests, and Agent hosts must use the same exact
string:

| Host | Explicit override |
| --- | --- |
| Codex | `POWERCONTEXT_CODEX_SCOPE_ID` |
| Claude Code | `POWERCONTEXT_CLAUDE_SCOPE_ID` |
| DeepSeek Harness | `POWERCONTEXT_DSH_SCOPE_ID` |
| OpenCode | `POWERCONTEXT_OPENCODE_SCOPE_ID` |
| Pi | `POWERCONTEXT_PI_SCOPE_ID` |
| LangGraph | `POWERCONTEXT_LANGGRAPH_SCOPE_ID` |

Git workspaces normally derive the scope automatically. Set an override only when derived values differ, then restart
the Agent host.

## Database and security

Do not set `POWERCONTEXT_SERVER_DATABASE_URL` casually. When it is unset, the Server reuses the database in the
operating-system user data directory. A relative SQLite path changes with the startup directory and can accidentally
open an empty database.

Do not commit `.env`, API keys, tokens, or other secrets, and do not write secrets into Source or Memory. Press
`Ctrl-C` in the Server terminal to stop cleanly; the database and scheduler state remain persistent.

## Quick troubleshooting

| Symptom | Action |
| --- | --- |
| Dashboard is empty | Compare the complete Dashboard and Agent scope strings |
| `ready` is `degraded` | Check generation and embedding models, credentials, and Base URL |
| `vector` and `hybrid` are absent | Set the embedding model, profile ID, and correct dimension together |
| Sources remain pending | Enable the scheduler or call `/v1/memory/flush` |
| Existing data disappears | Restore the previous database URL or `POWERCONTEXT_HOME` |

See [Troubleshoot](troubleshoot.md) for error states and [Configuration](../reference/configuration.md) for all variables.

---
title: Full-capability Quick Start
description: Start all PowerContext capabilities in five minutes.
---

# Full-capability Quick Start

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
powercontext ready
powercontext capabilities
```

Confirm these three results:

```text
Status: ready
Memory extraction: enabled
Search modes: auto, fts, vector, hybrid
```

The full-capability runtime is ready when `Status: ready`, `Memory extraction: enabled`, all four search modes are
listed, and the Dashboard contains `Quick Start`.

### Part 2: Start a Coding Agent

The Config Generator prints setup and launch commands for every supported Coding Agent. Open a new terminal, choose an
Agent, and copy the two commands under it. The first installs the PowerContext integration; the second loads the
generated `.env` and starts the Agent, so you do not need to enter the Scope ID again.

After the Coding Agent starts, send an ordinary prompt in the project. The integration first recalls relevant Memory
from `project:quickstart`, then saves the prompt as a Source. The Scheduler attempts to extract Memory from that Source
within 60 seconds. Refresh the Dashboard to view the data in the same Scope.

## Quick troubleshooting

| Symptom | Action |
| --- | --- |
| Dashboard is empty | Compare the complete Dashboard and Agent Scope strings |
| `ready` is `degraded` | Check the Generation and Embedding models, keys, and Base URLs |
| No `vector` or `hybrid` search | Configure the Embedding model, profile ID, and dimension together |
| Sources remain pending | Enable the Scheduler or call `/v1/memory/flush` |
| Existing data is missing | Restore the previous database URL or `POWERCONTEXT_HOME` |

See [Troubleshooting](troubleshoot.md) for error states and [Configuration](../reference/configuration.md) for all
variables.

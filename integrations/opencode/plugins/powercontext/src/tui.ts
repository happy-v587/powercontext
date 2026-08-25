/*
 * Copyright (c) 2026 OceanBase.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from '@opencode-ai/plugin/tui'

import { PowerContextClient } from './client.ts'
import { PC_COMMAND_USAGE, handlePcCommand, type PcCommandResult, type PcCommandRuntime } from './commands.ts'
import { resolveConfig } from './config.ts'
import { PLUGIN_NAME } from './errors.ts'
import { deriveScopeId } from './scope.ts'

const COMMAND_NAME = 'powercontext.pc'

function currentDirectory(api: TuiPluginApi): string | undefined {
  const route = api.route.current
  if (
    route.name === 'session'
    && 'params' in route
    && route.params
    && typeof route.params.sessionID === 'string'
  ) return api.state.session.get(route.params.sessionID)?.directory
  return api.state.path.directory?.trim() || undefined
}

function showResult(api: TuiPluginApi, result: PcCommandResult): void {
  const DialogAlert = api.ui.DialogAlert
  api.ui.dialog.setSize('large')
  api.ui.dialog.replace(() => DialogAlert({
    title: result.kind === 'success' ? 'PowerContext' : 'PowerContext error',
    message: result.text,
    onConfirm: () => api.ui.dialog.clear(),
  }))
}

async function runCommand(api: TuiPluginApi, runtime: PcCommandRuntime, rawInput: string): Promise<void> {
  api.ui.dialog.clear()
  try {
    const cwd = currentDirectory(api)
    if (!cwd && !runtime.config.scopeId) {
      showResult(api, { kind: 'error', text: 'PowerContext could not resolve the current OpenCode project directory.' })
      return
    }
    const scopeId = await deriveScopeId(cwd ?? '', { configuredScopeId: runtime.config.scopeId })
    showResult(api, await handlePcCommand(rawInput, runtime, scopeId, api.lifecycle.signal))
  } catch {
    showResult(api, { kind: 'error', text: 'PowerContext is unavailable; continue normal work.' })
  }
}

function showCommandPrompt(api: TuiPluginApi, runtime: PcCommandRuntime): void {
  const DialogPrompt = api.ui.DialogPrompt
  api.ui.dialog.setSize('large')
  api.ui.dialog.replace(() => DialogPrompt({
    title: 'PowerContext /pc',
    placeholder: PC_COMMAND_USAGE,
    onConfirm: (value) => void runCommand(api, runtime, value),
    onCancel: () => api.ui.dialog.clear(),
  }))
}

export const PowerContextTuiPlugin: TuiPlugin = async (api) => {
  let config
  try {
    config = resolveConfig()
  } catch (error) {
    api.ui.toast({
      variant: 'error',
      title: 'PowerContext',
      message: `configuration rejected: ${String(error)}`,
    })
    return
  }
  const runtime: PcCommandRuntime = {
    config,
    client: new PowerContextClient({
      baseUrl: config.baseUrl,
      authorization: config.authorization,
      requestTimeoutMs: config.requestTimeoutMs,
    }),
  }
  api.keymap.registerLayer({
    commands: [{
      name: COMMAND_NAME,
      title: 'PowerContext command',
      category: 'PowerContext',
      namespace: 'palette',
      slashName: 'pc',
      slashAliases: ['powercontext'],
      run: () => showCommandPrompt(api, runtime),
    }],
  })
}

const plugin = { id: PLUGIN_NAME, tui: PowerContextTuiPlugin } satisfies TuiPluginModule
export default plugin

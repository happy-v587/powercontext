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
import { createElement, insert, setProp } from '@opentui/solid'
import { createSignal } from 'solid-js'

import { PowerContextClient } from './client.ts'
import { PC_COMMAND_USAGE, handlePcCommand, type PcCommandResult, type PcCommandRuntime } from './commands.ts'
import { resolveConfig } from './config.ts'
import { PLUGIN_NAME } from './errors.ts'
import { deriveScopeId } from './scope.ts'

const COMMAND_NAME = 'powercontext.pc'
const STATUS_REFRESH_MS = 30_000

type TokenTotals = {
  comparable_preparations: number
  baseline_tokens: number
  recalled_tokens: number
  token_reduction: number
}

function sessionDirectory(api: TuiPluginApi, sessionID?: string): string | undefined {
  if (sessionID) {
    const directory = api.state.session.get(sessionID)?.directory?.trim()
    if (directory) return directory
  }
  return api.state.path.directory?.trim() || undefined
}

function currentDirectory(api: TuiPluginApi): string | undefined {
  const route = api.route.current
  if (
    route.name === 'session'
    && 'params' in route
    && route.params
    && typeof route.params.sessionID === 'string'
  ) return sessionDirectory(api, route.params.sessionID)
  return sessionDirectory(api)
}

function compactTokens(value: number): string {
  const absolute = Math.abs(value)
  const format = (scaled: number, suffix: string) => {
    const digits = scaled < 10 ? 1 : 0
    return `${scaled.toFixed(digits).replace(/\.0$/, '')}${suffix}`
  }
  if (absolute >= 1_000_000) return format(value / 1_000_000, 'm')
  if (absolute >= 1_000) return format(value / 1_000, 'k')
  return String(value)
}

function tokenTotals(value: unknown): TokenTotals | undefined {
  if (!value || typeof value !== 'object') return undefined
  const recall = (value as { recall?: unknown }).recall
  if (!recall || typeof recall !== 'object') return undefined
  const totals = (recall as { totals?: unknown }).totals
  if (!totals || typeof totals !== 'object') return undefined
  const candidate = totals as Record<string, unknown>
  const comparable = candidate.comparable_preparations
  const baseline = candidate.baseline_tokens
  const recalled = candidate.recalled_tokens
  const reduction = candidate.token_reduction
  if (
    !Number.isInteger(comparable) || Number(comparable) < 0
    || !Number.isInteger(baseline) || Number(baseline) < 0
    || !Number.isInteger(recalled) || Number(recalled) < 0
    || !Number.isInteger(reduction)
  ) return undefined
  return {
    comparable_preparations: Number(comparable),
    baseline_tokens: Number(baseline),
    recalled_tokens: Number(recalled),
    token_reduction: Number(reduction),
  }
}

export function formatTokenSavings(value: unknown): string | undefined {
  const totals = tokenTotals(value)
  if (!totals) return undefined
  if (totals.comparable_preparations === 0 || totals.baseline_tokens === 0) {
    if (totals.token_reduction >= 0) return `PC saved ${compactTokens(totals.token_reduction)}`
    return `PC tokens +${compactTokens(Math.abs(totals.token_reduction))}`
  }
  const percent = Math.round((totals.token_reduction / totals.baseline_tokens) * 100)
  if (totals.token_reduction >= 0) {
    return `PC saved ${compactTokens(totals.token_reduction)} (${percent}%)`
  }
  return `PC tokens +${compactTokens(Math.abs(totals.token_reduction))} (${Math.abs(percent)}%)`
}

function tokenSavingsView(api: TuiPluginApi, runtime: PcCommandRuntime, sessionID: string): any {
  const [label, setLabel] = createSignal<string | undefined>('PC saved 0')
  const root = createElement('text')
  setProp(root, 'fg', api.theme.current.success)
  insert(root, () => label() ?? '')

  const refresh = async () => {
    const cwd = sessionDirectory(api, sessionID)
    if (!cwd && !runtime.config.scopeId) {
      setLabel('PC unavailable')
      return
    }
    try {
      const scopeId = await deriveScopeId(cwd ?? '', { configuredScopeId: runtime.config.scopeId })
      const result = await runtime.client.request('get_stats', { scope_id: scopeId }, api.lifecycle.signal)
      setLabel(formatTokenSavings(result.value))
    } catch {
      setLabel('PC offline')
    }
  }

  void refresh()
  const timer = setInterval(() => void refresh(), STATUS_REFRESH_MS)
  api.lifecycle.onDispose(() => clearInterval(timer))
  return root
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
  api.slots.register({
    order: 50,
    slots: {
      session_prompt_right(_context, props) {
        return tokenSavingsView(api, runtime, props.session_id)
      },
    },
  })
}

const plugin = { id: `${PLUGIN_NAME}-tui`, tui: PowerContextTuiPlugin } satisfies TuiPluginModule
export default plugin

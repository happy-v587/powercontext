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

import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatPowerContextStatus, PowerContextTuiPlugin, withTimeout } from '../src/tui.tsx'

afterEach(() => {
  delete process.env.POWERCONTEXT_OPENCODE_SCOPE_ID
  delete process.env.POWERCONTEXT_OPENCODE_BASE_URL
  vi.unstubAllGlobals()
})

describe('PowerContextTuiPlugin', () => {
  it('registers /pc and renders the DSH-compatible command result', async () => {
    process.env.POWERCONTEXT_OPENCODE_SCOPE_ID = 'project:test'
    const layers: any[] = []
    const slotPlugins: any[] = []
    let rendered: any
    const dialog = {
      replace: (render: () => unknown) => { rendered = render() },
      clear: () => { rendered = undefined },
      setSize: vi.fn(),
      size: 'medium',
      depth: 0,
      open: false,
    }
    const api = {
      keymap: {
        registerLayer: (layer: unknown) => {
          layers.push(layer)
          return () => undefined
        },
      },
      slots: {
        register: (plugin: unknown) => {
          slotPlugins.push(plugin)
          return 'powercontext-statusline'
        },
      },
      lifecycle: { signal: new AbortController().signal },
      route: { current: { name: 'session', params: { sessionID: 'session-1' } } },
      state: {
        path: { directory: '/tmp/startup' },
        session: { get: () => ({ directory: '/tmp/project' }) },
      },
      ui: {
        DialogPrompt: (props: unknown) => ({ kind: 'prompt', props }),
        DialogAlert: (props: unknown) => ({ kind: 'alert', props }),
        toast: vi.fn(),
        dialog,
      },
    } as any

    await PowerContextTuiPlugin(api, undefined, {} as any)

    const command = layers[0]?.commands[0]
    expect(command).toMatchObject({
      name: 'powercontext.pc',
      namespace: 'palette',
      slashName: 'pc',
      slashAliases: ['powercontext'],
    })
    expect(slotPlugins[0]?.slots.session_prompt_right).toBeTypeOf('function')
    command.run()
    expect(rendered.kind).toBe('prompt')
    rendered.props.onConfirm('')
    await vi.waitFor(() => expect(rendered.kind).toBe('alert'))
    expect(rendered.props.message).toContain('scope=project:test')
    expect(dialog.setSize).toHaveBeenCalledWith('large')
  })

  it('reports today and 30-day savings with honest cost wording', () => {
    const saved = {
      recall: {
        totals: {
          preparations: 5,
          ready_preparations: 4,
          comparable_preparations: 3,
          baseline_tokens: 3_000,
          recalled_tokens: 1_800,
          token_reduction: 1_200,
        },
      },
    }
    const cost = {
      recall: {
        totals: {
          preparations: 2,
          ready_preparations: 2,
          comparable_preparations: 1,
          baseline_tokens: 1_000,
          recalled_tokens: 1_250,
          token_reduction: -250,
        },
      },
    }
    expect(formatPowerContextStatus(saved, saved)).toBe('PC online · saved 1.2k today · saved 1.2k in 30d')
    expect(formatPowerContextStatus(cost, saved)).toBe('PC online · cost 250 today · saved 1.2k in 30d')
    expect(formatPowerContextStatus({}, {})).toBe('PC online · no data today · no data in 30d')
  })

  it('turns a stalled status request into an offline result', async () => {
    await expect(withTimeout(new Promise<never>(() => {}), 5)).rejects.toThrow('timed out')
    await expect(withTimeout(Promise.resolve('ok'), 5)).resolves.toBe('ok')
  })
})

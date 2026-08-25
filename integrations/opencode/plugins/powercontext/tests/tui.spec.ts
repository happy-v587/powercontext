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

import { PowerContextTuiPlugin } from '../src/tui.ts'

afterEach(() => {
  delete process.env.POWERCONTEXT_OPENCODE_SCOPE_ID
  delete process.env.POWERCONTEXT_OPENCODE_BASE_URL
  vi.unstubAllGlobals()
})

describe('PowerContextTuiPlugin', () => {
  it('registers /pc and renders the DSH-compatible command result', async () => {
    process.env.POWERCONTEXT_OPENCODE_SCOPE_ID = 'project:test'
    const layers: any[] = []
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
    command.run()
    expect(rendered.kind).toBe('prompt')
    rendered.props.onConfirm('')
    await vi.waitFor(() => expect(rendered.kind).toBe('alert'))
    expect(rendered.props.message).toContain('scope=project:test')
    expect(dialog.setSize).toHaveBeenCalledWith('large')
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'

describe('resolveConfig', () => {
  afterEach(() => {
    delete process.env.POWERCONTEXT_OPENCODE_BASE_URL
  })

  it('uses bounded fail-open defaults', () => {
    const config = resolveConfig({})
    expect(config.baseUrl).toBe('http://127.0.0.1:8000')
    expect(config.capturePrompts).toBe(true)
    expect(config.maxBytes).toBe(8000)
  })

  it('rejects cleartext non-loopback servers', () => {
    expect(() => resolveConfig({ POWERCONTEXT_OPENCODE_BASE_URL: 'http://example.com' })).toThrow(/HTTPS/)
  })

  it('rejects request timeouts larger than the shared budget', () => {
    expect(() => resolveConfig({
      POWERCONTEXT_OPENCODE_REQUEST_TIMEOUT_MS: '2000',
      POWERCONTEXT_OPENCODE_HTTP_BUDGET_MS: '1000',
    })).toThrow(/must not exceed/)
  })
})

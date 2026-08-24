import {
  InvalidResponseError,
  MAX_RESPONSE_BYTES,
  PLUGIN_USER_AGENT,
  REQUEST_ID_HEADER,
  ServerResponseError,
  UnavailableError,
  UnknownOperationError,
} from './errors.ts'
import { OPERATIONS, type OperationId, type OperationSpec } from './operations.generated.ts'

export type JsonObject = Record<string, unknown>
export type FetchFn = (input: string, init: RequestInit) => Promise<Response>
export type ClientSuccess = { kind: 'json'; value: unknown; status: number; requestId: string | undefined }

export interface ClientOptions {
  baseUrl: string
  authorization?: string
  requestTimeoutMs: number
  fetch?: FetchFn
}

export function combineSignals(signals: readonly AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0]!
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([...signals])
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(timeoutMs)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref()
  return controller.signal
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const declared = response.headers.get('content-length')
  if (declared && Number(declared) > MAX_RESPONSE_BYTES) throw new InvalidResponseError('/')
  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new InvalidResponseError('/')
  return buffer
}

function queryString(payload: JsonObject | undefined): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export class PowerContextClient {
  private readonly fetchImpl: FetchFn

  constructor(private readonly options: ClientOptions) {
    this.fetchImpl = options.fetch ?? fetch
  }

  async request(id: string, payload?: JsonObject, signal?: AbortSignal): Promise<ClientSuccess> {
    if (!(id in OPERATIONS)) throw new UnknownOperationError(id)
    const spec = OPERATIONS[id as OperationId]
    try {
      const response = await this.fetchImpl(this.url(spec, payload), this.init(spec, payload, signal))
      if (response.status >= 300 && response.status < 400) throw new InvalidResponseError(spec.path)
      const bytes = await readLimitedBody(response)
      const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined
      if (!response.ok) {
        let error: { error?: { code?: string; message?: string } } = {}
        try {
          error = JSON.parse(Buffer.from(bytes).toString('utf8'))
        } catch {}
        throw new ServerResponseError({
          statusCode: response.status,
          requestId,
          code: error.error?.code,
          message: error.error?.message,
        })
      }
      try {
        return { kind: 'json', value: JSON.parse(Buffer.from(bytes).toString('utf8')), status: response.status, requestId }
      } catch {
        throw new InvalidResponseError(spec.path, requestId)
      }
    } catch (error) {
      if (error instanceof ServerResponseError || error instanceof InvalidResponseError || error instanceof UnknownOperationError) {
        throw error
      }
      throw new UnavailableError(spec.path, error)
    }
  }

  private url(spec: OperationSpec, payload: JsonObject | undefined): string {
    const query = spec.location === 'query' ? queryString(payload) : ''
    return `${this.options.baseUrl.replace(/\/+$/, '')}${spec.path}${query}`
  }

  private init(spec: OperationSpec, payload: JsonObject | undefined, signal?: AbortSignal): RequestInit {
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': PLUGIN_USER_AGENT }
    if (this.options.authorization) headers.Authorization = this.options.authorization
    const signals = [createTimeoutSignal(this.options.requestTimeoutMs)]
    if (signal) signals.push(signal)
    const init: RequestInit = { method: spec.method, headers, redirect: 'manual', signal: combineSignals(signals) }
    if (spec.method === 'POST' && spec.location === 'body') {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(payload ?? {})
    }
    return init
  }
}

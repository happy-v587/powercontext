import { InvalidResponseError } from './errors.ts'

export const PREPARED_CONTEXT_SCHEMA = 'powercontext.prepared-context.v1'
const FIELDS = new Set(['schema', 'status', 'content', 'content_bytes'])

export interface PreparedContext {
  schema: typeof PREPARED_CONTEXT_SCHEMA
  status: 'ready' | 'empty'
  content: string | null
  content_bytes: number
}

export function validatePreparedContext(value: unknown, maxBytes: number): PreparedContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidResponseError('/v1/context/prepare')
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== FIELDS.size || Object.keys(record).some((key) => !FIELDS.has(key))) {
    throw new InvalidResponseError('/v1/context/prepare')
  }
  if (record.schema !== PREPARED_CONTEXT_SCHEMA) throw new InvalidResponseError('/v1/context/prepare')
  if (!Number.isInteger(record.content_bytes) || Number(record.content_bytes) < 0 || Number(record.content_bytes) > maxBytes) {
    throw new InvalidResponseError('/v1/context/prepare')
  }
  if (record.status === 'empty' && record.content === null && record.content_bytes === 0) {
    return { schema: PREPARED_CONTEXT_SCHEMA, status: 'empty', content: null, content_bytes: 0 }
  }
  if (
    record.status !== 'ready'
    || typeof record.content !== 'string'
    || Buffer.byteLength(record.content, 'utf8') !== record.content_bytes
  ) {
    throw new InvalidResponseError('/v1/context/prepare')
  }
  return {
    schema: PREPARED_CONTEXT_SCHEMA,
    status: 'ready',
    content: record.content,
    content_bytes: Number(record.content_bytes),
  }
}

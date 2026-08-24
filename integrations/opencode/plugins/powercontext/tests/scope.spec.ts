import { describe, expect, it } from 'vitest'
import { deriveScopeId, normalizeGitRemote } from '../src/scope.ts'

describe('scope', () => {
  it('normalizes HTTPS and SCP remotes identically', () => {
    expect(normalizeGitRemote('https://github.com/oceanbase/powercontext.git')).toBe('github.com/oceanbase/powercontext')
    expect(normalizeGitRemote('git@github.com:oceanbase/powercontext.git')).toBe('github.com/oceanbase/powercontext')
  })

  it('prefers an explicit scope', async () => {
    await expect(deriveScopeId('/tmp/project', { configuredScopeId: 'project:test' })).resolves.toBe('project:test')
  })

  it('derives a git scope from the project remote', async () => {
    const git = async (_cwd: string, args: string[]) => args.includes('--show-toplevel')
      ? '/tmp/project'
      : 'git@github.com:oceanbase/powercontext.git'
    await expect(deriveScopeId('/tmp/project/subdir', { git })).resolves.toBe('git:github.com/oceanbase/powercontext')
  })
})

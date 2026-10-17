import type { ID, PageParams } from './types'

/**
 * Query keys are hierarchical tuples, so invalidating a prefix (`qk.storages.all`)
 * invalidates every list and detail under it.
 */
export const qk = {
  storages: {
    all: ['storages'] as const,
    list: (params: PageParams) => ['storages', 'list', params] as const,
    detail: (id: ID) => ['storages', 'detail', id] as const,
    objects: (id: ID, prefix: string) => ['storages', 'objects', id, prefix] as const,
  },
  users: {
    all: ['users'] as const,
    list: (role: string, params: PageParams) => ['users', 'list', role, params] as const,
  },
}

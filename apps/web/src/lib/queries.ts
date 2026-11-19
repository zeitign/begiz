import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { VaultPreferences } from '@webs/shared'
import { api, responseBody, type VaultFolder } from './api'

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: () => responseBody(api.tags.$get()) })
}

export function useCollections() {
  return useQuery({ queryKey: ['collections'], queryFn: () => responseBody(api.collections.$get()) })
}

/** Any change to a web can affect the mosaic, the tags and the collection counters. */
export function useInvalidateAll() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['webs'] }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['collections'] }),
    ])
}

const VAULT_FOLDERS_KEY = ['vault', 'folders']
const VAULT_PREFERENCES_KEY = ['vault', 'preferences']

export function useVaultFolders() {
  return useQuery({ queryKey: VAULT_FOLDERS_KEY, queryFn: () => responseBody(api.vault.folders.$get()) })
}

/** Every link of the Vault at once: the search filters them as you type, without a request per letter. */
export function useVaultLinks() {
  return useQuery({ queryKey: ['vault', 'links'], queryFn: () => responseBody(api.vault.links.$get({ query: {} })) })
}

export function useInvalidateVault() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['vault'] })
}

/** The Vault order: random, by name, by date or by hand. Saved in the account. */
export function useVaultPreferences() {
  return useQuery({ queryKey: VAULT_PREFERENCES_KEY, queryFn: () => responseBody(api.vault.preferences.$get()) })
}

/** The grid follows the new order at once; if saving fails, it goes back to the saved one. */
export function useSaveVaultPreferences() {
  const queryClient = useQueryClient()
  return async (preferences: VaultPreferences) => {
    queryClient.setQueryData(VAULT_PREFERENCES_KEY, preferences)
    try {
      await responseBody(api.vault.preferences.$put({ json: preferences }))
    } finally {
      await queryClient.invalidateQueries({ queryKey: VAULT_PREFERENCES_KEY })
    }
  }
}

/** Tiles moved by hand stay where they were dropped while the cells are saved. */
export function usePlaceVaultTiles() {
  const queryClient = useQueryClient()
  return async (cells: { folderId: string; gridCell: number }[]) => {
    const cellByFolderId = new Map(cells.map((cell) => [cell.folderId, cell.gridCell]))
    queryClient.setQueryData<VaultFolder[]>(VAULT_FOLDERS_KEY, (folders) =>
      folders?.map((folder) => ({ ...folder, gridCell: cellByFolderId.get(folder.id) ?? folder.gridCell })),
    )
    try {
      await responseBody(api.vault.folders.grid.$put({ json: { cells } }))
    } finally {
      await queryClient.invalidateQueries({ queryKey: VAULT_FOLDERS_KEY })
    }
  }
}

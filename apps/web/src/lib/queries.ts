import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { api, call } from './api'

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: () => call(api.tags.$get()) })
}

export function useCollections() {
  return useQuery({ queryKey: ['collections'], queryFn: () => call(api.collections.$get()) })
}

/** Tras cualquier cambio en una web, el mosaico, los tags y los contadores pueden haber cambiado. */
export function useInvalidateAll() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['webs'] }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['collections'] }),
    ])
}

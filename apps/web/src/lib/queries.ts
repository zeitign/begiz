import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { api, responseBody } from './api'

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

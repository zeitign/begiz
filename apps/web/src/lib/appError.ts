import { ref } from 'vue'

/** Why the app cannot be used: the sign-in service, our API, or a bug in the front. */
export type AppErrorKind = 'sign-in' | 'server' | 'unexpected'

/** When set, the whole app is replaced by the error page until it is reloaded. */
export const appError = ref<AppErrorKind | null>(null)

/** The first error wins: the ones after it are usually its consequences. */
export function showAppError(kind: AppErrorKind) {
  appError.value ??= kind
}

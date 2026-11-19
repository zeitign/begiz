import { computed, ref, watchEffect } from 'vue'

/** Light and dark, and rose: the extra colour theme. */
export const themes = ['light', 'dark', 'rose'] as const
export type Theme = (typeof themes)[number]

const STORAGE_KEY = 'begiz-theme'

const isTheme = (value: unknown): value is Theme => themes.includes(value as Theme)

/** The theme chosen with the header button wins; until there is one, follow the system. */
function initialTheme(): Theme {
  const savedTheme = localStorage.getItem(STORAGE_KEY)
  if (isTheme(savedTheme)) return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const theme = ref<Theme>(initialTheme())

/** The header button goes through the themes in turn and shows the one it switches to. */
export const nextTheme = computed(() => themes[(themes.indexOf(theme.value) + 1) % themes.length]!)

watchEffect(() => {
  document.documentElement.dataset.theme = theme.value
})

export function toggleTheme() {
  theme.value = nextTheme.value
  localStorage.setItem(STORAGE_KEY, theme.value)
}

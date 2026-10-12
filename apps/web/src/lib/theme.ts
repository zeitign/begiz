import { ref, watchEffect } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'begiz-theme'

/** The theme chosen with the header button wins; until there is one, follow the system. */
function initialTheme(): Theme {
  const savedTheme = localStorage.getItem(STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const theme = ref<Theme>(initialTheme())

watchEffect(() => {
  document.documentElement.dataset.theme = theme.value
})

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, theme.value)
}

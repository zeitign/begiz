import { computed, ref, watchEffect } from 'vue'

/** Light, dark, and colour: a theme whose colour is picked at random from a palette. */
export const themes = ['light', 'dark', 'colour'] as const
export type Theme = (typeof themes)[number]

/** The colour theme's palette. Each one is defined in style.css under [data-colour]. */
export const themeColours = ['rose', 'mint', 'lilac', 'teal', 'yellow'] as const
export type ThemeColour = (typeof themeColours)[number]

const THEME_KEY = 'begiz-theme'
const COLOUR_KEY = 'begiz-theme-colour'

const isTheme = (value: unknown): value is Theme => themes.includes(value as Theme)
const isThemeColour = (value: unknown): value is ThemeColour => themeColours.includes(value as ThemeColour)

/** Any colour of the palette but the one shown, when there is another. */
function randomColour(current?: ThemeColour): ThemeColour {
  const others = themeColours.filter((candidate) => candidate !== current)
  const choices = others.length ? others : themeColours
  return choices[Math.floor(Math.random() * choices.length)]!
}

/** The theme chosen with the header button wins; until there is one, follow the system. */
function initialTheme(): Theme {
  const savedTheme = localStorage.getItem(THEME_KEY)
  if (isTheme(savedTheme)) return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialColour(): ThemeColour {
  const savedColour = localStorage.getItem(COLOUR_KEY)
  return isThemeColour(savedColour) ? savedColour : randomColour()
}

export const theme = ref<Theme>(initialTheme())
export const themeColour = ref<ThemeColour>(initialColour())

/** The header button goes through the themes in turn. */
export const nextTheme = computed(() => themes[(themes.indexOf(theme.value) + 1) % themes.length]!)

watchEffect(() => {
  document.documentElement.dataset.theme = theme.value
  document.documentElement.dataset.colour = themeColour.value
})

/** Each time the colour theme comes up, it takes a new colour from the palette. */
export function toggleTheme() {
  theme.value = nextTheme.value
  if (theme.value === 'colour') themeColour.value = randomColour(themeColour.value)
  localStorage.setItem(THEME_KEY, theme.value)
  localStorage.setItem(COLOUR_KEY, themeColour.value)
}

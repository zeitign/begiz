import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const TYPING_DELAY_MS = 75
const DELETING_DELAY_MS = 35
const FINISHED_PHRASE_DELAY_MS = 1800
const NEXT_PHRASE_DELAY_MS = 350
const PAUSED_CHECK_DELAY_MS = 200
const CURSOR_BLINK_MS = 500

/** Types and deletes the phrases one after another in random order, with a blinking `_` cursor. Paused, it shows nothing. */
export function useTypewriter(phrases: string[]) {
  const typedText = ref('')
  const isCursorVisible = ref(true)
  const isPaused = ref(false)

  let phraseIndex = Math.floor(Math.random() * phrases.length)
  let letterCount = 0
  let isDeleting = false
  let letterTimer: ReturnType<typeof setTimeout> | undefined
  let cursorTimer: ReturnType<typeof setInterval> | undefined

  function pickAnotherPhrase() {
    const offset = 1 + Math.floor(Math.random() * (phrases.length - 1))
    phraseIndex = (phraseIndex + offset) % phrases.length
  }

  function delayAfterLetter(phrase: string) {
    if (!isDeleting && letterCount === phrase.length) {
      isDeleting = true
      return FINISHED_PHRASE_DELAY_MS
    }
    if (isDeleting && letterCount === 0) {
      isDeleting = false
      pickAnotherPhrase()
      return NEXT_PHRASE_DELAY_MS
    }
    return isDeleting ? DELETING_DELAY_MS : TYPING_DELAY_MS
  }

  function writeNextLetter() {
    if (isPaused.value) {
      letterTimer = setTimeout(writeNextLetter, PAUSED_CHECK_DELAY_MS)
      return
    }
    const phrase = phrases[phraseIndex] ?? ''
    letterCount += isDeleting ? -1 : 1
    typedText.value = phrase.slice(0, letterCount)
    letterTimer = setTimeout(writeNextLetter, delayAfterLetter(phrase))
  }

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typedText.value = phrases[phraseIndex] ?? ''
      isCursorVisible.value = false
      return
    }
    letterTimer = setTimeout(writeNextLetter, NEXT_PHRASE_DELAY_MS)
    cursorTimer = setInterval(() => (isCursorVisible.value = !isCursorVisible.value), CURSOR_BLINK_MS)
  })

  onBeforeUnmount(() => {
    clearTimeout(letterTimer)
    clearInterval(cursorTimer)
  })

  const displayedText = computed(() => {
    if (isPaused.value) return ''
    return isCursorVisible.value ? `${typedText.value}_` : typedText.value
  })

  return {
    displayedText,
    pause: () => (isPaused.value = true),
    resume: () => (isPaused.value = false),
  }
}

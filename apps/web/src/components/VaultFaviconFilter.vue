<script setup lang="ts">
import { ref, watch } from 'vue'
import { theme, themeColour } from '../lib/theme'

// Favicons are drawn in the page's two colours: their dark parts in the text colour and their light parts
// in the background's, whatever the theme. An SVG filter does it (style.css applies it to the favicons):
// it turns each pixel into its lightness and then into one of the two colours. It reads the colours from
// the page, so it follows the theme's variables.
type Channels = [number, number, number]

const darkChannels = ref<Channels>([0, 0, 0])
const lightChannels = ref<Channels>([1, 1, 1])

/** "rgb(19, 19, 19)" → [0.07, 0.07, 0.07] */
const channelsOf = (cssColour: string): Channels => {
  const [red = 0, green = 0, blue = 0] = cssColour.match(/\d+(\.\d+)?/g)?.map(Number) ?? []
  return [red / 255, green / 255, blue / 255]
}

watch(
  [theme, themeColour],
  () => {
    const pageStyle = getComputedStyle(document.body)
    darkChannels.value = channelsOf(pageStyle.color)
    lightChannels.value = channelsOf(pageStyle.backgroundColor)
  },
  { immediate: true, flush: 'post' },
)

const tableFor = (channel: 0 | 1 | 2) => `${darkChannels.value[channel]} ${lightChannels.value[channel]}`
</script>

<template>
  <svg class="vault-favicon-filter" width="0" height="0" aria-hidden="true">
    <filter id="vault-favicon-duotone" color-interpolation-filters="sRGB">
      <feColorMatrix
        type="matrix"
        values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
      />
      <feComponentTransfer>
        <feFuncR type="discrete" :tableValues="tableFor(0)" />
        <feFuncG type="discrete" :tableValues="tableFor(1)" />
        <feFuncB type="discrete" :tableValues="tableFor(2)" />
      </feComponentTransfer>
    </filter>
  </svg>
</template>

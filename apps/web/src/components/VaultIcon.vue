<script setup lang="ts">
// The icon font is only loaded with the Vault: the mosaic never downloads it.
import '@phosphor-icons/web/fill/style.css'

defineProps<{ name: string }>()
</script>

<template>
  <i class="ph-fill vault-icon" :class="`ph-${name}`" aria-hidden="true"></i>
</template>

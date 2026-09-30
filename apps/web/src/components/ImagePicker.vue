<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const model = defineModel<File | null>({ required: true })

const previewUrl = ref<string | null>(null)
const dragging = ref(false)

watch(
  model,
  (file) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = file ? URL.createObjectURL(file) : null
  },
  { immediate: true },
)

function pick(files: FileList | null | undefined) {
  const image = [...(files ?? [])].find((file) => file.type.startsWith('image/'))
  if (image) model.value = image
  return Boolean(image)
}

// Pegar con Ctrl+V en cualquier parte de la página, no solo sobre la caja.
function onPaste(event: ClipboardEvent) {
  if (pick(event.clipboardData?.files)) event.preventDefault()
}

function onDrop(event: DragEvent) {
  dragging.value = false
  pick(event.dataTransfer?.files)
}

onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div
    class="dropzone stack"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <template v-if="previewUrl">
      <img :src="previewUrl" alt="Imagen seleccionada" style="max-height: 240px; margin: 0 auto" />
      <div class="row" style="justify-content: center">
        <button type="button" @click="model = null">Quitar imagen</button>
      </div>
    </template>
    <template v-else>
      <span>Pega una captura (Ctrl+V), arrástrala aquí o</span>
      <label style="align-items: center">
        <input type="file" accept="image/*" @change="pick(($event.target as HTMLInputElement).files)" />
      </label>
    </template>
  </div>
</template>

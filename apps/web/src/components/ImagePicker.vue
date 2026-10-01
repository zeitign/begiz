<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const selectedImage = defineModel<File | null>({ required: true })

const previewUrl = ref<string | null>(null)
const isDraggingOver = ref(false)

watch(
  selectedImage,
  (image) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = image ? URL.createObjectURL(image) : null
  },
  { immediate: true },
)

function selectFirstImage(files: FileList | null | undefined) {
  const image = [...(files ?? [])].find((file) => file.type.startsWith('image/'))
  if (image) selectedImage.value = image
  return Boolean(image)
}

// Pasting with Ctrl+V works anywhere on the page, not only over the drop zone.
function onPaste(event: ClipboardEvent) {
  if (selectFirstImage(event.clipboardData?.files)) event.preventDefault()
}

function onDrop(event: DragEvent) {
  isDraggingOver.value = false
  selectFirstImage(event.dataTransfer?.files)
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
    :class="{ dragging: isDraggingOver }"
    @dragover.prevent="isDraggingOver = true"
    @dragleave="isDraggingOver = false"
    @drop.prevent="onDrop"
  >
    <template v-if="previewUrl">
      <img :src="previewUrl" alt="Selected image" style="max-height: 240px; margin: 0 auto" />
      <div class="row" style="justify-content: center">
        <button type="button" @click="selectedImage = null">Remove image</button>
      </div>
    </template>
    <template v-else>
      <span>Paste a screenshot (Ctrl+V), drag it here or</span>
      <label style="align-items: center">
        <input type="file" accept="image/*" @change="selectFirstImage(($event.target as HTMLInputElement).files)" />
      </label>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CollectionPicker from '../components/CollectionPicker.vue'
import ImagePicker from '../components/ImagePicker.vue'
import TagInput from '../components/TagInput.vue'
import { api, call, errorMessage } from '../lib/api'
import { useInvalidateAll } from '../lib/queries'

const router = useRouter()
const invalidateAll = useInvalidateAll()

const url = ref('')
const title = ref('')
const notes = ref('')
const tags = ref<string[]>([])
const collectionIds = ref<string[]>([])
const image = ref<File | null>(null)

const saving = ref(false)
const error = ref('')

async function save() {
  saving.value = true
  error.value = ''
  try {
    const web = await call(
      api.webs.$post({
        json: {
          url: url.value.trim(),
          title: title.value,
          notes: notes.value,
          tags: tags.value,
          collectionIds: collectionIds.value,
          // Con imagen propia no hace falta descargar la de la página.
          usePageImage: !image.value,
        },
      }),
    )
    if (image.value) {
      await call(api.webs[':id'].preview.$put({ param: { id: web.id }, form: { image: image.value } }))
    }
    await invalidateAll()
    await router.push({ name: 'web', params: { id: web.id } })
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="page narrow">
    <form class="stack" @submit.prevent="save">
      <h1>Guardar web</h1>
      <label>
        Enlace
        <input v-model="url" type="url" placeholder="https://…" required />
      </label>
      <label>
        Título
        <input v-model="title" required maxlength="200" />
      </label>
      <label>
        Notas
        <textarea v-model="notes" placeholder="¿Qué te interesa de esta web?" />
      </label>
      <div class="stack">
        <span>Tags</span>
        <TagInput v-model="tags" />
      </div>
      <CollectionPicker v-model="collectionIds" />
      <div class="stack">
        <span>Imagen (opcional)</span>
        <span class="muted">Si no subes ninguna, se usa la imagen de vista previa de la propia página.</span>
        <ImagePicker v-model="image" />
      </div>
      <button type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CollectionPicker from '../components/CollectionPicker.vue'
import ImagePicker from '../components/ImagePicker.vue'
import TagInput from '../components/TagInput.vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { useInvalidateAll } from '../lib/queries'

const router = useRouter()
const invalidateAll = useInvalidateAll()

const url = ref('')
const title = ref('')
const notes = ref('')
const tags = ref<string[]>([])
const collectionIds = ref<string[]>([])
const ownImage = ref<File | null>(null)

const saving = ref(false)
const saveError = ref('')

async function saveWeb() {
  saving.value = true
  saveError.value = ''
  try {
    const savedWeb = await responseBody(
      api.webs.$post({
        json: {
          url: url.value.trim(),
          title: title.value,
          notes: notes.value,
          tags: tags.value,
          collectionIds: collectionIds.value,
          usePageImage: !ownImage.value,
        },
      }),
    )
    if (ownImage.value) {
      await responseBody(
        api.webs[':id'].preview.$put({ param: { id: savedWeb.id }, form: { image: ownImage.value } }),
      )
    }
    await invalidateAll()
    await router.push({ name: 'web', params: { id: savedWeb.id } })
  } catch (error) {
    saveError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="page narrow">
    <form class="stack" @submit.prevent="saveWeb">
      <h1>Save web</h1>
      <label>
        URL
        <input v-model="url" type="url" placeholder="https://…" required />
      </label>
      <label>
        Title
        <input v-model="title" required maxlength="200" />
      </label>
      <label>
        Notes
        <textarea v-model="notes" placeholder="What do you like about this web?" />
      </label>
      <div class="stack">
        <span>Tags</span>
        <TagInput v-model="tags" />
      </div>
      <CollectionPicker v-model="collectionIds" />
      <div class="stack">
        <span>Image (optional)</span>
        <span class="muted">Without one, the page's own preview image is used.</span>
        <ImagePicker v-model="ownImage" />
      </div>
      <button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
      <p v-if="saveError" class="error">{{ saveError }}</p>
    </form>
  </main>
</template>

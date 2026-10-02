<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CollectionPicker from '../components/CollectionPicker.vue'
import ImagePicker from '../components/ImagePicker.vue'
import TagInput from '../components/TagInput.vue'
import WebThumb from '../components/WebThumb.vue'
import { api, errorMessage, responseBody, type WebDetail } from '../lib/api'
import { closeInfoWindow } from '../lib/infoWindows'
import { useInvalidateAll } from '../lib/queries'

const props = defineProps<{ id: string }>()

const router = useRouter()
const queryClient = useQueryClient()
const invalidateAll = useInvalidateAll()

const queryKey = computed(() => ['web', props.id])
const { data: web, isPending, error: loadError } = useQuery({
  queryKey,
  queryFn: () => responseBody(api.webs[':id'].$get({ param: { id: props.id } })),
})

const form = reactive({
  url: '',
  title: '',
  notes: '',
  tags: [] as string[],
  collectionIds: [] as string[],
})

watch(
  web,
  (loadedWeb) => {
    if (!loadedWeb) return
    Object.assign(form, {
      url: loadedWeb.url,
      title: loadedWeb.title,
      notes: loadedWeb.notes,
      tags: [...loadedWeb.tags],
      collectionIds: [...loadedWeb.collectionIds],
    })
  },
  { immediate: true },
)

const saving = ref(false)
const actionError = ref('')

async function runWebAction(action: () => Promise<WebDetail | undefined>) {
  saving.value = true
  actionError.value = ''
  try {
    const updatedWeb = await action()
    if (updatedWeb) queryClient.setQueryData(queryKey.value, updatedWeb)
    await invalidateAll()
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

const saveChanges = () =>
  runWebAction(() => responseBody(api.webs[':id'].$patch({ param: { id: props.id }, json: form })))

const newImage = ref<File | null>(null)
watch(newImage, (image) => {
  if (!image) return
  runWebAction(async () => {
    const updatedWeb = await responseBody(
      api.webs[':id'].preview.$put({ param: { id: props.id }, form: { image } }),
    )
    newImage.value = null
    return updatedWeb
  })
})

async function deleteWeb() {
  if (!confirm('Delete this web? This cannot be undone.')) return
  await runWebAction(async () => {
    await responseBody(api.webs[':id'].$delete({ param: { id: props.id } }))
    closeInfoWindow(props.id)
    queryClient.removeQueries({ queryKey: queryKey.value })
    await router.push({ name: 'home' })
    return undefined
  })
}

const imageSourceLabel = computed(() => {
  if (web.value?.previewSource === 'manual') return 'Uploaded image'
  if (web.value?.previewSource === 'og') return "Page's preview image"
  return 'No image'
})
</script>

<template>
  <main class="page">
    <p v-if="loadError" class="error">{{ loadError.message }}</p>
    <p v-else-if="isPending">Loading…</p>

    <div v-else-if="web" class="row" style="align-items: flex-start; gap: 24px">
      <section class="stack grow" style="min-width: 300px; flex-basis: 55%">
        <div class="detail-image">
          <img v-if="web.fullUrl ?? web.previewUrl" :src="(web.fullUrl ?? web.previewUrl)!" alt="" />
          <WebThumb v-else :web="web" />
        </div>
        <span class="muted">{{ imageSourceLabel }}</span>
        <div class="stack">
          <span>Change image</span>
          <ImagePicker v-model="newImage" />
        </div>
      </section>

      <form class="stack grow" style="min-width: 280px; flex-basis: 35%" @submit.prevent="saveChanges">
        <div class="row">
          <a :href="web.url" target="_blank" rel="noopener noreferrer">Open web ↗</a>
          <span v-if="web.siteTitle" class="muted">{{ web.siteTitle }}</span>
        </div>
        <label>
          Title
          <input v-model="form.title" required maxlength="200" />
        </label>
        <label>
          URL
          <input v-model="form.url" type="url" required />
        </label>
        <label>
          Notes
          <textarea v-model="form.notes" />
        </label>
        <div class="stack">
          <span>Tags</span>
          <TagInput v-model="form.tags" />
        </div>
        <CollectionPicker v-model="form.collectionIds" />
        <div class="row">
          <button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</button>
          <span class="grow" />
          <button type="button" :disabled="saving" @click="deleteWeb">Delete web</button>
        </div>
        <p v-if="actionError" class="error">{{ actionError }}</p>
      </form>
    </div>
  </main>
</template>

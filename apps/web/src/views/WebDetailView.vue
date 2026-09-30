<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CollectionPicker from '../components/CollectionPicker.vue'
import ImagePicker from '../components/ImagePicker.vue'
import TagInput from '../components/TagInput.vue'
import WebThumb from '../components/WebThumb.vue'
import { api, call, errorMessage, type WebDetail } from '../lib/api'
import { useInvalidateAll } from '../lib/queries'

const props = defineProps<{ id: string }>()

const router = useRouter()
const queryClient = useQueryClient()
const invalidateAll = useInvalidateAll()

const queryKey = computed(() => ['web', props.id])
const { data: web, isPending, error: loadError } = useQuery({
  queryKey,
  queryFn: () => call(api.webs[':id'].$get({ param: { id: props.id } })),
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
  (value) => {
    if (!value) return
    Object.assign(form, {
      url: value.url,
      title: value.title,
      notes: value.notes,
      tags: [...value.tags],
      collectionIds: [...value.collectionIds],
    })
  },
  { immediate: true },
)

const saving = ref(false)
const error = ref('')

async function run(action: () => Promise<WebDetail | undefined>) {
  saving.value = true
  error.value = ''
  try {
    const updated = await action()
    if (updated) queryClient.setQueryData(queryKey.value, updated)
    await invalidateAll()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

const save = () => run(() => call(api.webs[':id'].$patch({ param: { id: props.id }, json: form })))

const newImage = ref<File | null>(null)
watch(newImage, (file) => {
  if (!file) return
  run(async () => {
    const updated = await call(api.webs[':id'].preview.$put({ param: { id: props.id }, form: { image: file } }))
    newImage.value = null
    return updated
  })
})

async function remove() {
  if (!confirm('¿Borrar esta web? No se puede deshacer.')) return
  await run(async () => {
    await call(api.webs[':id'].$delete({ param: { id: props.id } }))
    queryClient.removeQueries({ queryKey: queryKey.value })
    await router.push({ name: 'home' })
    return undefined
  })
}
</script>

<template>
  <main class="page">
    <p v-if="loadError" class="error">{{ loadError.message }}</p>
    <p v-else-if="isPending">Cargando…</p>

    <div v-else-if="web" class="row" style="align-items: flex-start; gap: 24px">
      <section class="stack grow" style="min-width: 300px; flex-basis: 55%">
        <div class="detail-image">
          <img v-if="web.fullUrl ?? web.previewUrl" :src="(web.fullUrl ?? web.previewUrl)!" alt="" />
          <WebThumb v-else :web="web" />
        </div>
        <span class="muted">
          {{ web.previewSource === 'manual' ? 'Imagen subida a mano' : web.previewSource === 'og' ? 'Imagen de vista previa de la página' : 'Sin imagen' }}
        </span>
        <div class="stack">
          <span>Cambiar imagen</span>
          <ImagePicker v-model="newImage" />
        </div>
      </section>

      <form class="stack grow" style="min-width: 280px; flex-basis: 35%" @submit.prevent="save">
        <div class="row">
          <a :href="web.url" target="_blank" rel="noopener noreferrer">Abrir web ↗</a>
          <span v-if="web.siteTitle" class="muted">{{ web.siteTitle }}</span>
        </div>
        <label>
          Título
          <input v-model="form.title" required maxlength="200" />
        </label>
        <label>
          Enlace
          <input v-model="form.url" type="url" required />
        </label>
        <label>
          Notas
          <textarea v-model="form.notes" />
        </label>
        <div class="stack">
          <span>Tags</span>
          <TagInput v-model="form.tags" />
        </div>
        <CollectionPicker v-model="form.collectionIds" />
        <div class="row">
          <button type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
          <span class="grow" />
          <button type="button" :disabled="saving" @click="remove">Borrar web</button>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </div>
  </main>
</template>

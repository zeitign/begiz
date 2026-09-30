<script setup lang="ts">
import { normalizeTag } from '@webs/shared'
import { computed, ref, useId } from 'vue'
import { useTags } from '../lib/queries'

const model = defineModel<string[]>({ required: true })

const draft = ref('')
const listId = useId()
const { data: allTags } = useTags()
const suggestions = computed(
  () => allTags.value?.map((tag) => tag.name).filter((name) => !model.value.includes(name)) ?? [],
)

function add() {
  const name = normalizeTag(draft.value.replace(/,/g, ''))
  if (name && !model.value.includes(name)) model.value = [...model.value, name]
  draft.value = ''
}

function remove(name: string) {
  model.value = model.value.filter((tag) => tag !== name)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    add()
  } else if (event.key === 'Backspace' && !draft.value && model.value.length) {
    model.value = model.value.slice(0, -1)
  }
}
</script>

<template>
  <div class="stack">
    <div class="row">
      <input
        v-model="draft"
        class="grow"
        :list="listId"
        placeholder="Escribe un tag y pulsa Enter"
        @keydown="onKeydown"
        @change="suggestions.includes(normalizeTag(draft)) && add()"
      />
      <button type="button" :disabled="!draft.trim()" @click="add">Añadir</button>
      <datalist :id="listId">
        <option v-for="name in suggestions" :key="name" :value="name" />
      </datalist>
    </div>
    <div v-if="model.length" class="row">
      <button v-for="tag in model" :key="tag" type="button" class="chip" title="Quitar" @click="remove(tag)">
        {{ tag }} ×
      </button>
    </div>
  </div>
</template>

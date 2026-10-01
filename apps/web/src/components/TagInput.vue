<script setup lang="ts">
import { normalizeTag } from '@webs/shared'
import { computed, ref, useId } from 'vue'
import { useTags } from '../lib/queries'

const selectedTags = defineModel<string[]>({ required: true })

const tagDraft = ref('')
const suggestionListId = useId()
const { data: existingTags } = useTags()
const suggestions = computed(
  () =>
    existingTags.value?.map((tag) => tag.name).filter((name) => !selectedTags.value.includes(name)) ?? [],
)

function addDraftTag() {
  const name = normalizeTag(tagDraft.value.replace(/,/g, ''))
  if (name && !selectedTags.value.includes(name)) selectedTags.value = [...selectedTags.value, name]
  tagDraft.value = ''
}

function removeTag(name: string) {
  selectedTags.value = selectedTags.value.filter((tag) => tag !== name)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addDraftTag()
  } else if (event.key === 'Backspace' && !tagDraft.value && selectedTags.value.length) {
    selectedTags.value = selectedTags.value.slice(0, -1)
  }
}
</script>

<template>
  <div class="stack">
    <div class="row">
      <input
        v-model="tagDraft"
        class="grow"
        :list="suggestionListId"
        placeholder="Type a tag and press Enter"
        @keydown="onKeydown"
        @change="suggestions.includes(normalizeTag(tagDraft)) && addDraftTag()"
      />
      <button type="button" :disabled="!tagDraft.trim()" @click="addDraftTag">Add</button>
      <datalist :id="suggestionListId">
        <option v-for="name in suggestions" :key="name" :value="name" />
      </datalist>
    </div>
    <div v-if="selectedTags.length" class="row">
      <button
        v-for="tag in selectedTags"
        :key="tag"
        type="button"
        class="chip"
        title="Remove"
        @click="removeTag(tag)"
      >
        {{ tag }} ×
      </button>
    </div>
  </div>
</template>

import { ref } from 'vue'
import { api, errorMessage, responseBody, type VaultLink } from './api'
import { useInvalidateVault } from './queries'

/** Editing a link's title and URL in place, and deleting it. Shared by the rows of the tiles and the list. */
export function useVaultLinkActions(link: () => VaultLink) {
  const invalidateVault = useInvalidateVault()
  const isEditing = ref(false)
  const isSaving = ref(false)
  const draftTitle = ref('')
  const draftUrl = ref('')
  const actionError = ref('')

  function startEditing() {
    draftTitle.value = link().title
    draftUrl.value = link().url
    actionError.value = ''
    isEditing.value = true
  }

  async function saveLink() {
    isSaving.value = true
    actionError.value = ''
    try {
      await responseBody(
        api.vault.links[':id'].$patch({
          param: { id: link().id },
          json: { title: draftTitle.value, url: draftUrl.value },
        }),
      )
      await invalidateVault()
      isEditing.value = false
    } catch (error) {
      actionError.value = errorMessage(error)
    } finally {
      isSaving.value = false
    }
  }

  async function deleteLink() {
    if (!confirm(`Delete “${link().title}”?`)) return
    actionError.value = ''
    try {
      await responseBody(api.vault.links[':id'].$delete({ param: { id: link().id } }))
      await invalidateVault()
    } catch (error) {
      actionError.value = errorMessage(error)
    }
  }

  return { isEditing, isSaving, draftTitle, draftUrl, actionError, startEditing, saveLink, deleteLink }
}

export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

import { beforeEach, describe, expect, it } from 'vitest'
import { createPngImage } from './fake-web.ts'
import { createUserClient, type UserClient } from './api-client.ts'

let owner: UserClient
let stranger: UserClient
let ownerWebId: string
let ownerCollectionId: string

beforeEach(async () => {
  owner = await createUserClient()
  stranger = await createUserClient()

  ownerCollectionId = (await (await owner.post('/collections', { name: 'Private' })).json()).id
  const ownerWeb = await owner.post('/webs', {
    url: 'https://example.com',
    title: 'Owner web',
    tags: ['secret'],
    collectionIds: [ownerCollectionId],
  })
  ownerWebId = (await ownerWeb.json()).id
})

describe('isolation between users', () => {
  it('hides the webs, tags and collections of other users', async () => {
    expect(await (await stranger.get('/webs')).json()).toEqual([])
    expect(await (await stranger.get('/tags')).json()).toEqual([])
    expect(await (await stranger.get('/collections')).json()).toEqual([])
    expect(await (await stranger.get(`/webs?collection=${ownerCollectionId}`)).json()).toEqual([])
  })

  it('does not let other users read, edit, replace the image of or delete a web', async () => {
    const image = new Blob([await createPngImage(100, 100)])

    expect((await stranger.get(`/webs/${ownerWebId}`)).status).toBe(404)
    expect((await stranger.patch(`/webs/${ownerWebId}`, { title: 'Hacked' })).status).toBe(404)
    expect((await stranger.uploadImage(`/webs/${ownerWebId}/preview`, image)).status).toBe(404)
    expect((await stranger.delete(`/webs/${ownerWebId}`)).status).toBe(404)

    const ownerView = await (await owner.get(`/webs/${ownerWebId}`)).json()
    expect(ownerView).toMatchObject({ title: 'Owner web', previewUrl: null })
  })

  it('does not let other users rename, delete or use a collection', async () => {
    const strangerWeb = await stranger.post('/webs', {
      url: 'https://example.com',
      title: 'Stranger web',
      collectionIds: [ownerCollectionId],
    })

    expect(strangerWeb.status).toBe(400)
    expect((await stranger.patch(`/collections/${ownerCollectionId}`, { name: 'Mine' })).status).toBe(404)
    expect((await stranger.delete(`/collections/${ownerCollectionId}`)).status).toBe(404)
    expect(await (await owner.get('/collections')).json()).toMatchObject([{ name: 'Private', webCount: 1 }])
  })

  it('keeps tags and collection names independent per user', async () => {
    const strangerCollection = await stranger.post('/collections', { name: 'Private' })
    const strangerWeb = await stranger.post('/webs', {
      url: 'https://example.com',
      title: 'Stranger web',
      tags: ['secret'],
    })

    expect(strangerCollection.status).toBe(201)
    expect(strangerWeb.status).toBe(201)
    expect(await (await owner.get('/tags')).json()).toEqual([{ name: 'secret', webCount: 1 }])
  })

  it('does not let other users see, change, move or use vault folders and links', async () => {
    const ownerCategory = await (await owner.post('/vault/folders', { name: 'Private' })).json()
    const ownerFolder = await (await owner.post('/vault/folders', { name: 'Secrets', parentId: ownerCategory.id })).json()
    const ownerLink = await (
      await owner.post('/vault/links', {
        url: 'https://example.com',
        title: 'Owner link',
        tags: ['secret'],
        folderId: ownerFolder.id,
      })
    ).json()
    const strangerCategory = await (await stranger.post('/vault/folders', { name: 'Mine' })).json()
    const strangerFolder = await (
      await stranger.post('/vault/folders', { name: 'Mine too', parentId: strangerCategory.id })
    ).json()

    expect(await (await stranger.get('/vault/folders')).json()).toMatchObject([{ name: 'Mine' }, { name: 'Mine too' }])
    expect(await (await stranger.get('/vault/links')).json()).toEqual([])
    expect(await (await stranger.get(`/vault/links?folder=${ownerFolder.id}`)).json()).toEqual([])
    expect(await (await stranger.get('/vault/tags')).json()).toEqual([])

    expect((await stranger.get(`/vault/links/${ownerLink.id}`)).status).toBe(404)
    expect((await stranger.patch(`/vault/links/${ownerLink.id}`, { title: 'Hacked' })).status).toBe(404)
    expect((await stranger.delete(`/vault/links/${ownerLink.id}`)).status).toBe(404)
    const strangerMove = await stranger.post('/vault/links/move', { linkIds: [ownerLink.id], folderId: strangerFolder.id })
    expect(strangerMove.status).toBe(404)

    expect((await stranger.patch(`/vault/folders/${ownerFolder.id}`, { name: 'Hacked' })).status).toBe(404)
    expect((await stranger.delete(`/vault/folders/${ownerFolder.id}`)).status).toBe(404)
    const strangerSubfolder = await stranger.post('/vault/folders', { name: 'Inside', parentId: ownerCategory.id })
    expect(strangerSubfolder.status).toBe(400)
    const strangerFolderMove = await stranger.patch(`/vault/folders/${strangerFolder.id}`, {
      parentId: ownerCategory.id,
    })
    expect(strangerFolderMove.status).toBe(400)
    const strangerLink = await stranger.post('/vault/links', {
      url: 'https://example.com',
      title: 'Stranger link',
      folderId: ownerFolder.id,
    })
    expect(strangerLink.status).toBe(400)

    expect(await (await owner.get(`/vault/links/${ownerLink.id}`)).json()).toMatchObject({
      title: 'Owner link',
      folderId: ownerFolder.id,
      tags: ['secret'],
    })
    expect(await (await owner.get('/vault/folders')).json()).toMatchObject([
      { name: 'Private', linkCount: 0 },
      { name: 'Secrets', linkCount: 1 },
    ])
  })
})

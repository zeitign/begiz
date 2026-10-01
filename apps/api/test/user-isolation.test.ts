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
})

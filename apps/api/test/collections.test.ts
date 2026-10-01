import { beforeEach, describe, expect, it } from 'vitest'
import { createUserClient, type UserClient } from './api-client.ts'

let user: UserClient

beforeEach(async () => {
  user = await createUserClient()
})

async function createCollection(name: string, description?: string) {
  const response = await user.post('/collections', { name, description })
  expect(response.status).toBe(201)
  return response.json()
}

describe('collections', () => {
  it('creates collections and lists them by name with their web count', async () => {
    const landings = await createCollection('Landing pages', 'Hero sections')
    await createCollection('Blogs')
    await user.post('/webs', { url: 'https://example.com', title: 'Example', collectionIds: [landings.id] })

    const response = await user.get('/collections')

    expect(await response.json()).toEqual([
      { id: expect.any(String), name: 'Blogs', description: null, webCount: 0 },
      { id: landings.id, name: 'Landing pages', description: 'Hero sections', webCount: 1 },
    ])
  })

  it('does not allow two collections with the same name', async () => {
    await createCollection('Blogs')

    const response = await user.post('/collections', { name: '  Blogs ' })

    expect(response.status).toBe(409)
  })

  it('renames a collection', async () => {
    const collection = await createCollection('Blgos')

    const response = await user.patch(`/collections/${collection.id}`, { name: 'Blogs' })

    expect(await response.json()).toMatchObject({ id: collection.id, name: 'Blogs' })
  })

  it('allows saving a collection with its own name but not with another one', async () => {
    const blogs = await createCollection('Blogs')
    await createCollection('Shops')

    expect((await user.patch(`/collections/${blogs.id}`, { name: 'Blogs' })).status).toBe(200)
    expect((await user.patch(`/collections/${blogs.id}`, { name: 'Shops' })).status).toBe(409)
  })

  it('keeps the webs when a collection is deleted', async () => {
    const collection = await createCollection('Temporary')
    const web = await (
      await user.post('/webs', { url: 'https://example.com', title: 'Example', collectionIds: [collection.id] })
    ).json()

    expect((await user.delete(`/collections/${collection.id}`)).status).toBe(204)

    const detail = await (await user.get(`/webs/${web.id}`)).json()
    expect(detail.collectionIds).toEqual([])
    expect(await (await user.get('/collections')).json()).toEqual([])
  })

  it('answers 404 for unknown collections', async () => {
    const unknownId = crypto.randomUUID()

    expect((await user.patch(`/collections/${unknownId}`, { name: 'Any' })).status).toBe(404)
    expect((await user.delete(`/collections/${unknownId}`)).status).toBe(404)
  })
})

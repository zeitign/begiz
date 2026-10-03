import { beforeEach, describe, expect, it } from 'vitest'
import { createUserClient, type UserClient } from './api-client.ts'

let user: UserClient

beforeEach(async () => {
  user = await createUserClient()
})

async function saveWeb(title: string, collectionIds: string[] = []) {
  const response = await user.post('/webs', { url: 'https://example.com', title, collectionIds })
  expect(response.status).toBe(201)
  return (await response.json()).id as string
}

async function createCollection(name: string) {
  return (await (await user.post('/collections', { name })).json()).id as string
}

async function listWebTitles(query = '') {
  const response = await user.get(`/webs${query}`)
  expect(response.status).toBe(200)
  const cards: { title: string }[] = await response.json()
  return cards.map((card) => card.title)
}

const moveWeb = (webId: string, afterWebId: string | null) =>
  user.put(`/webs/${webId}/position`, { afterWebId })

describe('sorting the mosaic', () => {
  beforeEach(async () => {
    const shopsId = await createCollection('Shops')
    const blogsId = await createCollection('blogs')
    await saveWeb('banana', [shopsId])
    await saveWeb('Apple', [blogsId, shopsId])
    await saveWeb('cherry')
  })

  it('uses the custom order by default, with new webs first', async () => {
    expect(await listWebTitles()).toEqual(['cherry', 'Apple', 'banana'])
  })

  it('sorts by title ignoring case, in both directions', async () => {
    expect(await listWebTitles('?sort=title')).toEqual(['Apple', 'banana', 'cherry'])
    expect(await listWebTitles('?sort=title&direction=desc')).toEqual(['cherry', 'banana', 'Apple'])
  })

  it('sorts by date added, newest first unless reversed', async () => {
    expect(await listWebTitles('?sort=date')).toEqual(['cherry', 'Apple', 'banana'])
    expect(await listWebTitles('?sort=date&direction=asc')).toEqual(['banana', 'Apple', 'cherry'])
  })

  it('sorts by the first collection name and leaves webs without collection last', async () => {
    expect(await listWebTitles('?sort=collection')).toEqual(['Apple', 'banana', 'cherry'])
    expect(await listWebTitles('?sort=collection&direction=desc')).toEqual(['banana', 'Apple', 'cherry'])
  })

  it('never reverses the custom order', async () => {
    expect(await listWebTitles('?sort=custom&direction=desc')).toEqual(['cherry', 'Apple', 'banana'])
  })

  it('rejects unknown sort modes', async () => {
    expect((await user.get('/webs?sort=random')).status).toBe(400)
  })
})

describe('custom order', () => {
  let firstId: string
  let secondId: string
  let thirdId: string

  beforeEach(async () => {
    thirdId = await saveWeb('Third')
    secondId = await saveWeb('Second')
    firstId = await saveWeb('First')
  })

  it('moves a web right after another one', async () => {
    expect((await moveWeb(firstId, thirdId)).status).toBe(204)

    expect(await listWebTitles()).toEqual(['Second', 'Third', 'First'])
  })

  it('moves a web to the start', async () => {
    await moveWeb(thirdId, null)

    expect(await listWebTitles()).toEqual(['Third', 'First', 'Second'])
  })

  it('keeps the order right when moving inside a filtered view', async () => {
    const collectionId = await createCollection('Picked')
    await user.patch(`/webs/${firstId}`, { collectionIds: [collectionId] })
    await user.patch(`/webs/${thirdId}`, { collectionIds: [collectionId] })

    await moveWeb(firstId, thirdId)

    expect(await listWebTitles(`?collection=${collectionId}`)).toEqual(['Third', 'First'])
    expect(await listWebTitles()).toEqual(['Second', 'Third', 'First'])
  })

  it('keeps working after many moves into the same gap', async () => {
    for (let moveCount = 0; moveCount < 80; moveCount++) {
      const webToMove = moveCount % 2 === 0 ? thirdId : secondId
      expect((await moveWeb(webToMove, firstId)).status).toBe(204)
    }

    expect(await listWebTitles()).toEqual(['First', 'Second', 'Third'])
  })

  it('rejects moving after an unknown web or after itself', async () => {
    expect((await moveWeb(firstId, crypto.randomUUID())).status).toBe(400)
    expect((await moveWeb(firstId, firstId)).status).toBe(400)
  })

  it('does not let other users move a web or use it as reference', async () => {
    const stranger = await createUserClient()
    const strangerWebId = (
      await (await stranger.post('/webs', { url: 'https://example.com', title: 'Stranger' })).json()
    ).id

    expect((await stranger.put(`/webs/${firstId}/position`, { afterWebId: null })).status).toBe(404)
    expect((await stranger.put(`/webs/${strangerWebId}/position`, { afterWebId: firstId })).status).toBe(400)
    expect(await listWebTitles()).toEqual(['First', 'Second', 'Third'])
  })
})

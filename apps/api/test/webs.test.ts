import { beforeEach, describe, expect, it } from 'vitest'
import { createUserClient, type UserClient } from './api-client.ts'
import { isStored, publishHtmlPage, publishImage } from './fake-web.ts'

let user: UserClient

beforeEach(async () => {
  user = await createUserClient()
})

async function saveWeb(client: UserClient, fields: Record<string, unknown> = {}) {
  const response = await client.post('/webs', { url: 'https://example.com', title: 'Example', ...fields })
  expect(response.status).toBe(201)
  return response.json()
}

async function listWebTitles(query = '') {
  const response = await user.get(`/webs${query}`)
  expect(response.status).toBe(200)
  const cards: { title: string }[] = await response.json()
  return cards.map((card) => card.title)
}

describe('saving a web', () => {
  it('reads the title, favicon and og:image of the page', async () => {
    publishHtmlPage(
      'https://studio.example/',
      `<title>Fallback title</title>
       <meta property="og:title" content="Studio">
       <meta property="og:image" content="/social.png">
       <link rel="shortcut icon" href="/icon.svg">`,
    )
    await publishImage('https://studio.example/social.png')

    const web = await saveWeb(user, { url: 'https://studio.example/', title: 'My studio' })

    expect(web).toMatchObject({
      title: 'My studio',
      siteTitle: 'Studio',
      faviconUrl: 'https://studio.example/icon.svg',
      previewSource: 'og',
      fullUrl: null,
    })
    expect(isStored(web.previewUrl)).toBe(true)
  })

  it('falls back to the <title> tag and /favicon.ico', async () => {
    publishHtmlPage('https://plain.example/', '<title>Plain site</title>')

    const web = await saveWeb(user, { url: 'https://plain.example/' })

    expect(web).toMatchObject({
      siteTitle: 'Plain site',
      faviconUrl: 'https://plain.example/favicon.ico',
      previewUrl: null,
      previewSource: null,
    })
  })

  it('skips the og:image when the user is going to upload her own image', async () => {
    publishHtmlPage('https://studio.example/', '<meta property="og:image" content="/social.png">')
    await publishImage('https://studio.example/social.png')

    const web = await saveWeb(user, { url: 'https://studio.example/', usePageImage: false })

    expect(web.previewUrl).toBeNull()
  })

  it('still saves the web when the page cannot be reached', async () => {
    const web = await saveWeb(user, { url: 'https://offline.example/' })

    expect(web).toMatchObject({ siteTitle: null, faviconUrl: null, previewUrl: null })
  })

  it('still saves the web when the og:image is not a valid image', async () => {
    publishHtmlPage('https://broken.example/', '<meta property="og:image" content="/missing.png">')

    const web = await saveWeb(user, { url: 'https://broken.example/' })

    expect(web.previewUrl).toBeNull()
  })

  it('normalizes and deduplicates tags', async () => {
    const web = await saveWeb(user, { tags: ['  Dark   Mode ', 'dark mode', 'Typography'] })

    expect(web.tags).toEqual(['dark mode', 'typography'])
  })

  it.each([
    ['a non-http URL', { url: 'ftp://example.com' }],
    ['a missing URL', { url: '' }],
    ['an empty title', { title: '   ' }],
    ['an empty tag', { tags: ['  '] }],
    ['an unknown collection', { collectionIds: [crypto.randomUUID()] }],
  ])('rejects %s', async (_case, fields) => {
    const response = await user.post('/webs', { url: 'https://example.com', title: 'Example', ...fields })

    expect(response.status).toBe(400)
    expect((await response.json()).message).toBeTruthy()
  })
})

describe('listing webs', () => {
  it('shows the newest webs first', async () => {
    await saveWeb(user, { title: 'First' })
    await saveWeb(user, { title: 'Second' })

    expect(await listWebTitles()).toEqual(['Second', 'First'])
  })

  it('searches by title ignoring case', async () => {
    await saveWeb(user, { title: 'Brutalist portfolio' })
    await saveWeb(user, { title: 'Pastel shop' })

    expect(await listWebTitles('?search=PORTFOLIO')).toEqual(['Brutalist portfolio'])
  })

  it('treats % and _ in the search as plain text', async () => {
    await saveWeb(user, { title: '100% handmade' })
    await saveWeb(user, { title: 'Studio 1000' })

    expect(await listWebTitles(`?search=${encodeURIComponent('100%')}`)).toEqual(['100% handmade'])
    expect(await listWebTitles('?search=_')).toEqual([])
  })

  it('returns only the webs that have all the selected tags', async () => {
    await saveWeb(user, { title: 'Dark and serif', tags: ['dark', 'serif'] })
    await saveWeb(user, { title: 'Only dark', tags: ['dark'] })
    await saveWeb(user, { title: 'Only serif', tags: ['serif'] })

    expect(await listWebTitles('?tags=dark')).toEqual(['Only dark', 'Dark and serif'])
    expect(await listWebTitles('?tags=dark,Serif')).toEqual(['Dark and serif'])
  })

  it('filters by collection, combined with the other filters', async () => {
    const collection = await (await user.post('/collections', { name: 'Landing pages' })).json()
    await saveWeb(user, { title: 'Dark landing', tags: ['dark'], collectionIds: [collection.id] })
    await saveWeb(user, { title: 'Light landing', tags: ['light'], collectionIds: [collection.id] })
    await saveWeb(user, { title: 'Dark blog', tags: ['dark'] })

    expect(await listWebTitles(`?collection=${collection.id}`)).toEqual(['Light landing', 'Dark landing'])
    expect(await listWebTitles(`?collection=${collection.id}&tags=dark`)).toEqual(['Dark landing'])
    expect(await listWebTitles(`?collection=${collection.id}&search=light`)).toEqual(['Light landing'])
  })
})

describe('web detail', () => {
  it('returns notes, tags and collections', async () => {
    const collection = await (await user.post('/collections', { name: 'Favourites' })).json()
    const saved = await saveWeb(user, { notes: 'Nice grid', tags: ['grid'], collectionIds: [collection.id] })

    const response = await user.get(`/webs/${saved.id}`)

    expect(await response.json()).toMatchObject({
      notes: 'Nice grid',
      tags: ['grid'],
      collectionIds: [collection.id],
    })
  })

  it('answers 404 for an unknown web and 400 for an invalid id', async () => {
    expect((await user.get(`/webs/${crypto.randomUUID()}`)).status).toBe(404)
    expect((await user.get('/webs/not-a-uuid')).status).toBe(400)
  })
})

describe('editing a web', () => {
  it('updates the fields that are sent and keeps the rest', async () => {
    const saved = await saveWeb(user, { title: 'Old title', notes: 'Keep me', tags: ['keep'] })

    const response = await user.patch(`/webs/${saved.id}`, { title: 'New title' })

    expect(await response.json()).toMatchObject({ title: 'New title', notes: 'Keep me', tags: ['keep'] })
  })

  it('replaces tags and removes the ones no web uses anymore', async () => {
    const saved = await saveWeb(user, { tags: ['old'] })

    await user.patch(`/webs/${saved.id}`, { tags: ['new'] })

    const tagNames = (await (await user.get('/tags')).json()).map((tag: { name: string }) => tag.name)
    expect(tagNames).toEqual(['new'])
  })

  it('replaces the collections of the web', async () => {
    const first = await (await user.post('/collections', { name: 'First' })).json()
    const second = await (await user.post('/collections', { name: 'Second' })).json()
    const saved = await saveWeb(user, { collectionIds: [first.id] })

    const response = await user.patch(`/webs/${saved.id}`, { collectionIds: [second.id] })

    expect((await response.json()).collectionIds).toEqual([second.id])
  })
})

describe('deleting a web', () => {
  it('removes the web, its unused tags and its images', async () => {
    publishHtmlPage('https://studio.example/', '<meta property="og:image" content="/social.png">')
    await publishImage('https://studio.example/social.png')
    const saved = await saveWeb(user, { url: 'https://studio.example/', tags: ['only-here'] })
    await saveWeb(user, { title: 'Survivor', tags: ['shared'] })

    expect((await user.delete(`/webs/${saved.id}`)).status).toBe(204)

    expect((await user.get(`/webs/${saved.id}`)).status).toBe(404)
    expect(await listWebTitles()).toEqual(['Survivor'])
    expect(await (await user.get('/tags')).json()).toEqual([{ name: 'shared', webCount: 1 }])
    expect(isStored(saved.previewUrl)).toBe(false)
  })
})

describe('tags', () => {
  it('lists the tags in use, most used first', async () => {
    await saveWeb(user, { tags: ['serif', 'dark'] })
    await saveWeb(user, { tags: ['dark', 'animation'] })

    const response = await user.get('/tags')

    expect(await response.json()).toEqual([
      { name: 'dark', webCount: 2 },
      { name: 'animation', webCount: 1 },
      { name: 'serif', webCount: 1 },
    ])
  })
})

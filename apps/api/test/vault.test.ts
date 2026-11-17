import { beforeEach, describe, expect, it } from 'vitest'
import { createUserClient, type UserClient } from './api-client.ts'

let user: UserClient

beforeEach(async () => {
  user = await createUserClient()
})

async function createFolder(name: string, parentId: string | null = null): Promise<{ id: string }> {
  const response = await user.post('/vault/folders', { name, parentId })
  expect(response.status).toBe(201)
  return response.json()
}

async function createLink(link: { url: string; title: string; tags?: string[]; folderId?: string | null }) {
  const response = await user.post('/vault/links', link)
  expect(response.status).toBe(201)
  return (await response.json()) as { id: string; folderId: string | null; tags: string[] }
}

async function listLinkTitles(query = '') {
  const links: { title: string }[] = await (await user.get(`/vault/links${query}`)).json()
  return links.map((link) => link.title)
}

describe('vault folders', () => {
  it('lists every folder flat, by name, with its parent and its own link count', async () => {
    const work = await createFolder('Work')
    const tools = await createFolder('Tools', work.id)
    await createFolder('Art')
    await createLink({ url: 'https://figma.com', title: 'Figma', folderId: tools.id })
    await createLink({ url: 'https://linear.app', title: 'Linear', folderId: tools.id })

    const response = await user.get('/vault/folders')

    expect(await response.json()).toEqual([
      { id: expect.any(String), name: 'Art', parentId: null, linkCount: 0 },
      { id: tools.id, name: 'Tools', parentId: work.id, linkCount: 2 },
      { id: work.id, name: 'Work', parentId: null, linkCount: 0 },
    ])
  })

  it('renames a folder and moves it to another folder or to the root', async () => {
    const work = await createFolder('Work')
    const tools = await createFolder('Tols')

    const renamedAndMoved = await user.patch(`/vault/folders/${tools.id}`, { name: 'Tools', parentId: work.id })
    expect(await renamedAndMoved.json()).toEqual({ id: tools.id, name: 'Tools', parentId: work.id, linkCount: 0 })

    const backToRoot = await user.patch(`/vault/folders/${tools.id}`, { parentId: null })
    expect(await backToRoot.json()).toMatchObject({ name: 'Tools', parentId: null })
  })

  it('does not move a folder inside itself or inside one of its subfolders', async () => {
    const work = await createFolder('Work')
    const tools = await createFolder('Tools', work.id)
    const design = await createFolder('Design', tools.id)

    expect((await user.patch(`/vault/folders/${work.id}`, { parentId: work.id })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${work.id}`, { parentId: design.id })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${design.id}`, { parentId: work.id })).status).toBe(200)
  })

  it('deletes a folder with its subfolders, their links and the tags left unused', async () => {
    const work = await createFolder('Work')
    const tools = await createFolder('Tools', work.id)
    const art = await createFolder('Art')
    await createLink({ url: 'https://figma.com', title: 'Figma', folderId: tools.id, tags: ['design', 'apps'] })
    await createLink({ url: 'https://example.com', title: 'Work site', folderId: work.id })
    await createLink({ url: 'https://dribbble.com', title: 'Dribbble', folderId: art.id, tags: ['design'] })

    expect((await user.delete(`/vault/folders/${work.id}`)).status).toBe(204)

    expect(await (await user.get('/vault/folders')).json()).toMatchObject([{ id: art.id }])
    expect(await listLinkTitles()).toEqual(['Dribbble'])
    expect(await (await user.get('/vault/tags')).json()).toEqual([{ name: 'design', linkCount: 1 }])
  })

  it('rejects an unknown parent and answers 404 for unknown folders', async () => {
    const unknownId = crypto.randomUUID()
    const work = await createFolder('Work')

    expect((await user.post('/vault/folders', { name: 'Orphan', parentId: unknownId })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${work.id}`, { parentId: unknownId })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${unknownId}`, { name: 'Any' })).status).toBe(404)
    expect((await user.patch(`/vault/folders/${unknownId}`, { parentId: null })).status).toBe(404)
    expect((await user.delete(`/vault/folders/${unknownId}`)).status).toBe(404)
  })
})

describe('vault links', () => {
  it('saves a link at the root or in a folder, with normalized tags', async () => {
    const tools = await createFolder('Tools')

    const rootLink = await createLink({ url: 'https://example.com', title: 'Example' })
    const toolLink = await createLink({
      url: 'https://figma.com',
      title: 'Figma',
      folderId: tools.id,
      tags: [' Design  Apps', 'design apps'],
    })

    expect(rootLink).toMatchObject({ folderId: null, tags: [] })
    expect(await (await user.get(`/vault/links/${toolLink.id}`)).json()).toEqual({
      id: toolLink.id,
      url: 'https://figma.com',
      title: 'Figma',
      folderId: tools.id,
      tags: ['design apps'],
      createdAt: expect.any(String),
    })
  })

  it('lists the links of a folder, of the root or of the whole vault, by title', async () => {
    const tools = await createFolder('Tools')
    await createLink({ url: 'https://linear.app', title: 'Linear', folderId: tools.id })
    await createLink({ url: 'https://figma.com', title: 'Figma', folderId: tools.id })
    await createLink({ url: 'https://example.com', title: 'Example' })

    expect(await listLinkTitles(`?folder=${tools.id}`)).toEqual(['Figma', 'Linear'])
    expect(await listLinkTitles('?folder=root')).toEqual(['Example'])
    expect(await listLinkTitles()).toEqual(['Example', 'Figma', 'Linear'])
  })

  it('searches the whole vault by title or URL', async () => {
    const tools = await createFolder('Tools')
    await createLink({ url: 'https://figma.com', title: 'Design tool', folderId: tools.id })
    await createLink({ url: 'https://example.com', title: 'Figma tips' })
    await createLink({ url: 'https://example.org', title: '100% free fonts' })

    expect(await listLinkTitles('?search=FIGMA')).toEqual(['Design tool', 'Figma tips'])
    expect(await listLinkTitles(`?search=${encodeURIComponent('100%')}`)).toEqual(['100% free fonts'])
    expect(await listLinkTitles(`?folder=${tools.id}&search=figma`)).toEqual(['Design tool'])
  })

  it('edits a link and deletes the tags it no longer uses', async () => {
    const tools = await createFolder('Tools')
    const link = await createLink({ url: 'https://figma.com', title: 'Figam', tags: ['design', 'old'] })

    const response = await user.patch(`/vault/links/${link.id}`, {
      title: 'Figma',
      tags: ['design'],
      folderId: tools.id,
    })

    expect(await response.json()).toMatchObject({ title: 'Figma', tags: ['design'], folderId: tools.id })
    expect(await (await user.get('/vault/tags')).json()).toEqual([{ name: 'design', linkCount: 1 }])
  })

  it('moves several links together, and none if one of them is unknown', async () => {
    const tools = await createFolder('Tools')
    const figma = await createLink({ url: 'https://figma.com', title: 'Figma' })
    const linear = await createLink({ url: 'https://linear.app', title: 'Linear' })

    const moveToTools = await user.post('/vault/links/move', { linkIds: [figma.id, linear.id], folderId: tools.id })
    expect(moveToTools.status).toBe(204)
    expect(await listLinkTitles(`?folder=${tools.id}`)).toEqual(['Figma', 'Linear'])

    const moveWithUnknown = await user.post('/vault/links/move', {
      linkIds: [figma.id, crypto.randomUUID()],
      folderId: null,
    })
    expect(moveWithUnknown.status).toBe(404)
    expect(await listLinkTitles(`?folder=${tools.id}`)).toEqual(['Figma', 'Linear'])
  })

  it('rejects unknown folders as destination', async () => {
    const link = await createLink({ url: 'https://figma.com', title: 'Figma' })
    const unknownId = crypto.randomUUID()

    expect((await user.post('/vault/links', { url: 'https://a.com', title: 'A', folderId: unknownId })).status).toBe(
      400,
    )
    expect((await user.patch(`/vault/links/${link.id}`, { folderId: unknownId })).status).toBe(400)
    expect((await user.post('/vault/links/move', { linkIds: [link.id], folderId: unknownId })).status).toBe(400)
  })

  it('deletes a link with the tags left unused', async () => {
    const link = await createLink({ url: 'https://figma.com', title: 'Figma', tags: ['design'] })

    expect((await user.delete(`/vault/links/${link.id}`)).status).toBe(204)

    expect(await listLinkTitles()).toEqual([])
    expect(await (await user.get('/vault/tags')).json()).toEqual([])
    expect((await user.delete(`/vault/links/${link.id}`)).status).toBe(404)
  })

  it('keeps vault tags apart from the mosaic tags', async () => {
    await createLink({ url: 'https://figma.com', title: 'Figma', tags: ['design'] })
    await user.post('/webs', { url: 'https://example.com', title: 'Example', tags: ['design', 'mosaic only'] })

    expect(await (await user.get('/vault/tags')).json()).toEqual([{ name: 'design', linkCount: 1 }])
    expect(await (await user.get('/tags')).json()).toEqual([
      { name: 'design', webCount: 1 },
      { name: 'mosaic only', webCount: 1 },
    ])
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { createUserClient, type UserClient } from './api-client.ts'
import { publishHtmlPage } from './fake-web.ts'

let user: UserClient
/** Every test starts with one category and one folder inside it, where links can go. */
let design: { id: string }
let typography: { id: string }

async function createCategory(name: string, icon?: string): Promise<{ id: string }> {
  const response = await user.post('/vault/folders', { name, icon })
  expect(response.status).toBe(201)
  return response.json()
}

async function createFolder(name: string, categoryId: string): Promise<{ id: string }> {
  const response = await user.post('/vault/folders', { name, parentId: categoryId })
  expect(response.status).toBe(201)
  return response.json()
}

async function createLink(link: { url: string; title: string; tags?: string[]; folderId?: string }) {
  const response = await user.post('/vault/links', { folderId: typography.id, ...link })
  expect(response.status).toBe(201)
  return (await response.json()) as { id: string; folderId: string; tags: string[] }
}

async function listLinkTitles(query = '') {
  const links: { title: string }[] = await (await user.get(`/vault/links${query}`)).json()
  return links.map((link) => link.title)
}

beforeEach(async () => {
  user = await createUserClient()
  design = await createCategory('Design')
  typography = await createFolder('Typography', design.id)
})

describe('vault categories and folders', () => {
  it('lists every folder flat, by name, with its category and its own link count', async () => {
    const icons = await createFolder('Icons', design.id)
    const leisure = await createCategory('Leisure')
    await createLink({ url: 'https://phosphoricons.com', title: 'Phosphor', folderId: icons.id })
    await createLink({ url: 'https://lucide.dev', title: 'Lucide', folderId: icons.id })

    const response = await user.get('/vault/folders')

    const unplaced = { icon: null, gridCell: null, createdAt: expect.any(String) }
    expect(await response.json()).toEqual([
      { id: design.id, name: 'Design', parentId: null, ...unplaced, linkCount: 0 },
      { id: icons.id, name: 'Icons', parentId: design.id, ...unplaced, linkCount: 2 },
      { id: leisure.id, name: 'Leisure', parentId: null, ...unplaced, linkCount: 0 },
      { id: typography.id, name: 'Typography', parentId: design.id, ...unplaced, linkCount: 0 },
    ])
  })

  it('keeps the icon chosen for a folder, and goes back to the default one with null', async () => {
    const code = await createCategory('Code', 'code')
    expect(code).toMatchObject({ icon: 'code' })

    const changed = await user.patch(`/vault/folders/${code.id}`, { name: 'Coding', icon: 'terminal' })
    expect(await changed.json()).toMatchObject({ name: 'Coding', icon: 'terminal' })

    const reset = await user.patch(`/vault/folders/${code.id}`, { icon: null })
    expect(await reset.json()).toMatchObject({ icon: null })
  })

  it('only accepts icon names', async () => {
    const response = await user.post('/vault/folders', { name: 'Code', icon: '<svg onload=alert(1)>' })

    expect(response.status).toBe(400)
  })

  it('creates folders inside folders, at any depth', async () => {
    const serif = await createFolder('Serif', typography.id)
    const display = await createFolder('Display', serif.id)

    expect(await (await user.get('/vault/folders')).json()).toMatchObject([
      { id: design.id, parentId: null },
      { id: display.id, parentId: serif.id },
      { id: serif.id, parentId: typography.id },
      { id: typography.id, parentId: design.id },
    ])
  })

  it('moves a folder to another category, or makes an empty one a category', async () => {
    const leisure = await createCategory('Leisure')

    const moved = await user.patch(`/vault/folders/${typography.id}`, { parentId: leisure.id })
    expect(await moved.json()).toMatchObject({ parentId: leisure.id })

    const madeCategory = await user.patch(`/vault/folders/${typography.id}`, { parentId: null })
    expect(await madeCategory.json()).toMatchObject({ parentId: null })
  })

  it('moves a folder with everything inside it into any other folder', async () => {
    const leisure = await createCategory('Leisure')
    const games = await createFolder('Games', leisure.id)
    const serif = await createFolder('Serif', typography.id)

    const moved = await user.patch(`/vault/folders/${design.id}`, { parentId: games.id })

    expect(await moved.json()).toMatchObject({ parentId: games.id })
    expect(await (await user.get('/vault/folders')).json()).toMatchObject([
      { id: design.id, parentId: games.id },
      { id: games.id, parentId: leisure.id },
      { id: leisure.id, parentId: null },
      { id: serif.id, parentId: typography.id },
      { id: typography.id, parentId: design.id },
    ])
  })

  it('never moves a folder inside itself or its subfolders, nor makes one with links a category', async () => {
    const serif = await createFolder('Serif', typography.id)
    await createLink({ url: 'https://fontshare.com', title: 'Fontshare' })

    // A folder with links cannot become a category, which only holds folders.
    expect((await user.patch(`/vault/folders/${typography.id}`, { parentId: null })).status).toBe(400)
    // Inside itself or below itself, it would leave the tree.
    expect((await user.patch(`/vault/folders/${design.id}`, { parentId: design.id })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${design.id}`, { parentId: typography.id })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${design.id}`, { parentId: serif.id })).status).toBe(400)
    expect(await (await user.get('/vault/folders')).json()).toMatchObject([
      { id: design.id, parentId: null },
      { id: serif.id, parentId: typography.id },
      { id: typography.id, parentId: design.id },
    ])
  })

  it('deletes a folder with all its subfolders and their links, at any depth', async () => {
    const serif = await createFolder('Serif', typography.id)
    const display = await createFolder('Display', serif.id)
    await createLink({ url: 'https://klim.co.nz', title: 'Klim', folderId: display.id, tags: ['foundry'] })

    expect((await user.delete(`/vault/folders/${typography.id}`)).status).toBe(204)

    expect(await (await user.get('/vault/folders')).json()).toMatchObject([{ id: design.id }])
    expect(await listLinkTitles()).toEqual([])
    expect(await (await user.get('/vault/tags')).json()).toEqual([])
  })

  it('deletes a category with its folders, their links and the tags left unused', async () => {
    const leisure = await createCategory('Leisure')
    const games = await createFolder('Games', leisure.id)
    await createLink({ url: 'https://fontshare.com', title: 'Fontshare', tags: ['free', 'fonts'] })
    await createLink({ url: 'https://itch.io', title: 'Itch.io', folderId: games.id, tags: ['free'] })

    expect((await user.delete(`/vault/folders/${design.id}`)).status).toBe(204)

    expect(await (await user.get('/vault/folders')).json()).toMatchObject([{ id: games.id }, { id: leisure.id }])
    expect(await listLinkTitles()).toEqual(['Itch.io'])
    expect(await (await user.get('/vault/tags')).json()).toEqual([{ name: 'free', linkCount: 1 }])
  })

  it('rejects an unknown category and answers 404 for unknown folders', async () => {
    const unknownId = crypto.randomUUID()

    expect((await user.post('/vault/folders', { name: 'Orphan', parentId: unknownId })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${typography.id}`, { parentId: unknownId })).status).toBe(400)
    expect((await user.patch(`/vault/folders/${unknownId}`, { name: 'Any' })).status).toBe(404)
    expect((await user.patch(`/vault/folders/${unknownId}`, { parentId: null })).status).toBe(404)
    expect((await user.delete(`/vault/folders/${unknownId}`)).status).toBe(404)
  })
})

describe('vault links', () => {
  it('saves a link in a folder, with normalized tags', async () => {
    const link = await createLink({
      url: 'https://fontshare.com',
      title: 'Fontshare',
      tags: [' Free  Fonts', 'free fonts'],
    })

    expect(await (await user.get(`/vault/links/${link.id}`)).json()).toEqual({
      id: link.id,
      url: 'https://fontshare.com',
      title: 'Fontshare',
      folderId: typography.id,
      faviconUrl: null,
      tags: ['free fonts'],
      createdAt: expect.any(String),
    })
  })

  it('only saves links inside a folder, never in a category or outside any folder', async () => {
    const inCategory = await user.post('/vault/links', { url: 'https://a.com', title: 'A', folderId: design.id })
    const withoutFolder = await user.post('/vault/links', { url: 'https://a.com', title: 'A' })

    expect(inCategory.status).toBe(400)
    expect(withoutFolder.status).toBe(400)
  })

  it('saves and moves links in folders at any depth, next to their subfolders', async () => {
    const serif = await createFolder('Serif', typography.id)
    const display = await createFolder('Display', serif.id)
    const klim = await createLink({ url: 'https://klim.co.nz', title: 'Klim', folderId: serif.id })

    const moved = await user.post('/vault/links/move', { linkIds: [klim.id], folderId: display.id })

    expect(moved.status).toBe(204)
    expect(await listLinkTitles(`?folder=${display.id}`)).toEqual(['Klim'])
  })

  it('reads the favicon of the page, and saves the link anyway when the page cannot be read', async () => {
    publishHtmlPage('https://studio.example/', '<link rel="icon" href="/icon.svg">')

    const readable = await createLink({ url: 'https://studio.example/', title: 'Studio' })
    const unreachable = await createLink({ url: 'https://offline.example/', title: 'Offline' })

    expect(readable).toMatchObject({ faviconUrl: 'https://studio.example/icon.svg' })
    expect(unreachable).toMatchObject({ faviconUrl: null })
  })

  it('reads the favicon again only when the address changes', async () => {
    const link = await createLink({ url: 'https://offline.example/', title: 'Studio' })
    publishHtmlPage('https://offline.example/', '<link rel="icon" href="/old.svg">')
    publishHtmlPage('https://studio.example/', '<link rel="icon" href="/icon.svg">')

    const renamed = await (await user.patch(`/vault/links/${link.id}`, { title: 'Studio site' })).json()
    expect(renamed).toMatchObject({ faviconUrl: null })

    const moved = await (await user.patch(`/vault/links/${link.id}`, { url: 'https://studio.example/' })).json()
    expect(moved).toMatchObject({ faviconUrl: 'https://studio.example/icon.svg' })
  })

  it('lists the links of a folder or of the whole vault, by title', async () => {
    const icons = await createFolder('Icons', design.id)
    await createLink({ url: 'https://typewolf.com', title: 'Typewolf' })
    await createLink({ url: 'https://fontshare.com', title: 'Fontshare' })
    await createLink({ url: 'https://lucide.dev', title: 'Lucide', folderId: icons.id })

    expect(await listLinkTitles(`?folder=${typography.id}`)).toEqual(['Fontshare', 'Typewolf'])
    expect(await listLinkTitles()).toEqual(['Fontshare', 'Lucide', 'Typewolf'])
  })

  it('searches the whole vault by title or URL', async () => {
    const icons = await createFolder('Icons', design.id)
    await createLink({ url: 'https://figma.com', title: 'Design tool', folderId: icons.id })
    await createLink({ url: 'https://example.com', title: 'Figma tips' })
    await createLink({ url: 'https://example.org', title: '100% free fonts' })

    expect(await listLinkTitles('?search=FIGMA')).toEqual(['Design tool', 'Figma tips'])
    expect(await listLinkTitles(`?search=${encodeURIComponent('100%')}`)).toEqual(['100% free fonts'])
    expect(await listLinkTitles(`?folder=${icons.id}&search=figma`)).toEqual(['Design tool'])
  })

  it('edits a link and deletes the tags it no longer uses', async () => {
    const icons = await createFolder('Icons', design.id)
    const link = await createLink({ url: 'https://lucide.dev', title: 'Lucdie', tags: ['icons', 'old'] })

    const response = await user.patch(`/vault/links/${link.id}`, {
      title: 'Lucide',
      tags: ['icons'],
      folderId: icons.id,
    })

    expect(await response.json()).toMatchObject({ title: 'Lucide', tags: ['icons'], folderId: icons.id })
    expect(await (await user.get('/vault/tags')).json()).toEqual([{ name: 'icons', linkCount: 1 }])
  })

  it('moves several links together, and none if one of them is unknown', async () => {
    const icons = await createFolder('Icons', design.id)
    const phosphor = await createLink({ url: 'https://phosphoricons.com', title: 'Phosphor' })
    const lucide = await createLink({ url: 'https://lucide.dev', title: 'Lucide' })

    const moveToIcons = await user.post('/vault/links/move', { linkIds: [phosphor.id, lucide.id], folderId: icons.id })
    expect(moveToIcons.status).toBe(204)
    expect(await listLinkTitles(`?folder=${icons.id}`)).toEqual(['Lucide', 'Phosphor'])

    const moveWithUnknown = await user.post('/vault/links/move', {
      linkIds: [phosphor.id, crypto.randomUUID()],
      folderId: typography.id,
    })
    expect(moveWithUnknown.status).toBe(404)
    expect(await listLinkTitles(`?folder=${icons.id}`)).toEqual(['Lucide', 'Phosphor'])
  })

  it('rejects unknown folders and categories as destination', async () => {
    const link = await createLink({ url: 'https://fontshare.com', title: 'Fontshare' })
    const unknownId = crypto.randomUUID()

    expect((await user.patch(`/vault/links/${link.id}`, { folderId: unknownId })).status).toBe(400)
    expect((await user.patch(`/vault/links/${link.id}`, { folderId: design.id })).status).toBe(400)
    expect((await user.post('/vault/links/move', { linkIds: [link.id], folderId: unknownId })).status).toBe(400)
    expect((await user.post('/vault/links/move', { linkIds: [link.id], folderId: design.id })).status).toBe(400)
  })

  it('deletes a link with the tags left unused', async () => {
    const link = await createLink({ url: 'https://fontshare.com', title: 'Fontshare', tags: ['free'] })

    expect((await user.delete(`/vault/links/${link.id}`)).status).toBe(204)

    expect(await listLinkTitles()).toEqual([])
    expect(await (await user.get('/vault/tags')).json()).toEqual([])
    expect((await user.delete(`/vault/links/${link.id}`)).status).toBe(404)
  })

  it('keeps vault tags apart from the mosaic tags', async () => {
    await createLink({ url: 'https://fontshare.com', title: 'Fontshare', tags: ['design'] })
    await user.post('/webs', { url: 'https://example.com', title: 'Example', tags: ['design', 'mosaic only'] })

    expect(await (await user.get('/vault/tags')).json()).toEqual([{ name: 'design', linkCount: 1 }])
    expect(await (await user.get('/tags')).json()).toEqual([
      { name: 'design', webCount: 1 },
      { name: 'mosaic only', webCount: 1 },
    ])
  })
})

describe('vault layout', () => {
  async function listGridCells() {
    const folders: { name: string; gridCell: number | null }[] = await (await user.get('/vault/folders')).json()
    return Object.fromEntries(folders.map((folder) => [folder.name, folder.gridCell]))
  }

  it('places the tiles of one grid in the cells chosen by hand', async () => {
    const leisure = await createCategory('Leisure')

    const response = await user.put('/vault/folders/grid', {
      cells: [
        { folderId: design.id, gridCell: 6 },
        { folderId: leisure.id, gridCell: 2 },
      ],
    })

    expect(response.status).toBe(204)
    expect(await listGridCells()).toEqual({ Design: 6, Leisure: 2, Typography: null })
  })

  it('never mixes grids, shares a cell or places folders of another user', async () => {
    const stranger = await createUserClient()
    const strangerCategory: { id: string } = await (await stranger.post('/vault/folders', { name: 'Theirs' })).json()
    const place = (cells: { folderId: string; gridCell: number }[]) => user.put('/vault/folders/grid', { cells })

    expect(
      (
        await place([
          { folderId: design.id, gridCell: 1 },
          { folderId: typography.id, gridCell: 2 },
        ])
      ).status,
    ).toBe(400)
    const leisure = await createCategory('Leisure')
    expect(
      (
        await place([
          { folderId: design.id, gridCell: 1 },
          { folderId: leisure.id, gridCell: 1 },
        ])
      ).status,
    ).toBe(400)
    expect((await place([{ folderId: strangerCategory.id, gridCell: 1 }])).status).toBe(404)
    expect(await listGridCells()).toEqual({ Design: null, Leisure: null, Typography: null })
  })

  it('forgets the cell of a folder moved to another category', async () => {
    const leisure = await createCategory('Leisure')
    await user.put('/vault/folders/grid', { cells: [{ folderId: typography.id, gridCell: 4 }] })

    await user.patch(`/vault/folders/${typography.id}`, { parentId: leisure.id })

    expect((await listGridCells()).Typography).toBeNull()
  })

  it('remembers the order chosen, starting by name', async () => {
    expect(await (await user.get('/vault/preferences')).json()).toEqual({ order: 'name', direction: 'asc' })

    expect((await user.put('/vault/preferences', { order: 'custom', direction: 'asc' })).status).toBe(200)
    expect((await user.put('/vault/preferences', { order: 'date', direction: 'desc' })).status).toBe(200)

    expect(await (await user.get('/vault/preferences')).json()).toEqual({ order: 'date', direction: 'desc' })
    const stranger = await createUserClient()
    expect(await (await stranger.get('/vault/preferences')).json()).toEqual({ order: 'name', direction: 'asc' })
  })

  it('only accepts known orders', async () => {
    const response = await user.put('/vault/preferences', { order: 'size', direction: 'asc' })

    expect(response.status).toBe(400)
  })
})

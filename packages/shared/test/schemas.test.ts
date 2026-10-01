import { describe, expect, it } from 'vitest'
import { collectionCreate, normalizeTag, webCreate, webListQuery } from '../src/index.ts'

describe('normalizeTag', () => {
  it('lowercases, trims and collapses inner spaces', () => {
    expect(normalizeTag('  Paleta   de Color ')).toBe('paleta de color')
  })
})

describe('webCreate', () => {
  const minimalWeb = { url: 'https://example.com', title: 'Example' }

  it('fills in the defaults', () => {
    expect(webCreate.parse(minimalWeb)).toEqual({
      ...minimalWeb,
      notes: '',
      tags: [],
      collectionIds: [],
      usePageImage: true,
    })
  })

  it('normalizes tags and removes duplicates', () => {
    const { tags } = webCreate.parse({ ...minimalWeb, tags: ['Dark', ' dark ', 'Serif'] })
    expect(tags).toEqual(['dark', 'serif'])
  })

  it.each(['javascript:alert(1)', 'ftp://example.com', 'example.com', 'file:///etc/passwd'])(
    'only accepts http and https URLs (%s)',
    (url) => {
      expect(webCreate.safeParse({ ...minimalWeb, url }).success).toBe(false)
    },
  )

  it('trims the title and rejects it when empty', () => {
    expect(webCreate.parse({ ...minimalWeb, title: '  Spaced  ' }).title).toBe('Spaced')
    expect(webCreate.safeParse({ ...minimalWeb, title: '   ' }).success).toBe(false)
  })

  it('limits tags to 40 characters and 30 per web', () => {
    expect(webCreate.safeParse({ ...minimalWeb, tags: ['x'.repeat(41)] }).success).toBe(false)
    const thirtyOneTags = Array.from({ length: 31 }, (_, index) => `tag ${index}`)
    expect(webCreate.safeParse({ ...minimalWeb, tags: thirtyOneTags }).success).toBe(false)
  })
})

describe('webListQuery', () => {
  it('requires the collection filter to be a uuid', () => {
    expect(webListQuery.safeParse({ collection: 'not-a-uuid' }).success).toBe(false)
  })
})

describe('collectionCreate', () => {
  it('trims the name and rejects it when empty', () => {
    expect(collectionCreate.parse({ name: '  Blogs ' }).name).toBe('Blogs')
    expect(collectionCreate.safeParse({ name: '  ' }).success).toBe(false)
  })
})

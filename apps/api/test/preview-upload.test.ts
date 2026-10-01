import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { beforeEach, describe, expect, it } from 'vitest'
import { createUserClient, type UserClient } from './api-client.ts'
import { createPngImage, isStored, publishHtmlPage, publishImage, storedFilePath } from './fake-web.ts'

let user: UserClient
let webId: string

beforeEach(async () => {
  user = await createUserClient()
  const response = await user.post('/webs', { url: 'https://example.com', title: 'Example' })
  webId = (await response.json()).id
})

const uploadPng = async (width: number, height: number) =>
  user.uploadImage(`/webs/${webId}/preview`, new Blob([await createPngImage(width, height)]))

describe('uploading a preview image', () => {
  it('stores the original image and an 800px WebP thumbnail', async () => {
    const response = await uploadPng(1600, 900)

    expect(response.status).toBe(200)
    const web = await response.json()
    expect(web.previewSource).toBe('manual')
    expect(web.fullUrl).toMatch(/-full\.png$/)
    expect(isStored(web.fullUrl)).toBe(true)

    const thumbnail = await sharp(readFileSync(storedFilePath(web.previewUrl))).metadata()
    expect(thumbnail).toMatchObject({ format: 'webp', width: 800, height: 450 })
  })

  it('crops full-page screenshots to the top 1200px in the thumbnail', async () => {
    const web = await (await uploadPng(1000, 6000)).json()

    const thumbnail = await sharp(readFileSync(storedFilePath(web.previewUrl))).metadata()
    expect(thumbnail).toMatchObject({ width: 800, height: 1200 })
  })

  it('replaces the og:image and deletes the previous files', async () => {
    publishHtmlPage('https://studio.example/', '<meta property="og:image" content="/social.png">')
    await publishImage('https://studio.example/social.png')
    const withOgImage = await (
      await user.post('/webs', { url: 'https://studio.example/', title: 'Studio' })
    ).json()
    webId = withOgImage.id

    const firstUpload = await (await uploadPng(900, 900)).json()
    const secondUpload = await (await uploadPng(900, 900)).json()

    expect(isStored(withOgImage.previewUrl)).toBe(false)
    expect(isStored(firstUpload.previewUrl)).toBe(false)
    expect(isStored(firstUpload.fullUrl)).toBe(false)
    expect(isStored(secondUpload.previewUrl)).toBe(true)
  })

  it('detects the format from the content, not from the file name', async () => {
    const jpeg = await sharp(await createPngImage(400, 300)).jpeg().toBuffer()

    const response = await user.uploadImage(`/webs/${webId}/preview`, new Blob([jpeg], { type: 'image/png' }))

    expect((await response.json()).fullUrl).toMatch(/-full\.jpg$/)
  })

  it('rejects files that are not images', async () => {
    const response = await user.uploadImage(
      `/webs/${webId}/preview`,
      new Blob(['<svg onload="alert(1)">'], { type: 'image/png' }),
    )

    expect(response.status).toBe(400)
    expect((await response.json()).message).toBeTruthy()
  })
})

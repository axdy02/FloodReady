import sharp from "sharp"

const imageInput = {
  background: { alpha: 1, b: 180, g: 90, r: 20 },
  channels: 3 as const,
  height: 8,
  width: 12,
}

export const jpegImage = async (): Promise<Buffer> =>
  sharp({ create: imageInput }).jpeg({ quality: 90 }).toBuffer()

export const pngImage = async (): Promise<Buffer> =>
  sharp({ create: imageInput }).png().toBuffer()

export const webpImage = async (): Promise<Buffer> =>
  sharp({ create: imageInput }).webp({ quality: 90 }).toBuffer()

export const jpegWithMetadata = async (): Promise<Buffer> =>
  sharp({ create: imageInput }).withMetadata({ orientation: 6 }).jpeg({ quality: 90 }).toBuffer()

export const truncatedJpeg = (): Buffer => Buffer.from([
  0xff,
  0xd8,
  0xff,
  0xe0,
  0x00,
  0x10,
  0x4a,
  0x46,
  0x49,
  0x46,
  0x00,
  0x01,
  0x01,
  0x00,
])

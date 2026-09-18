export const imageExtensions = ["jpg", "png", "webp"] as const

export type ImageExtension = (typeof imageExtensions)[number]

export interface SaveValidatedImageInput {
  bytes: Buffer
  extension: ImageExtension
  serverTime: Date
}

export interface SavedImage {
  key: string
}

export interface StoredImage {
  bytes: Buffer
  extension: ImageExtension
}

export interface ImageStorage {
  saveValidatedImage(input: SaveValidatedImageInput): Promise<SavedImage>
  read(key: string): Promise<StoredImage>
  delete(key: string): Promise<void>
}

export class ImageStorageError extends Error {
  override readonly name = "ImageStorageError"

  constructor(options?: ErrorOptions) {
    super("Image storage operation failed", options)
  }
}

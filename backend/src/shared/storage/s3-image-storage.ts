import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import {
  ImageStorageError,
  type ImageExtension,
  type ImageStorage,
  type SaveValidatedImageInput,
  type SavedImage,
  type StoredImage,
} from "./image-storage.js"

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
const keyPattern = new RegExp(`^reports/${uuidPattern}/${uuidPattern}\\.(jpg|png|webp)$`)
const recordIdPattern = new RegExp(`^${uuidPattern}$`)

const extensionFromKey = (key: string): ImageExtension => {
  const extension = key.split(".").at(-1)
  if (extension === "jpg" || extension === "png" || extension === "webp") return extension
  throw new ImageStorageError()
}

const contentType = (extension: ImageExtension): string => extension === "jpg" ? "image/jpeg" : `image/${extension}`

const isMissing = (error: unknown): boolean => error instanceof Error && (
  error.name === "NoSuchKey" || error.name === "NotFound" || ("$metadata" in error && (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
)

const storageError = (error: unknown): ImageStorageError => error instanceof ImageStorageError ? error : new ImageStorageError({ cause: error })

export interface S3ImageStorageOptions {
  bucket: string
  region: string
  client?: S3Client
}

/** Uses the AWS SDK default credential provider chain (including an EC2 IAM role). */
export class S3ImageStorage implements ImageStorage {
  readonly #bucket: string
  readonly #client: S3Client

  constructor(options: S3ImageStorageOptions) {
    this.#bucket = options.bucket
    this.#client = options.client ?? new S3Client({ region: options.region })
  }

  async initialize(): Promise<void> {
    await this.checkHealth()
  }

  async checkHealth(): Promise<void> {
    try {
      await this.#client.send(new HeadBucketCommand({ Bucket: this.#bucket }))
    } catch (error) {
      throw storageError(error)
    }
  }

  async saveValidatedImage(input: SaveValidatedImageInput): Promise<SavedImage> {
    if (!recordIdPattern.test(input.recordId)) throw new ImageStorageError()
    const key = `reports/${input.recordId}/${randomUUID()}.${input.extension}`
    try {
      await this.#client.send(new PutObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        Body: input.bytes,
        ContentLength: input.bytes.length,
        ContentType: contentType(input.extension),
      }))
      return { key }
    } catch (error) {
      throw storageError(error)
    }
  }

  async read(key: string): Promise<StoredImage> {
    if (!keyPattern.test(key)) throw new ImageStorageError()
    try {
      const response = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key: key }))
      if (response.Body === undefined) throw new ImageStorageError()
      return { bytes: Buffer.from(await response.Body.transformToByteArray()), extension: extensionFromKey(key) }
    } catch (error) {
      throw storageError(error)
    }
  }

  async delete(key: string): Promise<void> {
    if (!keyPattern.test(key)) throw new ImageStorageError()
    try {
      await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }))
    } catch (error) {
      if (isMissing(error)) return
      throw storageError(error)
    }
  }
}

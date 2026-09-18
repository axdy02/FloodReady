import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { createImageStorage } from "../src/shared/storage/image-storage-factory.js"
import { LocalImageStorage } from "../src/shared/storage/local-image-storage.js"
import { S3ImageStorage } from "../src/shared/storage/s3-image-storage.js"

describe("image storage selection", () => {
  it("uses local storage by default configuration", () => {
    const storage = createImageStorage({ AWS_REGION: undefined, IMAGE_STORAGE_DRIVER: "local", S3_BUCKET_NAME: undefined, UPLOAD_DIRECTORY: `./tmp-${randomUUID()}` })
    expect(storage).toBeInstanceOf(LocalImageStorage)
  })

  it("uses the S3 driver when S3 is configured", () => {
    const storage = createImageStorage({ AWS_REGION: "ap-south-1", IMAGE_STORAGE_DRIVER: "s3", S3_BUCKET_NAME: "waterradar-evidence-images", UPLOAD_DIRECTORY: `./tmp-${randomUUID()}` })
    expect(storage).toBeInstanceOf(S3ImageStorage)
  })
})

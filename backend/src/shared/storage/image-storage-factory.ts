import type { Config } from "../../config/index.js"
import { type ImageStorage } from "./image-storage.js"
import { LocalImageStorage } from "./local-image-storage.js"
import { S3ImageStorage } from "./s3-image-storage.js"

type StorageConfig = Pick<Config, "AWS_REGION" | "IMAGE_STORAGE_DRIVER" | "S3_BUCKET_NAME" | "UPLOAD_DIRECTORY">

export const createImageStorage = (storageConfig: StorageConfig): ImageStorage => {
  if (storageConfig.IMAGE_STORAGE_DRIVER === "local") {
    return new LocalImageStorage(storageConfig.UPLOAD_DIRECTORY)
  }
  if (storageConfig.AWS_REGION === undefined || storageConfig.S3_BUCKET_NAME === undefined) {
    throw new Error("S3 image storage configuration is incomplete")
  }
  return new S3ImageStorage({ bucket: storageConfig.S3_BUCKET_NAME, region: storageConfig.AWS_REGION })
}

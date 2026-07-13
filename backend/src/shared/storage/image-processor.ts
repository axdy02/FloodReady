import { fileTypeFromBuffer } from "file-type"
import sharp from "sharp"
import type { ImageExtension } from "./image-storage.js"

const supportedImages = {
  jpg: { detectedExtension: "jpg", mime: "image/jpeg" },
  png: { detectedExtension: "png", mime: "image/png" },
  webp: { detectedExtension: "webp", mime: "image/webp" },
} as const

export type ImageProcessingFailure =
  | "FILE_TOO_LARGE"
  | "INVALID_IMAGE"
  | "UNSUPPORTED_MEDIA_TYPE"

export interface ProcessImageInput {
  bytes: Buffer
  clientMime: string
  maxBytes: number
  maxPixels: number
}

export interface ProcessedImage {
  bytes: Buffer
  extension: ImageExtension
}

export class ImageProcessingError extends Error {
  override readonly name = "ImageProcessingError"

  constructor(readonly failure: ImageProcessingFailure, options?: ErrorOptions) {
    super("Image processing failed", options)
  }
}

sharp.cache(false)
sharp.concurrency(1)

function resolveImageType(
  detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>,
  clientMime: string,
): ImageExtension {
  if (detected === undefined) {
    throw new ImageProcessingError("UNSUPPORTED_MEDIA_TYPE")
  }
  const extension = detected.ext
  if (extension !== "jpg" && extension !== "png" && extension !== "webp") {
    throw new ImageProcessingError("UNSUPPORTED_MEDIA_TYPE")
  }
  const supported = supportedImages[extension]
  if (clientMime !== supported.mime || detected.mime !== supported.mime) {
    throw new ImageProcessingError("UNSUPPORTED_MEDIA_TYPE")
  }
  return supported.detectedExtension
}

function imagePipeline(bytes: Buffer, extension: ImageExtension, maxPixels: number) {
  const pipeline = sharp(bytes, {
    animated: true,
    failOn: "error",
    limitInputPixels: maxPixels,
  }).rotate()
  if (extension === "jpg") {
    return pipeline.jpeg({ chromaSubsampling: "4:2:0", quality: 85 })
  }
  if (extension === "png") {
    return pipeline.png({ compressionLevel: 9 })
  }
  return pipeline.webp({ quality: 85 })
}

async function validateMetadata(bytes: Buffer, maxPixels: number): Promise<void> {
  try {
    const metadata = await sharp(bytes, {
      animated: true,
      failOn: "error",
      limitInputPixels: maxPixels,
    }).metadata()
    if (
      metadata.width === undefined ||
      metadata.height === undefined ||
      metadata.width <= 0 ||
      metadata.height <= 0 ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new ImageProcessingError("INVALID_IMAGE")
    }
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      throw error
    }
    throw new ImageProcessingError("INVALID_IMAGE", { cause: error })
  }
}

export async function processImage(input: ProcessImageInput): Promise<ProcessedImage> {
  if (input.bytes.length === 0) {
    throw new ImageProcessingError("INVALID_IMAGE")
  }
  if (input.bytes.length > input.maxBytes) {
    throw new ImageProcessingError("FILE_TOO_LARGE")
  }
  let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>
  try {
    detected = await fileTypeFromBuffer(input.bytes)
  } catch (error) {
    throw new ImageProcessingError("INVALID_IMAGE", { cause: error })
  }
  const extension = resolveImageType(detected, input.clientMime)
  await validateMetadata(input.bytes, input.maxPixels)
  try {
    const bytes = await imagePipeline(input.bytes, extension, input.maxPixels).toBuffer()
    if (bytes.length > input.maxBytes) {
      throw new ImageProcessingError("FILE_TOO_LARGE")
    }
    return { bytes, extension }
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      throw error
    }
    throw new ImageProcessingError("INVALID_IMAGE", { cause: error })
  }
}

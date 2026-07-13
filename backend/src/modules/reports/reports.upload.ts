import type { RequestHandler } from "express"
import multer, { MulterError } from "multer"
import { AppError } from "../../shared/errors/index.js"
import {
  UploadCapacity,
  UploadCapacityError,
} from "../../shared/storage/upload-capacity.js"

function validationError(): AppError {
  return new AppError(400, "VALIDATION_ERROR", "Invalid request")
}

function uploadError(error: unknown): AppError {
  if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
    return new AppError(413, "FILE_TOO_LARGE", "Uploaded file is too large")
  }
  return validationError()
}

export function createMultipartParser(maxBytes: number): RequestHandler {
  const parser = multer({
    limits: {
      fieldNameSize: 64,
      fieldSize: 4 * 1024,
      fields: 7,
      fileSize: maxBytes,
      files: 1,
      parts: 9,
    },
    storage: multer.memoryStorage(),
  }).single("image")
  return (request, response, next) => {
    parser(request, response, (error: unknown) => {
      if (error !== undefined) {
        request.uploadCapacityRelease?.()
        request.uploadCapacityRelease = undefined
        next(uploadError(error))
        return
      }
      next()
    })
  }
}

export function createUploadCapacityMiddleware(capacity: UploadCapacity): RequestHandler {
  return async (request, response, next) => {
    let closed = false
    const markClosed = () => {
      closed = true
    }
    response.once("close", markClosed)
    try {
      const release = await capacity.acquire()
      response.off("close", markClosed)
      if (closed) {
        release()
        return
      }
      response.once("close", release)
      request.uploadCapacityRelease = release
      next()
    } catch (error) {
      response.off("close", markClosed)
      if (error instanceof UploadCapacityError) {
        next(new AppError(503, "SERVICE_UNAVAILABLE", "Service unavailable"))
        return
      }
      next(error)
    }
  }
}

export function normalizeMultipartBody(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw validationError()
  }
  const normalized: Record<string, string> = {}
  for (const [key, field] of Object.entries(value)) {
    if (typeof field !== "string") {
      throw validationError()
    }
    normalized[key] = field
  }
  return normalized
}

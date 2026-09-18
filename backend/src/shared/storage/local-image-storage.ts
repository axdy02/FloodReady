import { randomUUID } from "node:crypto"
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
} from "node:fs/promises"
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path"
import {
  ImageStorageError,
  type ImageStorage,
  type ImageExtension,
  type SaveValidatedImageInput,
  type SavedImage,
  type StoredImage,
} from "./image-storage.js"

const keyPattern = /^reports\/[0-9]{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/

const isMissing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT"

const isAlreadyPresent = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "EEXIST"

const extensionFromKey = (key: string): ImageExtension => {
  const extension = key.split(".").at(-1)
  if (extension === "jpg" || extension === "png" || extension === "webp") {
    return extension
  }
  throw new ImageStorageError()
}

const contains = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

export class LocalImageStorage implements ImageStorage {
  readonly #root: string

  constructor(uploadRoot: string) {
    this.#root = resolve(uploadRoot)
  }

  async #rootPath(): Promise<string> {
    await mkdir(this.#root, { mode: 0o700, recursive: true })
    await chmod(this.#root, 0o700)
    const rootStat = await lstat(this.#root)
    if (rootStat.isSymbolicLink()) {
      throw new ImageStorageError()
    }
    return realpath(this.#root)
  }

  async #resolveKey(key: string, createDirectory: boolean): Promise<string> {
    if (!keyPattern.test(key)) {
      throw new ImageStorageError()
    }
    const root = await this.#rootPath()
    const candidate = resolve(root, ...key.split("/"))
    if (!contains(root, candidate)) {
      throw new ImageStorageError()
    }
    const directory = dirname(candidate)
    if (createDirectory) {
      await mkdir(directory, { mode: 0o700, recursive: true })
      await chmod(directory, 0o700)
    }
    const actualDirectory = await realpath(directory)
    if (!contains(root, actualDirectory)) {
      throw new ImageStorageError()
    }
    const contained = resolve(actualDirectory, basename(candidate))
    if (!contains(root, contained)) {
      throw new ImageStorageError()
    }
    return contained
  }

  async saveValidatedImage(input: SaveValidatedImageInput): Promise<SavedImage> {
    const year = input.serverTime.getUTCFullYear().toString().padStart(4, "0")
    const month = (input.serverTime.getUTCMonth() + 1).toString().padStart(2, "0")
    const key = `reports/${year}/${month}/${randomUUID()}.${input.extension}`
    const finalPath = await this.#resolveKey(key, true)
    const temporaryPath = `${finalPath}.${randomUUID()}.tmp`
    let handle: Awaited<ReturnType<typeof open>> | null = null
    try {
      handle = await open(temporaryPath, "wx", 0o600)
      await handle.writeFile(input.bytes)
      await handle.sync()
      await handle.close()
      handle = null
      await link(temporaryPath, finalPath)
      await unlink(temporaryPath)
      return { key }
    } catch (error) {
      if (handle !== null) {
        try {
          await handle.close()
        } catch {
          throw new ImageStorageError()
        }
      }
      await unlink(temporaryPath).catch((cleanupError: unknown) => {
        if (!isMissing(cleanupError)) {
          throw new ImageStorageError()
        }
      })
      if (error instanceof ImageStorageError || isAlreadyPresent(error)) {
        throw new ImageStorageError()
      }
      throw new ImageStorageError()
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = await this.#resolveKey(key, true)
    try {
      await unlink(fullPath)
    } catch (error) {
      if (!isMissing(error)) {
        throw new ImageStorageError()
      }
    }
  }

  async read(key: string): Promise<StoredImage> {
    try {
      const fullPath = await this.#resolveKey(key, false)
      return { bytes: await readFile(fullPath), extension: extensionFromKey(key) }
    } catch (error) {
      if (error instanceof ImageStorageError) {
        throw error
      }
      throw new ImageStorageError()
    }
  }
}

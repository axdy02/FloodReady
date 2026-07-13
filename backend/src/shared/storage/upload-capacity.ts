export class UploadCapacityError extends Error {
  override readonly name = "UploadCapacityError"

  constructor() {
    super("Upload processing capacity unavailable")
  }
}

export type ReleaseUploadCapacity = () => void

interface WaitingRequest {
  resolve(release: ReleaseUploadCapacity): void
}

export class UploadCapacity {
  readonly #concurrency: number
  readonly #maxWaiting: number
  readonly #waiting: WaitingRequest[] = []
  #active = 0

  constructor(concurrency: number, maxWaiting: number) {
    this.#concurrency = concurrency
    this.#maxWaiting = maxWaiting
  }

  acquire(): Promise<ReleaseUploadCapacity> {
    if (this.#active < this.#concurrency) {
      this.#active += 1
      return Promise.resolve(this.#createRelease())
    }
    if (this.#waiting.length >= this.#maxWaiting) {
      return Promise.reject(new UploadCapacityError())
    }
    return new Promise<ReleaseUploadCapacity>((resolveWaiting) => {
      this.#waiting.push({ resolve: resolveWaiting })
    })
  }

  #createRelease(): ReleaseUploadCapacity {
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      const waiting = this.#waiting.shift()
      if (waiting === undefined) {
        this.#active -= 1
        return
      }
      waiting.resolve(this.#createRelease())
    }
  }
}

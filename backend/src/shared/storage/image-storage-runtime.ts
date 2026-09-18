import { config } from "../../config/index.js"
import { createImageStorage } from "./image-storage-factory.js"

export const imageStorage = createImageStorage(config)

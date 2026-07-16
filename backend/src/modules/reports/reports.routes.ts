import { Router } from "express"
import { config } from "../../config/env.js"
import { authenticate } from "../../middleware/authenticate.js"
import { requireRoles } from "../../middleware/authorize.js"
import {
  parseJsonBody,
  requireJsonContentType,
  requireMultipartContentType,
} from "../../middleware/content-type.js"
import {
  createUserRateLimit,
  createReportMapRateLimit,
  reportIpRateLimit,
} from "../../middleware/rate-limit.js"
import { LocalImageStorage } from "../../shared/storage/local-image-storage.js"
import { UploadCapacity } from "../../shared/storage/upload-capacity.js"
import { ReportsController } from "./reports.controller.js"
import { ReportsService } from "./reports.service.js"
import {
  createMultipartParser,
  createUploadCapacityMiddleware,
} from "./reports.upload.js"

const maxBytes = config.MAX_UPLOAD_SIZE_MB * 1_048_576
const storage = new LocalImageStorage(config.UPLOAD_DIRECTORY)
const service = new ReportsService(storage, { maxBytes, maxPixels: config.MAX_IMAGE_PIXELS })
const controller = new ReportsController(service)
const capacity = new UploadCapacity(
  config.UPLOAD_PROCESSING_CONCURRENCY,
  config.UPLOAD_QUEUE_MAX,
)
const parseMultipart = createMultipartParser(maxBytes)
const acquireCapacity = createUploadCapacityMiddleware(capacity)
const userRateLimit = createUserRateLimit()
const reportMapRateLimit = createReportMapRateLimit()

export const reportsRouter = Router()

reportsRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store")
  next()
})

reportsRouter.post(
  "/analyze",
  reportIpRateLimit,
  requireMultipartContentType,
  authenticate,
  userRateLimit,
  acquireCapacity,
  parseMultipart,
  controller.analyze,
)
reportsRouter.post(
  "/",
  reportIpRateLimit,
  requireMultipartContentType,
  authenticate,
  userRateLimit,
  acquireCapacity,
  parseMultipart,
  controller.create,
)
reportsRouter.get("/", authenticate, requireRoles("MODERATOR", "ADMIN"), controller.list)
reportsRouter.get("/map", authenticate, reportMapRateLimit, controller.listMap)
reportsRouter.get("/:reportId/image", authenticate, controller.getImage)
reportsRouter.post("/:reportId/retry-ai", reportIpRateLimit, authenticate, userRateLimit, controller.retryAnalysis)
reportsRouter.get("/:reportId", authenticate, controller.get)
reportsRouter.post("/:reportId/submit", requireJsonContentType, parseJsonBody, authenticate, controller.submitDraft)
reportsRouter.patch("/:reportId", requireJsonContentType, parseJsonBody, authenticate, controller.updateOwned)
reportsRouter.patch(
  "/:reportId/status",
  requireJsonContentType,
  parseJsonBody,
  authenticate,
  requireRoles("MODERATOR", "ADMIN"),
  controller.moderate,
)

export const ownReportsRouter = Router()

ownReportsRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store")
  next()
})

ownReportsRouter.get("/", authenticate, controller.listOwn)

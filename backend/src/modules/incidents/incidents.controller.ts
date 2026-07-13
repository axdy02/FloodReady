import type { RequestHandler } from "express"
import { validateRequest } from "../../shared/validation/request-validation.js"
import { get, list } from "./incidents.service.js"
import { incidentIdSchema, incidentQuerySchema } from "./incidents.validation.js"

export const listController: RequestHandler = async (request, response) => {
  const page = await list(validateRequest("query", () => incidentQuerySchema.parse(request.query)))
  response.json({ success: true, data: page, requestId: request.requestId })
}

export const getController: RequestHandler = async (request, response) => {
  const { incidentId } = validateRequest("params", () => incidentIdSchema.parse(request.params))
  response.json({ success: true, data: await get(incidentId), requestId: request.requestId })
}

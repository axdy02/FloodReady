import { z } from "zod";
import { reportDtoSchema } from "@/lib/api/contracts";
import { request } from "@/lib/api/request";
import { reportPageSchema } from "@/lib/api/contracts";
const reportImageSchema = z.object({ blob: z.instanceof(Blob), mime: z.enum(["image/jpeg", "image/png", "image/webp"]) });
export const reportsApi = { create: (body: FormData, accessToken: string) => request({ method: "POST", path: "/reports", body, accessToken, schema: reportDtoSchema, timeoutClass: "imageUpload" }), detail: (id: string, accessToken: string) => request({ method: "GET", path: `/reports/${id}`, accessToken, schema: reportDtoSchema }), retryAnalysis: (id: string, accessToken: string) => request({ method: "POST", path: `/reports/${id}/retry-ai`, accessToken, schema: reportDtoSchema }), image: (id: string, accessToken: string, signal?: AbortSignal) => request({ method: "GET", path: `/reports/${id}/image`, accessToken, ...(signal === undefined ? {} : { signal }), responseMode: "protectedReportImage", schema: reportImageSchema }), own: (query: string, accessToken: string) => request({ method: "GET", path: `/users/me/reports?${query}`, accessToken, schema: reportPageSchema }) };

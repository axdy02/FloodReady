import { z } from "zod";
import { draftAnalysisDtoSchema, reportDtoSchema, reportPageSchema, type ReportDto } from "@/lib/api/contracts";
import { request } from "@/lib/api/request";

const reportImageSchema = z.object({
  blob: z.instanceof(Blob),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const reportsApi = {
  create: (body: FormData, accessToken: string) => request({ method: "POST", path: "/reports", body, accessToken, schema: reportDtoSchema, timeoutClass: "imageUpload" }),
  analyze: (body: FormData, accessToken: string) => request({ method: "POST", path: "/reports/analyze", body, accessToken, schema: draftAnalysisDtoSchema, timeoutClass: "aiAnalysis" }),
  submitDraft: (draftId: string, body: { finalSeverity: ReportDto["finalSeverity"] }, accessToken: string) => request({ method: "POST", path: `/reports/${draftId}/submit`, body: JSON.stringify(body), accessToken, schema: reportDtoSchema }),
  detail: (id: string, accessToken: string) => request({ method: "GET", path: `/reports/${id}`, accessToken, schema: reportDtoSchema }),
  image: (id: string, accessToken: string, signal?: AbortSignal) => request({ method: "GET", path: `/reports/${id}/image`, accessToken, ...(signal === undefined ? {} : { signal }), responseMode: "protectedReportImage", schema: reportImageSchema }),
  own: (query: string, accessToken: string) => request({ method: "GET", path: `/users/me/reports?${query}`, accessToken, schema: reportPageSchema }),
};

import { reportDtoSchema } from "@/lib/api/contracts";
import { request } from "@/lib/api/request";
import { reportPageSchema } from "@/lib/api/contracts";
export const reportsApi = { create: (body: FormData, accessToken: string) => request({ method: "POST", path: "/reports", body, accessToken, schema: reportDtoSchema, timeoutClass: "imageUpload" }), detail: (id: string, accessToken: string) => request({ method: "GET", path: `/reports/${id}`, accessToken, schema: reportDtoSchema }), own: (query: string, accessToken: string) => request({ method: "GET", path: `/users/me/reports?${query}`, accessToken, schema: reportPageSchema }) };

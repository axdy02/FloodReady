import { incidentDtoSchema, incidentPageSchema } from "@/lib/api/contracts";
import { request } from "@/lib/api/request";
export const incidentsApi = { list: (query: string) => request({ method: "GET", path: `/incidents${query}`, schema: incidentPageSchema }), detail: (id: string) => request({ method: "GET", path: `/incidents/${id}`, schema: incidentDtoSchema }) };

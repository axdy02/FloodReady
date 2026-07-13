import { authDtoSchema, backendHealthSchema, incidentPageSchema, reportDtoSchema, reportMapPageSchema, reportPageSchema, userDtoSchema, userPageSchema } from "@/lib/api/contracts";
import { request } from "@/lib/api/request";

export const api = {
  ready: () => request({ method: "GET", path: "/health/ready", schema: backendHealthSchema }),
  register: (body: BodyInit) => request({ method: "POST", path: "/auth/register", body, schema: userDtoSchema }),
  login: (body: BodyInit) => request({ method: "POST", path: "/auth/login", body, schema: authDtoSchema }),
  me: (accessToken: string) => request({ method: "GET", path: "/auth/me", accessToken, schema: userDtoSchema }),
  listUsers: (query: string, accessToken: string) => request({ method: "GET", path: `/users${query}`, accessToken, schema: userPageSchema }),
  listReports: (query: string, accessToken: string) => request({ method: "GET", path: `/reports${query}`, accessToken, schema: reportPageSchema }),
  ownReports: (query: string, accessToken: string) => request({ method: "GET", path: `/users/me/reports${query}`, accessToken, schema: reportPageSchema }),
  mapReports: (query: string, accessToken: string) => request({ method: "GET", path: `/reports/map${query}`, accessToken, schema: reportMapPageSchema }),
  report: (id: string, accessToken: string) => request({ method: "GET", path: `/reports/${id}`, accessToken, schema: reportDtoSchema }),
  incidents: (query: string) => request({ method: "GET", path: `/incidents${query}`, schema: incidentPageSchema })
};

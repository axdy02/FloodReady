import { authDtoSchema, userDtoSchema } from "@/lib/api/contracts";
import { request } from "@/lib/api/request";
import { z } from "zod";

export const authApi = {
  register: (body: BodyInit) => request({ method: "POST", path: "/auth/register", body, schema: userDtoSchema }),
  login: (body: BodyInit) => request({ method: "POST", path: "/auth/login", body, schema: authDtoSchema }),
  refresh: () => request({ method: "POST", path: "/auth/refresh", schema: authDtoSchema }),
  logout: () => request({ method: "POST", path: "/auth/logout", schema: z.null() })
};

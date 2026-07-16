import { userDtoSchema } from "@/lib/api/contracts";
import { request } from "@/lib/api/request";

export const usersApi = {
  getMe: (accessToken: string) => request({ method: "GET", path: "/users/me", accessToken, schema: userDtoSchema }),
  updateMe: (body: BodyInit, accessToken: string) => request({ method: "PATCH", path: "/users/me", body, accessToken, schema: userDtoSchema })
};

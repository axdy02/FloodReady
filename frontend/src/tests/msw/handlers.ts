import { http, HttpResponse } from "msw";
import { validAuth } from "@/tests/fixtures/contracts";

export const handlers = [http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.json({ success: true, data: validAuth, requestId: "10000000-0000-4000-8000-000000000001" }))];

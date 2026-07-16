import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loadServerEnvironment } from "@/lib/env/server";
import { createContentSecurityPolicy } from "@/lib/security/csp";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const headers = new Headers(request.headers);
  headers.delete("x-nonce");
  headers.delete("content-security-policy");
  const environment = loadServerEnvironment();
  const policy = createContentSecurityPolicy(environment, nonce, environment.NODE_ENV === "development");
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico|favicon.svg).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }]
};

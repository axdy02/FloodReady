import type { ClientEnvironment } from "@/lib/env/client";

export function createContentSecurityPolicy(environment: ClientEnvironment, nonce: string, development: boolean): string {
  const unsafeEval = development ? " 'unsafe-eval'" : "";
  const upgrade = environment.FRONTEND_ENV === "production" ? "; upgrade-insecure-requests" : "";
  const connect = [...environment.mapConnectOrigins].sort().join(" ");
  const images = [...environment.mapImageOrigins].sort().join(" ");
  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${unsafeEval}; script-src-attr 'none'; style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; connect-src 'self' ${new URL(environment.NEXT_PUBLIC_API_BASE_URL).origin} ${connect}; img-src 'self' data: blob: ${images}; worker-src 'self' blob:; font-src 'self' data:; manifest-src 'self'; frame-src 'none'; media-src 'none'${upgrade}`;
}

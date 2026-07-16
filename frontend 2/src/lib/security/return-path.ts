export function sanitizeReturnPath(value: string | null | undefined): string {
  if (value === null || value === undefined || value.length === 0 || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value)) return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f\u007f]/u.test(decoded)) return "/dashboard";
    const parsed = new URL(decoded, "http://localhost:3000");
    if (parsed.origin !== "http://localhost:3000" || parsed.username !== "" || parsed.password !== "" || parsed.pathname === "/login" || parsed.pathname === "/register") return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    void error;
    return "/dashboard";
  }
}

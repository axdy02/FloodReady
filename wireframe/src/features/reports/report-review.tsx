import type { ReportDraft } from "@/features/reports/types";
export function ReportReview({ draft }: { draft: ReportDraft }) { return <section aria-label="Review report"><p>This report will be submitted as unverified citizen evidence.</p><p>Claimed severity: {draft.severity || "Not provided"}</p><p>Category: {draft.category}</p><p>{draft.description}</p></section>; }

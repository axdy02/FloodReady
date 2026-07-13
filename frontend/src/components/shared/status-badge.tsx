import { Badge } from "@/components/ui/badge";

const labels = { SUBMITTED: "Submitted", PENDING_REVIEW: "Pending review", PROVISIONAL: "Provisional", VERIFIED: "Verified", DISPUTED: "Disputed", RESOLVED: "Resolved", STALE: "Stale", REJECTED: "Rejected" } as const;

export function StatusBadge({ status }: { status: keyof typeof labels }) {
  return <Badge variant={status === "VERIFIED" || status === "RESOLVED" ? "default" : "secondary"}>{labels[status]}</Badge>;
}

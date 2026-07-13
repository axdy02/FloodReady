import type { LocationValue } from "@/features/map/types";
export type ReportDraft = { file: File | null; capturedAt: string | null; location: LocationValue | null; category: string; severity: string; description: string };

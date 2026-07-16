import { CarFront, CircleAlert, CircleDashed, CircleOff, Construction, Droplets, TreePine, TriangleAlert, Waves } from "lucide-react";
import type { ReportMapDto } from "@/lib/api/contracts";

const icons = { ROAD_WATERLOGGING: Droplets, FLOODED_ROAD: Waves, CLOGGED_DRAIN: CircleOff, OVERFLOWING_DRAIN: CircleAlert, OPEN_MANHOLE: CircleDashed, FALLEN_TREE: TreePine, STRANDED_VEHICLE: CarFront, UNDERPASS_FLOODING: Construction, OTHER: TriangleAlert } as const;

export function CategoryMarker({ report }: { report: ReportMapDto }) { const Icon = icons[report.category]; return <span aria-label={`${report.category} ${report.verificationStatus}`} data-report-id={report.id} className="inline-flex rounded border p-2"><Icon aria-hidden="true" />{report.verificationStatus === "VERIFIED" ? "Verified" : "Unverified citizen report."}</span>; }

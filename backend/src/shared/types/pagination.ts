export type SortDirection = 'asc' | 'desc';

export type StandardCursorResource = 'users' | 'reports' | 'ownReports' | 'incidents';

export type CursorResource = StandardCursorResource | 'reportMap';

interface CursorPayloadBase {
  v: 1;
  sort: SortDirection;
  timestamp: string;
  id: string;
  filterHash: string;
}

export interface StandardCursorPayload extends CursorPayloadBase {
  resource: StandardCursorResource;
}

export interface ReportMapCursorPayload extends CursorPayloadBase {
  resource: 'reportMap';
  actorId: string;
}

export type CursorPayload = StandardCursorPayload | ReportMapCursorPayload;

export interface PaginationDto {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface KeysetPage<T> {
  items: T[];
  pagination: PaginationDto;
}

export interface TotalCountPage<T> extends KeysetPage<T> {
  totalCount: number;
}

export interface BoundingBox {
  east: number;
  north: number;
  south: number;
  west: number;
}

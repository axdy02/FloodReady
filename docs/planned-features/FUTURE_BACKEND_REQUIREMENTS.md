# Future backend requirements

Every item below is a **BACKEND REQUIREMENT — NOT IMPLEMENTED BY THIS FRONTEND TASK**.

- PostGIS-backed incident clustering with documented radius/time/category rules and immutable cluster identifiers.
- Cluster list/detail endpoints with report counts, server-calculated affected radius, lifecycle reason, road passability, trend, activity score and merge/split history.
- Paginated cluster media endpoint with authorization checks and short-lived controlled image URLs or protected image streaming.
- Geocoding proxy plus area search and backend-calculated area statistics/boundaries.
- Grounded area-summary aggregation and an AI-summary endpoint that receives only structured, non-personal facts.
- Alert generation, persistence, expiry, read/dismiss state, delivery tracking, nearby targeting and predictive-risk source metadata.
- Saved-area CRUD and notification preferences tied to authenticated users.
- Road-clear confirmation endpoint with duplicate prevention, quorum/authority workflow and audit log.
- Lifecycle jobs with category-specific inactivity rules and explanation strings.
- Escalation prediction service with backend-calculated factor list and cautious confidence labels.
- Realtime update channel, caching, pagination and rate limiting for area/cluster workloads.

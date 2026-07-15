# Image lifecycle

The browser previews the selected local file only. Backend 1 validates the actual file signature, dimensions, and MIME type, strips unsafe metadata by re-encoding it, then stores it with an opaque private key. Backend 2 receives bytes over the internal service boundary only for an analysis attempt and does not persist them. The frontend requests a submitted photo through an authenticated Backend 1 endpoint; stored paths are never exposed in API DTOs.

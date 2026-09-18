# EC2 deployment (temporary public HTTP)

This repository has two Compose modes. `docker-compose.yml` is the secure local default: frontend, Backend 1, and Backend 2 bind only to `127.0.0.1`. `docker-compose.ec2.yml` is an explicit EC2 overlay for the milestone demo. It exposes only the main frontend on port 3000 and Backend 1 on port 3001. Backend 2 and PostgreSQL remain private Docker-network services.

## AWS prerequisites

1. Create a private S3 bucket, for example `waterradar-evidence-images`, in `ap-south-1` (or set the matching region below). Do not make the bucket public and do not configure public object ACLs.
2. Attach an EC2 instance role with least-privilege access to that bucket: `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` for `reports/*`, plus `s3:ListBucket` for the bucket health check. The application uses the AWS SDK v3 default credential provider chain; do not add long-lived AWS access keys to `.env` or Compose.
3. If Docker containers cannot obtain the instance role, set the EC2 instance metadata hop limit to at least `2`; the SDK otherwise cannot reach IMDS from the container.
4. Create a security group that allows SSH (`22`) only from the administrator IP, and allows TCP `3000` and `3001` from the evaluator. Do **not** open `5432` or `8000`.

## EC2 `.env`

Copy `.env.example` to `.env`, generate the application secrets, and set these deployment values. Replace `EC2_PUBLIC_IP` exactly; do not include angle brackets.

```dotenv
NODE_ENV=production
IMAGE_STORAGE_DRIVER=s3
AWS_REGION=ap-south-1
S3_BUCKET_NAME=waterradar-evidence-images

PUBLIC_API_ORIGIN=http://EC2_PUBLIC_IP:3001
CORS_ORIGINS=http://EC2_PUBLIC_IP:3000
COOKIE_DOMAIN=
COOKIE_SECURE=false
ALLOW_INSECURE_PUBLIC_HTTP=true

AI_SERVICE_BASE_URL=http://ai-service:8000
FRONTEND_ENV=production
NEXT_PUBLIC_API_BASE_URL=http://EC2_PUBLIC_IP:3001/api/v1
INTERNAL_API_BASE_URL=http://backend:3000/api/v1
NEXT_PUBLIC_APP_ORIGIN=http://EC2_PUBLIC_IP:3000
NEXT_PUBLIC_ALLOW_INSECURE_PUBLIC_HTTP=true
```

The frontend opt-in is compiled during the Docker build. Without the exact value `true`, a public HTTP API/app URL is rejected. This override is only for the milestone’s IP-and-port deployment. When a domain and HTTPS are available, use HTTPS origins, remove both insecure-HTTP flags, and omit `COOKIE_SECURE` (production then defaults to secure refresh cookies).

## Start and verify

From the repository root on EC2:

```bash
docker compose -f docker-compose.yml -f docker-compose.ec2.yml --env-file .env up -d --build
docker compose -f docker-compose.yml -f docker-compose.ec2.yml --env-file .env ps
curl -f http://127.0.0.1:3001/api/v1/health/ready
curl -f http://127.0.0.1:3000/api/health
```

Open `http://EC2_PUBLIC_IP:3000` from a different machine and sign in. Submit a JPEG, PNG, or WebP report. Confirm that a report is created, its map marker appears, and its AI status changes from processing to a result or a retained manual-review failure.

## Image and AI path

1. Backend 1 validates and re-encodes the multipart image.
2. `S3ImageStorage` writes it privately as `reports/<report-id>/<uuid>.<extension>`; PostgreSQL stores only the key and image metadata in `flood_reports.image_path`.
3. Backend 1 reads the stored object back through the `ImageStorage` interface and sends those exact bytes in its authenticated internal request to `http://ai-service:8000`.
4. Backend 2 preprocesses the in-memory image, runs its LangGraph workflow, and returns structured analysis. It has no S3 or PostgreSQL credentials.
5. Backend 1 persists the AI output. Later image views still stream privately through authenticated `GET /api/v1/reports/:reportId/image`; no public S3 URL is issued.

The S3 driver runs a bucket health check at startup and as part of Backend 1 readiness. A missing bucket, missing region, or missing EC2 role permission makes readiness fail instead of silently falling back to disk.

## Network exposure

| Component | EC2 exposure | Purpose |
| --- | --- | --- |
| Frontend | `0.0.0.0:3000` | Evaluator browser |
| Backend 1 | `0.0.0.0:3001` | Browser API |
| Backend 2 / FastAPI | Docker `expose: 8000` only | Backend 1 internal AI calls |
| PostgreSQL / PostGIS | Docker network only | Backend persistence |

The overlay does not publish the wireframe app. Keep the local command without the overlay for normal loopback-only development.

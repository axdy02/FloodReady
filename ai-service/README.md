# FloodReady AI service

This is the Milestone 1 health-only FastAPI service. It listens on port 8000, runs as UID/GID 10001 in the container, and exposes `/health` and `/health/ready` with stable JSON envelopes.

## Local verification

From `ai-service/`, install the locked development dependencies and run the checks:

```powershell
.\.venv\Scripts\python.exe -m ruff check app tests scripts
.\.venv\Scripts\python.exe -m ruff format --check app tests scripts
.\.venv\Scripts\python.exe -m mypy app tests scripts
.\.venv\Scripts\python.exe scripts/check_source.py
```

To verify the hardened image from the repository root:

```powershell
ai-service\.venv\Scripts\python.exe ai-service/scripts/verify_container.py --build-context ai-service
```

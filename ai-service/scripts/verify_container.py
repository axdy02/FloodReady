import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path


def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, capture_output=True, text=True, encoding="utf-8", errors="replace")


def inspect_value(container: str, template: str) -> str:
    return run(["docker", "inspect", container, "--format", template]).stdout.strip()


def docker_request(port: str, path: str, request_id: str | None = None) -> tuple[int, dict[str, object], str]:
    headers = {"Host": "localhost"}
    if request_id is not None:
        headers["X-Request-Id"] = request_id
    request = urllib.request.Request(f"http://127.0.0.1:{port}{path}", headers=headers)
    with urllib.request.urlopen(request, timeout=3) as response:
        return response.status, json.loads(response.read()), response.headers.get("X-Request-Id", "")


def assert_health(port: str) -> None:
    status, body, response_id = docker_request(port, "/health")
    if status != 200 or body.get("success") is not True or body.get("data") != {"status": "ok"}:
        raise SystemExit("health contract failed")
    if not uuid.UUID(response_id) or body.get("requestId") != response_id:
        raise SystemExit("health request id contract failed")
    status, body, response_id = docker_request(port, "/health/ready")
    if status != 200 or body.get("success") is not True or body.get("data") != {"status": "ready"}:
        raise SystemExit("readiness contract failed")
    if not uuid.UUID(response_id) or body.get("requestId") != response_id:
        raise SystemExit("readiness request id contract failed")
    expected = "123e4567-e89b-12d3-a456-426614174000"
    status, body, response_id = docker_request(port, "/health", expected)
    if status != 200 or response_id != expected or body.get("requestId") != expected:
        raise SystemExit("valid request id contract failed")
    status, body, response_id = docker_request(port, "/health", "not-a-uuid")
    if (
        status != 200
        or response_id == "not-a-uuid"
        or not uuid.UUID(response_id)
        or body.get("requestId") != response_id
    ):
        raise SystemExit("invalid request id contract failed")


def assert_runtime_content(container: str) -> None:
    modules = "pytest pytest_cov httpx ruff mypy pip_tools"
    code = (
        "import importlib.util,sys; names='"
        + modules
        + "'.split(); bad=[n for n in names if importlib.util.find_spec(n) is not None]; "
        + "sys.exit(1 if bad else 0)"
    )
    if run(["docker", "exec", container, "python", "-c", code], check=False).returncode != 0:
        raise SystemExit("forbidden runtime package present")
    paths = "tests .pytest_cache .env requirements-dev.lock requirements.in scripts"
    find_code = (
        "import pathlib,sys; roots=(pathlib.Path('/app'),pathlib.Path('/usr/local/lib/python3.13/site-packages')); names='"
        + paths
        + "'.split(); found=[]; "
        + "[found.append(str(p)) for root in roots for p in root.rglob('*') if p.name in names]; "
        + "sys.exit(1 if found else 0)"
    )
    if run(["docker", "exec", container, "python", "-c", find_code], check=False).returncode != 0:
        raise SystemExit("forbidden runtime content present")
    if (
        run(["docker", "exec", container, "sh", "-c", "touch /tmp/wp13 && test -f /tmp/wp13"], check=False).returncode
        != 0
    ):
        raise SystemExit("tmpfs is not writable")
    if run(["docker", "exec", container, "sh", "-c", "touch /app/wp13-write-test"], check=False).returncode == 0:
        raise SystemExit("app tree is writable")
    for executable in ("gcc", "cc", "make"):
        if run(["docker", "exec", container, "sh", "-c", f"command -v {executable}"], check=False).returncode == 0:
            raise SystemExit("compiler or build tool present")


def main() -> None:
    context = Path.cwd()
    if len(sys.argv) == 3 and sys.argv[1] == "--build-context":
        context = Path(sys.argv[2]).resolve()
    else:
        raise SystemExit("expected --build-context <path>")
    run_id = uuid.uuid4().hex[:12]
    image = f"floodready-ai-service:wp13-{run_id}"
    container = f"floodready-ai-wp13-{run_id}"
    label = f"com.floodready.wp13-run={run_id}"
    if len(run_id) != 12 or any(char not in "0123456789abcdef" for char in run_id):
        raise SystemExit("invalid run id")
    try:
        if run(["docker", "image", "inspect", image], check=False).returncode == 0:
            raise SystemExit("owned image already exists")
        if run(["docker", "container", "inspect", container], check=False).returncode == 0:
            raise SystemExit("owned container already exists")
        run(["docker", "build", "--pull", "--no-cache", "--label", label, "--tag", image, str(context)])
        metadata = json.loads(run(["docker", "image", "inspect", image]).stdout)[0]
        if metadata.get("Config", {}).get("User") != "10001:10001":
            raise SystemExit("image user contract failed")
        if metadata.get("Config", {}).get("WorkingDir") != "/app":
            raise SystemExit("image workdir contract failed")
        if not metadata.get("Config", {}).get("Healthcheck"):
            raise SystemExit("image healthcheck missing")
        if metadata.get("Config", {}).get("Labels", {}).get("com.floodready.wp13-run") != run_id:
            raise SystemExit("image ownership label failed")
        history = run(["docker", "history", "--no-trunc", "--format", "{{.CreatedBy}}", image]).stdout.lower()
        if any(term in history for term in ("password", "secret", "token", "api_key", "private_key")):
            raise SystemExit("secret-like image history content")
        run(
            [
                "docker",
                "run",
                "--detach",
                "--name",
                container,
                "--user",
                "10001:10001",
                "--read-only",
                "--tmpfs",
                "/tmp",
                "--cap-drop",
                "ALL",
                "--security-opt",
                "no-new-privileges:true",
                "-e",
                "AI_ENV=production",
                "-e",
                "AI_HOST=0.0.0.0",
                "-e",
                "AI_PORT=8000",
                "-e",
                "AI_LOG_LEVEL=info",
                "-e",
                "AI_TRUSTED_HOSTS=localhost,127.0.0.1,ai-service",
                "-e",
                "AI_BODY_LIMIT_BYTES=65536",
                "-e",
                "AI_SHUTDOWN_TIMEOUT_SECONDS=10",
                "-p",
                "127.0.0.1::8000",
                image,
            ]
        )
        port = run(["docker", "port", container, "8000/tcp"]).stdout.strip().rsplit(":", 1)[-1]
        deadline = time.time() + 60
        while time.time() < deadline:
            try:
                status, _, _ = docker_request(port, "/health/ready")
                if status == 200:
                    break
            except (OSError, TimeoutError, urllib.error.URLError):
                time.sleep(1)
        else:
            raise SystemExit("health timeout")
        assert_health(port)
        if inspect_value(container, "{{.Config.User}}") != "10001:10001":
            raise SystemExit("runtime user contract failed")
        if run(["docker", "exec", container, "id", "-u"]).stdout.strip() != "10001":
            raise SystemExit("runtime uid contract failed")
        if run(["docker", "exec", container, "id", "-g"]).stdout.strip() != "10001":
            raise SystemExit("runtime gid contract failed")
        assert_runtime_content(container)
        started = time.time()
        run(["docker", "stop", "--time", "15", container])
        if time.time() - started > 15 or inspect_value(container, "{{.State.ExitCode}}") != "0":
            raise SystemExit("shutdown contract failed")
    finally:
        run(["docker", "rm", "--force", container], check=False)
        image_id_result = run(["docker", "image", "inspect", image], check=False)
        if image_id_result.returncode == 0:
            image_id = json.loads(image_id_result.stdout)[0]["Id"]
            labels = json.loads(image_id_result.stdout)[0].get("Config", {}).get("Labels", {})
            if labels.get("com.floodready.wp13-run") == run_id:
                run(["docker", "image", "rm", image_id], check=False)
            else:
                raise SystemExit("refusing unowned image removal")


if __name__ == "__main__":
    main()

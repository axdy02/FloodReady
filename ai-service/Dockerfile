FROM python:3.13.11-slim-bookworm@sha256:20080e807bfc404f8450b185cf0fc95d553462673598549613735f70a5b4d5d0 AS dependencies
WORKDIR /build
COPY requirements-prod.lock ./
RUN python -m pip install --no-cache-dir --require-hashes --prefix /runtime -r requirements-prod.lock

FROM python:3.13.11-slim-bookworm@sha256:20080e807bfc404f8450b185cf0fc95d553462673598549613735f70a5b4d5d0 AS runtime
WORKDIR /app
RUN groupadd --gid 10001 floodready && useradd --uid 10001 --gid 10001 --create-home floodready
COPY --from=dependencies /runtime /usr/local
COPY app ./app
RUN find /usr/local/lib/python3.13/site-packages -type d \( -name tests -o -name __pycache__ \) -prune -exec rm -rf {} + \
    && rm -rf /usr/share/gcc /usr/lib/gcc
USER 10001:10001
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 CMD python -c "import urllib.request; response=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8000/health/ready', headers={'Host':'localhost'}), timeout=2); raise SystemExit(0 if response.status == 200 else 1)"
CMD ["python", "-m", "app.server"]

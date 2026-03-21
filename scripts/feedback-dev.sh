#!/usr/bin/env bash
# feedback-dev.sh — starts MinIO + playground for feedback-upload development
#
# Supports two modes:
#   Nix/native  — uses `minio` + `mc` binaries (provided by the Nix flake)
#   Docker      — uses the minio/minio and minio/mc Docker images
#
# Usage: npm run playground:feedback-dev
set -euo pipefail

BUCKET="wp-agentic-feedback"
MINIO_PORT=9000
CONSOLE_PORT=9001
ENDPOINT="http://localhost:${MINIO_PORT}/${BUCKET}"
CONTAINER_NAME="wp-agentic-minio"

# ── Detect runtime ────────────────────────────────────────────────────────────
if command -v minio >/dev/null 2>&1 && command -v mc >/dev/null 2>&1; then
	USE_DOCKER=false
	echo "Using native minio + mc"
elif command -v docker >/dev/null 2>&1; then
	USE_DOCKER=true
	echo "Using Docker (minio/minio + minio/mc images)"
else
	echo "Error: neither 'minio'+'mc' (Nix) nor 'docker' found."
	echo "See docs/FEEDBACK-DEV.md for setup instructions."
	exit 1
fi

# ── Cleanup on exit ───────────────────────────────────────────────────────────
MINIO_PID=""
MINIO_LOG="minio-data/minio.log"
cleanup() {
	echo ""
	echo "Shutting down MinIO..."
	if [ "$USE_DOCKER" = true ]; then
		docker stop "$CONTAINER_NAME" 2>/dev/null || true
		docker rm   "$CONTAINER_NAME" 2>/dev/null || true
	elif [ -n "$MINIO_PID" ]; then
		kill "$MINIO_PID" 2>/dev/null || true
		wait "$MINIO_PID" 2>/dev/null || true  # wait for it to actually exit
	fi
}
trap cleanup EXIT INT TERM

# ── Start MinIO ───────────────────────────────────────────────────────────────
mkdir -p minio-data

if [ "$USE_DOCKER" = true ]; then
	# Remove stale container if present
	docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
	docker run -d \
		--name "$CONTAINER_NAME" \
		-p "${MINIO_PORT}:9000" \
		-p "${CONSOLE_PORT}:9001" \
		-v "$(pwd)/minio-data:/data" \
		-e MINIO_ROOT_USER=minioadmin \
		-e MINIO_ROOT_PASSWORD=minioadmin \
		minio/minio server /data --console-address ":9001"
else
	# Redirect output to log file so it doesn't interleave with script output
	minio server ./minio-data --console-address ":${CONSOLE_PORT}" \
		>"${MINIO_LOG}" 2>&1 &
	MINIO_PID=$!
fi

# ── Wait for MinIO to be ready ────────────────────────────────────────────────
echo "Waiting for MinIO on :${MINIO_PORT}..."
for i in $(seq 1 30); do
	if curl -sf "http://localhost:${MINIO_PORT}/minio/health/live" >/dev/null 2>&1; then
		echo "MinIO is ready."
		break
	fi
	if [ "$i" -eq 30 ]; then
		echo "Error: MinIO did not start in time."
		exit 1
	fi
	sleep 1
done

# ── mc wrapper ────────────────────────────────────────────────────────────────
# Native mode  : runs mc directly with MC_HOST_local env var.
# Docker mode  : runs minio/mc container sharing the minio container's network
#                namespace (so localhost:9000 reaches minio). Any argument that
#                is an existing local file is auto-mounted into the container.
run_mc() {
	if [ "$USE_DOCKER" = true ]; then
		local args=() mounts=()
		for arg in "$@"; do
			if [ -f "$arg" ]; then
				local cpath="/tmp/mc-$(basename "$arg")"
				mounts+=( -v "${arg}:${cpath}:ro" )
				args+=( "$cpath" )
			else
				args+=( "$arg" )
			fi
		done
		docker run --rm -i \
			--network "container:${CONTAINER_NAME}" \
			-e "MC_HOST_local=http://minioadmin:minioadmin@localhost:9000" \
			"${mounts[@]+"${mounts[@]}"}" \
			minio/mc "${args[@]}"
	else
		MC_HOST_local="http://minioadmin:minioadmin@localhost:${MINIO_PORT}" \
			mc "$@"
	fi
}

# ── Configure bucket (idempotent) ─────────────────────────────────────────────
echo "Configuring bucket '${BUCKET}'..."

# Write config to temp files — mc doesn't support /dev/stdin as a path argument
POLICY_FILE=$(mktemp /tmp/minio-policy-XXXXXX.json)
CORS_FILE=$(mktemp /tmp/minio-cors-XXXXXX.xml)
trap 'rm -f "$POLICY_FILE" "$CORS_FILE"; cleanup' EXIT INT TERM

cat > "$POLICY_FILE" <<'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::wp-agentic-feedback/*"
    }
  ]
}
POLICY

cat > "$CORS_FILE" <<'CORS'
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedHeader>Content-Type</AllowedHeader>
  </CORSRule>
</CORSConfiguration>
CORS

run_mc mb --ignore-existing "local/${BUCKET}"
run_mc anonymous set-json "$POLICY_FILE" "local/${BUCKET}"

# CORS: mc cors set takes a file path (XML). Silently skipped if unavailable.
if run_mc cors set "local/${BUCKET}" "$CORS_FILE" 2>/dev/null; then
	echo "CORS configured."
else
	echo "Note: CORS not configured automatically — set it via the MinIO console at http://localhost:${CONSOLE_PORT} if the browser blocks PUT requests."
fi

echo "Bucket ready: ${ENDPOINT}"
echo "Console:      http://localhost:${CONSOLE_PORT}  (minioadmin / minioadmin)"

# ── Start playground (build + wp-now) with endpoint baked in ─────────────────
echo ""
echo "FEEDBACK_S3_ENDPOINT=${ENDPOINT}"
echo "Starting playground. Ctrl-C to stop everything."
echo "(MinIO log: ${MINIO_LOG})"
FEEDBACK_S3_ENDPOINT="${ENDPOINT}" npm run playground

# Feedback Upload — Local Development Guide

Opted-in ratings are PUT to an S3-compatible bucket so they can be used for
future fine-tuning runs. This guide explains how to run a local MinIO bucket
and wire it up to the plugin.

## Quick start

```bash
npm run playground:feedback-dev
```

This single command:

1. Starts MinIO (native binary or Docker — auto-detected)
2. Creates the `wp-agentic-feedback` bucket with an anonymous write policy and CORS
3. Builds the plugin with `FEEDBACK_S3_ENDPOINT` baked in
4. Starts the WordPress Playground

Stop everything with **Ctrl-C**.

## Prerequisites — pick one

### Option A: Nix / direnv (recommended)

`minio` and `mc` are provided by the project's Nix flake.
After `direnv allow` they are on your `PATH` automatically — no extra steps.

```bash
direnv allow   # first time only
npm run playground:feedback-dev
```

### Option B: Docker

Any system with Docker installed works. The script pulls `minio/minio` and
`minio/mc` automatically.

```bash
npm run playground:feedback-dev
```

No other tools required. The script detects Docker when the native binaries
are absent.

## Manual setup (without the npm script)

If you want to run MinIO independently — e.g. during active development with
`npm run watch` — follow the steps below.

### With Nix / native binaries

```bash
# Start MinIO — data stored in ./minio-data (gitignored)
minio server ./minio-data --console-address ":9001"
```

In a second terminal, create and configure the bucket (run once):

```bash
MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
  mc mb --ignore-existing local/wp-agentic-feedback

# anonymous policy (JSON file)
cat > /tmp/policy.json <<'EOF'
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
EOF
MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
  mc anonymous set-json /tmp/policy.json local/wp-agentic-feedback

# CORS (XML file) — required for browser PUT requests
cat > /tmp/cors.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedHeader>Content-Type</AllowedHeader>
  </CORSRule>
</CORSConfiguration>
EOF
MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
  mc cors set local/wp-agentic-feedback /tmp/cors.xml
```

### With Docker

```bash
# Start MinIO
docker run -d \
  --name wp-agentic-minio \
  -p 9000:9000 -p 9001:9001 \
  -v "$(pwd)/minio-data:/data" \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Write config files to the host
cat > /tmp/policy.json <<'EOF'
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
EOF

cat > /tmp/cors.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedHeader>Content-Type</AllowedHeader>
  </CORSRule>
</CORSConfiguration>
EOF

# Create bucket
docker run --rm \
  --network container:wp-agentic-minio \
  -e MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
  minio/mc mb --ignore-existing local/wp-agentic-feedback

# Apply anonymous policy
docker run --rm \
  --network container:wp-agentic-minio \
  -e MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
  -v /tmp/policy.json:/tmp/policy.json:ro \
  minio/mc anonymous set-json /tmp/policy.json local/wp-agentic-feedback

# Apply CORS
docker run --rm \
  --network container:wp-agentic-minio \
  -e MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
  -v /tmp/cors.xml:/tmp/cors.xml:ro \
  minio/mc cors set local/wp-agentic-feedback /tmp/cors.xml
```

## Building with feedback enabled

Set `FEEDBACK_S3_ENDPOINT` before building. When this variable is empty (the
default), the opt-in UI is hidden entirely — no banner, no thumbs buttons.

```bash
# .env  (gitignored — never commit this file)
FEEDBACK_S3_ENDPOINT=http://localhost:9000/wp-agentic-feedback
```

Then build:

```bash
npm run build
# or during active development:
npm run watch
```

The endpoint URL is inlined at build time by dotenv-webpack. Changing `.env`
requires a rebuild.

## Verifying uploads

Rate a response in the chat, then export all feedback files to `feedback-export/`
(gitignored):

```bash
npm run export:feedback
```

Pass a custom destination as needed:

```bash
npm run export:feedback -- ./my-export
```

Each file is a single labelled turn:

```json
{
  "messageId": "...",
  "sessionId": "...",
  "abilityIds": ["wp-agentic-admin/list-plugins"],
  "rating": "up",
  "comment": "",
  "timestamp": "2026-03-20T12:00:00.000Z",
  "model": "Qwen3-1.7B-q4f16_1-MLC",
  "conversation": [
    { "role": "user",      "content": "Check the error log first." },
    { "role": "assistant", "content": "The log shows a PHP warning in ..." },
    { "role": "user",      "content": "How do I deactivate the Yoast plugin?" },
    { "role": "assistant", "content": "I'll deactivate it for you. ..." }
  ]
}
```

## MinIO web console

Available at <http://localhost:9001> (credentials: `minioadmin` / `minioadmin`).
MinIO is **never** started automatically — start it manually when you need it.

#!/usr/bin/env bash
# Export all feedback JSONs from MinIO to a local folder.
#
# Usage:
#   npm run export:feedback              # → feedback-export/
#   npm run export:feedback -- ./out     # → ./out/
set -euo pipefail

DEST="${1:-feedback-export}"
BUCKET="wp-agentic-feedback"

mkdir -p "$DEST"

MC_HOST_local=http://minioadmin:minioadmin@localhost:9000 \
	mc mirror --overwrite "local/${BUCKET}/feedback/" "${DEST}/"

echo "Exported to ${DEST}/"
find "$DEST" -name "*.json" | wc -l | xargs -I{} echo "{} file(s) exported."

#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install

echo "Building the Next.js project..."
pnpm next build

echo "Bundling with @opennextjs/cloudflare..."
npx @opennextjs/cloudflare build

echo "Build completed successfully!"
#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install

echo "Building with Cloudflare next-on-pages adapter..."
npx @cloudflare/next-on-pages@1

echo "Build completed successfully!"
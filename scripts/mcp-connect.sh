#!/bin/bash
# First-use setup for a local checkout. Setup logs must never enter MCP stdout.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
    echo 'Census MCP requires Node.js 22+ and npm on PATH.' >&2
    exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Census MCP requires Node.js 22+."); process.exit(1) }'
if [ ! -d node_modules ] || [ ! -f mcp-server/dist/index.js ]; then
    echo 'Setting up Census MCP (first launch may take a minute)...' >&2
    npm ci --include=dev >&2
fi
exec node "$PROJECT_DIR/mcp-server/dist/index.js"

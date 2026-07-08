#!/usr/bin/env bash
# +------------------------------------------------------------+
# |  Fiber Merchant Kit - One-Command Start (macOS / Linux)    |
# |                                                            |
# |  This script installs dependencies and starts all          |
# |  three services concurrently:                              |
# |    - API Server      -> http://localhost:3001               |
# |    - Admin Dashboard -> http://localhost:5173               |
# |    - Demo Store      -> http://localhost:5174               |
# +------------------------------------------------------------+

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

load_env_file() {
  local env_file="$1"
  [ -f "$env_file" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    if [ -z "$line" ] || [[ "$line" == \#* ]] || [[ "$line" != *=* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key//[[:space:]]/}"

    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && [ -z "${!key+x}" ]; then
      export "$key=$value"
    fi
  done < "$env_file"
}

echo ""
echo "  Fiber Merchant Kit"
echo "  ===================="
echo ""

# -- Install dependencies -------------------------------------
echo "  Installing dependencies..."
npm install --silent
echo "  Dependencies installed."
echo ""

# -- Copy .env files if they don't exist -----------------------
if [ ! -f packages/api-server/.env ] && [ -f packages/api-server/.env.example ]; then
  cp packages/api-server/.env.example packages/api-server/.env
  echo "  Created packages/api-server/.env from .env.example"
fi

if [ ! -f packages/admin-dashboard/.env ] && [ -f packages/admin-dashboard/.env.example ]; then
  cp packages/admin-dashboard/.env.example packages/admin-dashboard/.env
  echo "  Created packages/admin-dashboard/.env from .env.example"
fi

if [ ! -f packages/demo-store/.env ] && [ -f packages/demo-store/.env.example ]; then
  cp packages/demo-store/.env.example packages/demo-store/.env
  echo "  Created packages/demo-store/.env from .env.example"
fi
load_env_file packages/api-server/.env
echo ""

# -- Start all services ----------------------------------------
echo "  Starting services..."
echo ""
echo "  +-------------------------------------------------------+"
echo "  |  API Server:      http://localhost:3001               |"
echo "  |  Admin Dashboard: http://localhost:5173               |"
echo "  |  Demo Store:      http://localhost:5174               |"
echo "  +-------------------------------------------------------+"
echo ""
echo "  Look for the API key in the server logs above."
echo "  Enter it in the dashboard at http://localhost:5173"
echo ""

npm run dev

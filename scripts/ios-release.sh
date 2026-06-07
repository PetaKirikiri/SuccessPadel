#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE=".env.production.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.example and set:"
  echo "  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_LINE_CHANNEL_ID"
  exit 1
fi

missing=()
for key in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_LINE_CHANNEL_ID; do
  if ! grep -E "^${key}=.+$" "$ENV_FILE" >/dev/null 2>&1; then
    missing+=("$key")
  fi
done
if ((${#missing[@]} > 0)); then
  echo "Set in $ENV_FILE: ${missing[*]}"
  exit 1
fi

echo "Building web bundle (production)…"
npm run build

echo "Syncing Capacitor iOS…"
npx cap sync ios

echo ""
echo "Next — on your Mac:"
echo "  1. open ios/App/App.xcodeproj"
echo "  2. Signing & Capabilities → your Team"
echo "  3. Product → Archive → Distribute → TestFlight"
echo ""
echo "LINE callback must include: successpadel://login"

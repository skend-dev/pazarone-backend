#!/bin/bash
set -euo pipefail

# Check if dist/src/main.js exists, if not, build
if [ ! -f dist/src/main.js ]; then
  echo "🔨 Building application (dist/src/main.js not found)..."
  npm run build

  echo "📊 Verifying build output..."
  if [ ! -f dist/src/main.js ]; then
    echo "❌ Error: dist/src/main.js not found after build!"
    echo "📂 Checking for main.js in other locations:"
    find . -name "main.js" -type f 2>/dev/null || echo "No main.js found anywhere"
    echo "Build may have failed. Check the build logs above."
    exit 1
  fi
  echo "✅ Build successful! Found dist/src/main.js"
else
  echo "✅ Build output already exists (dist/src/main.js found)"
fi

# Compiled JS migrations live under dist/src/migrations (see data-source.ts)
echo "🔄 Running database migrations..."
npm run migration:run:prod

echo "🚀 Starting application..."
exec node dist/src/main

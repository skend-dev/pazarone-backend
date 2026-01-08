#!/bin/bash
set -e

# Check if dist/main.js exists, if not, build
if [ ! -f dist/main.js ]; then
  echo "🔨 Building application (dist/main.js not found)..."
  npm run build
  
  echo "📊 Verifying build output..."
  if [ ! -f dist/main.js ]; then
    echo "❌ Error: dist/main.js not found after build!"
    echo "Build may have failed. Check the build logs above."
    exit 1
  fi
  echo "✅ Build successful!"
else
  echo "✅ Build output already exists (dist/main.js found)"
fi

echo "🔄 Running migrations..."
npm run migration:run || {
  echo "⚠️  Warning: Migrations failed or no migrations to run (this is OK if migrations are up to date)"
}

echo "🚀 Starting application..."
exec node dist/main

#!/bin/bash

# Original Theme Restoration Script
# Run this script to restore the original purple/navy theme

echo "🔄 Restoring Original Theme..."

# Restore original CSS files
echo "📁 Restoring CSS files..."
git checkout f1687a2 -- public/styles/main.css
git checkout f1687a2 -- docs/styles/main.css

# Restore original JavaScript component
echo "📁 Restoring EventScheduleManager.js..."
git checkout f1687a2 -- src/components/EventScheduleManager.js

# Rebuild the project
echo "🔨 Building project..."
npm run build

# Commit the restoration
echo "💾 Committing restoration..."
git add .
git commit -m "Restore original purple/navy theme - Revert Microsoft branding to original color scheme"

echo "✅ Original theme restored successfully!"
echo "🎨 Original colors:"
echo "   - Navbar: #232a5c (navy blue)"
echo "   - FAB: #3bb273 (green)" 
echo "   - Template Button: #6c7bbd (purple-blue)"
echo "   - Gradients: #232a5c to #3c4e8a"

echo ""
echo "🚀 You can now push changes with: git push"

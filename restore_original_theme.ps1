# Original Theme Restoration Script (PowerShell)
# Run this script to restore the original purple/navy theme

Write-Host "🔄 Restoring Original Theme..." -ForegroundColor Cyan

# Restore original CSS files
Write-Host "📁 Restoring CSS files..." -ForegroundColor Yellow
git checkout f1687a2 -- public/styles/main.css
git checkout f1687a2 -- docs/styles/main.css

# Restore original JavaScript component
Write-Host "📁 Restoring EventScheduleManager.js..." -ForegroundColor Yellow
git checkout f1687a2 -- src/components/EventScheduleManager.js

# Rebuild the project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build

# Commit the restoration
Write-Host "💾 Committing restoration..." -ForegroundColor Yellow
git add .
git commit -m "Restore original purple/navy theme - Revert Microsoft branding to original color scheme"

Write-Host "✅ Original theme restored successfully!" -ForegroundColor Green
Write-Host "🎨 Original colors:" -ForegroundColor Green
Write-Host "   - Navbar: #232a5c (navy blue)" -ForegroundColor White
Write-Host "   - FAB: #3bb273 (green)" -ForegroundColor White
Write-Host "   - Template Button: #6c7bbd (purple-blue)" -ForegroundColor White
Write-Host "   - Gradients: #232a5c to #3c4e8a" -ForegroundColor White

Write-Host ""
Write-Host "🚀 You can now push changes with: git push" -ForegroundColor Cyan

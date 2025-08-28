# Original Theme Backup

This file contains the original theme colors and styles that were used before implementing Microsoft branding as the default theme. This backup allows for easy restoration if needed.

## Original Color Scheme

### Primary Colors:
- **Navy Blue**: `#232a5c` (Main navbar, headers)
- **Purple**: `#3c4e8a` (Gradients, accents)  
- **Green**: `#3bb273` (Success buttons, FAB button)
- **Dark Green**: `#2e8c5a` (Green hover states)
- **Purple-Blue**: `#6c7bbd` (Template button, secondary elements)

### Original CSS Styles to Restore:

```css
/* === ORIGINAL THEME STYLES === */

/* Mobile Navigation */
.showflow-mobile-nav {
  background: #232a5c;
  box-shadow: 0 2px 8px rgba(35,42,92,0.13);
}

/* Floating Action Button */
.showflow-fab {
  background: #3bb273;
  box-shadow: 0 4px 18px rgba(35,42,92,0.18);
}
.showflow-fab:active {
  background: #2e8c5a;
}

/* Speaker/Presenter View */
.showflow-speaker-view {
  background: linear-gradient(135deg, #232a5c 0%, #3c4e8a 100%);
}

/* Template Button (Original) */
.template-button-original {
  background: #6c7bbd !important;
  color: #fff !important;
}

/* Status Colors (Original) */
.status-running-original {
  background: #3bb273;
  color: #fff;
}

.status-upcoming-original {
  background: #ffb300;
  color: #fff;
}

/* Input Focus (Original) */
.showflow-input-original:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* Cards and Elements */
.showflow-card-original {
  box-shadow: 0 1px 6px rgba(35,42,92,0.10);
}

/* Time Display */
.time-display-original {
  color: #a7c3ff;
}
```

## Original JavaScript Theme Logic

### Theme State Management:
```javascript
// Original theme toggle (before Microsoft integration)
const toggleTheme = () => {
  setTheme(t => (t === 'light' ? 'dark' : 'light'));
  document.body.classList.toggle('dark', theme === 'light');
};
```

### Original Theme Button Text:
```javascript
// Original theme button labels
{theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
```

### Original Template Button:
```javascript
// Original template button with purple background
<a 
  href="https://aka.ms/showflowtrackertemplate" 
  target="_blank" 
  rel="noopener noreferrer"
  className="showflow-btn"
  style={{
    textDecoration: 'none',
    display: 'inline-block',
    backgroundColor: '#6c7bbd',  // Original purple color
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '0.9em'
  }}
>
  📋 Click for Schedule Template
</a>
```

## How to Restore Original Theme

### Step 1: Revert CSS Changes
Replace the Microsoft color scheme in both:
- `public/styles/main.css`
- `docs/styles/main.css`

### Step 2: Update Mobile Nav
```css
.showflow-mobile-nav {
  background: #232a5c;
  box-shadow: 0 2px 8px rgba(35,42,92,0.13);
}
```

### Step 3: Update FAB Button
```css
.showflow-fab {
  background: #3bb273;
  box-shadow: 0 4px 18px rgba(35,42,92,0.18);
}
.showflow-fab:active {
  background: #2e8c5a;
}
```

### Step 4: Restore Template Button
In `src/components/EventScheduleManager.js`, restore the original inline style:
```javascript
backgroundColor: '#6c7bbd'
```

### Step 5: Remove Microsoft Default Styles
Remove or comment out the Microsoft default theme CSS section and restore original class-based theming.

## Commit References
- **Last Original Commit**: f1687a2 (before Microsoft theme implementation)
- **Microsoft Default Theme Commit**: 42683d9
- **Microsoft Toggle Theme Commit**: 0703f20

## Git Commands to Revert
```bash
# To see the original theme files:
git show f1687a2:public/styles/main.css
git show f1687a2:src/components/EventScheduleManager.js

# To restore original theme completely:
git checkout f1687a2 -- public/styles/main.css docs/styles/main.css
git checkout f1687a2 -- src/components/EventScheduleManager.js
npm run build
```

## Color Palette Comparison

| Element | Original | Microsoft |
|---------|----------|-----------|
| Navbar | #232a5c | #F25022 |
| FAB | #3bb273 | #7FBA00 |
| Primary Button | Default | #00A4EF |
| Template Button | #6c7bbd | #7FBA00 |
| Running Status | #3bb273 | #7FBA00 |
| Upcoming Status | #ffb300 | #FFB900 |

This backup ensures you can easily return to the original purple/navy theme if desired.

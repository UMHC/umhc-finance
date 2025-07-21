# UMHC Finance System - Folder Structure Setup Checklist

## ✅ Complete File Structure

Copy and paste this structure into your `umhc-finance` repository:

### 📁 Root Level Files

```txt
- [ ] README.md (✅ Created above)
- [ ] index.html (✅ Created above)
- [ ] admin-login.html (create in Phase 3)
- [ ] admin-dashboard.html (create in Phase 4)
- [ ] .gitignore (optional but recommended)
```

### 📁 CSS Folder (`css/`)

```txt
css/
- [ ] main.css (✅ Created above)
- [ ] dashboard.css (create in Phase 2)
- [ ] admin.css (create in Phase 3)
- [ ] components.css (create in Phase 2)
```

### 📁 JavaScript Folder (`js/`)

```txt
js/
- [ ] config.js (✅ Created above)
- [ ] utils.js (create next)
- [ ] data-manager.js (create in Phase 2)
- [ ] chart-renderer.js (create in Phase 2)
- [ ] ui-components.js (create in Phase 2)
- [ ] auth.js (create in Phase 3)
- [ ] ai-extraction.js (create in Phase 4)
```

### 📁 Data Folder (`data/`)

```txt
data/
- [ ] transactions.csv (create sample data)
- [ ] summary.json (create sample summary)
- [ ] .gitkeep (to ensure folder is tracked)
```

### 📁 Assets Folder (`assets/`)

```txt
assets/
├── images/
│   - [ ] logo.png (optional)
│   - [ ] favicon.ico (optional)
│   └── icons/
│       - [ ] (various icon files)
└── fonts/
    - [ ] (custom fonts if needed)
```

### 📁 Documentation Folder (`docs/`)

```txt
docs/
- [ ] setup-guide.md (create in Phase 6)
- [ ] user-manual.md (create in Phase 6)
- [ ] technical-docs.md (create in Phase 6)
- [ ] implementation-plan.md (✅ Already created)
```

## 🚀 Quick Setup Commands

If you're comfortable with command line, you can create this structure quickly:

### Using Command Line (Git Bash/Terminal)

```bash
# Navigate to your repository
cd umhc-finance

# Create folders
mkdir css js data assets docs
mkdir assets/images assets/icons assets/fonts

# Create placeholder files
touch css/dashboard.css css/admin.css css/components.css
touch js/utils.js js/data-manager.js js/chart-renderer.js js/ui-components.js js/auth.js js/ai-extraction.js
touch data/transactions.csv data/summary.json
touch docs/setup-guide.md docs/user-manual.md docs/technical-docs.md
echo "# Keep this folder in git" > data/.gitkeep
```

### Using GitHub Web Interface

1. Click "Create new file"
2. Type the folder path (e.g., `css/main.css`)
3. Add some basic content
4. Commit the file

## 📝 Next Steps - Create These Files Now

### 1. Create `js/utils.js` (Basic Version)

```javascript
// js/utils.js - Helper functions
const Utils = {
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP'
        }).format(amount);
    },
    
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-GB');
    },
    
    log: (message, data = null) => {
        if (CONFIG && CONFIG.DEBUG && CONFIG.DEBUG.ENABLED) {
            console.log(`[UMHC] ${message}`, data || '');
        }
    }
};

window.Utils = Utils;
```

### 2. Create `data/transactions.csv` (Sample Data)

```csv
Date,Description,Amount,Type,Category,Event,Reference
18/04/2025,Welsh 3000s Registration,1610.00,Income,Event Registration,Welsh 3000s 2025,REG001
18/04/2025,Hostel Booking - Canolfan Corris,-1400.00,Expense,Accommodation,Welsh 3000s 2025,INV001
15/04/2025,Transport - Minibus Hire,-320.50,Expense,Transport,Welsh 3000s 2025,INV002
10/04/2025,Equipment Maintenance,-89.50,Expense,Equipment,General,INV003
05/04/2025,Membership Fees Collection,420.00,Income,Membership,General,MEM001
```

### 3. Create `data/summary.json` (Sample Summary)

```json
{
  "lastUpdated": "2025-07-04T12:00:00Z",
  "totalIncome": 2030.00,
  "totalExpenses": 1810.00,
  "balance": 220.00,
  "transactionCount": 5,
  "byCategory": {
    "Event Registration": 1610.00,
    "Membership": 420.00,
    "Accommodation": -1400.00,
    "Transport": -320.50,
    "Equipment": -89.50
  },
  "byEvent": {
    "Welsh 3000s 2025": 210.00,
    "General": 330.50
  },
  "byMonth": {
    "2025-04": 220.00
  }
}
```

### 4. Create `.gitignore` (Optional but Recommended)

```md
# Logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed

# Coverage directory used by tools like istanbul
coverage

# Environment variables
.env
.env.local

# API keys (keep these private!)
api-keys.js
secrets.js

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
*.temp
```

### 5. Create Basic CSS Files (Placeholder)

```css
/* css/dashboard.css */
/* Dashboard-specific styles will go here */

/* css/admin.css */
/* Admin interface styles will go here */

/* css/components.css */  
/* Reusable component styles will go here */
```

## 🧪 Test Your Setup

1. **Commit and push** all files to GitHub
2. **Check GitHub Pages** - your site should load at `https://[username].github.io/umhc-finance`
3. **Verify the page loads** and shows the sample data
4. **Check the browser console** for any errors

## ✅ Success Criteria

Your setup is complete when:

- [ ] GitHub Pages shows your dashboard
- [ ] No 404 errors for CSS/JS files
- [ ] Sample financial data displays correctly
- [ ] Browser console shows "✅ Dashboard loaded successfully"
- [ ] Mobile view looks reasonable

## 🆘 Troubleshooting

### Common Issues

**CSS not loading?**

- Check file paths are correct (case-sensitive!)
- Make sure CSS files exist and have content

**JavaScript errors?**

- Open browser dev tools (F12)
- Check console for error messages
- Ensure files are loading in correct order

**GitHub Pages not updating?**

- Changes can take 5-10 minutes to deploy
- Check Settings → Pages for build status

**Sample data not showing?**

- Verify CSV and JSON files are properly formatted
- Check browser console for parsing errors

## 📞 Need Help?

If you get stuck:

1. Check browser console for errors (F12)
2. Verify all files exist and have content
3. Compare your structure to this checklist
4. Create a GitHub issue if you're completely stuck

## 🎉 Next Phase

Once this is working, you'll have:

- ✅ Professional-looking finance dashboard
- ✅ Proper file structure for future development
- ✅ Sample data to demonstrate the concept
- ✅ Foundation for adding GitHub OAuth and AI features

Ready to move to Phase 2? Let's build the data management system!

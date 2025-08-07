# UMHC Finance System

A modern financial management system for the University of Manchester Hiking Club (UMHC) featuring GitHub OAuth authentication and free OCR-powered expense extraction.

## 🚀 Features

### Public Access (All Club Members)
- 📊 Interactive financial dashboard
- 💰 Real-time income/expense tracking
- 📈 Visual charts and analytics
- 🔍 Transaction search and filtering
- 📱 Mobile-responsive design

### Committee Access (GitHub OAuth)
- 🔐 Secure GitHub authentication
- 🆓 Free OCR-powered document processing
- 📄 PDF and image text extraction (Tesseract.js + PDF.js)
- 💰 Smart handling of "Cash In/Out" expense formats
- ✏️ Manual transaction entry and editing
- 📊 Advanced reporting tools
- 🔧 Data management and export

## 🏗️ Technical Architecture

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Hosting**: GitHub Pages (free)
- **Authentication**: GitHub OAuth via Vercel serverless functions
- **OCR Processing**: Tesseract.js + PDF.js (completely client-side)
- **Document Parsing**: Specialized expense365 pattern matching
- **Data Storage**: CSV files + JSON summaries
- **Charts**: Chart.js library

## 🔍 OCR Processing Details

The system uses advanced client-side OCR processing to extract transactions from PDF documents and images:

### Supported Formats
- **PDF files**: Automatic text extraction + OCR fallback
- **Images**: PNG, JPG, JPEG with OCR processing
- **Table structures**: "Date | Description | Cash In | Cash Out" format

### Key Features
- **OCR Error Correction**: Automatic fixing of common misrecognitions (O→0, I→1, S→5, etc.)
- **Smart Date Parsing**: Handles DD/MM/YYYY format with validation
- **Amount Detection**: Intelligent parsing of currency amounts with decimal/comma handling
- **Empty Column Logic**: Proper handling when only Cash In OR Cash Out is populated
- **High Accuracy**: Specialized patterns for financial documents

### Processing Libraries
- **Tesseract.js**: Open-source OCR engine
- **PDF.js**: Mozilla's PDF processing library
- **Custom Parsers**: UMHC-specific transaction pattern matching

## 📁 Project Structure

```
umhc-finance/
├── index.html              # Public dashboard
├── admin-login.html        # Committee authentication
├── admin-dashboard.html    # Committee management
├── 
├── css/
│   ├── main.css           # Global styles
│   ├── dashboard.css      # Dashboard styles
│   ├── admin.css          # Admin interface
│   └── components.css     # Reusable components
├── 
├── js/
│   ├── config.js          # Configuration & categories
│   ├── auth.js            # GitHub OAuth authentication
│   ├── data-manager.js    # CSV/JSON data handling
│   ├── ocr-processor.js   # Free OCR processing (Tesseract.js)
│   ├── expense365-parser.js # Transaction pattern matching
│   ├── chart-renderer.js  # Chart generation
│   ├── ui-components.js   # UI elements
│   └── utils.js           # Helper functions
├── 
├── data/
│   ├── transactions.csv   # Transaction data
│   └── summary.json       # Summary statistics
├── 
├── assets/
│   ├── images/
│   └── icons/
├── 
└── docs/
    ├── setup-guide.md     # Committee setup
    ├── user-manual.md     # User guide
    └── technical-docs.md  # Developer docs
```

## 🎯 Quick Start

### For Club Members (Public Access)
1. Visit: `https://[your-username].github.io/umhc-finance`
2. View financial dashboard and transaction history
3. Use filters to explore specific events or time periods

### For Committee Members (Admin Access)
1. Go to: `https://[your-username].github.io/umhc-finance/admin-login.html`
2. Click "Login with GitHub"
3. Access admin dashboard for data management

## 👥 Committee Members (2025)

Update this list annually:

| Name | Role | GitHub Username |
|------|------|-----------------|
| Alice Cooper | Treasurer | `@alice-treasurer` |
| Bob Smith | President | `@bob-president` |
| Carol Johnson | Secretary | `@carol-secretary` |

## 🔧 Setup for New Committees

### Annual Handover Checklist
- [ ] Update committee member list in `js/config.js`
- [ ] Review GitHub OAuth app settings
- [ ] Test authentication with new accounts
- [ ] Update contact information in documentation
- [ ] Train new committee on system usage

### Technical Requirements
- GitHub account for each committee member
- Basic understanding of GitHub (for making updates)
- Access to expense365 or bank statement documents
- Modern web browser with JavaScript enabled

## 💰 Operating Costs

- **GitHub Pages Hosting**: Free
- **GitHub OAuth**: Free
- **OCR Processing**: Free (client-side Tesseract.js)
- **Vercel Auth Server**: Free tier
- **Total Monthly Cost**: £0 🎉

## 📊 Current Financial Summary

<!-- This will be updated automatically by the system -->
- **Total Income**: £[auto-updated]
- **Total Expenses**: £[auto-updated]
- **Current Balance**: £[auto-updated]
- **Last Updated**: [auto-updated]

## 🛠️ Development Status

### Completed ✅
- [x] Repository setup and project structure
- [x] Public dashboard with interactive charts
- [x] GitHub OAuth authentication system
- [x] Free OCR document processing (PDF + images)
- [x] Admin dashboard with transaction management
- [x] Expense365 pattern matching and data extraction
- [x] CSV/JSON data storage and export functionality
- [x] Mobile-responsive design

### In Progress 🔄
- [ ] Testing enhanced PDF extraction accuracy
- [ ] User feedback integration and bug fixes

### Planned 📋
- [ ] Progressive Web App features
- [ ] Advanced financial analytics and forecasting
- [ ] Automated backup and data validation
- [ ] Integration with more financial document formats

## 📚 Documentation

- [**Setup Guide**](docs/setup-guide.md) - For new committees
- [**User Manual**](docs/user-manual.md) - For club members
- [**Technical Docs**](docs/technical-docs.md) - For developers
- [**Implementation Plan**](docs/implementation-plan.md) - Development roadmap

## 🆘 Support

### For Current Committee
- **Technical Issues**: Create GitHub issue
- **Feature Requests**: Create GitHub issue
- **Emergency Contact**: [Your contact information]

### For Future Committees
- **All Documentation**: Check `/docs` folder
- **Code Questions**: Review inline comments
- **Setup Help**: Follow setup guide

## 🔒 Security & Privacy

- **Authentication**: Industry-standard GitHub OAuth
- **Data Protection**: All OCR processing client-side (no data leaves browser)
- **Access Control**: Committee-only admin features
- **Zero API Costs**: No external services = no privacy concerns
- **Audit Trail**: All changes tracked and logged

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Contact

- **Current Treasurer**: [Name] - [Email]
- **Technical Lead**: [Name] - [Email]
- **Club Email**: [club@email.com]

---

**Last Updated**: January 2025
**Version**: 2.0.0 (Free OCR Processing)
**Maintained by**: UMHC Committee 2025

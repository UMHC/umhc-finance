# UMHC Finance System

A modern financial management system for the University of Manchester Hiking Club (UMHC) featuring GitHub OAuth authentication and AI-powered expense extraction.

## 🚀 Features

### Public Access (All Club Members)
- 📊 Interactive financial dashboard
- 💰 Real-time income/expense tracking
- 📈 Visual charts and analytics
- 🔍 Transaction search and filtering
- 📱 Mobile-responsive design

### Committee Access (GitHub OAuth)
- 🔐 Secure GitHub authentication
- 🤖 AI-powered expense365 document processing
- 📄 PDF and screenshot text extraction
- ✏️ Manual transaction entry
- 📊 Advanced reporting tools
- 🔧 Data management and export

## 🏗️ Technical Architecture

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Hosting**: GitHub Pages (free)
- **Authentication**: GitHub OAuth
- **AI Processing**: Claude API for document parsing
- **Data Storage**: CSV files + JSON summaries
- **Charts**: Chart.js library

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
│   ├── config.js          # Configuration
│   ├── auth.js            # Authentication logic
│   ├── data-manager.js    # Data handling
│   ├── ai-extraction.js   # AI document processing
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
- Access to expense365 documents for processing

## 💰 Operating Costs

- **GitHub Pages Hosting**: Free
- **GitHub OAuth**: Free
- **AI API (Claude)**: ~£5-15/month
- **Total Monthly Cost**: £5-15

## 📊 Current Financial Summary

<!-- This will be updated automatically by the system -->
- **Total Income**: £[auto-updated]
- **Total Expenses**: £[auto-updated]
- **Current Balance**: £[auto-updated]
- **Last Updated**: [auto-updated]

## 🛠️ Development Status

### Completed ✅
- [x] Repository setup
- [x] Basic file structure
- [ ] Public dashboard
- [ ] GitHub OAuth authentication
- [ ] AI expense extraction
- [ ] Admin dashboard
- [ ] Documentation

### In Progress 🔄
- [ ] [Current development task]

### Planned 📋
- [ ] Progressive Web App features
- [ ] Advanced analytics
- [ ] Mobile app integration

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
- **Data Protection**: All processing client-side
- **Access Control**: Committee-only admin features
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

**Last Updated**: [Current Date]
**Version**: 1.0.0
**Maintained by**: UMHC Committee 2025
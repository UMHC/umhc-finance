// js/config.js - Enhanced Configuration for UMHC Finance System
// Updated with future-proof categories based on real transaction analysis

const CONFIG = {
    // Application metadata
    APP_NAME: 'UMHC Finance System',
    VERSION: '1.1.0',
    LAST_UPDATED: '2025-07-04',
    
    // GitHub OAuth Configuration
    // NOTE: Will be updated when we implement OAuth in Phase 3
    GITHUB: {
        CLIENT_ID: 'not_configured_yet', // Will set this up in Phase 3
        REDIRECT_URI: window.location.origin + '/admin-login.html',
        SCOPE: 'user:email',
        API_BASE: 'https://api.github.com'
    },
    
    // Committee Members - UPDATE THIS ANNUALLY!
    // Only these GitHub usernames can access admin features
    COMMITTEE_MEMBERS: [
        { 
            github: 'umhc-treasurer-2025',
            name: 'UMHC Treasurer', 
            role: 'Treasurer',
            email: 'treasurer@umhc.manchester.ac.uk',
            year: '2025'
        },
        { 
            github: 'umhc-president-2025',
            name: 'UMHC President', 
            role: 'President',
            email: 'president@umhc.manchester.ac.uk',
            year: '2025'
        }
        // Add more committee members as needed
    ],
    
    // Data file paths (relative to repository root)
    DATA_FILES: {
        TRANSACTIONS: 'data/transactions.csv',
        SUMMARY: 'data/summary.json',
        COMMITTEE_HISTORY: 'data/committee-history.json'
    },
    
    // Enhanced Category System (Future-Proofed)
    CATEGORIES: {
        // Core operational categories (most transactions)
        CORE: [
            'Event Registration',
            'Membership',
            'Accommodation', 
            'Transport',
            'Equipment',
            'Training',
            'Food & Catering'
        ],
        
        // Financial & administrative (money management)
        FINANCIAL: [
            'Grants & Funding',
            'Refunds & Adjustments',
            'Insurance',
            'Administration'
        ],
        
        // External & promotional (outreach activities)
        EXTERNAL: [
            'External Memberships',
            'Technology & Communications',
            'Marketing & Promotion',
            'Professional Services'
        ],
        
        // Specialized categories (add as needed)
        SPECIALIZED: [
            'Health & Safety',
            'Penalties & Fines',
            'Competition & Awards',
            'Utilities & Facilities',
            'Social Events',
            'Merchandise'
        ]
    },
    
    // Auto-categorization suggestions based on real UMHC data
    CATEGORY_SUGGESTIONS: {
        'grant': 'Grants & Funding',
        'fund it': 'Grants & Funding',
        'funding': 'Grants & Funding',
        'refund': 'Refunds & Adjustments',
        'credit': 'Refunds & Adjustments',
        'adjustment': 'Refunds & Adjustments',
        'bmc': 'External Memberships',
        'mountaineering council': 'External Memberships',
        'website': 'Technology & Communications',
        'domain': 'Technology & Communications',
        'hosting': 'Technology & Communications',
        'printing': 'Marketing & Promotion',
        'poster': 'Marketing & Promotion',
        'promotional': 'Marketing & Promotion',
        'fresher': 'Marketing & Promotion',
        'traffic': 'Penalties & Fines',
        'fine': 'Penalties & Fines',
        'penalty': 'Penalties & Fines',
        'toll': 'Penalties & Fines',
        'first aid': 'Health & Safety',
        'safety': 'Health & Safety',
        'emergency': 'Health & Safety',
        'engraving': 'Professional Services',
        'legal': 'Professional Services',
        'accounting': 'Professional Services',
        'prize': 'Competition & Awards',
        'award': 'Competition & Awards',
        'trophy': 'Competition & Awards',
        'storage': 'Utilities & Facilities',
        'utility': 'Utilities & Facilities',
        'facility': 'Utilities & Facilities',
        'membership': 'Membership',
        'ticket': 'Event Registration',
        'registration': 'Event Registration',
        'hostel': 'Accommodation',
        'yha': 'Accommodation',
        'hotel': 'Accommodation',
        'minibus': 'Transport',
        'coach': 'Transport',
        'fuel': 'Transport',
        'diesel': 'Transport',
        'petrol': 'Transport',
        'uber': 'Transport',
        'taxi': 'Transport',
        'parking': 'Transport',
        'helmet': 'Equipment',
        'rope': 'Equipment',
        'compass': 'Equipment',
        'radio': 'Equipment',
        'boots': 'Equipment',
        'tent': 'Equipment',
        'course': 'Training',
        'instructor': 'Training',
        'guide': 'Training',
        'food': 'Food & Catering',
        'meal': 'Food & Catering',
        'catering': 'Food & Catering',
        'insurance': 'Insurance',
        'banking': 'Administration',
        'fee': 'Administration',
        'social': 'Social Events',
        'party': 'Social Events',
        'barbecue': 'Social Events',
        'bbq': 'Social Events'
    },
    
    // External API endpoints
    API_ENDPOINTS: {
        CLAUDE: 'https://api.anthropic.com/v1/messages',
        OPENAI: 'https://api.openai.com/v1/chat/completions'
        // Add other APIs as needed
    },
    
    // AI Configuration
    AI: {
        PROVIDER: 'claude', // Options: 'claude', 'openai', 'google'
        MODEL: 'claude-3-sonnet-20240229',
        MAX_TOKENS: 1000,
        CONFIDENCE_THRESHOLD: 0.7 // Minimum confidence for auto-acceptance
    },
    
    // UI Configuration
    UI: {
        ITEMS_PER_PAGE: 20,
        CHART_COLORS: {
            INCOME: '#28a745',
            EXPENSE: '#dc3545',
            PRIMARY: '#667eea',
            SECONDARY: '#764ba2',
            // Category colors for better visualization
            CATEGORY_COLORS: {
                'Event Registration': '#28a745',
                'Membership': '#17a2b8',
                'Accommodation': '#fd7e14',
                'Transport': '#6f42c1',
                'Equipment': '#dc3545',
                'Training': '#20c997',
                'Food & Catering': '#ffc107',
                'Grants & Funding': '#198754',
                'Insurance': '#6c757d',
                'Administration': '#495057',
                'Social Events': '#e83e8c',
                'External Memberships': '#0d6efd'
            }
        },
        DATE_FORMAT: 'DD/MM/YYYY',
        CURRENCY: 'GBP'
    },
    
    // Session management
    SESSION: {
        DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        STORAGE_KEY: 'umhc_admin_session',
        AUTO_LOGOUT_WARNING: 5 * 60 * 1000 // 5 minutes warning
    },
    
    // File upload limits
    UPLOAD: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: [
            'application/pdf',
            'image/png', 
            'image/jpeg', 
            'image/jpg',
            'text/csv'
        ]
    },
    
    // Feature flags (enable/disable features)
    FEATURES: {
        AI_EXTRACTION: true,
        MANUAL_ENTRY: true,
        BULK_IMPORT: true,
        DATA_EXPORT: true,
        AUDIT_TRAIL: true,
        CATEGORY_SUGGESTIONS: true, // New feature
        THEME_TOGGLE: true, // For light/dark mode
        EMAIL_NOTIFICATIONS: false // Future feature
    },
    
    // Error messages and user feedback
    MESSAGES: {
        ERRORS: {
            UNAUTHORIZED: 'Access denied. Please ensure you are a current committee member.',
            INVALID_FILE: 'Invalid file type. Please upload a PDF or image file.',
            NETWORK_ERROR: 'Network error. Please check your connection and try again.',
            AI_PROCESSING: 'AI processing failed. Please try manual entry or contact support.',
            SESSION_EXPIRED: 'Your session has expired. Please log in again.',
            INVALID_CATEGORY: 'Please select a valid category for this transaction.',
            DUPLICATE_TRANSACTION: 'This transaction may be a duplicate. Please verify.'
        },
        SUCCESS: {
            LOGIN: 'Successfully logged in! Welcome to the admin dashboard.',
            FILE_PROCESSED: 'File processed successfully! Review the extracted data below.',
            DATA_SAVED: 'Transaction data saved successfully.',
            LOGOUT: 'Successfully logged out.',
            CATEGORY_SUGGESTED: 'Category automatically suggested based on transaction description.',
            EXPORT_COMPLETE: 'Data exported successfully!'
        }
    },
    
    // Development and debugging
    DEBUG: {
        ENABLED: true, // Set to true for development
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        MOCK_DATA: false // Use mock data instead of real APIs
    }
};

// Helper functions for enhanced functionality
CONFIG.getAllCategories = function() {
    return [
        ...this.CATEGORIES.CORE,
        ...this.CATEGORIES.FINANCIAL,
        ...this.CATEGORIES.EXTERNAL,
        ...this.CATEGORIES.SPECIALIZED
    ].sort();
};

CONFIG.suggestCategory = function(description) {
    if (!description || !this.FEATURES.CATEGORY_SUGGESTIONS) return null;
    
    const lowerDesc = description.toLowerCase();
    
    // Check for keyword matches
    for (const [keyword, category] of Object.entries(this.CATEGORY_SUGGESTIONS)) {
        if (lowerDesc.includes(keyword)) {
            return category;
        }
    }
    
    return null;
};

CONFIG.getCategoryColor = function(category) {
    return this.UI.CHART_COLORS.CATEGORY_COLORS[category] || this.UI.CHART_COLORS.PRIMARY;
};

CONFIG.getCategoriesByGroup = function(group) {
    return this.CATEGORIES[group] || [];
};

CONFIG.isCommitteeMember = function(githubUsername) {
    return this.COMMITTEE_MEMBERS.some(member => 
        member.github.toLowerCase() === githubUsername.toLowerCase()
    );
};

CONFIG.getCommitteeMember = function(githubUsername) {
    return this.COMMITTEE_MEMBERS.find(member => 
        member.github.toLowerCase() === githubUsername.toLowerCase()
    );
};

CONFIG.isFeatureEnabled = function(featureName) {
    return this.FEATURES[featureName] === true;
};

CONFIG.log = function(level, message, data = null) {
    if (!this.DEBUG.ENABLED) return;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.DEBUG.LOG_LEVEL);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex >= currentLevelIndex) {
        console[level](`[UMHC Finance] ${message}`, data || '');
    }
};

// Enhanced validation functions
CONFIG.validate = function() {
    const errors = [];
    
    // Only check for actual development issues, not placeholder values during development
    if (this.COMMITTEE_MEMBERS.length === 0) {
        errors.push('No committee members configured');
    }
    
    // Validate categories are properly configured
    const allCategories = this.getAllCategories();
    if (allCategories.length === 0) {
        errors.push('No categories configured');
    }
    
    // Check for duplicate categories
    const duplicates = allCategories.filter((item, index) => allCategories.indexOf(item) !== index);
    if (duplicates.length > 0) {
        errors.push(`Duplicate categories found: ${duplicates.join(', ')}`);
    }
    
    // For development phase, don't validate OAuth setup yet
    if (this.DEBUG.ENABLED) {
        // In debug mode, just log info but don't treat as errors
        CONFIG.log('info', 'Development mode - OAuth setup will be completed in Phase 3');
        CONFIG.log('info', `Configured ${allCategories.length} categories across ${Object.keys(this.CATEGORIES).length} groups`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// Export CONFIG for use in other files
window.CONFIG = CONFIG;

// Log configuration status on load
CONFIG.log('info', 'Enhanced configuration loaded', {
    version: CONFIG.VERSION,
    committeeCount: CONFIG.COMMITTEE_MEMBERS.length,
    categoryCount: CONFIG.getAllCategories().length,
    featuresEnabled: Object.keys(CONFIG.FEATURES).filter(key => CONFIG.FEATURES[key])
});
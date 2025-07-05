// js/config.js - Central Configuration for UMHC Finance System
// This file contains all the key settings and is updated annually by new committees

const CONFIG = {
    // Application metadata
    APP_NAME: 'UMHC Finance System',
    VERSION: '1.0.0',
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
            SECONDARY: '#764ba2'
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
        EMAIL_NOTIFICATIONS: false // Future feature
    },
    
    // Error messages and user feedback
    MESSAGES: {
        ERRORS: {
            UNAUTHORIZED: 'Access denied. Please ensure you are a current committee member.',
            INVALID_FILE: 'Invalid file type. Please upload a PDF or image file.',
            NETWORK_ERROR: 'Network error. Please check your connection and try again.',
            AI_PROCESSING: 'AI processing failed. Please try manual entry or contact support.',
            SESSION_EXPIRED: 'Your session has expired. Please log in again.'
        },
        SUCCESS: {
            LOGIN: 'Successfully logged in! Welcome to the admin dashboard.',
            FILE_PROCESSED: 'File processed successfully! Review the extracted data below.',
            DATA_SAVED: 'Transaction data saved successfully.',
            LOGOUT: 'Successfully logged out.'
        }
    },
    
    // Development and debugging
    DEBUG: {
        ENABLED: true, // Set to true for development
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        MOCK_DATA: false // Use mock data instead of real APIs
    }
};

// Helper functions for configuration
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

// Validation functions
CONFIG.validate = function() {
    const errors = [];
    
    // Only check for actual development issues, not placeholder values during development
    if (this.COMMITTEE_MEMBERS.length === 0) {
        errors.push('No committee members configured');
    }
    
    // For development phase, don't validate OAuth setup yet
    if (this.DEBUG.ENABLED) {
        // In debug mode, just log info but don't treat as errors
        CONFIG.log('info', 'Development mode - OAuth setup will be completed in Phase 3');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// Export CONFIG for use in other files
window.CONFIG = CONFIG;

// Log configuration status on load
CONFIG.log('info', 'Configuration loaded', {
    version: CONFIG.VERSION,
    committeeCount: CONFIG.COMMITTEE_MEMBERS.length,
    featuresEnabled: Object.keys(CONFIG.FEATURES).filter(key => CONFIG.FEATURES[key])
});
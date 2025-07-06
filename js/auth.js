// js/auth.js - Authentication management for UMHC Finance System

class AuthManager {
    constructor() {
        this.authToken = null;
        this.userInfo = null;
        this.authServerUrl = 'https://umhc-auth-server.vercel.app';
        this.sessionKey = 'umhc_admin_session';
        this.refreshInterval = null;
        
        Utils.log('info', 'AuthManager initialized');
    }

    // Check if user is currently authenticated
    isAuthenticated() {
        return this.authToken !== null && this.userInfo !== null;
    }

    // Get current user info
    getCurrentUser() {
        return this.userInfo;
    }

    // Get current auth token
    getAuthToken() {
        return this.authToken;
    }

    // Initialize authentication - check for existing session or URL token
    async initialize() {
        try {
            // First, check for token in URL (from OAuth redirect)
            const urlToken = this.getTokenFromUrl();
            
            if (urlToken) {
                Utils.log('info', 'Token found in URL, verifying...');
                await this.verifyAndStoreToken(urlToken);
                this.clearTokenFromUrl();
                return true;
            }

            // Check for stored session
            const storedSession = this.getStoredSession();
            if (storedSession && this.isSessionValid(storedSession)) {
                Utils.log('info', 'Valid stored session found');
                this.authToken = storedSession.token;
                this.userInfo = storedSession.userInfo;
                
                // Verify token is still valid
                const isValid = await this.verifyToken(this.authToken);
                if (isValid) {
                    this.startTokenRefreshTimer();
                    return true;
                } else {
                    Utils.log('warn', 'Stored token is no longer valid');
                    this.clearSession();
                }
            }

            return false;
            
        } catch (error) {
            Utils.log('error', 'Authentication initialization failed', error);
            this.clearSession();
            return false;
        }
    }

    // Extract token from URL parameters
    getTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token');
    }

    // Clear token from URL without page reload
    clearTokenFromUrl() {
        const url = new URL(window.location);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url);
    }

    // Verify token with auth server and store user info
    async verifyAndStoreToken(token) {
        try {
            const response = await fetch(`${this.authServerUrl}/api/auth-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                throw new Error(`Token verification failed: ${response.status}`);
            }

            const userData = await response.json();
            
            // Store authentication data
            this.authToken = token;
            this.userInfo = userData;
            
            // Store session for persistence
            this.storeSession({
                token,
                userInfo: userData,
                timestamp: Date.now()
            });

            // Start token refresh timer
            this.startTokenRefreshTimer();

            Utils.log('info', 'Authentication successful', { 
                user: userData.login || userData.name,
                email: userData.email 
            });

            return true;

        } catch (error) {
            Utils.log('error', 'Token verification failed', error);
            throw new Error('Authentication failed. Please try logging in again.');
        }
    }

    // Verify if a token is still valid
    async verifyToken(token) {
        try {
            const response = await fetch(`${this.authServerUrl}/api/auth-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            return response.ok;

        } catch (error) {
            Utils.log('error', 'Token verification request failed', error);
            return false;
        }
    }

    // Store session in localStorage
    storeSession(sessionData) {
        try {
            Utils.storage.set(this.sessionKey, {
                ...sessionData,
                expiresAt: Date.now() + CONFIG.SESSION.DURATION
            });
            
            Utils.log('info', 'Session stored successfully');
        } catch (error) {
            Utils.log('error', 'Failed to store session', error);
        }
    }

    // Get stored session from localStorage
    getStoredSession() {
        try {
            return Utils.storage.get(this.sessionKey);
        } catch (error) {
            Utils.log('error', 'Failed to retrieve stored session', error);
            return null;
        }
    }

    // Check if stored session is still valid
    isSessionValid(session) {
        if (!session || !session.token || !session.expiresAt) {
            return false;
        }

        const now = Date.now();
        const isExpired = now >= session.expiresAt;
        
        if (isExpired) {
            Utils.log('info', 'Stored session has expired');
            return false;
        }

        // Check if session expires within warning period
        const timeUntilExpiry = session.expiresAt - now;
        if (timeUntilExpiry <= CONFIG.SESSION.AUTO_LOGOUT_WARNING) {
            Utils.log('warn', 'Session expires soon', { 
                minutesRemaining: Math.round(timeUntilExpiry / (1000 * 60)) 
            });
        }

        return true;
    }

    // Clear all authentication data
    clearSession() {
        this.authToken = null;
        this.userInfo = null;
        Utils.storage.remove(this.sessionKey);
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        Utils.log('info', 'Session cleared');
    }

    // Start the GitHub OAuth login process
    startLogin() {
        Utils.log('info', 'Starting GitHub OAuth login...');
        
        // Redirect to auth server
        window.location.href = `${this.authServerUrl}/api/auth-begin`;
    }

    // Logout user
    async logout() {
        Utils.log('info', 'Logging out user...');
        
        // Clear local session
        this.clearSession();
        
        // Show success message
        if (typeof UIComponents !== 'undefined') {
            UIComponents.showToast('Successfully logged out', 'success');
        }
        
        // Redirect to login page after a brief delay
        setTimeout(() => {
            window.location.href = 'admin-login.html';
        }, 1000);
    }

    // Start token refresh timer to check session validity
    startTokenRefreshTimer() {
        // Clear existing timer
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Check session every 5 minutes
        this.refreshInterval = setInterval(async () => {
            try {
                const storedSession = this.getStoredSession();
                
                if (!storedSession || !this.isSessionValid(storedSession)) {
                    Utils.log('warn', 'Session expired during refresh check');
                    await this.handleSessionExpiry();
                    return;
                }

                // Verify token is still valid with server
                const isValid = await this.verifyToken(this.authToken);
                if (!isValid) {
                    Utils.log('warn', 'Token invalidated by server');
                    await this.handleSessionExpiry();
                }

            } catch (error) {
                Utils.log('error', 'Token refresh check failed', error);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    // Handle session expiry
    async handleSessionExpiry() {
        this.clearSession();
        
        // Show warning message
        if (typeof UIComponents !== 'undefined') {
            UIComponents.showToast('Your session has expired. Please log in again.', 'warning', 5000);
        } else {
            alert('Your session has expired. You will be redirected to the login page.');
        }
        
        // Redirect to login after a delay
        setTimeout(() => {
            window.location.href = 'admin-login.html?error=session_expired';
        }, 2000);
    }

    // Get user-friendly display name
    getUserDisplayName() {
        if (!this.userInfo) return 'Unknown User';
        
        return this.userInfo.name || 
               this.userInfo.login || 
               this.userInfo.email || 
               'Committee Member';
    }

    // Get user email
    getUserEmail() {
        return this.userInfo?.email || '';
    }

    // Check if user has admin privileges (additional validation)
    hasAdminPrivileges() {
        if (!this.isAuthenticated()) return false;
        
        // Check if user is in committee members list
        const userEmail = this.getUserEmail();
        const userLogin = this.userInfo?.login;
        
        // Check by GitHub username
        if (userLogin && CONFIG.isCommitteeMember(userLogin)) {
            return true;
        }
        
        // Check by email (fallback)
        if (userEmail && userEmail.includes('hiking@manchesterstudentsunion.com')) {
            return true;
        }
        
        return false;
    }

    // Make authenticated API requests
    async makeAuthenticatedRequest(url, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const headers = {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
            Utils.log('warn', 'Authentication error in API request', { 
                status: response.status,
                url 
            });
            
            await this.handleSessionExpiry();
            throw new Error('Authentication expired');
        }

        return response;
    }

    // Get authentication headers for manual requests
    getAuthHeaders() {
        if (!this.isAuthenticated()) {
            return {};
        }

        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    // Check authentication status and redirect if needed
    async requireAuthentication() {
        const isAuth = await this.initialize();
        
        if (!isAuth) {
            Utils.log('info', 'Authentication required, redirecting to login');
            window.location.href = 'admin-login.html';
            return false;
        }

        if (!this.hasAdminPrivileges()) {
            Utils.log('warn', 'User lacks admin privileges');
            window.location.href = 'admin-login.html?error=access_denied';
            return false;
        }

        return true;
    }

    // Get session info for debugging
    getSessionInfo() {
        const session = this.getStoredSession();
        
        return {
            isAuthenticated: this.isAuthenticated(),
            userDisplayName: this.getUserDisplayName(),
            userEmail: this.getUserEmail(),
            hasAdminPrivileges: this.hasAdminPrivileges(),
            tokenPresent: !!this.authToken,
            sessionValid: session ? this.isSessionValid(session) : false,
            expiresAt: session?.expiresAt ? new Date(session.expiresAt) : null
        };
    }
}

// Create global auth manager instance
const authManager = new AuthManager();

// Export for use in other files
window.AuthManager = AuthManager;
window.authManager = authManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Utils.log('info', 'Auth manager ready for initialization');
    });
} else {
    Utils.log('info', 'Auth manager loaded after DOM ready');
}

Utils.log('info', 'Auth module loaded successfully');
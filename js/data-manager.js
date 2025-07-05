// js/data-manager.js - Advanced data management for UMHC Finance System

class DataManager {
    constructor() {
        this.transactions = [];
        this.summary = {};
        this.filteredTransactions = [];
        this.isLoaded = false;
        
        // Cache for performance
        this.cache = {
            categoryTotals: null,
            eventTotals: null,
            monthlyTotals: null
        };
        
        Utils.log('info', 'DataManager initialized');
    }

    // Load all financial data
    async loadData() {
        try {
            Utils.log('info', 'Loading financial data...');
            
            // Load transactions and summary in parallel for better performance
            const [transactions, summary] = await Promise.all([
                this.loadTransactions(),
                this.loadSummary()
            ]);
            
            this.transactions = transactions;
            this.summary = summary;
            this.filteredTransactions = [...this.transactions];
            this.isLoaded = true;
            
            // Clear cache when new data is loaded
            this.clearCache();
            
            Utils.log('info', 'Data loaded successfully', {
                transactions: this.transactions.length,
                summary: this.summary
            });
            
            return {
                transactions: this.transactions,
                summary: this.summary
            };
            
        } catch (error) {
            Utils.log('error', 'Failed to load data', error);
            throw error;
        }
    }

    // Load transactions from CSV file
    async loadTransactions() {
        const response = await fetch(CONFIG.DATA_FILES.TRANSACTIONS);
        if (!response.ok) {
            throw new Error(`Failed to load transactions: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const transactions = Utils.parseCSV(csvText);
        
        // Validate and clean transaction data
        return transactions.map(transaction => this.validateTransaction(transaction)).filter(Boolean);
    }

    // Load summary from JSON file
    async loadSummary() {
        const response = await fetch(CONFIG.DATA_FILES.SUMMARY);
        if (!response.ok) {
            throw new Error(`Failed to load summary: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }

    // Validate and clean transaction data
    validateTransaction(transaction) {
        try {
            // Ensure required fields exist
            if (!transaction.Date || !transaction.Description || !transaction.Amount) {
                Utils.log('warn', 'Invalid transaction - missing required fields', transaction);
                return null;
            }

            // Clean and validate data
            const cleaned = {
                Date: transaction.Date.trim(),
                Description: transaction.Description.trim(),
                Amount: parseFloat(transaction.Amount) || 0,
                Type: transaction.Type?.trim() || (parseFloat(transaction.Amount) > 0 ? 'Income' : 'Expense'),
                Category: transaction.Category?.trim() || 'Uncategorized',
                Event: transaction.Event?.trim() || 'General',
                Reference: transaction.Reference?.trim() || ''
            };

            // Validate date
            if (!Utils.validate.date(cleaned.Date)) {
                Utils.log('warn', 'Invalid date in transaction', transaction);
                return null;
            }

            // Validate amount
            if (!Utils.validate.currency(cleaned.Amount)) {
                Utils.log('warn', 'Invalid amount in transaction', transaction);
                return null;
            }

            return cleaned;
            
        } catch (error) {
            Utils.log('error', 'Error validating transaction', { transaction, error });
            return null;
        }
    }

    // Filter transactions by various criteria
    filterTransactions(filters = {}) {
        if (!this.isLoaded) {
            Utils.log('warn', 'Data not loaded yet');
            return [];
        }

        let filtered = [...this.transactions];

        // Date range filter
        if (filters.startDate || filters.endDate) {
            filtered = filtered.filter(transaction => {
                const transactionDate = new Date(transaction.Date);
                
                if (filters.startDate && transactionDate < new Date(filters.startDate)) {
                    return false;
                }
                
                if (filters.endDate && transactionDate > new Date(filters.endDate)) {
                    return false;
                }
                
                return true;
            });
        }

        // Predefined date range filter
        if (filters.period) {
            const dateRange = Utils.dateRange[filters.period]?.();
            if (dateRange) {
                filtered = filtered.filter(transaction => {
                    const transactionDate = new Date(transaction.Date);
                    return transactionDate >= dateRange.start && transactionDate < dateRange.end;
                });
            }
        }

        // Text search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(transaction => 
                transaction.Description.toLowerCase().includes(searchTerm) ||
                transaction.Category.toLowerCase().includes(searchTerm) ||
                transaction.Event.toLowerCase().includes(searchTerm) ||
                transaction.Reference.toLowerCase().includes(searchTerm)
            );
        }

        // Category filter
        if (filters.category && filters.category !== 'all') {
            filtered = filtered.filter(transaction => 
                transaction.Category.toLowerCase() === filters.category.toLowerCase()
            );
        }

        // Event filter
        if (filters.event && filters.event !== 'all') {
            filtered = filtered.filter(transaction => 
                transaction.Event.toLowerCase() === filters.event.toLowerCase()
            );
        }

        // Type filter (Income/Expense)
        if (filters.type && filters.type !== 'all') {
            filtered = filtered.filter(transaction => 
                transaction.Type.toLowerCase() === filters.type.toLowerCase()
            );
        }

        // Amount range filter
        if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
            filtered = filtered.filter(transaction => {
                const amount = Math.abs(transaction.Amount);
                
                if (filters.minAmount !== undefined && amount < filters.minAmount) {
                    return false;
                }
                
                if (filters.maxAmount !== undefined && amount > filters.maxAmount) {
                    return false;
                }
                
                return true;
            });
        }

        this.filteredTransactions = filtered;
        return filtered;
    }

    // Sort transactions by various criteria
    sortTransactions(sortBy = 'Date', order = 'desc') {
        if (!this.isLoaded) return [];

        return [...this.filteredTransactions].sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'Date':
                    aValue = new Date(a.Date);
                    bValue = new Date(b.Date);
                    break;
                case 'Amount':
                    aValue = Math.abs(parseFloat(a.Amount));
                    bValue = Math.abs(parseFloat(b.Amount));
                    break;
                case 'Description':
                case 'Category':
                case 'Event':
                    aValue = a[sortBy].toLowerCase();
                    bValue = b[sortBy].toLowerCase();
                    break;
                default:
                    aValue = a[sortBy];
                    bValue = b[sortBy];
            }

            if (aValue < bValue) return order === 'asc' ? -1 : 1;
            if (aValue > bValue) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Get unique values for filters
    getUniqueValues(field) {
        if (!this.isLoaded) return [];
        
        const values = [...new Set(this.transactions.map(t => t[field]))];
        return values.filter(Boolean).sort();
    }

    // Calculate totals for filtered transactions
    calculateTotals(transactions = this.filteredTransactions) {
        const totals = {
            income: 0,
            expenses: 0,
            balance: 0,
            count: transactions.length
        };

        transactions.forEach(transaction => {
            const amount = parseFloat(transaction.Amount) || 0;
            if (amount > 0) {
                totals.income += amount;
            } else {
                totals.expenses += Math.abs(amount);
            }
        });

        totals.balance = totals.income - totals.expenses;
        return totals;
    }

    // Get category breakdown
    getCategoryBreakdown(transactions = this.filteredTransactions) {
        if (this.cache.categoryTotals && transactions === this.filteredTransactions) {
            return this.cache.categoryTotals;
        }

        const categories = {};
        
        transactions.forEach(transaction => {
            const category = transaction.Category;
            const amount = parseFloat(transaction.Amount) || 0;
            
            if (!categories[category]) {
                categories[category] = { income: 0, expenses: 0, net: 0, count: 0 };
            }
            
            if (amount > 0) {
                categories[category].income += amount;
            } else {
                categories[category].expenses += Math.abs(amount);
            }
            
            categories[category].net += amount;
            categories[category].count++;
        });

        const result = Object.entries(categories)
            .map(([category, data]) => ({
                category,
                ...data
            }))
            .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

        if (transactions === this.filteredTransactions) {
            this.cache.categoryTotals = result;
        }

        return result;
    }

    // Get event breakdown
    getEventBreakdown(transactions = this.filteredTransactions) {
        if (this.cache.eventTotals && transactions === this.filteredTransactions) {
            return this.cache.eventTotals;
        }

        const events = {};
        
        transactions.forEach(transaction => {
            const event = transaction.Event;
            const amount = parseFloat(transaction.Amount) || 0;
            
            if (!events[event]) {
                events[event] = { income: 0, expenses: 0, net: 0, count: 0 };
            }
            
            if (amount > 0) {
                events[event].income += amount;
            } else {
                events[event].expenses += Math.abs(amount);
            }
            
            events[event].net += amount;
            events[event].count++;
        });

        const result = Object.entries(events)
            .map(([event, data]) => ({
                event,
                ...data
            }))
            .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

        if (transactions === this.filteredTransactions) {
            this.cache.eventTotals = result;
        }

        return result;
    }

    // Get monthly breakdown
    getMonthlyBreakdown(transactions = this.filteredTransactions) {
        if (this.cache.monthlyTotals && transactions === this.filteredTransactions) {
            return this.cache.monthlyTotals;
        }

        const months = {};
        
        transactions.forEach(transaction => {
            const date = new Date(transaction.Date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const amount = parseFloat(transaction.Amount) || 0;
            
            if (!months[monthKey]) {
                months[monthKey] = { 
                    month: monthKey,
                    income: 0, 
                    expenses: 0, 
                    net: 0, 
                    count: 0,
                    date: new Date(date.getFullYear(), date.getMonth(), 1)
                };
            }
            
            if (amount > 0) {
                months[monthKey].income += amount;
            } else {
                months[monthKey].expenses += Math.abs(amount);
            }
            
            months[monthKey].net += amount;
            months[monthKey].count++;
        });

        const result = Object.values(months)
            .sort((a, b) => a.date - b.date);

        if (transactions === this.filteredTransactions) {
            this.cache.monthlyTotals = result;
        }

        return result;
    }

    // Export data in various formats
    exportData(format = 'csv', transactions = this.filteredTransactions) {
        switch (format.toLowerCase()) {
            case 'csv':
                return this.exportCSV(transactions);
            case 'json':
                return this.exportJSON(transactions);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    // Export as CSV
    exportCSV(transactions = this.filteredTransactions) {
        const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Event', 'Reference'];
        const csvContent = [
            headers.join(','),
            ...transactions.map(transaction => 
                headers.map(header => {
                    const value = transaction[header] || '';
                    // Escape commas and quotes in CSV
                    return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');

        return csvContent;
    }

    // Export as JSON
    exportJSON(transactions = this.filteredTransactions) {
        const exportData = {
            exportDate: new Date().toISOString(),
            totalTransactions: transactions.length,
            summary: this.calculateTotals(transactions),
            transactions: transactions
        };

        return JSON.stringify(exportData, null, 2);
    }

    // Download exported data
    downloadExport(format = 'csv', filename = null) {
        const data = this.exportData(format);
        const actualFilename = filename || `umhc-finance-${new Date().toISOString().split('T')[0]}.${format}`;
        
        const mimeTypes = {
            csv: 'text/csv',
            json: 'application/json'
        };

        const blob = new Blob([data], { type: mimeTypes[format] || 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = actualFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Utils.log('info', 'Data exported', { format, filename: actualFilename, recordCount: this.filteredTransactions.length });
    }

    // Clear cache
    clearCache() {
        this.cache = {
            categoryTotals: null,
            eventTotals: null,
            monthlyTotals: null
        };
    }

    // Get data for charts
    getChartData() {
        return {
            monthly: this.getMonthlyBreakdown(),
            categories: this.getCategoryBreakdown(),
            events: this.getEventBreakdown(),
            totals: this.calculateTotals()
        };
    }

    // Search transactions with advanced options
    searchTransactions(query, options = {}) {
        if (!query || !this.isLoaded) return this.filteredTransactions;

        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        
        return this.filteredTransactions.filter(transaction => {
            const searchableText = [
                transaction.Description,
                transaction.Category,
                transaction.Event,
                transaction.Reference,
                Utils.formatCurrency(transaction.Amount),
                Utils.formatDate(transaction.Date)
            ].join(' ').toLowerCase();

            // Check if all search terms are found
            return searchTerms.every(term => searchableText.includes(term));
        });
    }
}

// Export DataManager for use in other files
window.DataManager = DataManager;

Utils.log('info', 'DataManager class loaded');
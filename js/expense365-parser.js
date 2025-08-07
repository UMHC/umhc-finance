// js/expense365-parser.js - Specialized parser for expense365 financial statements
// Optimized patterns for UMHC financial document formats

class Expense365Parser {
    constructor() {
        this.patterns = this.initializePatterns();
        this.confidenceThresholds = {
            high: 0.85,
            medium: 0.65,
            low: 0.4
        };
        
        Utils.log('info', 'Expense365Parser initialized with optimized patterns');
    }

    // Initialize all extraction patterns
    initializePatterns() {
        return {
            // Dedicated Cash In/Out format: Date | Description | Cash In | Cash Out
            cashInOutFormat: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*\|\s*([^|]+?)\s*\|\s*([£$€]?\s*[\d,]+\.\d{2}|)\s*\|\s*([£$€]?\s*[\d,]+\.\d{2}|)/gm,
                fields: ['date', 'description', 'cashIn', 'cashOut'],
                priority: 1
            },
            
            // Standard expense365 format: Date | Description | Cash In | Cash Out
            expense365Standard: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+([^|]+?)(?:\s+\|\s+)?(?:([£$€]?\s*[\d,]+\.?\d*))?\s*(?:\|\s*)?(?:([£$€]?\s*[\d,]+\.?\d*))?/gm,
                fields: ['date', 'description', 'cashIn', 'cashOut'],
                priority: 2
            },
            
            // Tabular format with clear columns
            tabularFormat: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s{2,}([^\d£$€]+?)\s{2,}([£$€]?\s*[\d,]+\.?\d*)/gm,
                fields: ['date', 'description', 'amount'],
                priority: 2
            },
            
            // Bank statement format with reference numbers
            bankStatement: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+(?:FPR|BGC|DDR|CHQ|TFR)\s+ref\s+(\d+)\s+([£$€]?\s*[\d,]+\.?\d*)/gmi,
                fields: ['date', 'description', 'reference', 'amount'],
                priority: 3
            },
            
            // UMHC specific patterns
            umhcMembership: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(?:MEMBERSHIP|Member|UMHC).{0,50}?\s+([£$€]?\s*[\d,]+\.?\d*)/gmi,
                fields: ['date', 'description', 'amount'],
                category: 'Membership',
                priority: 4
            },
            
            // Event registration patterns
            eventRegistration: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.{0,20}(?:WELSH\s*3000|TICKET|REGISTRATION|EVENT).{0,30}?)\s+([£$€]?\s*[\d,]+\.?\d*)/gmi,
                fields: ['date', 'description', 'amount'],
                category: 'Event Registration',
                priority: 4
            },
            
            // Transport related
            transportPattern: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.{0,30}(?:MINIBUS|FUEL|DIESEL|TRANSPORT|COACH).{0,30}?)\s+([£$€]?\s*[\d,]+\.?\d*)/gmi,
                fields: ['date', 'description', 'amount'],
                category: 'Transport',
                priority: 4
            },
            
            // Accommodation patterns
            accommodationPattern: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.{0,30}(?:HOSTEL|HOTEL|YHA|ACCOMMODATION|LODGE).{0,30}?)\s+([£$€]?\s*[\d,]+\.?\d*)/gmi,
                fields: ['date', 'description', 'amount'],
                category: 'Accommodation',
                priority: 4
            },
            
            // Generic pattern with amount at end
            genericPattern: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+([£$€]?\s*[\d,]+\.?\d*)\s*$/gm,
                fields: ['date', 'description', 'amount'],
                priority: 10
            }
        };
    }

    // Parse document text and extract transactions
    parseDocument(text, fileName = 'document') {
        const results = {
            transactions: [],
            parsingStats: {
                totalMatches: 0,
                patternMatches: {},
                confidence: {
                    high: 0,
                    medium: 0,
                    low: 0,
                    rejected: 0
                }
            },
            metadata: {
                fileName: fileName,
                processingMethod: 'Expense365 Pattern Matching',
                textLength: text.length,
                linesProcessed: text.split('\n').length
            }
        };

        try {
            // Pre-process text for better pattern matching
            const processedText = this.preprocessText(text);
            
            // Try patterns in priority order
            const sortedPatterns = Object.entries(this.patterns)
                .sort(([,a], [,b]) => a.priority - b.priority);
            
            const seenTransactions = new Set();
            
            for (const [patternName, pattern] of sortedPatterns) {
                const matches = this.extractWithPattern(processedText, pattern, patternName);
                results.parsingStats.patternMatches[patternName] = matches.length;
                results.parsingStats.totalMatches += matches.length;
                
                // Process matches and avoid duplicates
                for (const match of matches) {
                    const transaction = this.parseTransaction(match, pattern, patternName);
                    
                    if (transaction && this.isValidTransaction(transaction)) {
                        const dedupeKey = this.getDedupeKey(transaction);
                        
                        if (!seenTransactions.has(dedupeKey)) {
                            seenTransactions.add(dedupeKey);
                            results.transactions.push(transaction);
                            
                            // Update confidence stats
                            if (transaction.confidence >= this.confidenceThresholds.high) {
                                results.parsingStats.confidence.high++;
                            } else if (transaction.confidence >= this.confidenceThresholds.medium) {
                                results.parsingStats.confidence.medium++;
                            } else if (transaction.confidence >= this.confidenceThresholds.low) {
                                results.parsingStats.confidence.low++;
                            }
                        }
                    } else {
                        results.parsingStats.confidence.rejected++;
                    }
                }
            }
            
            // Sort transactions by date
            results.transactions.sort((a, b) => {
                const dateA = this.parseDate(a.date);
                const dateB = this.parseDate(b.date);
                return dateB - dateA; // Most recent first
            });
            
            Utils.log('info', 'Expense365 parsing completed', {
                transactions: results.transactions.length,
                patterns: Object.keys(results.parsingStats.patternMatches).length,
                highConfidence: results.parsingStats.confidence.high
            });
            
            return results;
            
        } catch (error) {
            Utils.log('error', 'Expense365 parsing failed', error);
            results.error = error.message;
            return results;
        }
    }

    // Pre-process text for better pattern matching with enhanced OCR cleanup
    preprocessText(text) {
        return text
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            
            // Fix common OCR character misrecognitions
            .replace(/[Oo](?=\d)/g, '0')        // O before digit → 0
            .replace(/(?<=\d)[Oo]/g, '0')       // O after digit → 0 
            .replace(/[Il|](?=\d)/g, '1')       // I, l, | before digit → 1
            .replace(/(?<=\d)[Il]/g, '1')       // I, l after digit → 1
            .replace(/[S](?=\d)/g, '5')         // S before digit → 5
            .replace(/(?<=\d)[S]/g, '5')        // S after digit → 5
            .replace(/[Z](?=\d)/g, '2')         // Z before digit → 2
            .replace(/(?<=\d)[Z]/g, '2')        // Z after digit → 2
            .replace(/[G](?=\d)/g, '6')         // G before digit → 6
            .replace(/(?<=\d)[G]/g, '6')        // G after digit → 6
            
            // Normalize currency symbols
            .replace(/[£€$]/g, '£')
            
            // Fix pipe separator variations (OCR may see | as other chars)
            .replace(/[│∣║¦]/g, '|')            // Various pipe-like characters
            .replace(/\s*\|\s*/g, ' | ')        // Normalize spacing around pipes
            
            // Clean up spacing around numbers and preserve decimal points
            .replace(/(\d)\s+(\d)/g, '$1$2')
            .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
            .replace(/(\d)\s*,\s*(\d{3})/g, '$1,$2') // Thousands separator
            .replace(/(\d)\s*,\s*(\d{1,2})\b/g, '$1.$2') // Decimal separator
            
            // Fix date separators and normalize format
            .replace(/(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/g, '$1/$2/$3')
            
            // Handle table structure - convert multiple spaces/tabs to pipes
            .replace(/\t+/g, ' | ')             // Tabs to pipes
            .replace(/ {3,}/g, ' | ')           // Multiple spaces to pipes
            .replace(/\s*\|\s*\|\s*/g, ' | ')   // Multiple pipes to single pipe
            
            // Clean up pipe-separated structure for Cash In/Out format
            .replace(/\|\s*£?\s*\|/g, '| |')    // Empty columns with currency symbols
            .replace(/\|\s*\|\s*/g, '| |')      // Multiple consecutive pipes (empty cells)
            
            // Remove excessive whitespace while preserving structure
            .replace(/^\s+/gm, '')              // Leading whitespace on lines
            .replace(/\s+$/gm, '')              // Trailing whitespace on lines
            .replace(/\n{3,}/g, '\n\n');       // Multiple line breaks
    }

    // Extract matches using a specific pattern
    extractWithPattern(text, pattern, patternName) {
        const matches = [];
        let match;
        
        while ((match = pattern.regex.exec(text)) !== null) {
            matches.push({
                fullMatch: match[0],
                groups: match.slice(1),
                index: match.index,
                patternName: patternName
            });
            
            // Prevent infinite loops
            if (!pattern.regex.global) break;
        }
        
        // Reset regex for next use
        pattern.regex.lastIndex = 0;
        
        return matches;
    }

    // Parse a transaction from a regex match
    parseTransaction(match, pattern, patternName) {
        try {
            const transaction = {
                date: null,
                description: '',
                amount: 0,
                type: 'Expense',
                category: pattern.category || 'Uncategorized',
                event: 'General',
                reference: '',
                confidence: 0.5,
                patternUsed: patternName,
                rawMatch: match.fullMatch
            };

            // Map fields based on pattern configuration
            for (let i = 0; i < pattern.fields.length && i < match.groups.length; i++) {
                const field = pattern.fields[i];
                const value = match.groups[i];
                
                if (!value) continue;
                
                switch (field) {
                    case 'date':
                        transaction.date = this.normalizeDate(value.trim());
                        break;
                        
                    case 'description':
                        transaction.description = this.cleanDescription(value.trim());
                        break;
                        
                    case 'amount':
                        const amount = this.parseAmount(value);
                        if (amount !== null) {
                            transaction.amount = Math.abs(amount);
                            transaction.type = amount > 0 ? 'Income' : 'Expense';
                        }
                        break;
                        
                    case 'cashIn':
                        // Only process if value is not empty/whitespace
                        if (value && value.trim() !== '') {
                            const cashIn = this.parseCurrencyAmount(value);
                            if (cashIn !== null && cashIn > 0) {
                                transaction.cashInValue = cashIn;
                            }
                        }
                        break;
                        
                    case 'cashOut':
                        // Only process if value is not empty/whitespace
                        if (value && value.trim() !== '') {
                            const cashOut = this.parseCurrencyAmount(value);
                            if (cashOut !== null && cashOut > 0) {
                                transaction.cashOutValue = cashOut;
                            }
                        }
                        break;
                        
                    case 'reference':
                        transaction.reference = value.trim();
                        break;
                }
            }

            // Handle Cash In/Out logic - Cash In column (3rd) comes before Cash Out (4th)
            if (transaction.cashInValue && transaction.cashOutValue) {
                // Both columns have values - this is unusual for expense365 format
                // This might indicate a parsing error, but if it happens, log it and prefer Cash In
                Utils.log('warn', 'Both Cash In and Cash Out have values - unusual', {
                    cashIn: transaction.cashInValue,
                    cashOut: transaction.cashOutValue,
                    description: transaction.description
                });
                transaction.amount = transaction.cashInValue;
                transaction.type = 'Income';
            } else if (transaction.cashInValue && !transaction.cashOutValue) {
                // Only Cash In (3rd column) has value - Income
                transaction.amount = transaction.cashInValue;
                transaction.type = 'Income';
            } else if (!transaction.cashInValue && transaction.cashOutValue) {
                // Only Cash Out (4th column) has value - Expense  
                transaction.amount = transaction.cashOutValue;
                transaction.type = 'Expense';
            } else {
                // Neither column has a valid currency amount - invalid transaction
                return null;
            }
            
            // Clean up temporary fields
            delete transaction.cashInValue;
            delete transaction.cashOutValue;

            // Auto-categorize if not already set by pattern
            if (transaction.category === 'Uncategorized') {
                transaction.category = this.autoCategorizeFree(transaction.description);
            }
            
            // Extract event information
            transaction.event = this.extractEvent(transaction.description);
            
            // Calculate confidence score
            transaction.confidence = this.calculateTransactionConfidence(transaction, match, pattern);
            
            return transaction;
            
        } catch (error) {
            Utils.log('warn', 'Failed to parse transaction', { error, match });
            return null;
        }
    }

    // Normalize date to DD/MM/YYYY format with enhanced OCR error handling
    normalizeDate(dateStr) {
        try {
            if (!dateStr) return null;
            
            // Clean OCR artifacts and normalize separators
            let cleanDate = dateStr.toString().trim()
                .replace(/[Oo]/g, '0')  // O → 0
                .replace(/[Il|]/g, '1') // I, l, | → 1  
                .replace(/[S]/g, '5')   // S → 5
                .replace(/[Z]/g, '2')   // Z → 2
                .replace(/[G]/g, '6')   // G → 6
                .replace(/\s+/g, '')    // Remove all whitespace
                .replace(/[-\.]/g, '/') // Normalize separators
                .replace(/[^\d\/]/g, ''); // Remove non-digit, non-slash characters
            
            const parts = cleanDate.split('/');
            
            if (parts.length !== 3) return null;
            
            let [day, month, year] = parts.map(p => parseInt(p.trim()));
            
            // Handle invalid parse results
            if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
            
            // Handle 2-digit years
            if (year < 100) {
                year = year > 50 ? 1900 + year : 2000 + year;
            }
            
            // Swap day/month if month > 12 but day <= 12 (common OCR error)
            if (month > 12 && day <= 12) {
                [day, month] = [month, day];
            }
            
            // Validate date ranges
            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return null;
            }
            
            // Additional validation: check if date is valid (e.g., not Feb 30)
            const testDate = new Date(year, month - 1, day);
            if (testDate.getDate() !== day || testDate.getMonth() !== month - 1) {
                return null;
            }
            
            // Check if date is reasonable (not too far in future)
            const now = new Date();
            const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
            
            if (testDate > twoYearsFromNow) {
                return null;
            }
            
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
            
        } catch (error) {
            return null;
        }
    }

    // Clean and normalize description
    cleanDescription(description) {
        return description
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            
            // Remove common OCR artifacts
            .replace(/[|]{1,}/g, ' ')
            .replace(/_{2,}/g, ' ')
            .replace(/\*{2,}/g, ' ')
            
            // Remove trailing numbers that might be amounts
            .replace(/\s+[\d,]+\.?\d*\s*$/, '')
            
            // Clean up formatting
            .replace(/[^\w\s£$€.,()&-]/g, '')
            .trim()
            .substring(0, 80); // Limit length
    }

    // Parse currency amount - requires exactly 2 decimal places (e.g., 123.45)
    parseCurrencyAmount(amountStr) {
        if (!amountStr) return null;
        
        try {
            // Clean OCR artifacts first
            let cleaned = amountStr.toString().trim()
                .replace(/[Oo]/g, '0')    // O → 0
                .replace(/[Il]/g, '1')    // I, l → 1
                .replace(/[S]/g, '5')     // S → 5
                .replace(/[Z]/g, '2')     // Z → 2  
                .replace(/[G]/g, '6')     // G → 6
                .replace(/[£$€\s]/g, ''); // Remove currency and whitespace
            
            // Must have at least some digits and a decimal point
            if (!cleaned || !/\d+\.\d/.test(cleaned)) return null;
            
            // Handle negative indicators
            const isNegative = /[\(\-]/.test(amountStr) || 
                              amountStr.toLowerCase().includes('out') ||
                              amountStr.toLowerCase().includes('debit');
            
            // Remove negative indicators
            cleaned = cleaned.replace(/[\(\)\-]/g, '');
            
            // Only keep digits, commas, dots
            cleaned = cleaned.replace(/[^0-9.,]/g, '');
            
            // Handle comma thousands separators
            if (cleaned.includes(',') && cleaned.includes('.')) {
                // Both comma and dot - comma should be thousands separator
                const lastDotIndex = cleaned.lastIndexOf('.');
                const lastCommaIndex = cleaned.lastIndexOf(',');
                
                if (lastDotIndex > lastCommaIndex) {
                    // Remove comma thousands separators, keep dot as decimal
                    cleaned = cleaned.replace(/,/g, '');
                }
            } else if (cleaned.includes(',') && !cleaned.includes('.')) {
                // Only comma - check if it's decimal separator (European format)
                const parts = cleaned.split(',');
                if (parts.length === 2 && parts[1].length === 2) {
                    // Likely decimal: "123,45" → "123.45"
                    cleaned = cleaned.replace(',', '.');
                } else {
                    // Likely thousands separator without decimals - invalid currency
                    return null;
                }
            }
            
            // Strict currency format validation: must have exactly 2 decimal places
            const currencyPattern = /^\d{1,6}\.\d{2}$/;
            if (!currencyPattern.test(cleaned)) {
                return null;
            }
            
            const amount = parseFloat(cleaned);
            
            // Validate amount is reasonable for UMHC expenses
            if (isNaN(amount) || amount < 0.01 || amount > 50000) {
                return null;
            }
            
            return isNegative ? -amount : amount;
            
        } catch (error) {
            return null;
        }
    }

    // Legacy parseAmount - kept for backward compatibility with other patterns
    parseAmount(amountStr) {
        // For Cash In/Out patterns, use strict currency parsing
        return this.parseCurrencyAmount(amountStr);
    }

    // Calculate transaction confidence score
    calculateTransactionConfidence(transaction, match, pattern) {
        let confidence = 0.3; // Base confidence
        
        // Date quality
        if (transaction.date && /^\d{2}\/\d{2}\/\d{4}$/.test(transaction.date)) {
            confidence += 0.2;
        }
        
        // Description quality
        if (transaction.description && transaction.description.length >= 5) {
            confidence += 0.15;
            
            // Bonus for meaningful words
            if (/[a-zA-Z]{3,}/.test(transaction.description)) {
                confidence += 0.1;
            }
        }
        
        // Amount quality
        if (transaction.amount > 0) {
            confidence += 0.2;
            
            // Reasonable amount range
            if (transaction.amount >= 1 && transaction.amount <= 10000) {
                confidence += 0.1;
            }
        }
        
        // Pattern reliability bonus
        switch (pattern.priority) {
            case 1: confidence += 0.15; break; // High priority patterns
            case 2: confidence += 0.1; break;
            case 3: confidence += 0.05; break;
            default: confidence += 0; break;
        }
        
        // Category assignment bonus
        if (transaction.category !== 'Uncategorized') {
            confidence += 0.1;
        }
        
        return Math.min(confidence, 1.0);
    }

    // Auto-categorization using UMHC-specific keywords
    autoCategorizeFree(description) {
        const desc = description.toLowerCase();
        
        // Use CONFIG categories if available
        if (typeof CONFIG !== 'undefined' && CONFIG.suggestCategory) {
            const suggested = CONFIG.suggestCategory(description);
            if (suggested) return suggested;
        }
        
        // UMHC-specific patterns
        const categoryPatterns = {
            'Membership': ['membership', 'member', 'umhc', 'club fee'],
            'Event Registration': ['welsh 3000', 'ticket', 'registration', 'event', 'trip'],
            'Transport': ['minibus', 'fuel', 'diesel', 'petrol', 'transport', 'coach', 'train', 'bus'],
            'Accommodation': ['hostel', 'hotel', 'yha', 'lodge', 'accommodation', 'camping'],
            'Equipment': ['equipment', 'gear', 'rope', 'helmet', 'boots', 'tent', 'compass'],
            'Food & Catering': ['food', 'catering', 'meal', 'lunch', 'dinner', 'snack'],
            'Insurance': ['insurance', 'cover', 'policy'],
            'Training': ['training', 'course', 'instructor', 'guide', 'lesson'],
            'Grants & Funding': ['grant', 'fund', 'funding', 'award', 'sponsorship'],
            'Administration': ['admin', 'fee', 'charge', 'bank', 'statement'],
            'Social Events': ['social', 'party', 'bbq', 'barbecue', 'drink', 'pub'],
            'External Memberships': ['bmc', 'mountaineering council', 'outdoor', 'climbing'],
            'Penalties & Fines': ['fine', 'penalty', 'charge', 'fee', 'parking', 'speeding']
        };
        
        for (const [category, keywords] of Object.entries(categoryPatterns)) {
            if (keywords.some(keyword => desc.includes(keyword))) {
                return category;
            }
        }
        
        return 'Uncategorized';
    }

    // Extract event information
    extractEvent(description) {
        const desc = description.toLowerCase();
        
        // UMHC event patterns
        if (desc.includes('welsh 3000') || desc.includes('welsh3000')) return 'Welsh 3000s 2025';
        if (desc.includes('snowdon') || desc.includes('snowdonia')) return 'Snowdonia Trip';
        if (desc.includes('peak district') || desc.includes('peaks')) return 'Peak District Trip';
        if (desc.includes('lake district') || desc.includes('lakes')) return 'Lake District Trip';
        if (desc.includes('scotland') || desc.includes('highland')) return 'Scotland Trip';
        if (desc.includes('brecon') || desc.includes('beacon')) return 'Brecon Beacons Trip';
        if (desc.includes('fresher') || desc.includes('welcome')) return 'Freshers Events';
        if (desc.includes('social') || desc.includes('bbq') || desc.includes('party')) return 'Social Events';
        if (desc.includes('training') || desc.includes('course')) return 'Training Events';
        
        return 'General';
    }

    // Create deduplication key
    getDedupeKey(transaction) {
        return `${transaction.date}-${transaction.amount.toFixed(2)}-${transaction.description.substring(0, 20).toLowerCase()}`;
    }

    // Validate transaction
    isValidTransaction(transaction) {
        return transaction.date && 
               transaction.description && 
               transaction.description.length >= 3 &&
               transaction.amount > 0 &&
               transaction.confidence >= this.confidenceThresholds.low;
    }

    // Parse date for sorting
    parseDate(dateStr) {
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    }

    // Get parsing statistics
    getParsingStats() {
        return {
            patterns: Object.keys(this.patterns).length,
            confidenceThresholds: this.confidenceThresholds
        };
    }
}

// Export for use
window.Expense365Parser = Expense365Parser;

Utils.log('info', 'Expense365 specialized parser loaded with UMHC-optimized patterns');
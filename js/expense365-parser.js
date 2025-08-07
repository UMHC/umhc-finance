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
            // Standard expense365 format: Date | Description | Cash In | Cash Out
            expense365Standard: {
                regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+([^|]+?)(?:\s+\|\s+)?(?:([£$€]?\s*[\d,]+\.?\d*))?\s*(?:\|\s*)?(?:([£$€]?\s*[\d,]+\.?\d*))?/gm,
                fields: ['date', 'description', 'cashIn', 'cashOut'],
                priority: 1
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

    // Pre-process text for better pattern matching
    preprocessText(text) {
        return text
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            
            // Fix common OCR issues
            .replace(/\bO\b/g, '0') // O to 0 in numbers
            .replace(/\bl\b/g, '1') // l to 1 in numbers
            .replace(/\bS\b/g, '5') // S to 5 in numbers
            
            // Normalize currency symbols
            .replace(/[£€$]/g, '£')
            
            // Clean up spacing around numbers
            .replace(/(\d)\s+(\d)/g, '$1$2')
            .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
            .replace(/(\d)\s*,\s*(\d)/g, '$1,$2')
            
            // Fix date separators
            .replace(/(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/g, '$1/$2/$3')
            
            // Remove excessive whitespace but preserve structure
            .replace(/ {3,}/g, ' | '); // Convert multiple spaces to pipe separators
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
                        const cashIn = this.parseAmount(value);
                        if (cashIn !== null && cashIn > 0) {
                            transaction.amount = cashIn;
                            transaction.type = 'Income';
                        }
                        break;
                        
                    case 'cashOut':
                        const cashOut = this.parseAmount(value);
                        if (cashOut !== null && cashOut > 0) {
                            transaction.amount = cashOut;
                            transaction.type = 'Expense';
                        }
                        break;
                        
                    case 'reference':
                        transaction.reference = value.trim();
                        break;
                }
            }

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

    // Normalize date to DD/MM/YYYY format
    normalizeDate(dateStr) {
        try {
            // Handle various separators
            const cleanDate = dateStr.replace(/[-\.]/g, '/');
            const parts = cleanDate.split('/');
            
            if (parts.length !== 3) return null;
            
            let [day, month, year] = parts.map(p => parseInt(p.trim()));
            
            // Handle 2-digit years
            if (year < 100) {
                year = year > 50 ? 1900 + year : 2000 + year;
            }
            
            // Validate ranges
            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return null;
            }
            
            // Check if date is reasonable (not too far in future)
            const date = new Date(year, month - 1, day);
            const now = new Date();
            const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            
            if (date > oneYearFromNow) {
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

    // Parse amount from string with enhanced logic
    parseAmount(amountStr) {
        if (!amountStr) return null;
        
        try {
            // Remove whitespace and currency symbols
            let cleaned = amountStr.replace(/[£$€\s]/g, '');
            
            // Handle empty or non-numeric strings
            if (!cleaned || !/\d/.test(cleaned)) return null;
            
            // Handle negative indicators
            const isNegative = /[\(\-]/.test(amountStr) || 
                              amountStr.toLowerCase().includes('out') ||
                              amountStr.toLowerCase().includes('debit');
            
            // Remove negative indicators
            cleaned = cleaned.replace(/[\(\)\-]/g, '');
            
            // Handle comma thousands separators
            if (cleaned.includes(',')) {
                // Validate comma placement (every 3 digits from right)
                const commaPattern = /^\d{1,3}(,\d{3})*(\.\d{2})?$/;
                if (commaPattern.test(cleaned)) {
                    cleaned = cleaned.replace(/,/g, '');
                } else {
                    // Invalid comma usage, try to fix
                    cleaned = cleaned.replace(/,/g, '');
                }
            }
            
            const amount = parseFloat(cleaned);
            
            // Validate amount is reasonable
            if (isNaN(amount) || amount <= 0 || amount > 100000) {
                return null;
            }
            
            return isNegative ? -amount : amount;
            
        } catch (error) {
            return null;
        }
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
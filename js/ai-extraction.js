// js/ai-extraction.js - AI-powered document processing for UMHC Finance System
// IMPROVED VERSION for expense365 format

class AIExtractor {
    constructor() {
        this.apiKey = null; // Will be set by user or stored securely
        this.apiEndpoint = CONFIG.API_ENDPOINTS.CLAUDE;
        this.model = CONFIG.AI.MODEL;
        this.maxTokens = CONFIG.AI.MAX_TOKENS;
        this.confidenceThreshold = CONFIG.AI.CONFIDENCE_THRESHOLD;
        
        Utils.log('info', 'AIExtractor initialized');
    }

    // Set API key for Claude
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        Utils.log('info', 'API key configured');
    }

    // Check if AI is configured and ready
    isConfigured() {
        return !!this.apiKey;
    }

    // Process a file and extract financial data
    async processFile(file) {
        Utils.log('info', 'Starting file processing', { 
            fileName: file.name, 
            fileType: file.type,
            fileSize: file.size 
        });

        try {
            // Step 1: Extract text from file
            const extractedText = await this.extractTextFromFile(file);
            
            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No text could be extracted from the file');
            }

            Utils.log('info', 'Text extracted successfully', { 
                textLength: extractedText.length 
            });

            // Step 2: Process with AI or fallback
            let aiResult;
            
            if (this.isConfigured()) {
                Utils.log('info', 'Using Claude AI for processing');
                aiResult = await this.processWithAI(extractedText);
            } else {
                Utils.log('info', 'Using improved expense365 parser (no API key)');
                aiResult = this.parseExpense365Format(extractedText);
            }
            
            // Step 3: Validate and format results
            const validatedTransactions = this.validateExtractedData(aiResult);

            Utils.log('info', 'Processing complete', { 
                transactionsFound: validatedTransactions.length 
            });

            return {
                success: true,
                extractedText,
                transactions: validatedTransactions,
                metadata: {
                    fileName: file.name,
                    fileType: file.type,
                    extractedAt: new Date().toISOString(),
                    processingMethod: this.isConfigured() ? 'Claude AI' : 'expense365 Parser'
                }
            };

        } catch (error) {
            Utils.log('error', 'File processing failed', error);
            throw error;
        }
    }

    // IMPROVED: Parse expense365 format specifically
    parseExpense365Format(text) {
        Utils.log('info', 'Parsing expense365 format...');
        
        const transactions = [];
        const lines = text.split('\n');
        
        let currentDate = null;
        let balanceCarriedForward = null;
        
        // Find balance carried forward
        const balanceMatch = text.match(/Balance Bfwd\s*:\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
        if (balanceMatch) {
            balanceCarriedForward = parseFloat(balanceMatch[1].replace(/,/g, ''));
            Utils.log('info', 'Found balance carried forward:', balanceCarriedForward);
        }
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Skip header lines
            if (line.includes('Statement at') || line.includes('Hiking Club') || 
                line.includes('Description') || line.includes('Cash In') ||
                line.includes('Cost Centre') || line.includes('Page')) {
                continue;
            }
            
            // Try to parse as transaction line
            const transaction = this.parseExpense365TransactionLine(line);
            if (transaction) {
                transactions.push(transaction);
            }
        }
        
        Utils.log('info', 'expense365 parsing complete', {
            linesProcessed: lines.length,
            transactionsFound: transactions.length
        });
        
        return {
            transactions,
            summary: {
                totalTransactions: transactions.length,
                totalIncome: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
                totalExpenses: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
                averageConfidence: 0.85, // Higher confidence for structured parsing
                balanceCarriedForward: balanceCarriedForward
            }
        };
    }

    // Parse a single expense365 transaction line
    parseExpense365TransactionLine(line) {
        // expense365 format: DD/MM/YYYY Description Amount
        // Sometimes amounts appear in separate "Cash In" and "Cash Out" columns
        
        // Pattern for date at start of line
        const datePattern = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)/;
        const dateMatch = line.match(datePattern);
        
        if (!dateMatch) {
            return null; // Not a transaction line
        }
        
        const [, dateStr, restOfLine] = dateMatch;
        
        // Extract amount(s) from the line
        const amounts = this.extractAmountsFromLine(restOfLine);
        
        if (amounts.length === 0) {
            return null; // No valid amounts found
        }
        
        // Get description (everything except the amount at the end)
        let description = restOfLine;
        
        // Remove amounts from description
        amounts.forEach(amount => {
            const amountStr = amount.original;
            const lastIndex = description.lastIndexOf(amountStr);
            if (lastIndex !== -1) {
                description = description.substring(0, lastIndex);
            }
        });
        
        description = description.trim();
        
        if (!description) {
            return null; // No description
        }
        
        // Use the last/largest amount as the transaction amount
        const mainAmount = amounts[amounts.length - 1];
        
        // Determine if this is income or expense based on context
        const isIncome = this.determineTransactionType(description, mainAmount.value);
        const finalAmount = isIncome ? Math.abs(mainAmount.value) : -Math.abs(mainAmount.value);
        
        // Categorize the transaction
        const category = this.categorizeTransaction(description);
        const event = this.determineEvent(description);
        
        return {
            date: this.normalizeDate(dateStr),
            description: this.cleanDescription(description),
            amount: finalAmount,
            type: isIncome ? 'Income' : 'Expense',
            category: category,
            event: event,
            confidence: 0.85,
            reference: this.extractReference(description),
            notes: 'Extracted from expense365 format'
        };
    }

    // Extract amounts from a line (handles various formats)
    extractAmountsFromLine(text) {
        // Pattern for amounts: optional minus, digits with optional commas, optional decimal
        const amountPattern = /(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
        const amounts = [];
        
        let match;
        while ((match = amountPattern.exec(text)) !== null) {
            const originalStr = match[1];
            const value = parseFloat(originalStr.replace(/,/g, ''));
            
            // Only consider significant amounts (> £1)
            if (!isNaN(value) && Math.abs(value) >= 1) {
                amounts.push({
                    original: originalStr,
                    value: value
                });
            }
        }
        
        return amounts;
    }

    // Determine if transaction is income or expense
    determineTransactionType(description, amount) {
        const desc = description.toLowerCase();
        
        // Income indicators
        const incomeKeywords = [
            'membership', 'ticket', 'registration', 'grant', 'funding', 'refund',
            'fpr ref', 'bgc ref', 'payment', 'deposit', 'collection'
        ];
        
        // Expense indicators  
        const expenseKeywords = [
            'hire', 'fuel', 'diesel', 'petrol', 'food', 'accommodation', 'hotel', 'hostel',
            'insurance', 'parking', 'toll', 'uber', 'taxi', 'equipment', 'training',
            'website', 'printing', 'coach', 'van', 'minibus'
        ];
        
        // Check for income keywords
        for (const keyword of incomeKeywords) {
            if (desc.includes(keyword)) {
                return true;
            }
        }
        
        // Check for expense keywords
        for (const keyword of expenseKeywords) {
            if (desc.includes(keyword)) {
                return false;
            }
        }
        
        // If amount is positive and no clear indicators, assume income
        // If amount is negative, assume expense
        return amount > 0;
    }

    // Categorize transaction based on description
    categorizeTransaction(description) {
        const desc = description.toLowerCase();
        
        // Category mapping based on UMHC's real transactions
        const categoryMap = {
            'Event Registration': ['ticket', 'registration', 'member ticket', 'non member', 'freshers', 'leader ticket'],
            'Membership': ['membership', 'student membership', 'associate membership'],
            'Transport': ['fuel', 'diesel', 'petrol', 'hire', 'coach', 'minibus', 'van hire', 'parking', 'toll', 'uber', 'taxi'],
            'Accommodation': ['accommodation', 'hostel', 'hotel', 'booking', 'centre', 'lodge'],
            'Equipment': ['equipment', 'helmet', 'radio', 'compass', 'rope', 'crampons', 'kit'],
            'Food & Catering': ['food', 'catering', 'meal', 'curry', 'party payment'],
            'Insurance': ['insurance', 'cover'],
            'Training': ['training', 'course', 'first aid'],
            'Administration': ['website', 'printing', 'admin', 'bank', 'fees'],
            'Grants & Funding': ['grant', 'funding', 'fund it'],
            'Social Events': ['social', 'party', 'bowling', 'ninja', 'barbecue', 'ceilidh'],
            'Penalties & Fines': ['fine', 'penalty', 'traffic', 'toll fine'],
            'External Memberships': ['bmc', 'mountaineering']
        };
        
        // Find matching category
        for (const [category, keywords] of Object.entries(categoryMap)) {
            for (const keyword of keywords) {
                if (desc.includes(keyword)) {
                    return category;
                }
            }
        }
        
        return 'Uncategorized';
    }

    // Determine event from description
    determineEvent(description) {
        const desc = description.toLowerCase();
        
        // Event patterns based on UMHC's actual events
        const eventMap = {
            'Welsh 3000s 2025': ['welsh 3000s', 'w3k', 'w3s'],
            'Nethy 2025': ['nethy'],
            'Torridon 2025': ['torridon'],
            'Glenridding 2025': ['glenridding'],
            'Snowdonia 2025': ['snowdonia'],
            'Cadair Idris 2024': ['cadair'],
            'Skye 2024': ['skye'],
            'Ennerdale 2025': ['ennerdale'],
            'Borrowdale 2024': ['borrowdale'],
            'Langdales': ['langdale'],
            'Helvellyn': ['helvellyn'],
            'Braithwaite': ['braithwaite'],
            'Keswick': ['keswick'],
            'Coniston': ['coniston'],
            'Grasmere': ['grasmere'],
            'Snowdon': ['snowdon'],
            'Malham': ['malham'],
            'Christmas Events': ['christmas'],
            'Freshers Events': ['freshers'],
            'Social Events': ['social', 'party', 'bowling', 'ninja'],
            'Annual Dinner': ['annual dinner']
        };
        
        // Find matching event
        for (const [event, keywords] of Object.entries(eventMap)) {
            for (const keyword of keywords) {
                if (desc.includes(keyword)) {
                    return event;
                }
            }
        }
        
        return 'General';
    }

    // Extract reference from description
    extractReference(description) {
        // Look for reference patterns
        const refPatterns = [
            /\((\d+)\)/, // Numbers in parentheses
            /ref\s+([^\s]+)/i, // "ref" followed by reference
            /FPR\s+ref\s+([^\s]+)/i, // "FPR ref" pattern
            /BGC\s+ref\s+([^\s]+)/i, // "BGC ref" pattern
        ];
        
        for (const pattern of refPatterns) {
            const match = description.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return '';
    }

    // Extract text from different file types
    async extractTextFromFile(file) {
        const fileType = file.type;

        try {
            if (fileType === 'application/pdf') {
                return await this.extractTextFromPDF(file);
            } else if (fileType.startsWith('image/')) {
                return await this.extractTextFromImage(file);
            } else {
                throw new Error(`Unsupported file type: ${fileType}`);
            }
        } catch (error) {
            Utils.log('error', 'Text extraction failed', error);
            throw new Error(`Failed to extract text: ${error.message}`);
        }
    }

    // Extract text from PDF using PDF.js
    async extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            
            fileReader.onload = async function() {
                try {
                    // Load PDF.js library dynamically if not already loaded
                    if (typeof pdfjsLib === 'undefined') {
                        await loadPDFJSLibrary();
                    }

                    const typedArray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument({data: typedArray}).promise;
                    
                    let fullText = '';
                    
                    // Extract text from each page
                    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                        const page = await pdf.getPage(pageNumber);
                        const textContent = await page.getTextContent();
                        
                        const pageText = textContent.items
                            .map(item => item.str)
                            .join(' ');
                        
                        fullText += pageText + '\n';
                    }

                    Utils.log('info', 'PDF text extraction complete', {
                        pages: pdf.numPages,
                        textLength: fullText.length
                    });

                    resolve(fullText.trim());
                    
                } catch (error) {
                    reject(new Error(`PDF processing error: ${error.message}`));
                }
            };

            fileReader.onerror = () => {
                reject(new Error('Failed to read PDF file'));
            };

            fileReader.readAsArrayBuffer(file);
        });
    }

    // Extract text from image using simulated OCR
    async extractTextFromImage(file) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            
            fileReader.onload = async function() {
                try {
                    // Simulate OCR processing delay
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // In production, this would use Tesseract.js or cloud OCR
                    Utils.log('info', 'OCR processing complete (simulated)');
                    
                    // Return sample OCR result for now
                    const simulatedOCRText = `
Statement at 05/07/2025
Hiking Club UMSU01
18/04/2025 Welsh 3000s Registration 1610.00
18/04/2025 Hostel Booking - Canolfan Corris 1400.00
15/04/2025 Transport - Minibus Hire 320.50
                    `;
                    
                    resolve(simulatedOCRText.trim());
                    
                } catch (error) {
                    reject(new Error(`OCR processing error: ${error.message}`));
                }
            };

            fileReader.onerror = () => {
                reject(new Error('Failed to read image file'));
            };

            fileReader.readAsDataURL(file);
        });
    }

    // Process extracted text with Claude AI (when API key is available)
    async processWithAI(extractedText) {
        const prompt = this.buildExtractionPrompt(extractedText);
        
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Claude API error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            const aiResponse = result.content[0].text;

            Utils.log('info', 'Claude API response received');
            return this.parseAIResponse(aiResponse);

        } catch (error) {
            Utils.log('error', 'Claude API request failed', error);
            throw error;
        }
    }

    // Build the prompt for AI extraction
    buildExtractionPrompt(extractedText) {
        return `You are a financial data extraction specialist for the University of Manchester Hiking Club (UMHC). 

Extract ALL transactions from this expense365 statement and format as JSON.

KEY PATTERNS TO RECOGNIZE:
- Lines starting with DD/MM/YYYY are transaction lines
- Positive amounts or "Cash In" column = Income
- Negative amounts or "Cash Out" column = Expenses
- FPR ref/BGC ref usually = Income from member payments
- Hire/Fuel/Accommodation usually = Expenses

CATEGORIES: ${CONFIG.getAllCategories().join(', ')}

TEXT TO PROCESS:
${extractedText}

Return JSON with this structure:
{
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "Description",
      "amount": 123.45,
      "type": "Income|Expense", 
      "category": "Category",
      "event": "Event name",
      "confidence": 0.95
    }
  ],
  "summary": {
    "totalTransactions": 150,
    "totalIncome": 50000.00,
    "totalExpenses": 45000.00
  }
}`;
    }

    // Continue with existing methods...
    parseAIResponse(aiResponse) {
        try {
            let cleanResponse = aiResponse.trim();
            const jsonMatch = cleanResponse.match(/```(?:json)?\n?(.*?)\n?```/s);
            if (jsonMatch) {
                cleanResponse = jsonMatch[1];
            }
            return JSON.parse(cleanResponse);
        } catch (error) {
            Utils.log('error', 'Failed to parse AI response', error);
            throw new Error('Invalid AI response format');
        }
    }

    // Validate extracted data
    validateExtractedData(aiResult) {
        if (!aiResult || !aiResult.transactions) {
            return [];
        }

        const validTransactions = [];

        for (const transaction of aiResult.transactions) {
            try {
                if (!transaction.date || !transaction.description || transaction.amount === undefined) {
                    continue;
                }

                if (!Utils.validate.date(transaction.date)) {
                    continue;
                }

                const amount = parseFloat(transaction.amount);
                if (isNaN(amount)) {
                    continue;
                }

                const allCategories = CONFIG.getAllCategories();
                const category = allCategories.includes(transaction.category) 
                    ? transaction.category 
                    : 'Uncategorized';

                const validTransaction = {
                    date: this.normalizeDate(transaction.date),
                    description: this.cleanDescription(transaction.description),
                    amount: amount,
                    type: transaction.type || (amount > 0 ? 'Income' : 'Expense'),
                    category: category,
                    event: transaction.event || 'General',
                    confidence: Math.min(Math.max(transaction.confidence || 0.5, 0), 1),
                    reference: transaction.reference || '',
                    notes: transaction.notes || ''
                };

                validTransactions.push(validTransaction);

            } catch (error) {
                Utils.log('warn', 'Error validating transaction', { transaction, error });
            }
        }

        return validTransactions;
    }

    // Utility methods
    normalizeDate(dateStr) {
        try {
            const parts = dateStr.split('/');
            if (parts.length !== 3) return dateStr;
            
            let [day, month, year] = parts;
            day = day.padStart(2, '0');
            month = month.padStart(2, '0');
            
            if (year.length === 2) {
                year = year > 50 ? '19' + year : '20' + year;
            }
            
            return `${day}/${month}/${year}`;
        } catch (error) {
            return dateStr;
        }
    }

    cleanDescription(description) {
        return description
            .replace(/\s+/g, ' ')
            .replace(/^[-\s]+|[-\s]+$/g, '')
            .trim();
    }

    getProcessingStats() {
        return {
            isConfigured: this.isConfigured(),
            model: this.model,
            maxTokens: this.maxTokens,
            confidenceThreshold: this.confidenceThreshold,
            supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG'],
            processingMethod: this.isConfigured() ? 'Claude AI' : 'expense365 Parser'
        };
    }
}

// Load PDF.js library dynamically
async function loadPDFJSLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof pdfjsLib !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        script.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
    });
}

// Create global AI extractor instance
const aiExtractor = new AIExtractor();

// Export for use in other files
window.AIExtractor = AIExtractor;
window.aiExtractor = aiExtractor;

Utils.log('info', 'Enhanced AI Extraction module loaded successfully');
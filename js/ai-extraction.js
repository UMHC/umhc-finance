// js/ai-extraction.js - AI-powered document processing for UMHC Finance System
// SIMPLIFIED VERSION - API key input with Vercel proxy

class AIExtractor {
    constructor() {
        this.apiKey = null;
        this.model = 'claude-3-5-sonnet-20241022'; // Latest Claude 3.5 Sonnet
        // Alternative models:
        // this.model = 'claude-3-opus-20240229';
        // this.model = 'claude-3-haiku-20240307';
        this.maxTokens = 4000;
        this.confidenceThreshold = 0.7;

        Utils.log('info', 'AIExtractor initialized');
    }

    // Set API key
    setApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('Invalid API key provided');
        }

        if (!apiKey.startsWith('sk-ant-api')) {
            throw new Error('Invalid API key format. Should start with "sk-ant-api"');
        }

        this.apiKey = apiKey;
        Utils.log('info', 'API key configured successfully');
    }

    // Check if AI is configured and ready
    isConfigured() {
        return !!this.apiKey;
    }

    // NEW: Generate manual prompt for claude.ai
    generateManualPrompt(extractedText) {
        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('No extracted text provided for manual prompt generation');
        }

        const prompt = `You are a financial data extraction specialist for the University of Manchester Hiking Club (UMHC). 

Extract ALL transactions from this expense365 statement and format as JSON.

KEY PATTERNS TO RECOGNIZE:
- Lines starting with DD/MM/YYYY are transaction lines
- Positive amounts or "Cash In" column = Income
- Negative amounts or "Cash Out" column = Expenses
- FPR ref/BGC ref usually = Income from member payments
- Hire/Fuel/Accommodation usually = Expenses

CATEGORIES TO USE: ${this.getAllCategories().join(', ')}

INSTRUCTIONS:
1. Parse each transaction line carefully
2. Determine if it's Income or Expense based on context
3. Categorize using the categories above
4. Assign confidence score (0.0 to 1.0)
5. Extract event names where possible

TEXT TO PROCESS:
${extractedText}

Return ONLY a JSON object with this exact structure:
{
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "Description text",
      "amount": 123.45,
      "type": "Income",
      "category": "Event Registration",
      "event": "Welsh 3000s 2025",
      "confidence": 0.95,
      "reference": "",
      "notes": ""
    }
  ],
  "summary": {
    "totalTransactions": 150,
    "totalIncome": 50000.00,
    "totalExpenses": 45000.00,
    "averageConfidence": 0.85
  }
}

IMPORTANT: 
- Return ONLY the JSON object, no other text
- Use positive amounts for Income, negative amounts for Expenses
- Include ALL transactions found in the document
- Be as accurate as possible with dates and amounts`;

        return prompt;
    }

    // NEW: Get all available categories (using CONFIG if available, or fallback)
    getAllCategories() {
        try {
            if (typeof CONFIG !== 'undefined' && CONFIG.getAllCategories) {
                return CONFIG.getAllCategories();
            }
        } catch (error) {
            console.warn('CONFIG not available, using fallback categories');
        }

        // Fallback categories based on UMHC's real transactions
        return [
            'Event Registration',
            'Membership',
            'Transport',
            'Accommodation',
            'Equipment',
            'Food & Catering',
            'Insurance',
            'Training',
            'Administration',
            'Grants & Funding',
            'Social Events',
            'Penalties & Fines',
            'External Memberships',
            'Uncategorized'
        ];
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

            // Step 2: Process with AI if configured, otherwise use fallback parsing
            let aiResult;

            if (this.isConfigured() && this.proxyAvailable) {
                Utils.log('info', 'Using Claude API via proxy for processing');
                aiResult = await this.processWithProxy(extractedText);
            } else {
                Utils.log('info', 'Using expense365 parser (no API/proxy available)');
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
                    processingMethod: this.isConfigured() && this.proxyAvailable ? 'Claude API via Proxy' : 'expense365 Parser'
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

            fileReader.onload = async function () {
                try {
                    // Load PDF.js library dynamically if not already loaded
                    if (typeof pdfjsLib === 'undefined') {
                        await loadPDFJSLibrary();
                    }

                    const typedArray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

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

            fileReader.onload = async function () {
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

    // ENHANCED: Process extracted text with Claude AI (using proxy server)
    async processWithAI(extractedText, apiKey, authToken) {
        if (!apiKey) {
            throw new Error('API key not configured. Please set your Claude API key first.');
        }

        if (!authToken) {
            throw new Error('Authentication token required for API processing');
        }

        const prompt = this.buildExtractionPrompt(extractedText);

        try {
            // Use the proxy server instead of calling Claude directly
            const response = await fetch('https://umhc-auth-server.vercel.app/api/claude-extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    prompt: prompt,
                    model: this.model,
                    maxTokens: this.maxTokens,
                    apiKey: apiKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `API request failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.content) {
                Utils.log('info', 'Claude API response received via proxy');
                return this.parseAIResponse(result.content);
            } else {
                throw new Error('Invalid response from Claude API proxy');
            }

        } catch (error) {
            Utils.log('error', 'Claude API request failed', error);
            throw error;
        }
    }

    // Build the prompt for AI extraction
    buildExtractionPrompt(extractedText) {
        return `You are a financial data extraction API. You MUST respond with ONLY valid JSON. No other text.

CRITICAL: Your ENTIRE response must be a single valid JSON object. Do not include any explanatory text, markdown formatting, or conversation.

Extract ALL transactions from this expense365 statement.

CATEGORIES: ${this.getAllCategories().join(', ')}

INPUT TEXT:
${extractedText}

OUTPUT FORMAT (respond with ONLY this JSON structure):
{
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "string",
      "amount": number,
      "type": "Income|Expense",
      "category": "string",
      "event": "string",
      "confidence": number
    }
  ],
  "summary": {
    "totalTransactions": number,
    "totalIncome": number,
    "totalExpenses": number,
    "averageConfidence": number
  }
}

REMEMBER: Output ONLY valid JSON. No text before or after. No markdown. Just the JSON object.`;
    }


    // Parse AI response (handles both API and manual responses)
    parseAIResponse(aiResponse) {
        try {
            let cleanResponse = aiResponse.trim();

            // Remove any non-JSON content before the first {
            const jsonStart = cleanResponse.indexOf('{');
            if (jsonStart > 0) {
                console.warn('AI response contained text before JSON, cleaning...');
                cleanResponse = cleanResponse.substring(jsonStart);
            }

            // Remove any non-JSON content after the last }
            const jsonEnd = cleanResponse.lastIndexOf('}');
            if (jsonEnd < cleanResponse.length - 1) {
                cleanResponse = cleanResponse.substring(0, jsonEnd + 1);
            }

            // Remove markdown code blocks if present
            cleanResponse = cleanResponse.replace(/```(?:json)?\n?/g, '');

            // Parse JSON
            const parsed = JSON.parse(cleanResponse);

            // Validate structure
            if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
                throw new Error('Invalid response format: missing transactions array');
            }

            return parsed;
        } catch (error) {
            Utils.log('error', 'Failed to parse AI response', {
                error: error.message,
                response: aiResponse.substring(0, 200) + '...'
            });
            throw new Error(`Invalid AI response format: ${error.message}`);
        }
    }

    // Validate extracted data
    validateExtractedData(aiResult) {
        if (!aiResult || !aiResult.transactions) {
            return [];
        }

        const validTransactions = [];
        const allCategories = this.getAllCategories();

        for (const transaction of aiResult.transactions) {
            try {
                // Validate required fields
                if (!transaction.date || !transaction.description || transaction.amount === undefined) {
                    Utils.log('warn', 'Skipping transaction with missing required fields', transaction);
                    continue;
                }

                // Validate date format
                if (!this.isValidDate(transaction.date)) {
                    Utils.log('warn', 'Skipping transaction with invalid date', transaction);
                    continue;
                }

                // Validate amount
                const amount = parseFloat(transaction.amount);
                if (isNaN(amount)) {
                    Utils.log('warn', 'Skipping transaction with invalid amount', transaction);
                    continue;
                }

                // Validate category
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

    // NEW: Validate date format
    isValidDate(dateStr) {
        // Accept DD/MM/YYYY format
        const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        if (!datePattern.test(dateStr)) {
            return false;
        }

        const [day, month, year] = dateStr.split('/').map(Number);
        const date = new Date(year, month - 1, day);

        return date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day;
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

    // NEW: Get processing stats for display (browser version)
    getProcessingStats() {
        return {
            isConfigured: false, // API doesn't work in browser
            model: this.model,
            maxTokens: this.maxTokens,
            confidenceThreshold: this.confidenceThreshold,
            supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG'],
            processingMethod: 'Manual Processing (Browser-Compatible)',
            apiEndpoint: 'Not available in browser (CORS restriction)',
            note: 'Direct API calls blocked by browser security policy'
        };
    }

    // NEW: Test API connection
    async testApiConnection() {
        if (!this.isConfigured()) {
            throw new Error('API key not configured');
        }

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
                    max_tokens: 10,
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello'
                        }
                    ]
                })
            });

            if (response.ok) {
                return { success: true, message: 'API connection successful' };
            } else {
                const errorText = await response.text();
                return { success: false, message: `API test failed: ${errorText}` };
            }
        } catch (error) {
            return { success: false, message: `API test failed: ${error.message}` };
        }
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

Utils.log('info', 'Simplified AI Extraction module loaded - API key input with Vercel proxy support');
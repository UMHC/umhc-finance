// js/ai-extraction.js - AI-powered document processing for UMHC Finance System
// UPDATED VERSION - Sends images/PDFs directly to Claude

class AIExtractor {
    constructor() {
        this.apiKey = null;
        this.model = 'claude-3-5-sonnet-20241022'; // Latest Claude 3.5 Sonnet
        this.maxTokens = 8000;
        this.confidenceThreshold = 0.7;
        this.lastRawResponse = null;

        Utils.log('info', 'AIExtractor initialized');
    }

    setLastRawResponse(response) {
        this.lastRawResponse = response;
    }

    getLastRawResponse() {
        return this.lastRawResponse || 'No response captured yet';
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

    // Get all available categories
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

    // Convert file to base64
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix to get just the base64 string
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Extract text from file (for preview/debugging only)
    async extractTextFromFile(file) {
        // For PDFs, we'll still extract text for preview purposes
        if (file.type === 'application/pdf') {
            try {
                return await this.extractTextFromPDF(file);
            } catch (error) {
                console.warn('PDF text extraction failed, will rely on Claude vision', error);
                return 'PDF text extraction failed - Claude will analyze the visual content';
            }
        }
        
        // For images, we don't extract text, just return a placeholder
        if (file.type.startsWith('image/')) {
            return 'Image file - Claude will analyze the visual content directly';
        }
        
        return 'File ready for Claude analysis';
    }

    // Extract text from PDF (for preview only)
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

                    // Extract text from each page (max 3 pages for preview)
                    const maxPages = Math.min(pdf.numPages, 3);
                    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
                        const page = await pdf.getPage(pageNumber);
                        const textContent = await page.getTextContent();

                        const pageText = textContent.items
                            .map(item => item.str)
                            .join(' ');

                        fullText += `Page ${pageNumber}:\n${pageText}\n\n`;
                    }

                    if (pdf.numPages > 3) {
                        fullText += `\n... (${pdf.numPages - 3} more pages)`;
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

    // Process with AI using direct file analysis
    async processWithAI(file, apiKey, authToken) {
        if (!apiKey) {
            throw new Error('API key not configured. Please set your Claude API key first.');
        }

        if (!authToken) {
            throw new Error('Authentication token required for API processing');
        }

        try {
            // Convert file to base64
            const base64Data = await this.fileToBase64(file);
            
            // Prepare the message content based on file type
            let messageContent = [];
            
            if (file.type === 'application/pdf') {
                messageContent.push({
                    type: "document",
                    source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: base64Data
                    }
                });
            } else if (file.type.startsWith('image/')) {
                messageContent.push({
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: file.type,
                        data: base64Data
                    }
                });
            }
            
            // Add the text prompt
            messageContent.push({
                type: "text",
                text: this.buildVisualExtractionPrompt()
            });

            // Use the proxy server
            const response = await fetch('https://umhc-auth-server.vercel.app/api/claude-extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    messageContent: messageContent,
                    model: this.model,
                    maxTokens: this.maxTokens,
                    apiKey: apiKey,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `API request failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.content) {
                Utils.log('info', 'Claude API response received via proxy');
                // Store the raw response before parsing
                this.setLastRawResponse(result.content);
                return this.parseAIResponse(result.content);
            } else {
                throw new Error('Invalid response from Claude API proxy');
            }

        } catch (error) {
            Utils.log('error', 'Claude API request failed', error);
            throw error;
        }
    }

    // Build prompt for visual extraction
    buildVisualExtractionPrompt() {
        const categories = this.getAllCategories().join(', ');
        
        return `You are analyzing a University of Manchester Hiking Club (UMHC) financial statement document. This is likely an expense365 statement showing financial transactions.

CRITICAL REQUIREMENTS:
1. Extract EVERY SINGLE transaction visible in the document - do not skip any
2. Each line with a date (DD/MM/YYYY format) is a separate transaction
3. Your ENTIRE response must be valid JSON only
4. Include ALL transactions, even if there are hundreds

WHAT TO LOOK FOR:
- Transaction dates in DD/MM/YYYY format
- Description text following the date
- Amounts (may be in separate "Cash In" and "Cash Out" columns)
- Positive amounts or "Cash In" = Income
- Negative amounts or "Cash Out" = Expenses

COMMON PATTERNS:
- "FPR ref" or "BGC ref" = Income from member payments
- Ticket sales (e.g., "WELSH 3000S MEMBER TICKET") = Income
- "Membership" entries = Income
- "Hire", "Fuel", "Accommodation" = Expenses
- "Grant" or "Fund it" = Income
- Numbers in parentheses like (7466) = Reference numbers

CATEGORIES TO USE: ${categories}

CONFIDENCE SCORING:
- 1.0 = All fields clearly visible and unambiguous
- 0.9 = Very clear, minor interpretation needed
- 0.8 = Clear but some guesswork required
- 0.7 = Mostly readable with significant interpretation
- 0.6 or below = Hard to read or very uncertain

OUTPUT FORMAT (respond with ONLY this JSON):
{
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "Full description text",
      "amount": 123.45,
      "type": "Income",
      "category": "Event Registration",
      "event": "Event name if identifiable",
      "confidence": 0.95,
      "reference": "Reference if found",
      "notes": "Any additional context"
    }
  ],
  "summary": {
    "totalTransactions": 150,
    "totalIncome": 50000.00,
    "totalExpenses": 45000.00,
    "averageConfidence": 0.85,
    "documentInfo": "Any relevant document metadata"
  }
}

IMPORTANT REMINDERS:
- Extract EVERY transaction - if you see 200 transactions, include all 200
- Look carefully at both "Cash In" and "Cash Out" columns
- Page numbers and headers are not transactions
- Return ONLY valid JSON, no other text`;
    }

    // Parse AI response
    parseAIResponse(aiResponse) {
        // Store the raw response for debugging
        this.setLastRawResponse(aiResponse);

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

            console.log(`Parsed ${parsed.transactions.length} transactions from Claude response`);

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

                // Ensure type matches amount sign
                let type = transaction.type;
                if (type === 'Income' && amount < 0) {
                    type = 'Expense';
                } else if (type === 'Expense' && amount > 0) {
                    type = 'Income';
                }

                // Validate category
                const category = allCategories.includes(transaction.category)
                    ? transaction.category
                    : 'Uncategorized';

                const validTransaction = {
                    date: this.normalizeDate(transaction.date),
                    description: this.cleanDescription(transaction.description),
                    amount: Math.abs(amount), // Store as positive, use type to determine sign
                    type: type,
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

        console.log('Validation complete:', {
            input: aiResult.transactions.length,
            valid: validTransactions.length,
            rejected: aiResult.transactions.length - validTransactions.length
        });

        return validTransactions;
    }

    // Validate date format
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

    // Normalize date format
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

    // Clean description text
    cleanDescription(description) {
        return description
            .replace(/\s+/g, ' ')
            .replace(/^[-\s]+|[-\s]+$/g, '')
            .trim();
    }

    // Generate manual prompt for claude.ai
    generateManualPrompt(extractedText) {
        return `You are analyzing a financial statement for the University of Manchester Hiking Club. Extract ALL transactions and return ONLY valid JSON.

Categories: ${this.getAllCategories().join(', ')}

Text to analyze:
${extractedText}

Return this JSON structure:
{
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "text",
      "amount": 123.45,
      "type": "Income|Expense",
      "category": "category",
      "event": "event name",
      "confidence": 0.95,
      "reference": "",
      "notes": ""
    }
  ],
  "summary": {
    "totalTransactions": 0,
    "totalIncome": 0,
    "totalExpenses": 0,
    "averageConfidence": 0
  }
}`;
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

Utils.log('info', 'AI Extraction module loaded - Direct image/PDF processing via Claude vision');
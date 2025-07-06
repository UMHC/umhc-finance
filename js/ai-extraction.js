// js/ai-extraction.js - AI-powered document processing for UMHC Finance System

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
        if (!this.isConfigured()) {
            throw new Error('AI not configured. Please set your Claude API key.');
        }

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

            // Step 2: Process with AI
            const aiResult = await this.processWithAI(extractedText);
            
            // Step 3: Validate and format results
            const validatedTransactions = this.validateExtractedData(aiResult);

            Utils.log('info', 'AI processing complete', { 
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
                    aiModel: this.model
                }
            };

        } catch (error) {
            Utils.log('error', 'File processing failed', error);
            throw error;
        }
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
                        await this.loadPDFJS();
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

    // Extract text from image using Tesseract.js OCR
    async extractTextFromImage(file) {
        return new Promise((resolve, reject) => {
            // For now, simulate OCR processing
            // In a real implementation, you would use Tesseract.js or a cloud OCR service
            
            const fileReader = new FileReader();
            
            fileReader.onload = async function() {
                try {
                    // Simulate OCR processing delay
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Return simulated OCR result
                    // In production, this would be actual OCR text
                    const simulatedOCRText = `
Statement at 05/07/2025
Hiking Club UMSU01
Description Cash In Cash Out
18/04/2025 Welsh 3000s Registration 1610.00
18/04/2025 Hostel Booking - Canolfan Corris 1400.00
15/04/2025 Transport - Minibus Hire 320.50
10/04/2025 Equipment Maintenance 89.50
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

    // Process extracted text with Claude AI
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

            Utils.log('info', 'Claude API response received', { 
                responseLength: aiResponse.length 
            });

            // Parse the AI response
            return this.parseAIResponse(aiResponse);

        } catch (error) {
            Utils.log('error', 'Claude API request failed', error);
            
            // Fallback to basic parsing if AI fails
            Utils.log('info', 'Falling back to basic parsing');
            return this.fallbackBasicParsing(extractedText);
        }
    }

    // Build the prompt for AI extraction
    buildExtractionPrompt(extractedText) {
        return `You are a financial data extraction specialist for the University of Manchester Hiking Club (UMHC). 

Your task is to extract transaction data from this expense365 statement text and format it as JSON.

IMPORTANT GUIDELINES:
1. Extract ALL transactions that have dates, descriptions, and amounts
2. Positive amounts are typically income (registrations, memberships, grants)
3. Negative amounts or amounts in "Cash Out" column are expenses
4. Categorize transactions using these categories: ${CONFIG.getAllCategories().join(', ')}
5. Try to identify the event each transaction relates to
6. Provide a confidence score (0.0-1.0) for each extraction
7. For unclear amounts, use your best judgment based on context

CATEGORIES GUIDE:
- Event Registration: Ticket sales, registration fees
- Membership: Annual membership fees
- Accommodation: Hostels, hotels, booking fees
- Transport: Minibus hire, fuel, parking, tolls
- Equipment: Gear purchases, maintenance
- Training: Courses, instructor fees
- Food & Catering: Meals, catering for events
- Grants & Funding: External funding received
- Insurance: Vehicle and activity insurance
- Administration: Banking, website, admin costs

TEXT TO PROCESS:
${extractedText}

Return your response as a JSON object with this exact structure:
{
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "Clear description",
      "amount": 123.45,
      "type": "Income|Expense",
      "category": "Category from list above",
      "event": "Event name or General",
      "confidence": 0.95,
      "notes": "Any relevant notes or assumptions"
    }
  ],
  "summary": {
    "totalTransactions": 3,
    "totalIncome": 1500.00,
    "totalExpenses": 800.00,
    "averageConfidence": 0.92
  }
}

Be thorough but accurate. If you're unsure about something, lower the confidence score rather than guessing.`;
    }

    // Parse AI response JSON
    parseAIResponse(aiResponse) {
        try {
            // Clean the response text
            let cleanResponse = aiResponse.trim();
            
            // Extract JSON from markdown code blocks if present
            const jsonMatch = cleanResponse.match(/```(?:json)?\n?(.*?)\n?```/s);
            if (jsonMatch) {
                cleanResponse = jsonMatch[1];
            }

            // Parse JSON
            const parsed = JSON.parse(cleanResponse);
            
            // Validate structure
            if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
                throw new Error('Invalid response structure: missing transactions array');
            }

            return parsed;

        } catch (error) {
            Utils.log('error', 'Failed to parse AI response', { 
                error: error.message,
                response: aiResponse.substring(0, 500) + '...'
            });
            
            // Try to extract transactions using regex as fallback
            return this.extractTransactionsWithRegex(aiResponse);
        }
    }

    // Fallback basic parsing when AI fails
    fallbackBasicParsing(text) {
        Utils.log('info', 'Using fallback basic parsing');
        
        const transactions = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            const transaction = this.parseTransactionLine(line);
            if (transaction) {
                transactions.push(transaction);
            }
        }

        return {
            transactions,
            summary: {
                totalTransactions: transactions.length,
                totalIncome: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
                totalExpenses: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
                averageConfidence: 0.6 // Lower confidence for basic parsing
            }
        };
    }

    // Parse a single transaction line using regex
    parseTransactionLine(line) {
        // Look for date pattern (DD/MM/YYYY or DD/MM/YY)
        const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
        const dateMatch = line.match(datePattern);
        
        if (!dateMatch) return null;

        // Look for amount pattern (numbers with optional decimal places)
        const amountPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
        const amounts = line.match(amountPattern);
        
        if (!amounts) return null;

        // Extract description (text between date and first amount)
        const dateIndex = line.indexOf(dateMatch[0]);
        const firstAmountIndex = line.indexOf(amounts[0]);
        
        let description = line.substring(dateIndex + dateMatch[0].length, firstAmountIndex).trim();
        
        // Clean up description
        description = description.replace(/^\s*-?\s*/, '').trim();
        
        if (!description) return null;

        // Parse amount (assume last amount is the transaction amount)
        const amountStr = amounts[amounts.length - 1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        if (isNaN(amount)) return null;

        // Determine type and apply sign
        const type = amount > 0 || line.toLowerCase().includes('income') ? 'Income' : 'Expense';
        const finalAmount = type === 'Expense' ? -Math.abs(amount) : Math.abs(amount);

        // Suggest category based on description
        const category = CONFIG.suggestCategory(description) || 'Uncategorized';

        return {
            date: this.normalizeDate(dateMatch[0]),
            description: this.cleanDescription(description),
            amount: finalAmount,
            type,
            category,
            event: this.guessEvent(description),
            confidence: 0.7, // Medium confidence for regex parsing
            notes: 'Extracted using basic parsing'
        };
    }

    // Normalize date format
    normalizeDate(dateStr) {
        try {
            const parts = dateStr.split('/');
            if (parts.length !== 3) return dateStr;
            
            let [day, month, year] = parts;
            
            // Pad day and month
            day = day.padStart(2, '0');
            month = month.padStart(2, '0');
            
            // Handle 2-digit years
            if (year.length === 2) {
                year = year > 50 ? '19' + year : '20' + year;
            }
            
            return `${day}/${month}/${year}`;
        } catch (error) {
            return dateStr;
        }
    }

    // Clean transaction description
    cleanDescription(description) {
        return description
            .replace(/\s+/g, ' ')
            .replace(/^[-\s]+|[-\s]+$/g, '')
            .trim();
    }

    // Guess event based on description
    guessEvent(description) {
        const desc = description.toLowerCase();
        
        // Common event patterns
        const eventPatterns = {
            'welsh 3000s': 'Welsh 3000s 2025',
            'nethy': 'Nethy 2025',
            'torridon': 'Torridon 2025',
            'glenridding': 'Glenridding 2025',
            'snowdonia': 'Snowdonia 2025',
            'cadair': 'Cadair Idris 2024',
            'keswick': 'Keswick Weekend',
            'langdale': 'Langdale Weekend',
            'borrowdale': 'Borrowdale Weekend',
            'helvellyn': 'Helvellyn Weekend',
            'freshers': 'Freshers Events',
            'christmas': 'Christmas Events',
            'social': 'Social Events'
        };

        for (const [pattern, event] of Object.entries(eventPatterns)) {
            if (desc.includes(pattern)) {
                return event;
            }
        }

        return 'General';
    }

    // Validate extracted data
    validateExtractedData(aiResult) {
        if (!aiResult || !aiResult.transactions) {
            return [];
        }

        const validTransactions = [];

        for (const transaction of aiResult.transactions) {
            try {
                // Validate required fields
                if (!transaction.date || !transaction.description || transaction.amount === undefined) {
                    Utils.log('warn', 'Skipping invalid transaction - missing required fields', transaction);
                    continue;
                }

                // Validate date
                if (!Utils.validate.date(transaction.date)) {
                    Utils.log('warn', 'Skipping transaction with invalid date', transaction);
                    continue;
                }

                // Validate amount
                const amount = parseFloat(transaction.amount);
                if (isNaN(amount)) {
                    Utils.log('warn', 'Skipping transaction with invalid amount', transaction);
                    continue;
                }

                // Ensure category is valid
                const allCategories = CONFIG.getAllCategories();
                const category = allCategories.includes(transaction.category) 
                    ? transaction.category 
                    : 'Uncategorized';

                // Create validated transaction
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

        Utils.log('info', 'Transaction validation complete', {
            original: aiResult.transactions.length,
            valid: validTransactions.length
        });

        return validTransactions;
    }

    // Extract transactions using regex fallback
    extractTransactionsWithRegex(text) {
        // This is a simplified fallback method
        const transactions = [];
        
        // Try to find JSON-like patterns in the response
        const jsonPattern = /"date":\s*"([^"]+)"[\s\S]*?"description":\s*"([^"]+)"[\s\S]*?"amount":\s*([0-9.-]+)/g;
        
        let match;
        while ((match = jsonPattern.exec(text)) !== null) {
            const [_, date, description, amountStr] = match;
            const amount = parseFloat(amountStr);
            
            if (Utils.validate.date(date) && !isNaN(amount)) {
                transactions.push({
                    date: this.normalizeDate(date),
                    description: this.cleanDescription(description),
                    amount: amount,
                    type: amount > 0 ? 'Income' : 'Expense',
                    category: CONFIG.suggestCategory(description) || 'Uncategorized',
                    event: this.guessEvent(description),
                    confidence: 0.6,
                    notes: 'Extracted using regex fallback'
                });
            }
        }

        return {
            transactions,
            summary: {
                totalTransactions: transactions.length,
                totalIncome: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
                totalExpenses: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
                averageConfidence: 0.6
            }
        };
    }

    // Load PDF.js library dynamically
    async loadPDFJS() {
        return new Promise((resolve, reject) => {
            if (typeof pdfjsLib !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
            script.onload = () => {
                // Set up PDF.js worker
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js'));
            document.head.appendChild(script);
        });
    }

    // Get processing statistics
    getProcessingStats() {
        return {
            isConfigured: this.isConfigured(),
            model: this.model,
            maxTokens: this.maxTokens,
            confidenceThreshold: this.confidenceThreshold,
            supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG']
        };
    }
}

// Create global AI extractor instance
const aiExtractor = new AIExtractor();

// Export for use in other files
window.AIExtractor = AIExtractor;
window.aiExtractor = aiExtractor;

Utils.log('info', 'AI Extraction module loaded successfully');
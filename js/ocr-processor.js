// js/ocr-processor.js - Free OCR processing using Tesseract.js + PDF.js
// Replaces expensive Claude API with open-source alternatives

class OCRProcessor {
    constructor() {
        this.tesseractWorker = null;
        this.isInitialized = false;
        this.currentProcessingId = 0;
        this.progressCallback = null;
        
        // OCR.Space free API as backup (500 requests/month)
        this.ocrSpaceEndpoint = 'https://api.ocr.space/parse/image';
        this.ocrSpaceApiKey = null; // Optional - user can set for backup processing
        
        Utils.log('info', 'OCRProcessor initialized with free open-source processing');
    }

    // Initialize Tesseract.js worker
    async initializeTesseract() {
        if (this.isInitialized) return true;
        
        try {
            this.updateProgress('Initializing OCR engine...', 0);
            
            // Load Tesseract.js if not already loaded
            if (typeof Tesseract === 'undefined') {
                await this.loadTesseractJS();
            }
            
            // Create worker with financial document optimizations
            this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        this.updateProgress(`OCR processing: ${progress}%`, 0.3 + (m.progress * 0.6));
                    }
                }
            });

            // Optimize for financial documents
            await this.tesseractWorker.setParameters({
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,£$€-+/(): \n\r',
                preserve_interword_spaces: '1',
                tessedit_pageseg_mode: '6' // Assume uniform block of text
            });
            
            this.isInitialized = true;
            this.updateProgress('OCR engine ready', 0.1);
            
            Utils.log('info', 'Tesseract.js initialized successfully');
            return true;
            
        } catch (error) {
            Utils.log('error', 'Failed to initialize Tesseract.js', error);
            throw new Error(`OCR initialization failed: ${error.message}`);
        }
    }

    // Load Tesseract.js library dynamically
    async loadTesseractJS() {
        return new Promise((resolve, reject) => {
            if (typeof Tesseract !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = () => {
                Utils.log('info', 'Tesseract.js library loaded');
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load Tesseract.js library'));
            document.head.appendChild(script);
        });
    }

    // Set progress callback for UI updates
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    // Update progress
    updateProgress(message, progress = null) {
        if (this.progressCallback) {
            this.progressCallback(message, progress);
        }
        console.log(`OCR Progress: ${message}${progress !== null ? ` (${Math.round(progress * 100)}%)` : ''}`);
    }

    // Main processing function
    async processDocument(file) {
        const processingId = ++this.currentProcessingId;
        
        try {
            this.updateProgress('Starting document processing...', 0);
            
            // Initialize OCR if needed
            await this.initializeTesseract();
            
            // Process based on file type
            if (file.type === 'application/pdf') {
                return await this.processPDF(file, processingId);
            } else if (file.type.startsWith('image/')) {
                return await this.processImage(file, processingId);
            } else {
                throw new Error('Unsupported file type. Please upload PDF or image files.');
            }
            
        } catch (error) {
            Utils.log('error', 'Document processing failed', error);
            throw error;
        }
    }

    // Process PDF files
    async processPDF(file, processingId) {
        this.updateProgress('Loading PDF...', 0.1);
        
        try {
            // Load PDF.js if not already loaded
            if (typeof pdfjsLib === 'undefined') {
                await this.loadPDFJS();
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            this.updateProgress(`Processing ${pdf.numPages} pages...`, 0.2);
            
            let fullText = '';
            let allTransactions = [];
            const maxPages = Math.min(pdf.numPages, 10); // Limit to 10 pages for performance
            
            // Process each page
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                // Check if processing was cancelled
                if (this.currentProcessingId !== processingId) {
                    throw new Error('Processing cancelled');
                }
                
                const baseProgress = 0.2 + ((pageNum - 1) / maxPages) * 0.7;
                this.updateProgress(`Processing page ${pageNum}/${maxPages}...`, baseProgress);
                
                const page = await pdf.getPage(pageNum);
                
                // Try text extraction first (faster for text-based PDFs)
                const textContent = await page.getTextContent();
                let pageText = textContent.items.map(item => item.str).join(' ');
                
                // If text extraction gives poor results, use OCR on rendered page
                if (this.isTextExtractionPoor(pageText)) {
                    this.updateProgress(`OCR scanning page ${pageNum}...`, baseProgress + 0.1);
                    
                    // Render page to canvas for OCR
                    const viewport = page.getViewport({scale: 2.0}); // Higher scale for better OCR
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    await page.render({canvasContext: context, viewport: viewport}).promise;
                    
                    // Run OCR on the canvas
                    const ocrResult = await this.tesseractWorker.recognize(canvas);
                    pageText = ocrResult.data.text;
                }
                
                fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
                
                // Extract transactions from this page
                const pageTransactions = this.extractTransactionsFromText(pageText, pageNum);
                allTransactions = allTransactions.concat(pageTransactions);
            }
            
            this.updateProgress('Finalizing results...', 0.9);
            
            const result = {
                fullText: fullText,
                transactions: allTransactions,
                summary: {
                    totalTransactions: allTransactions.length,
                    pagesProcessed: maxPages,
                    processingMethod: 'PDF.js + Tesseract.js OCR',
                    fileName: file.name
                }
            };
            
            this.updateProgress(`Extracted ${allTransactions.length} transactions`, 1.0);
            
            Utils.log('info', 'PDF processing completed', {
                pages: maxPages,
                transactions: allTransactions.length
            });
            
            return result;
            
        } catch (error) {
            Utils.log('error', 'PDF processing failed', error);
            throw new Error(`PDF processing failed: ${error.message}`);
        }
    }

    // Process image files
    async processImage(file, processingId) {
        this.updateProgress('Processing image with OCR...', 0.2);
        
        try {
            // Run Tesseract OCR on the image
            const result = await this.tesseractWorker.recognize(file);
            const extractedText = result.data.text;
            
            this.updateProgress('Extracting transaction data...', 0.8);
            
            // Extract transactions from OCR text
            const transactions = this.extractTransactionsFromText(extractedText, 1);
            
            const processedResult = {
                fullText: extractedText,
                transactions: transactions,
                summary: {
                    totalTransactions: transactions.length,
                    processingMethod: 'Tesseract.js OCR (Image)',
                    fileName: file.name,
                    confidence: result.data.confidence
                }
            };
            
            this.updateProgress(`Extracted ${transactions.length} transactions`, 1.0);
            
            Utils.log('info', 'Image processing completed', {
                transactions: transactions.length,
                confidence: result.data.confidence
            });
            
            return processedResult;
            
        } catch (error) {
            Utils.log('error', 'Image processing failed', error);
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }

    // Load PDF.js library
    async loadPDFJS() {
        return new Promise((resolve, reject) => {
            if (typeof pdfjsLib !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                Utils.log('info', 'PDF.js library loaded');
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js library'));
            document.head.appendChild(script);
        });
    }

    // Check if text extraction is poor quality
    isTextExtractionPoor(text) {
        // Indicators of poor text extraction
        const wordCount = text.split(/\s+/).length;
        const hasNumbers = /\d/.test(text);
        const hasProperSpacing = text.includes(' ');
        const tooShort = wordCount < 10;
        const tooManySpecialChars = (text.match(/[^\w\s]/g) || []).length > text.length * 0.3;
        
        return tooShort || !hasNumbers || !hasProperSpacing || tooManySpecialChars;
    }

    // Extract transactions from text using pattern matching
    extractTransactionsFromText(text, pageNumber = 1) {
        const transactions = [];
        
        try {
            // Common patterns for expense365/financial statements
            const patterns = {
                // Pattern 1: DD/MM/YYYY Description Amount
                standard: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)/gm,
                
                // Pattern 2: Date with description and amount in separate columns
                tabular: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+([^\d£$€]+)\s+([£$€]?[\d,]+\.?\d*)/gm,
                
                // Pattern 3: Complex format with reference numbers
                withRef: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+\((\d+)\)\s+([£$€]?[\d,]+\.?\d*)/gm
            };
            
            // Try each pattern
            for (const [patternName, regex] of Object.entries(patterns)) {
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const transaction = this.parseTransactionMatch(match, patternName, pageNumber);
                    if (transaction && this.isValidTransaction(transaction)) {
                        transactions.push(transaction);
                    }
                }
            }
            
            // Remove duplicates based on date + description similarity
            return this.removeDuplicateTransactions(transactions);
            
        } catch (error) {
            Utils.log('error', 'Transaction extraction failed', error);
            return [];
        }
    }

    // Parse a regex match into a transaction object
    parseTransactionMatch(match, patternName, pageNumber) {
        try {
            let date, description, amount, reference = '';
            
            switch (patternName) {
                case 'standard':
                    [, date, description, amount] = match;
                    break;
                case 'tabular':
                    [, date, description, amount] = match;
                    break;
                case 'withRef':
                    [, date, description, reference, amount] = match;
                    break;
            }
            
            // Clean and normalize data
            date = this.normalizeDate(date);
            description = this.cleanDescription(description);
            amount = this.parseAmount(amount);
            
            if (!date || !description || amount === null) {
                return null;
            }
            
            // Determine transaction type
            const type = amount > 0 ? 'Income' : 'Expense';
            
            // Auto-categorize based on description
            const category = this.autoCategorizeFree(description);
            
            // Calculate confidence based on data quality
            const confidence = this.calculateConfidence(match[0], description, amount);
            
            return {
                date: date,
                description: description,
                amount: Math.abs(amount),
                type: type,
                category: category,
                event: this.extractEvent(description),
                reference: reference || '',
                confidence: confidence,
                page: pageNumber,
                rawMatch: match[0]
            };
            
        } catch (error) {
            Utils.log('warn', 'Failed to parse transaction match', error);
            return null;
        }
    }

    // Normalize date format
    normalizeDate(dateStr) {
        try {
            // Handle various date formats: DD/MM/YYYY, DD-MM-YYYY, etc.
            const cleanDate = dateStr.replace(/[-\.]/g, '/');
            const parts = cleanDate.split('/');
            
            if (parts.length !== 3) return null;
            
            let [day, month, year] = parts.map(p => parseInt(p));
            
            // Handle 2-digit years
            if (year < 100) {
                year = year > 50 ? 1900 + year : 2000 + year;
            }
            
            // Validate date components
            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return null;
            }
            
            // Return in DD/MM/YYYY format
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
            
        } catch (error) {
            return null;
        }
    }

    // Clean description text
    cleanDescription(description) {
        return description
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s£$€.,()-]/g, '')
            .trim()
            .substring(0, 100); // Limit length
    }

    // Parse amount from string
    parseAmount(amountStr) {
        try {
            // Remove currency symbols and spaces
            const cleaned = amountStr.replace(/[£$€,\s]/g, '');
            
            // Handle negative amounts (in parentheses or with minus)
            const isNegative = amountStr.includes('(') || amountStr.includes('-') || amountStr.toLowerCase().includes('out');
            
            const amount = parseFloat(cleaned);
            
            if (isNaN(amount)) return null;
            
            return isNegative ? -amount : amount;
            
        } catch (error) {
            return null;
        }
    }

    // Free auto-categorization using keywords
    autoCategorizeFree(description) {
        const desc = description.toLowerCase();
        
        // Use existing CONFIG categories and suggestions
        if (typeof CONFIG !== 'undefined' && CONFIG.CATEGORY_SUGGESTIONS) {
            for (const [keyword, category] of Object.entries(CONFIG.CATEGORY_SUGGESTIONS)) {
                if (desc.includes(keyword)) {
                    return category;
                }
            }
        }
        
        // Fallback simple categorization
        if (desc.includes('membership') || desc.includes('member')) return 'Membership';
        if (desc.includes('ticket') || desc.includes('registration')) return 'Event Registration';
        if (desc.includes('transport') || desc.includes('fuel') || desc.includes('minibus')) return 'Transport';
        if (desc.includes('accommodation') || desc.includes('hostel') || desc.includes('hotel')) return 'Accommodation';
        if (desc.includes('equipment') || desc.includes('gear')) return 'Equipment';
        if (desc.includes('food') || desc.includes('catering')) return 'Food & Catering';
        if (desc.includes('insurance')) return 'Insurance';
        if (desc.includes('training') || desc.includes('course')) return 'Training';
        
        return 'Uncategorized';
    }

    // Extract event name from description
    extractEvent(description) {
        const desc = description.toLowerCase();
        
        // Common UMHC events
        if (desc.includes('welsh 3000') || desc.includes('welsh3000')) return 'Welsh 3000s 2025';
        if (desc.includes('snowdon') || desc.includes('snowdonia')) return 'Snowdonia Trip';
        if (desc.includes('peak district') || desc.includes('peaks')) return 'Peak District Trip';
        if (desc.includes('lake district') || desc.includes('lakes')) return 'Lake District Trip';
        if (desc.includes('fresher') || desc.includes('welcome')) return 'Freshers Events';
        if (desc.includes('social') || desc.includes('bbq') || desc.includes('party')) return 'Social Events';
        
        return 'General';
    }

    // Calculate confidence score
    calculateConfidence(rawMatch, description, amount) {
        let confidence = 0.5; // Base confidence
        
        // Date format clarity
        if (/\d{2}\/\d{2}\/\d{4}/.test(rawMatch)) confidence += 0.2;
        
        // Description quality
        if (description.length > 5 && description.length < 50) confidence += 0.1;
        if (description.match(/[a-zA-Z]/)) confidence += 0.1;
        
        // Amount clarity
        if (!isNaN(amount) && amount !== 0) confidence += 0.2;
        
        // Overall structure
        if (rawMatch.split(/\s+/).length >= 3) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    // Validate transaction data
    isValidTransaction(transaction) {
        return transaction.date && 
               transaction.description && 
               transaction.description.length > 2 &&
               transaction.amount !== null && 
               transaction.amount > 0 &&
               transaction.confidence >= 0.3;
    }

    // Remove duplicate transactions
    removeDuplicateTransactions(transactions) {
        const seen = new Set();
        return transactions.filter(transaction => {
            const key = `${transaction.date}-${transaction.amount}-${transaction.description.substring(0, 20)}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // Fallback to OCR.Space API (free tier)
    async processWithOCRSpace(file) {
        if (!this.ocrSpaceApiKey) {
            throw new Error('OCR.Space API key not configured for backup processing');
        }
        
        try {
            this.updateProgress('Using backup OCR service...', 0.3);
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('apikey', this.ocrSpaceApiKey);
            formData.append('language', 'eng');
            formData.append('isOverlayRequired', 'false');
            formData.append('detectOrientation', 'true');
            formData.append('isCreateSearchablePdf', 'false');
            formData.append('isSearchablePdfHideTextLayer', 'true');
            formData.append('filetype', file.type.includes('pdf') ? 'PDF' : 'JPG');
            
            const response = await fetch(this.ocrSpaceEndpoint, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`OCR.Space API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.IsErroredOnProcessing) {
                throw new Error(`OCR.Space processing error: ${result.ErrorMessage || 'Unknown error'}`);
            }
            
            const extractedText = result.ParsedResults[0].ParsedText;
            const transactions = this.extractTransactionsFromText(extractedText, 1);
            
            return {
                fullText: extractedText,
                transactions: transactions,
                summary: {
                    totalTransactions: transactions.length,
                    processingMethod: 'OCR.Space API (Backup)',
                    fileName: file.name
                }
            };
            
        } catch (error) {
            Utils.log('error', 'OCR.Space backup processing failed', error);
            throw error;
        }
    }

    // Set OCR.Space API key for backup processing
    setOCRSpaceApiKey(apiKey) {
        this.ocrSpaceApiKey = apiKey;
        Utils.log('info', 'OCR.Space backup API configured');
    }

    // Cleanup resources
    async cleanup() {
        if (this.tesseractWorker) {
            await this.tesseractWorker.terminate();
            this.tesseractWorker = null;
        }
        this.isInitialized = false;
        Utils.log('info', 'OCR processor cleanup completed');
    }

    // Get processing statistics
    getStats() {
        return {
            isInitialized: this.isInitialized,
            hasBackupAPI: !!this.ocrSpaceApiKey,
            currentProcessingId: this.currentProcessingId
        };
    }
}

// Create global OCR processor instance
const ocrProcessor = new OCRProcessor();

// Export for use in other files
window.OCRProcessor = OCRProcessor;
window.ocrProcessor = ocrProcessor;

Utils.log('info', 'Free OCR processor loaded - Tesseract.js + PDF.js + OCR.Space backup');
// js/ocr-processor.js - PDF Spatial Text Extraction
// Processes PDFs using PDF.js with coordinate-based column detection

class PDFSpatialProcessor {
    constructor() {
        this.currentProcessingId = 0;
        this.progressCallback = null;
        
        Utils.log('info', 'PDF Spatial Processor initialized for PDF-only processing');
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

    // Main processing function - PDF only
    async processDocument(file) {
        const processingId = ++this.currentProcessingId;
        
        try {
            this.updateProgress('Starting PDF spatial processing...', 0);
            
            // Only process PDF files
            if (file.type === 'application/pdf') {
                return await this.processPDF(file, processingId);
            } else {
                throw new Error('Only PDF files are supported. Please upload a PDF file.');
            }
            
        } catch (error) {
            Utils.log('error', 'PDF processing failed', error);
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
            let masterColumnInfo = null; // Store column info for consistency across pages
            
            // Process each page
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                // Check if processing was cancelled
                if (this.currentProcessingId !== processingId) {
                    throw new Error('Processing cancelled');
                }
                
                const baseProgress = 0.2 + ((pageNum - 1) / maxPages) * 0.7;
                this.updateProgress(`Processing page ${pageNum}/${maxPages}...`, baseProgress);
                
                const page = await pdf.getPage(pageNum);
                
                // Extract spatial text data from PDF
                const textContent = await page.getTextContent();
                const spatialText = this.extractSpatialText(textContent, pageNum);
                
                if (!spatialText || spatialText.items.length === 0) {
                    throw new Error(`Page ${pageNum} contains no extractable text with coordinate data. This PDF may be image-based or corrupted.`);
                }
                
                fullText += `\n--- Page ${pageNum} ---\n${spatialText.plainText}\n`;
                
                // Always use spatial extraction
                this.updateProgress(`Analyzing spatial layout on page ${pageNum}...`, baseProgress + 0.1);
                const result = this.extractTransactionsWithSpatial(spatialText, pageNum, masterColumnInfo);
                const pageTransactions = result.transactions;
                
                // Update master column info if this page provided better data
                if (result.columnInfo && result.columnInfo.hasValidStructure) {
                    masterColumnInfo = result.columnInfo;
                }
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


    // Extract text with spatial coordinates from PDF.js textContent
    extractSpatialText(textContent, pageNum) {
        try {
            const items = textContent.items.map(item => ({
                text: item.str,
                x: item.transform[4], // X coordinate
                y: item.transform[5], // Y coordinate
                width: item.width,
                height: item.height,
                fontSize: item.transform[0] // Font size (scale factor)
            }));
            
            // Sort items by Y coordinate (top to bottom), then X coordinate (left to right)
            items.sort((a, b) => {
                const yDiff = Math.abs(a.y - b.y);
                if (yDiff < 5) { // Same line (within 5 units)
                    return a.x - b.x; // Sort by X (left to right)
                }
                return b.y - a.y; // Sort by Y (top to bottom, PDF coordinates are inverted)
            });
            
            // Generate plain text for backward compatibility
            const plainText = items.map(item => item.text).join(' ');
            
            Utils.log('debug', `Extracted ${items.length} spatial text items from page ${pageNum}`);
            
            return {
                items: items,
                plainText: plainText,
                pageNum: pageNum
            };
            
        } catch (error) {
            Utils.log('error', 'Failed to extract spatial text', error);
            return {
                items: [],
                plainText: textContent.items.map(item => item.str).join(' '),
                pageNum: pageNum
            };
        }
    }
    
    // Extract transactions using spatial positioning data
    extractTransactionsWithSpatial(spatialText, pageNum, masterColumnInfo = null) {
        try {
            // Use master column info if available, otherwise detect from this page
            let columnInfo = masterColumnInfo;
            if (!columnInfo || !columnInfo.hasValidStructure) {
                columnInfo = this.detectColumnStructure(spatialText.items);
            }
            
            if (!columnInfo.hasValidStructure) {
                Utils.log('error', `No valid column structure detected on page ${pageNum}. This PDF may not contain transaction tables with proper column layout.`);
                throw new Error(`Page ${pageNum} does not contain a recognizable transaction table structure. Please ensure the PDF contains properly formatted financial data with columns.`);
            }
            
            // Group items into rows based on Y coordinate
            const rows = this.groupItemsIntoRows(spatialText.items);
            
            // Extract transactions from each row using column positions
            const transactions = [];
            for (const row of rows) {
                const transaction = this.parseRowWithSpatial(row, columnInfo, pageNum);
                if (transaction && this.isValidTransaction(transaction)) {
                    transactions.push(transaction);
                }
            }
            
            Utils.log('info', `Extracted ${transactions.length} transactions using spatial analysis on page ${pageNum}`);
            
            return {
                transactions: transactions,
                columnInfo: columnInfo // Return column info for use on subsequent pages
            };
            
        } catch (error) {
            Utils.log('error', 'Spatial transaction extraction failed', error);
            throw error; // No fallback - fail clearly
        }
    }
    
    // Detect column structure from spatial text items
    detectColumnStructure(items) {
        // Look for header indicators
        const headerKeywords = ['date', 'description', 'cash in', 'cash out', 'amount'];
        const headers = [];
        
        for (const item of items) {
            const text = item.text.toLowerCase().trim();
            for (const keyword of headerKeywords) {
                if (text.includes(keyword)) {
                    headers.push({
                        keyword: keyword,
                        x: item.x,
                        y: item.y,
                        text: item.text
                    });
                    break;
                }
            }
        }
        
        // Try to establish column positions
        let dateColumn = null, descColumn = null, cashInColumn = null, cashOutColumn = null;
        
        for (const header of headers) {
            if (header.keyword.includes('date')) dateColumn = header.x;
            if (header.keyword.includes('description')) descColumn = header.x;
            if (header.keyword.includes('cash in')) cashInColumn = header.x;
            if (header.keyword.includes('cash out')) cashOutColumn = header.x;
        }
        
        // If we don't have clear headers, try to infer from content patterns
        if (!cashInColumn || !cashOutColumn) {
            const inferredColumns = this.inferColumnPositions(items);
            if (inferredColumns.cashIn) cashInColumn = inferredColumns.cashIn;
            if (inferredColumns.cashOut) cashOutColumn = inferredColumns.cashOut;
        }
        
        const hasValidStructure = dateColumn !== null && (cashInColumn !== null || cashOutColumn !== null);
        
        Utils.log('debug', 'Column structure detection', {
            dateColumn, descColumn, cashInColumn, cashOutColumn, hasValidStructure
        });
        
        return {
            hasValidStructure,
            dateColumn,
            descColumn,
            cashInColumn,
            cashOutColumn,
            headers
        };
    }
    
    // Infer column positions from currency amounts and text positioning
    inferColumnPositions(items) {
        const currencyPattern = /^\d{1,6}\.\d{2}$/;
        
        // Find all currency amounts
        const amounts = items.filter(item => 
            currencyPattern.test(item.text.replace(/[£$€,\s]/g, ''))
        );
        
        if (amounts.length === 0) return { cashIn: null, cashOut: null };
        
        // Group amounts by X position (within 30 units for more flexibility)
        const xGroups = {};
        for (const amount of amounts) {
            const roundedX = Math.round(amount.x / 30) * 30; // Group by 30-unit buckets
            if (!xGroups[roundedX]) xGroups[roundedX] = [];
            xGroups[roundedX].push(amount);
        }
        
        // Get unique X positions sorted left to right
        const xPositions = Object.keys(xGroups).map(Number).sort((a, b) => a - b);
        
        Utils.log('debug', 'Found amount column positions', { xPositions, groupCount: xPositions.length });
        
        if (xPositions.length === 1) {
            // Only one column of amounts - assume it's Cash Out (expenses are more common)
            return {
                cashIn: null,
                cashOut: xPositions[0]
            };
        } else if (xPositions.length >= 2) {
            // Two or more columns - Cash In (left), Cash Out (right)
            return {
                cashIn: xPositions[xPositions.length - 2],  // Second from right
                cashOut: xPositions[xPositions.length - 1]  // Rightmost
            };
        }
        
        return { cashIn: null, cashOut: null };
    }
    
    // Group spatial items into rows based on Y coordinate
    groupItemsIntoRows(items) {
        const rows = [];
        let currentRow = [];
        let currentY = null;
        
        for (const item of items) {
            // If Y coordinate differs by more than 10 units, it's a new row
            if (currentY === null || Math.abs(item.y - currentY) > 10) {
                if (currentRow.length > 0) {
                    rows.push([...currentRow]);
                }
                currentRow = [item];
                currentY = item.y;
            } else {
                currentRow.push(item);
            }
        }
        
        // Add the last row
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }
        
        return rows;
    }
    
    // Parse a single row using spatial column information
    parseRowWithSpatial(rowItems, columnInfo, pageNumber) {
        // Find date in the row
        const dateItem = rowItems.find(item => 
            /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(item.text)
        );
        if (!dateItem) return null; // No date found, skip this row
        
        // Find description (text between date and amounts)
        const descItems = rowItems.filter(item => 
            item.x > (columnInfo.dateColumn || 0) + 50 && // After date column
            item.x < Math.min(columnInfo.cashInColumn || 9999, columnInfo.cashOutColumn || 9999) - 20 // Before amount columns
        );
        const description = descItems.map(item => item.text).join(' ').trim();
        
        // Find amounts based on column positions
        let cashInAmount = null, cashOutAmount = null;
        
        if (columnInfo.cashInColumn) {
            const cashInItems = rowItems.filter(item => 
                Math.abs(item.x - columnInfo.cashInColumn) < 50 && // Within 50 units of column
                /\d+\.\d{2}/.test(item.text.replace(/[£$€,\s]/g, ''))
            );
            if (cashInItems.length > 0) {
                cashInAmount = this.parseCurrencyAmount(cashInItems[0].text);
            }
        }
        
        if (columnInfo.cashOutColumn) {
            const cashOutItems = rowItems.filter(item => 
                Math.abs(item.x - columnInfo.cashOutColumn) < 50 && // Within 50 units of column
                /\d+\.\d{2}/.test(item.text.replace(/[£$€,\s]/g, ''))
            );
            if (cashOutItems.length > 0) {
                cashOutAmount = this.parseCurrencyAmount(cashOutItems[0].text);
            }
        }
        
        // Create transaction object
        if ((cashInAmount || cashOutAmount) && description.length > 2) {
            const date = this.normalizeDate(dateItem.text);
            if (!date) return null;
            
            const amount = cashInAmount || cashOutAmount;
            const type = cashInAmount ? 'Income' : 'Expense';
            
            return {
                date: date,
                description: this.cleanDescription(description),
                amount: Math.abs(amount),
                type: type,
                category: this.autoCategorizeFree(description),
                event: this.extractEvent(description),
                reference: '',
                confidence: 0.9, // Higher confidence for spatial extraction
                page: pageNumber,
                extractionMethod: 'spatial',
                spatialInfo: {
                    dateX: dateItem.x,
                    amountX: cashInAmount ? columnInfo.cashInColumn : columnInfo.cashOutColumn,
                    rowY: dateItem.y
                }
            };
        }
        
        return null;
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


    // Normalize date format with enhanced OCR error handling
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
            
            let [day, month, year] = parts.map(p => parseInt(p));
            
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
            
            // Validate date components
            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return null;
            }
            
            // Additional validation: check if date is actually valid
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

    // Parse amount from string - now delegates to currency parsing for consistency
    parseAmount(amountStr) {
        // For modern expense365 parsing, require proper currency format
        return this.parseCurrencyAmount(amountStr);
    }
    
    // Parse currency amount - requires exactly 2 decimal places (e.g., 123.45)
    parseCurrencyAmount(amountStr) {
        try {
            if (!amountStr) return null;
            
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
            
            // Handle negative amounts (in parentheses or with minus)
            const isNegative = amountStr.includes('(') || 
                              amountStr.includes('-') || 
                              amountStr.toLowerCase().includes('out') ||
                              amountStr.toLowerCase().includes('debit');
            
            // Remove negative indicators
            cleaned = cleaned.replace(/[\(\)\-]/g, '');
            
            // Only keep digits, commas, dots
            cleaned = cleaned.replace(/[^0-9.,]/g, '');
            
            // Handle comma thousands separators
            if (cleaned.includes(',') && cleaned.includes('.')) {
                const lastDotIndex = cleaned.lastIndexOf('.');
                const lastCommaIndex = cleaned.lastIndexOf(',');
                
                if (lastDotIndex > lastCommaIndex) {
                    // Remove comma thousands separators, keep dot as decimal
                    cleaned = cleaned.replace(/,/g, '');
                }
            } else if (cleaned.includes(',') && !cleaned.includes('.')) {
                // Only comma - check if it's decimal separator
                const parts = cleaned.split(',');
                if (parts.length === 2 && parts[1].length === 2) {
                    // Likely decimal: "123,45" → "123.45"
                    cleaned = cleaned.replace(',', '.');
                } else {
                    // Likely thousands separator without decimals - invalid
                    return null;
                }
            }
            
            // Strict currency format validation: must have exactly 2 decimal places
            const currencyPattern = /^\d{1,6}\.\d{2}$/;
            if (!currencyPattern.test(cleaned)) {
                return null;
            }
            
            const amount = parseFloat(cleaned);
            
            // Validate amount is reasonable
            if (isNaN(amount) || amount < 0.01 || amount > 50000) {
                return null;
            }
            
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
               transaction.amount > 0;
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

// Create global PDF spatial processor instance
const ocrProcessor = new PDFSpatialProcessor();

// Export for use in other files
window.PDFSpatialProcessor = PDFSpatialProcessor;
window.ocrProcessor = ocrProcessor;

Utils.log('info', 'PDF Spatial Processor loaded - PDF.js coordinate-based extraction');
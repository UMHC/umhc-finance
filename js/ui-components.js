// js/ui-components.js - Reusable UI components for UMHC Finance System

const UIComponents = {
    // Create a loading spinner
    createLoadingSpinner: (size = 'medium') => {
        const spinner = Utils.dom.create('div', {
            className: `loading-spinner ${size}`,
            innerHTML: `
                <div class="spinner-circle"></div>
                <span class="spinner-text">Loading...</span>
            `
        });
        return spinner;
    },

    // Create a toast notification
    showToast: (message, type = 'info', duration = 3000) => {
        const toast = Utils.dom.create('div', {
            className: `toast toast-${type}`,
            innerHTML: `
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            `
        });

        // Add to page
        document.body.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);

        return toast;
    },

    // Create a modal dialog
    createModal: (title, content, options = {}) => {
        const modal = Utils.dom.create('div', {
            className: 'modal-overlay',
            innerHTML: `
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="UIComponents.closeModal(this)">×</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${options.showCancel !== false ? '<button class="btn secondary" onclick="UIComponents.closeModal(this)">Cancel</button>' : ''}
                        ${options.confirmText ? `<button class="btn primary" onclick="${options.onConfirm || ''}">${options.confirmText}</button>` : ''}
                    </div>
                </div>
            `
        });

        document.body.appendChild(modal);
        return modal;
    },

    // Close modal
    closeModal: (element) => {
        const modal = element.closest('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    },

    // Create a data table
    createDataTable: (data, columns, options = {}) => {
        const table = Utils.dom.create('table', {
            className: 'data-table'
        });

        // Create header
        const thead = Utils.dom.create('thead');
        const headerRow = Utils.dom.create('tr');
        
        columns.forEach(column => {
            const th = Utils.dom.create('th', {}, column.label || column.key);
            if (column.sortable !== false) {
                th.style.cursor = 'pointer';
                th.onclick = () => options.onSort?.(column.key);
            }
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = Utils.dom.create('tbody');
        
        data.forEach(row => {
            const tr = Utils.dom.create('tr');
            
            columns.forEach(column => {
                const td = Utils.dom.create('td');
                let cellValue = row[column.key];
                
                // Apply formatter if provided
                if (column.formatter) {
                    cellValue = column.formatter(cellValue, row);
                }
                
                td.innerHTML = cellValue;
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        return table;
    },

    // Create a progress bar
    createProgressBar: (value = 0, max = 100, label = '') => {
        const percentage = Math.round((value / max) * 100);
        
        const progressBar = Utils.dom.create('div', {
            className: 'progress-bar-container',
            innerHTML: `
                ${label ? `<div class="progress-label">${label}</div>` : ''}
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-text">${percentage}%</div>
            `
        });
        
        return progressBar;
    },

    // Create a confirmation dialog
    confirm: (message, onConfirm, onCancel) => {
        const modal = UIComponents.createModal(
            'Confirm Action',
            `<p>${message}</p>`,
            {
                confirmText: 'Confirm',
                onConfirm: () => {
                    onConfirm?.();
                    UIComponents.closeModal(modal.querySelector('.modal-close'));
                }
            }
        );

        // Handle cancel
        modal.querySelector('.btn.secondary').onclick = () => {
            onCancel?.();
            UIComponents.closeModal(modal.querySelector('.modal-close'));
        };

        return modal;
    },

    // Create a date range picker
    createDateRangePicker: (onDateChange) => {
        const container = Utils.dom.create('div', {
            className: 'date-range-picker',
            innerHTML: `
                <div class="date-input-group">
                    <label>From:</label>
                    <input type="date" class="date-from" onchange="UIComponents.handleDateRangeChange(this)">
                </div>
                <div class="date-input-group">
                    <label>To:</label>
                    <input type="date" class="date-to" onchange="UIComponents.handleDateRangeChange(this)">
                </div>
                <button class="btn secondary" onclick="UIComponents.clearDateRange(this)">Clear</button>
            `
        });

        // Store callback
        container.onDateChange = onDateChange;
        
        return container;
    },

    // Handle date range changes
    handleDateRangeChange: (input) => {
        const container = input.closest('.date-range-picker');
        const fromDate = container.querySelector('.date-from').value;
        const toDate = container.querySelector('.date-to').value;
        
        if (container.onDateChange && fromDate && toDate) {
            container.onDateChange(fromDate, toDate);
        }
    },

    // Clear date range
    clearDateRange: (button) => {
        const container = button.closest('.date-range-picker');
        container.querySelector('.date-from').value = '';
        container.querySelector('.date-to').value = '';
        
        if (container.onDateChange) {
            container.onDateChange(null, null);
        }
    },

    // Create a search box with suggestions
    createSearchBox: (placeholder, onSearch, suggestions = []) => {
        const searchId = Utils.generateId();
        
        const container = Utils.dom.create('div', {
            className: 'search-box-container',
            innerHTML: `
                <input type="text" 
                       id="${searchId}"
                       class="search-input" 
                       placeholder="${placeholder}"
                       autocomplete="off">
                <div class="search-suggestions" id="${searchId}-suggestions"></div>
            `
        });

        const input = container.querySelector('.search-input');
        const suggestionsDiv = container.querySelector('.search-suggestions');

        // Handle input
        input.oninput = Utils.debounce((e) => {
            const value = e.target.value;
            onSearch?.(value);
            
            // Show suggestions
            if (value && suggestions.length > 0) {
                const filtered = suggestions.filter(s => 
                    s.toLowerCase().includes(value.toLowerCase())
                ).slice(0, 5);
                
                suggestionsDiv.innerHTML = filtered
                    .map(suggestion => `<div class="suggestion-item" onclick="UIComponents.selectSuggestion('${searchId}', '${suggestion}')">${suggestion}</div>`)
                    .join('');
                
                suggestionsDiv.style.display = filtered.length > 0 ? 'block' : 'none';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        }, 300);

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });

        return container;
    },

    // Select a search suggestion
    selectSuggestion: (searchId, suggestion) => {
        const input = document.getElementById(searchId);
        const suggestionsDiv = document.getElementById(searchId + '-suggestions');
        
        input.value = suggestion;
        suggestionsDiv.style.display = 'none';
        
        // Trigger search
        input.dispatchEvent(new Event('input'));
    },

    // Create a statistics card
    createStatCard: (title, value, icon, change = null) => {
        const card = Utils.dom.create('div', {
            className: 'stat-card',
            innerHTML: `
                <div class="stat-icon">${icon}</div>
                <div class="stat-content">
                    <h3>${title}</h3>
                    <div class="stat-value">${value}</div>
                    ${change ? `<div class="stat-change ${change.type || 'neutral'}">${change.text}</div>` : ''}
                </div>
            `
        });
        
        return card;
    },

    // Create a simple chart placeholder
    createChartPlaceholder: (title, type = 'Loading...') => {
        const placeholder = Utils.dom.create('div', {
            className: 'chart-placeholder',
            innerHTML: `
                <h3>${title}</h3>
                <div class="placeholder-content">
                    <div class="placeholder-icon">📊</div>
                    <div class="placeholder-text">${type}</div>
                </div>
            `
        });
        
        return placeholder;
    }
};

// Export UIComponents for global use
window.UIComponents = UIComponents;

Utils.log('info', 'UIComponents loaded');
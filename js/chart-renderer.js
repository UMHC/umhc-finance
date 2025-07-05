// js/chart-renderer.js - Interactive chart rendering for UMHC Finance System

class ChartRenderer {
    constructor() {
        this.charts = {};
        this.colors = CONFIG.UI.CHART_COLORS;
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                }
            }
        };
        
        Utils.log('info', 'ChartRenderer initialized');
    }

    // Initialize all dashboard charts
    async initializeDashboard(dataManager) {
        try {
            Utils.log('info', 'Initializing dashboard charts...');
            
            const chartData = dataManager.getChartData();
            
            // Create charts in parallel for better performance
            await Promise.all([
                this.createIncomeExpenseChart(chartData.monthly),
                this.createCategoryChart(chartData.categories),
                this.createEventChart(chartData.events)
            ]);
            
            Utils.log('info', 'Dashboard charts initialized successfully');
            
        } catch (error) {
            Utils.log('error', 'Failed to initialize charts', error);
            throw error;
        }
    }

    // Create monthly income vs expenses chart
    createIncomeExpenseChart(monthlyData) {
        const canvas = document.getElementById('incomeExpenseChart');
        if (!canvas) {
            Utils.log('warn', 'Income/Expense chart canvas not found');
            return null;
        }

        // Destroy existing chart if it exists
        if (this.charts.incomeExpense) {
            this.charts.incomeExpense.destroy();
        }

        // Prepare data for the last 12 months
        const months = monthlyData.slice(-12);
        const labels = months.map(month => Utils.formatDate(month.date, 'month-year'));
        const incomeData = months.map(month => month.income);
        const expenseData = months.map(month => month.expenses);

        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        borderColor: this.colors.INCOME,
                        backgroundColor: this.colors.INCOME + '20',
                        fill: false,
                        tension: 0.1,
                        pointBackgroundColor: this.colors.INCOME,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: this.colors.EXPENSE,
                        backgroundColor: this.colors.EXPENSE + '20',
                        fill: false,
                        tension: 0.1,
                        pointBackgroundColor: this.colors.EXPENSE,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Utils.formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    ...this.defaultOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${Utils.formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        this.charts.incomeExpense = new Chart(canvas, config);
        return this.charts.incomeExpense;
    }

    // Create category breakdown pie chart
    createCategoryChart(categoryData) {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) {
            Utils.log('warn', 'Category chart canvas not found');
            return null;
        }

        // Destroy existing chart if it exists
        if (this.charts.category) {
            this.charts.category.destroy();
        }

        // Prepare data - show top 8 categories by absolute value
        const sortedCategories = categoryData
            .filter(cat => cat.expenses > 0) // Only show categories with expenses
            .sort((a, b) => b.expenses - a.expenses)
            .slice(0, 8);

        const labels = sortedCategories.map(cat => cat.category);
        const data = sortedCategories.map(cat => cat.expenses);
        const backgroundColors = this.generateColors(labels.length);

        const config = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expenses by Category',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${Utils.formatCurrency(context.parsed)} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '50%'
            }
        };

        this.charts.category = new Chart(canvas, config);
        return this.charts.category;
    }

    // Create event breakdown chart
    createEventChart(eventData) {
        // This will be displayed as a horizontal bar chart showing net results by event
        const canvas = document.getElementById('eventChart');
        if (!canvas) {
            // If no specific event chart canvas, we might show this data differently
            return null;
        }

        // Destroy existing chart if it exists
        if (this.charts.event) {
            this.charts.event.destroy();
        }

        // Prepare data - show events with significant financial impact
        const significantEvents = eventData
            .filter(event => event.event !== 'General' && Math.abs(event.net) > 50)
            .sort((a, b) => b.net - a.net)
            .slice(0, 10);

        const labels = significantEvents.map(event => event.event);
        const data = significantEvents.map(event => event.net);
        const backgroundColors = data.map(value => 
            value >= 0 ? this.colors.INCOME + '80' : this.colors.EXPENSE + '80'
        );

        const config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Net Result by Event',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: data.map(value => 
                        value >= 0 ? this.colors.INCOME : this.colors.EXPENSE
                    ),
                    borderWidth: 2
                }]
            },
            options: {
                ...this.defaultOptions,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Utils.formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    ...this.defaultOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.x;
                                const status = value >= 0 ? 'Profit' : 'Loss';
                                return `${context.label}: ${Utils.formatCurrency(Math.abs(value))} ${status}`;
                            }
                        }
                    }
                }
            }
        };

        this.charts.event = new Chart(canvas, config);
        return this.charts.event;
    }

    // Update charts with new data (for filtering)
    updateCharts(dataManager) {
        const chartData = dataManager.getChartData();
        
        if (this.charts.incomeExpense) {
            this.updateIncomeExpenseChart(chartData.monthly);
        }
        
        if (this.charts.category) {
            this.updateCategoryChart(chartData.categories);
        }
        
        if (this.charts.event) {
            this.updateEventChart(chartData.events);
        }
    }

    // Update income/expense chart
    updateIncomeExpenseChart(monthlyData) {
        const chart = this.charts.incomeExpense;
        if (!chart) return;

        const months = monthlyData.slice(-12);
        chart.data.labels = months.map(month => Utils.formatDate(month.date, 'month-year'));
        chart.data.datasets[0].data = months.map(month => month.income);
        chart.data.datasets[1].data = months.map(month => month.expenses);
        
        chart.update('none'); // Update without animation for better performance
    }

    // Update category chart
    updateCategoryChart(categoryData) {
        const chart = this.charts.category;
        if (!chart) return;

        const sortedCategories = categoryData
            .filter(cat => cat.expenses > 0)
            .sort((a, b) => b.expenses - a.expenses)
            .slice(0, 8);

        chart.data.labels = sortedCategories.map(cat => cat.category);
        chart.data.datasets[0].data = sortedCategories.map(cat => cat.expenses);
        chart.data.datasets[0].backgroundColor = this.generateColors(sortedCategories.length);
        
        chart.update('none');
    }

    // Update event chart
    updateEventChart(eventData) {
        const chart = this.charts.event;
        if (!chart) return;

        const significantEvents = eventData
            .filter(event => event.event !== 'General' && Math.abs(event.net) > 50)
            .sort((a, b) => b.net - a.net)
            .slice(0, 10);

        chart.data.labels = significantEvents.map(event => event.event);
        chart.data.datasets[0].data = significantEvents.map(event => event.net);
        
        chart.update('none');
    }

    // Generate colors for charts
    generateColors(count) {
        const baseColors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
            '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            const colorIndex = i % baseColors.length;
            const opacity = 0.8 - (Math.floor(i / baseColors.length) * 0.1);
            colors.push(baseColors[colorIndex] + Math.round(opacity * 255).toString(16).padStart(2, '0'));
        }

        return colors;
    }

    // Create a simple summary chart for specific data
    createSummaryChart(canvasId, data, type = 'bar') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        // Destroy existing chart if it exists
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const config = {
            type: type,
            data: data,
            options: {
                ...this.defaultOptions,
                scales: type === 'doughnut' || type === 'pie' ? {} : {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Utils.formatCurrency(value);
                            }
                        }
                    }
                }
            }
        };

        this.charts[canvasId] = new Chart(canvas, config);
        return this.charts[canvasId];
    }

    // Destroy all charts (cleanup)
    destroyAllCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
        Utils.log('info', 'All charts destroyed');
    }

    // Resize charts (call on window resize)
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.resize();
        });
    }

    // Export chart as image
    exportChart(chartName, filename = null) {
        const chart = this.charts[chartName];
        if (!chart) {
            Utils.log('warn', `Chart ${chartName} not found for export`);
            return;
        }

        const link = document.createElement('a');
        link.download = filename || `umhc-${chartName}-chart.png`;
        link.href = chart.toBase64Image();
        link.click();

        Utils.log('info', 'Chart exported', { chartName, filename });
    }
}

// Export ChartRenderer for use in other files
window.ChartRenderer = ChartRenderer;

// Handle window resize
window.addEventListener('resize', Utils.debounce(() => {
    if (window.chartRenderer) {
        window.chartRenderer.resizeCharts();
    }
}, 250));

Utils.log('info', 'ChartRenderer class loaded');
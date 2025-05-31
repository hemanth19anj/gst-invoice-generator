document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }
        initializeReportsPage();
    });
});

let currentReportType = 'gstr1';
let customers = [];
let invoices = [];

async function initializeReportsPage() {
    try {
        // Set default dates (current month)
        setDefaultDates();
        
        // Load customers for dropdown
        await loadCustomers();
        
        // Set up event listeners
        setupEventListeners();
        
        // Generate initial report
        await generateReport();
        
    } catch (error) {
        console.error('Error initializing reports page:', error);
        showError('Failed to initialize reports page.');
    }
}

function setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('fromDate').valueAsDate = firstDay;
    document.getElementById('toDate').valueAsDate = lastDay;
}

async function loadCustomers() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('customers').get();
        
        customers = [];
        const select = document.getElementById('customerSelect');
        select.innerHTML = '<option value="">All Customers</option>';
        
        snapshot.forEach(doc => {
            const customer = { id: doc.id, ...doc.data() };
            customers.push(customer);
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading customers:', error);
        showError('Failed to load customers.');
    }
}

function setupEventListeners() {
    // Report type buttons
    document.getElementById('gstr1Btn').addEventListener('click', () => switchReportType('gstr1'));
    document.getElementById('customerReportBtn').addEventListener('click', () => switchReportType('customer'));
    
    // Generate report button
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    
    // Export report button
    document.getElementById('exportReportBtn').addEventListener('click', exportReport);
}

function switchReportType(type) {
    currentReportType = type;
    
    // Update button styles
    const gstr1Btn = document.getElementById('gstr1Btn');
    const customerReportBtn = document.getElementById('customerReportBtn');
    
    if (type === 'gstr1') {
        gstr1Btn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
        gstr1Btn.classList.add('bg-indigo-600', 'text-white');
        customerReportBtn.classList.remove('bg-indigo-600', 'text-white');
        customerReportBtn.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
        
        document.getElementById('gstr1Table').classList.remove('hidden');
        document.getElementById('customerReportTable').classList.add('hidden');
    } else {
        customerReportBtn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
        customerReportBtn.classList.add('bg-indigo-600', 'text-white');
        gstr1Btn.classList.remove('bg-indigo-600', 'text-white');
        gstr1Btn.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
        
        document.getElementById('customerReportTable').classList.remove('hidden');
        document.getElementById('gstr1Table').classList.add('hidden');
    }
    
    generateReport();
}

async function generateReport() {
    try {
        const fromDate = new Date(document.getElementById('fromDate').value);
        const toDate = new Date(document.getElementById('toDate').value);
        toDate.setHours(23, 59, 59, 999); // Include the entire end date
        
        const customerId = document.getElementById('customerSelect').value;
        
        // Fetch invoices from Firebase
        const db = firebase.firestore();
        let query = db.collection('invoices')
            .where('date', '>=', fromDate)
            .where('date', '<=', toDate)
            .orderBy('date', 'desc');
            
        if (customerId) {
            query = query.where('customerId', '==', customerId);
        }
        
        const snapshot = await query.get();
        
        invoices = [];
        snapshot.forEach(doc => {
            invoices.push({ id: doc.id, ...doc.data() });
        });
        
        if (currentReportType === 'gstr1') {
            displayGSTR1Report(invoices);
        } else {
            displayCustomerReport(invoices);
        }
        
    } catch (error) {
        console.error('Error generating report:', error);
        showError('Failed to generate report.');
    }
}

function displayGSTR1Report(invoices) {
    const tbody = document.getElementById('gstr1TableBody');
    tbody.innerHTML = '';
    
    let totals = {
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        invoiceValue: 0
    };
    
    if (invoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="px-6 py-4 text-center text-sm text-gray-500">
                    No invoices found for the selected period
                </td>
            </tr>
        `;
    } else {
        invoices.forEach(invoice => {
            const row = document.createElement('tr');
            
            // Calculate totals
            totals.taxableValue += invoice.totals.subtotal || 0;
            totals.cgst += invoice.totals.cgst || 0;
            totals.sgst += invoice.totals.sgst || 0;
            totals.igst += invoice.totals.igst || 0;
            totals.totalTax += (invoice.totals.cgst || 0) + (invoice.totals.sgst || 0) + (invoice.totals.igst || 0);
            totals.invoiceValue += invoice.totals.total || 0;
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${invoice.invoiceNumber}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(invoice.date.toDate())}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${invoice.customerName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${getCustomerGSTIN(invoice.customerId)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${invoice.placeOfSupply}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(invoice.totals.subtotal)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(invoice.totals.cgst)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(invoice.totals.sgst)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(invoice.totals.igst)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(invoice.totals.cgst + invoice.totals.sgst + invoice.totals.igst)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(invoice.totals.total)}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // Update totals
    document.getElementById('totalTaxableValue').textContent = `₹${formatAmount(totals.taxableValue)}`;
    document.getElementById('totalCGST').textContent = `₹${formatAmount(totals.cgst)}`;
    document.getElementById('totalSGST').textContent = `₹${formatAmount(totals.sgst)}`;
    document.getElementById('totalIGST').textContent = `₹${formatAmount(totals.igst)}`;
    document.getElementById('totalTax').textContent = `₹${formatAmount(totals.totalTax)}`;
    document.getElementById('totalInvoiceValue').textContent = `₹${formatAmount(totals.invoiceValue)}`;
}

function displayCustomerReport(invoices) {
    const tbody = document.getElementById('customerReportTableBody');
    tbody.innerHTML = '';
    
    if (invoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                    No invoices found for the selected period
                </td>
            </tr>
        `;
        return;
    }
    
    // Group invoices by customer
    const customerSummary = {};
    invoices.forEach(invoice => {
        if (!customerSummary[invoice.customerId]) {
            customerSummary[invoice.customerId] = {
                name: invoice.customerName,
                gstin: getCustomerGSTIN(invoice.customerId),
                invoiceCount: 0,
                taxableValue: 0,
                totalTax: 0,
                totalValue: 0
            };
        }
        
        const summary = customerSummary[invoice.customerId];
        summary.invoiceCount++;
        summary.taxableValue += invoice.totals.subtotal || 0;
        summary.totalTax += (invoice.totals.cgst || 0) + (invoice.totals.sgst || 0) + (invoice.totals.igst || 0);
        summary.totalValue += invoice.totals.total || 0;
    });
    
    let totals = {
        taxableValue: 0,
        totalTax: 0,
        totalValue: 0
    };
    
    Object.values(customerSummary).forEach(summary => {
        const row = document.createElement('tr');
        
        // Calculate totals
        totals.taxableValue += summary.taxableValue;
        totals.totalTax += summary.totalTax;
        totals.totalValue += summary.totalValue;
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${summary.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${summary.gstin}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${summary.invoiceCount}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(summary.taxableValue)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(summary.totalTax)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${formatAmount(summary.totalValue)}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update totals
    document.getElementById('customerTotalTaxableValue').textContent = `₹${formatAmount(totals.taxableValue)}`;
    document.getElementById('customerTotalTax').textContent = `₹${formatAmount(totals.totalTax)}`;
    document.getElementById('customerTotalValue').textContent = `₹${formatAmount(totals.totalValue)}`;
}

function exportReport() {
    try {
        const fromDate = formatDate(new Date(document.getElementById('fromDate').value));
        const toDate = formatDate(new Date(document.getElementById('toDate').value));
        const reportType = currentReportType === 'gstr1' ? 'GSTR-1' : 'Customer-wise';
        
        let csv = '';
        
        if (currentReportType === 'gstr1') {
            // GSTR-1 report headers
            csv = 'Invoice Number,Date,Customer Name,GSTIN,Place of Supply,Taxable Value,CGST,SGST,IGST,Total Tax,Invoice Value\n';
            
            // Add data rows
            invoices.forEach(invoice => {
                csv += `${invoice.invoiceNumber},`;
                csv += `${formatDate(invoice.date.toDate())},`;
                csv += `${invoice.customerName},`;
                csv += `${getCustomerGSTIN(invoice.customerId)},`;
                csv += `${invoice.placeOfSupply},`;
                csv += `${invoice.totals.subtotal || 0},`;
                csv += `${invoice.totals.cgst || 0},`;
                csv += `${invoice.totals.sgst || 0},`;
                csv += `${invoice.totals.igst || 0},`;
                csv += `${(invoice.totals.cgst || 0) + (invoice.totals.sgst || 0) + (invoice.totals.igst || 0)},`;
                csv += `${invoice.totals.total || 0}\n`;
            });
        } else {
            // Customer-wise report headers
            csv = 'Customer Name,GSTIN,Total Invoices,Taxable Value,Total Tax,Total Value\n';
            
            // Group invoices by customer
            const customerSummary = {};
            invoices.forEach(invoice => {
                if (!customerSummary[invoice.customerId]) {
                    customerSummary[invoice.customerId] = {
                        name: invoice.customerName,
                        gstin: getCustomerGSTIN(invoice.customerId),
                        invoiceCount: 0,
                        taxableValue: 0,
                        totalTax: 0,
                        totalValue: 0
                    };
                }
                
                const summary = customerSummary[invoice.customerId];
                summary.invoiceCount++;
                summary.taxableValue += invoice.totals.subtotal || 0;
                summary.totalTax += (invoice.totals.cgst || 0) + (invoice.totals.sgst || 0) + (invoice.totals.igst || 0);
                summary.totalValue += invoice.totals.total || 0;
            });
            
            // Add data rows
            Object.values(customerSummary).forEach(summary => {
                csv += `${summary.name},`;
                csv += `${summary.gstin},`;
                csv += `${summary.invoiceCount},`;
                csv += `${summary.taxableValue},`;
                csv += `${summary.totalTax},`;
                csv += `${summary.totalValue}\n`;
            });
        }
        
        // Create and trigger download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `${reportType}_Report_${fromDate}_to_${toDate}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showSuccess('Report exported successfully');
    } catch (error) {
        console.error('Error exporting report:', error);
        showError('Failed to export report.');
    }
}

function getCustomerGSTIN(customerId) {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.gstin : '-';
}

function formatDate(date) {
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatAmount(amount) {
    return (amount || 0).toFixed(2);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded';
    errorDiv.role = 'alert';
    errorDiv.innerHTML = `
        <strong class="font-bold">Error!</strong>
        <span class="block sm:inline"> ${message}</span>
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded';
    successDiv.role = 'alert';
    successDiv.innerHTML = `
        <strong class="font-bold">Success!</strong>
        <span class="block sm:inline"> ${message}</span>
    `;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

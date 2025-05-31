document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        loadDashboardData();
    });

    // Handle logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await firebase.auth().signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showError('Failed to sign out. Please try again.');
        }
    });
});

async function loadDashboardData() {
    try {
        const db = firebase.firestore();
        
        // Update statistics
        await updateStatistics(db);
        
        // Load recent invoices
        await loadRecentInvoices(db);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data. Please refresh the page.');
    }
}

async function updateStatistics(db) {
    try {
        // Get total invoices
        const invoicesSnapshot = await db.collection('invoices').get();
        document.getElementById('totalInvoices').textContent = invoicesSnapshot.size;

        // Get total customers
        const customersSnapshot = await db.collection('customers').get();
        document.getElementById('totalCustomers').textContent = customersSnapshot.size;

        // Get total items
        const itemsSnapshot = await db.collection('items').get();
        document.getElementById('totalItems').textContent = itemsSnapshot.size;

    } catch (error) {
        console.error('Error updating statistics:', error);
        showError('Failed to load statistics.');
    }
}

async function loadRecentInvoices(db) {
    try {
        const recentInvoicesSnapshot = await db.collection('invoices')
            .orderBy('date', 'desc')
            .limit(5)
            .get();

        const recentInvoicesTable = document.getElementById('recentInvoicesTable');
        recentInvoicesTable.innerHTML = ''; // Clear existing content

        if (recentInvoicesSnapshot.empty) {
            recentInvoicesTable.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                        No invoices found. Create your first invoice!
                    </td>
                </tr>
            `;
            return;
        }

        recentInvoicesSnapshot.forEach((doc) => {
            const invoice = doc.data();
            const row = document.createElement('tr');
            
            // Format date
            const invoiceDate = invoice.date ? new Date(invoice.date.toDate()) : new Date();
            const formattedDate = invoiceDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            // Format amount
            const formattedAmount = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR'
            }).format(invoice.totals?.total || 0);

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${invoice.invoiceNumber || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formattedDate}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${invoice.customerName || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formattedAmount}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(invoice.status)}">
                        ${invoice.status || 'Pending'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a href="pages/invoice.html?id=${doc.id}" class="text-indigo-600 hover:text-indigo-900 mr-3">
                        View
                    </a>
                    <button onclick="deleteInvoice('${doc.id}')" class="text-red-600 hover:text-red-900">
                        Delete
                    </button>
                </td>
            `;
            recentInvoicesTable.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading recent invoices:', error);
        showError('Failed to load recent invoices.');
    }
}

async function deleteInvoice(invoiceId) {
    if (!confirm('Are you sure you want to delete this invoice?')) {
        return;
    }

    try {
        const db = firebase.firestore();
        await db.collection('invoices').doc(invoiceId).delete();
        
        // Reload dashboard data
        await loadDashboardData();
        showSuccess('Invoice deleted successfully');
    } catch (error) {
        console.error('Error deleting invoice:', error);
        showError('Failed to delete invoice.');
    }
}

function getStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'paid':
            return 'bg-green-100 text-green-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'overdue':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
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

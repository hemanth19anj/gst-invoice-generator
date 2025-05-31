// Invoice List Module

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }
        loadInvoiceList();
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await firebase.auth().signOut();
            window.location.href = '../login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Failed to sign out. Please try again.');
        }
    });
});

async function loadInvoiceList() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('invoices').orderBy('createdAt', 'desc').get();

        const tbody = document.getElementById('invoiceListTableBody');
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                        No invoices found.
                    </td>
                </tr>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const invoice = doc.data();
            const invoiceId = doc.id;
            const invoiceDate = invoice.date ? invoice.date.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
            const totalAmount = invoice.totals?.total ? `₹${invoice.totals.total.toFixed(2)}` : '₹0.00';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${invoice.invoiceNumber || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${invoiceDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${invoice.customerName || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${totalAmount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <a href="invoice.html?id=${invoiceId}" class="text-indigo-600 hover:text-indigo-900">Edit</a>
                    <button onclick="deleteInvoice('${invoiceId}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading invoices:', error);
        alert('Failed to load invoices.');
    }
}

async function deleteInvoice(invoiceId) {
    if (!confirm('Are you sure you want to delete this invoice?')) {
        return;
    }

    try {
        const db = firebase.firestore();
        await db.collection('invoices').doc(invoiceId).delete();
        alert('Invoice deleted successfully.');
        loadInvoiceList();
    } catch (error) {
        console.error('Error deleting invoice:', error);
        alert('Failed to delete invoice.');
    }
}

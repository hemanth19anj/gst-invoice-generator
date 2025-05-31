// Initialize customers array
let customers = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }
        initializeCustomersPage();
    });
});

async function initializeCustomersPage() {
    try {
        // Set up event listeners
        setupEventListeners();
        
        // Load customers
        await loadCustomers();
        
    } catch (error) {
        console.error('Error initializing customers page:', error);
        showError('Failed to initialize customers page.');
    }
}

function setupEventListeners() {
    // Add customer button
    document.getElementById('addCustomerBtn').addEventListener('click', () => {
        window.showCustomerModal();
    });

    // Import button
    document.getElementById('importBtn').addEventListener('click', () => {
        window.showImportModal();
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', window.exportCustomers);

    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterCustomers(e.target.value);
    });

    // Same as billing checkbox
    document.getElementById('sameAsBilling').addEventListener('change', handleSameAsBilling);

    // Customer form
    document.getElementById('customerForm').addEventListener('submit', handleCustomerSubmit);
}

async function loadCustomers() {
    try {
        const snapshot = await db.collection('customers').get();
        
        customers = [];
        snapshot.forEach(doc => {
            customers.push({ id: doc.id, ...doc.data() });
        });
        
        displayCustomers(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        showError('Failed to load customers.');
    }
}

function displayCustomers(customersToDisplay) {
    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = '';
    
    if (customersToDisplay.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                    No customers found
                </td>
            </tr>
        `;
        return;
    }
    
    customersToDisplay.forEach(customer => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${customer.name}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${customer.gstin || '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${customer.email || '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${customer.phone || '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${customer.billingState}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="window.editCustomer('${customer.id}')" class="text-indigo-600 hover:text-indigo-900 mr-4">
                    Edit
                </button>
                <button onclick="window.deleteCustomer('${customer.id}')" class="text-red-600 hover:text-red-900">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterCustomers(searchTerm) {
    const filtered = customers.filter(customer => {
        const searchString = searchTerm.toLowerCase();
        return (
            customer.name.toLowerCase().includes(searchString) ||
            (customer.gstin && customer.gstin.toLowerCase().includes(searchString)) ||
            (customer.email && customer.email.toLowerCase().includes(searchString)) ||
            (customer.phone && customer.phone.includes(searchString)) ||
            customer.billingState.toLowerCase().includes(searchString)
        );
    });
    
    displayCustomers(filtered);
}

// Make functions globally accessible
window.showCustomerModal = function(customerId = null) {
    const modal = document.getElementById('customerModal');
    const form = document.getElementById('customerForm');
    const title = document.getElementById('modalTitle');
    
    // Reset form
    form.reset();
    
    if (customerId) {
        // Edit mode
        title.textContent = 'Edit Customer';
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            // Populate form fields
            Object.keys(customer).forEach(key => {
                const input = form.elements[key];
                if (input && key !== 'id') {
                    input.value = customer[key];
                }
            });
        }
        form.dataset.customerId = customerId;
    } else {
        // Add mode
        title.textContent = 'Add New Customer';
        delete form.dataset.customerId;
    }
    
    modal.classList.remove('hidden');
};

window.closeCustomerModal = function() {
    document.getElementById('customerModal').classList.add('hidden');
};

window.showImportModal = function() {
    document.getElementById('importModal').classList.remove('hidden');
};

window.closeImportModal = function() {
    document.getElementById('importModal').classList.add('hidden');
    document.getElementById('csvFile').value = '';
};

window.editCustomer = function(customerId) {
    window.showCustomerModal(customerId);
};

function handleSameAsBilling(event) {
    const form = document.getElementById('customerForm');
    const checked = event.target.checked;
    
    if (checked) {
        // Copy billing address to shipping address
        form.shippingAddressLine1.value = form.billingAddressLine1.value;
        form.shippingAddressLine2.value = form.billingAddressLine2.value;
        form.shippingCity.value = form.billingCity.value;
        form.shippingState.value = form.billingState.value;
        form.shippingPincode.value = form.billingPincode.value;
        form.shippingCountry.value = form.billingCountry.value;
    }
}

async function handleCustomerSubmit(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const customerId = form.dataset.customerId;
        
        const customerData = {
            name: form.name.value,
            gstin: form.gstin.value,
            email: form.email.value,
            phone: form.phone.value,
            billingAddressLine1: form.billingAddressLine1.value,
            billingAddressLine2: form.billingAddressLine2.value,
            billingCity: form.billingCity.value,
            billingState: form.billingState.value,
            billingPincode: form.billingPincode.value,
            billingCountry: form.billingCountry.value,
            shippingAddressLine1: form.shippingAddressLine1.value,
            shippingAddressLine2: form.shippingAddressLine2.value,
            shippingCity: form.shippingCity.value,
            shippingState: form.shippingState.value,
            shippingPincode: form.shippingPincode.value,
            shippingCountry: form.shippingCountry.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (customerId) {
            // Update existing customer
            await db.collection('customers').doc(customerId).update(customerData);
        } else {
            // Add new customer
            customerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('customers').add(customerData);
        }
        
        // Reload customers and close modal
        await loadCustomers();
        window.closeCustomerModal();
        
        showSuccess(customerId ? 'Customer updated successfully' : 'Customer added successfully');
    } catch (error) {
        console.error('Error saving customer:', error);
        showError('Failed to save customer.');
    }
}

window.deleteCustomer = async function(customerId) {
    if (!confirm('Are you sure you want to delete this customer?')) {
        return;
    }
    
    try {
        await db.collection('customers').doc(customerId).delete();
        
        // Reload customers
        await loadCustomers();
        showSuccess('Customer deleted successfully');
    } catch (error) {
        console.error('Error deleting customer:', error);
        showError('Failed to delete customer.');
    }
};

window.importCustomers = async function() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showError('Please select a CSV file');
        return;
    }
    
    try {
        const text = await file.text();
        const rows = text.split('\n').map(row => row.split(','));
        
        // Validate headers
        const headers = rows[0].map(header => header.trim());
        const requiredHeaders = ['name', 'gstin', 'email', 'phone', 'billingAddressLine1', 'billingCity', 'billingState', 'billingPincode'];
        
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            showError(`Missing required columns: ${missingHeaders.join(', ')}`);
            return;
        }
        
        // Process data
        const customers = rows.slice(1).map(row => {
            const customer = {};
            headers.forEach((header, index) => {
                customer[header] = row[index]?.trim() || '';
            });
            return customer;
        });
        
        // Save to Firebase
        const batch = db.batch();
        
        customers.forEach(customer => {
            if (customer.name) { // Only process rows with a name
                const docRef = db.collection('customers').doc();
                batch.set(docRef, {
                    ...customer,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        
        await batch.commit();
        
        // Reload customers and close modal
        await loadCustomers();
        window.closeImportModal();
        
        showSuccess(`${customers.length} customers imported successfully`);
    } catch (error) {
        console.error('Error importing customers:', error);
        showError('Failed to import customers.');
    }
};

window.exportCustomers = function() {
    try {
        // Define headers
        const headers = [
            'name',
            'gstin',
            'email',
            'phone',
            'billingAddressLine1',
            'billingAddressLine2',
            'billingCity',
            'billingState',
            'billingPincode',
            'billingCountry',
            'shippingAddressLine1',
            'shippingAddressLine2',
            'shippingCity',
            'shippingState',
            'shippingPincode',
            'shippingCountry'
        ];
        
        // Convert customers to CSV
        const csv = [
            headers.join(','),
            ...customers.map(customer => 
                headers.map(header => 
                    JSON.stringify(customer[header] || '')
                ).join(',')
            )
        ].join('\n');
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'customers.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showSuccess('Customers exported successfully');
    } catch (error) {
        console.error('Error exporting customers:', error);
        showError('Failed to export customers.');
    }
};

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded';
    errorDiv.role = 'alert';
    errorDiv.innerHTML = `
        <strong class="font-bold">Error!</strong>
        <span class="block sm:inline"> ${message}</span>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
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
    setTimeout(() => successDiv.remove(), 5000);
}

// Initialize items array
let items = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }
        initializeItemsPage();
    });
});

async function initializeItemsPage() {
    try {
        // Set up event listeners
        setupEventListeners();
        
        // Load items
        await loadItems();
        
    } catch (error) {
        console.error('Error initializing items page:', error);
        showError('Failed to initialize items page.');
    }
}

function setupEventListeners() {
    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', () => {
        window.showItemModal();
    });

    // Import button
    document.getElementById('importBtn').addEventListener('click', () => {
        window.showImportModal();
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', window.exportItems);

    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterItems(e.target.value);
    });

    // Item form
    document.getElementById('itemForm').addEventListener('submit', handleItemSubmit);
}

async function loadItems() {
    try {
        const snapshot = await db.collection('items').get();
        
        items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        
        displayItems(items);
    } catch (error) {
        console.error('Error loading items:', error);
        showError('Failed to load items.');
    }
}

function displayItems(itemsToDisplay) {
    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';
    
    if (itemsToDisplay.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                    No items found
                </td>
            </tr>
        `;
        return;
    }
    
    itemsToDisplay.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${item.name}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${item.hsnCode || '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${item.unit || '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ₹${parseFloat(item.defaultRate).toFixed(2)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${item.defaultGstRate}%
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="window.editItem('${item.id}')" class="text-indigo-600 hover:text-indigo-900 mr-4">
                    Edit
                </button>
                <button onclick="window.deleteItem('${item.id}')" class="text-red-600 hover:text-red-900">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterItems(searchTerm) {
    const filtered = items.filter(item => {
        const searchString = searchTerm.toLowerCase();
        return (
            item.name.toLowerCase().includes(searchString) ||
            (item.hsnCode && item.hsnCode.toLowerCase().includes(searchString)) ||
            (item.unit && item.unit.toLowerCase().includes(searchString))
        );
    });
    
    displayItems(filtered);
}

// Make functions globally accessible
window.showItemModal = function(itemId = null) {
    const modal = document.getElementById('itemModal');
    const form = document.getElementById('itemForm');
    const title = document.getElementById('modalTitle');
    
    // Reset form
    form.reset();
    
    if (itemId) {
        // Edit mode
        title.textContent = 'Edit Item';
        const item = items.find(i => i.id === itemId);
        if (item) {
            // Populate form fields
            Object.keys(item).forEach(key => {
                const input = form.elements[key];
                if (input && key !== 'id') {
                    input.value = item[key];
                }
            });
        }
        form.dataset.itemId = itemId;
    } else {
        // Add mode
        title.textContent = 'Add New Item';
        delete form.dataset.itemId;
    }
    
    modal.classList.remove('hidden');
};

window.closeItemModal = function() {
    document.getElementById('itemModal').classList.add('hidden');
};

window.showImportModal = function() {
    document.getElementById('importModal').classList.remove('hidden');
};

window.closeImportModal = function() {
    document.getElementById('importModal').classList.add('hidden');
    document.getElementById('csvFile').value = '';
};

window.editItem = function(itemId) {
    window.showItemModal(itemId);
};

async function handleItemSubmit(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const itemId = form.dataset.itemId;
        
        const itemData = {
            name: form.name.value,
            hsnCode: form.hsnCode.value,
            unit: form.unit.value,
            defaultRate: parseFloat(form.defaultRate.value),
            defaultGstRate: parseFloat(form.defaultGstRate.value),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (itemId) {
            // Update existing item
            await db.collection('items').doc(itemId).update(itemData);
        } else {
            // Add new item
            itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('items').add(itemData);
        }
        
        // Reload items and close modal
        await loadItems();
        window.closeItemModal();
        
        showSuccess(itemId ? 'Item updated successfully' : 'Item added successfully');
    } catch (error) {
        console.error('Error saving item:', error);
        showError('Failed to save item.');
    }
}

window.deleteItem = async function(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    try {
        await db.collection('items').doc(itemId).delete();
        
        // Reload items
        await loadItems();
        showSuccess('Item deleted successfully');
    } catch (error) {
        console.error('Error deleting item:', error);
        showError('Failed to delete item.');
    }
};

window.importItems = async function() {
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
        const requiredHeaders = ['name', 'hsnCode', 'unit', 'defaultRate', 'defaultGstRate'];
        
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            showError(`Missing required columns: ${missingHeaders.join(', ')}`);
            return;
        }
        
        // Process data
        const items = rows.slice(1).map(row => {
            const item = {};
            headers.forEach((header, index) => {
                let value = row[index]?.trim() || '';
                if (header === 'defaultRate' || header === 'defaultGstRate') {
                    value = parseFloat(value) || 0;
                }
                item[header] = value;
            });
            return item;
        });
        
        // Save to Firebase
        const batch = db.batch();
        
        items.forEach(item => {
            if (item.name) { // Only process rows with a name
                const docRef = db.collection('items').doc();
                batch.set(docRef, {
                    ...item,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        
        await batch.commit();
        
        // Reload items and close modal
        await loadItems();
        window.closeImportModal();
        
        showSuccess(`${items.length} items imported successfully`);
    } catch (error) {
        console.error('Error importing items:', error);
        showError('Failed to import items.');
    }
};

window.exportItems = function() {
    try {
        // Define headers
        const headers = [
            'name',
            'hsnCode',
            'unit',
            'defaultRate',
            'defaultGstRate'
        ];
        
        // Convert items to CSV
        const csv = [
            headers.join(','),
            ...items.map(item => 
                headers.map(header => 
                    JSON.stringify(item[header] || '')
                ).join(',')
            )
        ].join('\n');
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'items.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showSuccess('Items exported successfully');
    } catch (error) {
        console.error('Error exporting items:', error);
        showError('Failed to export items.');
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

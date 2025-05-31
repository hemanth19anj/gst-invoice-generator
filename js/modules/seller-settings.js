document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }
        loadSellerSettings();
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await firebase.auth().signOut();
            window.location.href = '../login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showError('Failed to sign out.');
        }
    });

    // Form submit handler
    document.getElementById('sellerSettingsForm').addEventListener('submit', saveSellerSettings);
});

async function loadSellerSettings() {
    try {
        const doc = await db.collection('settings').doc('seller').get();
        
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('sellerName').value = data.name || '';
            document.getElementById('sellerAddressLine1').value = data.addressLine1 || '';
            document.getElementById('sellerAddressLine2').value = data.addressLine2 || '';
            document.getElementById('sellerState').value = data.state || '';
            document.getElementById('sellerPincode').value = data.pincode || '';
            document.getElementById('sellerPhone').value = data.phone || '';
            document.getElementById('sellerEmail').value = data.email || '';
            document.getElementById('sellerGst').value = data.gst || '';
            document.getElementById('sellerLogoUrl').value = data.logoUrl || '';
            document.getElementById('sellerSignUrl').value = data.signUrl || '';
            
            // Load invoice settings
            document.getElementById('invoicePrefix').value = data.invoicePrefix || '';
            document.getElementById('nextInvoiceNumber').value = data.nextInvoiceNumber || '1';
            document.getElementById('invoicePadding').value = data.invoicePadding || '3';
            document.getElementById('invoiceNote').value = data.invoiceNote || '';
        }
    } catch (error) {
        console.error('Error loading seller settings:', error);
        showError('Failed to load seller settings.');
    }
}

async function saveSellerSettings(event) {
    event.preventDefault();
    
    try {
        const data = {
            name: document.getElementById('sellerName').value,
            addressLine1: document.getElementById('sellerAddressLine1').value,
            addressLine2: document.getElementById('sellerAddressLine2').value,
            state: document.getElementById('sellerState').value,
            pincode: document.getElementById('sellerPincode').value,
            phone: document.getElementById('sellerPhone').value,
            email: document.getElementById('sellerEmail').value,
            gst: document.getElementById('sellerGst').value,
            logoUrl: document.getElementById('sellerLogoUrl').value,
            signUrl: document.getElementById('sellerSignUrl').value,
            
            // Invoice settings
            invoicePrefix: document.getElementById('invoicePrefix').value,
            nextInvoiceNumber: parseInt(document.getElementById('nextInvoiceNumber').value) || 1,
            invoicePadding: parseInt(document.getElementById('invoicePadding').value) || 3,
            invoiceNote: document.getElementById('invoiceNote').value,
            
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Validate phone number (10 digits)
        if (!/^\d{10}$/.test(data.phone)) {
            showError('Phone number must be 10 digits');
            return;
        }

        // Validate email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(data.email)) {
            showError('Invalid email address format');
            return;
        }

        // Validate GST format
        const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstPattern.test(data.gst)) {
            showError('Invalid GST number format');
            return;
        }

        // Validate pincode
        if (!/^\d{6}$/.test(data.pincode)) {
            showError('Pincode must be 6 digits');
            return;
        }

        // Validate invoice padding
        if (data.invoicePadding < 1 || data.invoicePadding > 10) {
            showError('Invoice number padding must be between 1 and 10');
            return;
        }

        await db.collection('settings').doc('seller').set(data);
        showSuccess('Seller settings saved successfully.');
    } catch (error) {
        console.error('Error saving seller settings:', error);
        showError('Failed to save seller settings.');
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

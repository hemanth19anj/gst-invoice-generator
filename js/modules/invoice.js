// Initialize variables for storing data
let customers = [];
let items = [];

// Utility function for debouncing calculations
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
let currentInvoice = {
    items: [],
    totals: {
        subtotal: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }
        initializeInvoicePage();
    });
});

async function loadDefaultSettings() {
    try {
        const sellerDoc = await db.collection('settings').doc('seller').get();
        if (sellerDoc.exists) {
            const sellerData = sellerDoc.data();
            if (sellerData.invoiceNote) {
                document.getElementById('termsConditions').value = sellerData.invoiceNote;
            }
        }
    } catch (error) {
        console.error('Error loading default settings:', error);
    }
}

async function initializeInvoicePage() {
    try {
        // Set default date to today
        document.getElementById('invoiceDate').valueAsDate = new Date();
        
        // Load seller settings first
        const sellerDoc = await db.collection('settings').doc('seller').get();
        if (sellerDoc.exists) {
            const data = sellerDoc.data();
            sellerState = data.state; // Set global sellerState
            
            // Load default invoice note
            if (data.invoiceNote) {
                document.getElementById('termsConditions').value = data.invoiceNote;
            }
        }
        
        // Generate new invoice number
        await generateInvoiceNumber();
        
        // Load customers and items
        await Promise.all([
            loadCustomers(),
            loadItems()
        ]);
        
        // Initialize event listeners
        setupEventListeners();
        
        // Add event listener for GST option change
        document.getElementById('gstOption').addEventListener('change', () => {
            // Recalculate all rows when GST option changes
            document.querySelectorAll('#itemsTableBody tr').forEach(row => {
                calculateItemAmount(row);
            });
            recalculateTotals();
        });
        
        // Check if editing existing invoice
        const urlParams = new URLSearchParams(window.location.search);
        const invoiceId = urlParams.get('id');
        if (invoiceId) {
            await loadExistingInvoice(invoiceId);
        }
    } catch (error) {
        console.error('Error initializing invoice page:', error);
        showError('Failed to initialize invoice page. Please refresh.');
    }
}

async function generateInvoiceNumber() {
    try {
        const db = firebase.firestore();
        const settingsDoc = await db.collection('settings').doc('invoiceSettings').get();
        const settings = settingsDoc.data() || { prefix: 'INV', lastNumber: 0 };
        
        const newNumber = settings.lastNumber + 1;
        const invoiceNumber = `${settings.prefix}${newNumber.toString().padStart(5, '0')}`;
        
        document.getElementById('invoiceNumber').value = invoiceNumber;
        
        // Update the last number in settings
        await db.collection('settings').doc('invoiceSettings').set({
            ...settings,
            lastNumber: newNumber
        });
    } catch (error) {
        console.error('Error generating invoice number:', error);
        showError('Failed to generate invoice number.');
    }
}

async function loadCustomers() {
    try {
        const snapshot = await db.collection('customers').get();
        
        customers = [];
        const select = document.getElementById('customerSelect');
        select.innerHTML = '<option value="">Select or add new customer</option>';
        
        snapshot.forEach(doc => {
            const customer = { id: doc.id, ...doc.data() };
            customers.push(customer);
        });
        
        // Sort customers by name
        customers.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add sorted customers to select
        customers.forEach(customer => {
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

async function loadItems() {
    try {
        const snapshot = await db.collection('items').get();
        
        items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort items by name
        items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error loading items:', error);
        showError('Failed to load items.');
    }
}

function setupEventListeners() {
    // Customer select change
    document.getElementById('customerSelect').addEventListener('change', handleCustomerSelect);
    
    // Add new customer button
    document.getElementById('addNewCustomerBtn').addEventListener('click', showCustomerModal);
    
    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', showItemModal);
    
    // Save invoice button
    document.getElementById('saveInvoiceBtn').addEventListener('click', saveInvoice);
    
    // Preview invoice button
    document.getElementById('previewInvoiceBtn').addEventListener('click', previewInvoice);
    
    // Logo and signature URL inputs
    document.getElementById('logoUrl').addEventListener('input', updateLogoPreview);
    document.getElementById('signatureUrl').addEventListener('input', updateSignaturePreview);
}

function handleCustomerSelect(event) {
    const customerId = event.target.value;
    if (!customerId) {
        clearCustomerDetails();
        return;
    }
    
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        displayCustomerDetails(customer);
    }
}

function displayCustomerDetails(customer) {
    const detailsDiv = document.getElementById('customerDetails');
    detailsDiv.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">Name</label>
            <input type="text" value="${customer.name || ''}" readonly class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">GSTIN</label>
            <input type="text" value="${customer.gstin || ''}" readonly class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value="${customer.email || ''}" readonly class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Phone</label>
            <input type="tel" value="${customer.phone || ''}" readonly class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50">
        </div>
        <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-700">Billing Address</label>
            <textarea readonly class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50" rows="3">${formatAddress(customer, 'billing')}</textarea>
        </div>
        <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-700">Shipping Address</label>
            <textarea readonly class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50" rows="3">${formatAddress(customer, 'shipping')}</textarea>
        </div>
    `;
}

function formatAddress(customer, type) {
    const prefix = type === 'billing' ? 'billing' : 'shipping';
    return [
        customer[prefix + 'AddressLine1'],
        customer[prefix + 'AddressLine2'],
        customer[prefix + 'City'],
        customer[prefix + 'State'],
        customer[prefix + 'Pincode'],
        customer[prefix + 'Country']
    ].filter(Boolean).join(', ');
}

function clearCustomerDetails() {
    document.getElementById('customerDetails').innerHTML = '';
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

function showCustomerModal() {
    const modal = document.getElementById('customerModal');
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Add New Customer</h3>
            <form id="customerForm" class="space-y-6">
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Name *</label>
                        <input type="text" name="name" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">GSTIN</label>
                        <input type="text" name="gstin" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Email *</label>
                        <input type="email" name="email" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Phone *</label>
                        <input type="tel" name="phone" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    
                    <!-- Billing Address -->
                    <div class="sm:col-span-2">
                        <h4 class="text-md font-medium text-gray-900 mb-2">Billing Address</h4>
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium text-gray-700">Address Line 1 *</label>
                        <input type="text" name="billingAddressLine1" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium text-gray-700">Address Line 2</label>
                        <input type="text" name="billingAddressLine2" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">City *</label>
                        <input type="text" name="billingCity" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">State *</label>
                        <select name="billingState" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                            <option value="">Select State</option>
                            <option value="Andhra Pradesh">Andhra Pradesh</option>
                            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                            <option value="Assam">Assam</option>
                            <option value="Bihar">Bihar</option>
                            <option value="Chhattisgarh">Chhattisgarh</option>
                            <option value="Goa">Goa</option>
                            <option value="Gujarat">Gujarat</option>
                            <option value="Haryana">Haryana</option>
                            <option value="Himachal Pradesh">Himachal Pradesh</option>
                            <option value="Jharkhand">Jharkhand</option>
                            <option value="Karnataka">Karnataka</option>
                            <option value="Kerala">Kerala</option>
                            <option value="Madhya Pradesh">Madhya Pradesh</option>
                            <option value="Maharashtra">Maharashtra</option>
                            <option value="Manipur">Manipur</option>
                            <option value="Meghalaya">Meghalaya</option>
                            <option value="Mizoram">Mizoram</option>
                            <option value="Nagaland">Nagaland</option>
                            <option value="Odisha">Odisha</option>
                            <option value="Punjab">Punjab</option>
                            <option value="Rajasthan">Rajasthan</option>
                            <option value="Sikkim">Sikkim</option>
                            <option value="Tamil Nadu">Tamil Nadu</option>
                            <option value="Telangana">Telangana</option>
                            <option value="Tripura">Tripura</option>
                            <option value="Uttar Pradesh">Uttar Pradesh</option>
                            <option value="Uttarakhand">Uttarakhand</option>
                            <option value="West Bengal">West Bengal</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Pincode *</label>
                        <input type="text" name="billingPincode" required pattern="[0-9]{6}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Country *</label>
                        <input type="text" name="billingCountry" required value="India" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50" readonly>
                    </div>

                    <!-- Shipping Address -->
                    <div class="sm:col-span-2 border-t pt-4">
                        <div class="flex items-center mb-2">
                            <h4 class="text-md font-medium text-gray-900">Shipping Address</h4>
                            <label class="ml-4 inline-flex items-center">
                                <input type="checkbox" id="sameAsBilling" class="rounded border-gray-300 text-indigo-600 shadow-sm">
                                <span class="ml-2 text-sm text-gray-600">Same as Billing Address</span>
                            </label>
                        </div>
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium text-gray-700">Address Line 1 *</label>
                        <input type="text" name="shippingAddressLine1" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium text-gray-700">Address Line 2</label>
                        <input type="text" name="shippingAddressLine2" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">City *</label>
                        <input type="text" name="shippingCity" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">State *</label>
                        <select name="shippingState" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                            <option value="">Select State</option>
                            <option value="Andhra Pradesh">Andhra Pradesh</option>
                            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                            <option value="Assam">Assam</option>
                            <option value="Bihar">Bihar</option>
                            <option value="Chhattisgarh">Chhattisgarh</option>
                            <option value="Goa">Goa</option>
                            <option value="Gujarat">Gujarat</option>
                            <option value="Haryana">Haryana</option>
                            <option value="Himachal Pradesh">Himachal Pradesh</option>
                            <option value="Jharkhand">Jharkhand</option>
                            <option value="Karnataka">Karnataka</option>
                            <option value="Kerala">Kerala</option>
                            <option value="Madhya Pradesh">Madhya Pradesh</option>
                            <option value="Maharashtra">Maharashtra</option>
                            <option value="Manipur">Manipur</option>
                            <option value="Meghalaya">Meghalaya</option>
                            <option value="Mizoram">Mizoram</option>
                            <option value="Nagaland">Nagaland</option>
                            <option value="Odisha">Odisha</option>
                            <option value="Punjab">Punjab</option>
                            <option value="Rajasthan">Rajasthan</option>
                            <option value="Sikkim">Sikkim</option>
                            <option value="Tamil Nadu">Tamil Nadu</option>
                            <option value="Telangana">Telangana</option>
                            <option value="Tripura">Tripura</option>
                            <option value="Uttar Pradesh">Uttar Pradesh</option>
                            <option value="Uttarakhand">Uttarakhand</option>
                            <option value="West Bengal">West Bengal</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Pincode *</label>
                        <input type="text" name="shippingPincode" required pattern="[0-9]{6}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Country *</label>
                        <input type="text" name="shippingCountry" required value="India" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50" readonly>
                    </div>
                </div>
                <div class="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onclick="closeCustomerModal()" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                        Save Customer
                    </button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    
    const form = document.getElementById('customerForm');
    form.addEventListener('submit', saveCustomer);
    setupCustomerForm(); // Initialize the same as billing functionality

    // Add input validation for GSTIN
    const gstinInput = form.querySelector('[name="gstin"]');
    gstinInput.addEventListener('input', function() {
        const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (this.value && !gstinPattern.test(this.value)) {
            this.setCustomValidity('Please enter a valid GSTIN');
        } else {
            this.setCustomValidity('');
        }
    });

    // Add validation for pincode
    ['billingPincode', 'shippingPincode'].forEach(field => {
        const input = form.querySelector(`[name="${field}"]`);
        input.addEventListener('input', function() {
            const pincodePattern = /^[0-9]{6}$/;
            if (!pincodePattern.test(this.value)) {
                this.setCustomValidity('Please enter a valid 6-digit pincode');
            } else {
                this.setCustomValidity('');
            }
        });
    });
}

function setupCustomerForm() {
    const sameAsBillingCheckbox = document.getElementById('sameAsBilling');
    const shippingFields = [
        'shippingAddressLine1',
        'shippingAddressLine2',
        'shippingCity',
        'shippingState',
        'shippingPincode',
        'shippingCountry'
    ];

    sameAsBillingCheckbox.addEventListener('change', function() {
        const billingFields = [
            'billingAddressLine1',
            'billingAddressLine2',
            'billingCity',
            'billingState',
            'billingPincode',
            'billingCountry'
        ];

        shippingFields.forEach((field, index) => {
            const shippingInput = document.querySelector(`[name="${field}"]`);
            if (this.checked) {
                const billingValue = document.querySelector(`[name="${billingFields[index]}"]`).value;
                shippingInput.value = billingValue;
                shippingInput.readOnly = true;
                shippingInput.classList.add('bg-gray-50');
            } else {
                shippingInput.readOnly = false;
                shippingInput.classList.remove('bg-gray-50');
            }
        });
    });
}

async function saveCustomer(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const customerData = {
            name: form.name.value,
            gstin: form.gstin.value || null,
            email: form.email.value,
            phone: form.phone.value,
            billingAddressLine1: form.billingAddressLine1.value,
            billingAddressLine2: form.billingAddressLine2.value || '',
            billingCity: form.billingCity.value,
            billingState: form.billingState.value,
            billingPincode: form.billingPincode.value,
            billingCountry: form.billingCountry.value,
            shippingAddressLine1: form.shippingAddressLine1.value,
            shippingAddressLine2: form.shippingAddressLine2.value || '',
            shippingCity: form.shippingCity.value,
            shippingState: form.shippingState.value,
            shippingPincode: form.shippingPincode.value,
            shippingCountry: form.shippingCountry.value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const db = firebase.firestore();
        const docRef = await db.collection('customers').add(customerData);
        
        // Reload customers and close modal
        await loadCustomers();
        closeCustomerModal();
        
        // Select the new customer
        document.getElementById('customerSelect').value = docRef.id;
        handleCustomerSelect({ target: { value: docRef.id } });
        
        showSuccess('Customer added successfully');
    } catch (error) {
        console.error('Error saving customer:', error);
        showError('Failed to save customer.');
    }
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.add('hidden');
}

function showItemModal() {
    const modal = document.getElementById('itemModal');
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Add Item</h3>
            <div class="space-y-6">
                <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium text-gray-700">Select Item</label>
                        <select id="itemSelect" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                            <option value="">Select an item</option>
                            ${items.map(item => `
                                <option value="${item.id}">${item.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Quantity</label>
                        <input type="number" id="itemQuantity" min="1" value="1" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Rate (₹)</label>
                        <input type="number" id="itemRate" step="0.01" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Discount (%)</label>
                        <input type="number" id="itemDiscount" min="0" max="100" value="0" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">GST Rate (%)</label>
                        <input type="number" id="itemGst" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">UOM</label>
                        <input type="text" id="itemUom" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" value="PCS" readonly>
                    </div>
                </div>
                <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div class="text-gray-600">Base Amount:</div>
                        <div id="previewBaseAmount" class="text-right">₹0.00</div>
                        <div class="text-gray-600">Discount Amount:</div>
                        <div id="previewDiscountAmount" class="text-right">₹0.00</div>
                        <div class="text-gray-600">GST Amount:</div>
                        <div id="previewGstAmount" class="text-right">₹0.00</div>
                        <div class="font-medium text-gray-700">Final Amount:</div>
                        <div id="previewFinalAmount" class="text-right font-medium">₹0.00</div>
                    </div>
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeItemModal()" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="button" onclick="addItemToInvoice()" class="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                        Add Item
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    
    // Set up event listeners
    const itemSelect = document.getElementById('itemSelect');
    const quantityInput = document.getElementById('itemQuantity');
    const rateInput = document.getElementById('itemRate');
    const discountInput = document.getElementById('itemDiscount');
    
    // Add change handler for item selection with immediate calculation
    itemSelect.addEventListener('change', (event) => {
        const itemId = event.target.value;
        if (!itemId) {
            // Clear all fields if no item selected
            document.getElementById('itemRate').value = '';
            document.getElementById('itemGst').value = '';
            document.getElementById('itemUom').value = 'PCS';
            document.getElementById('itemQuantity').value = '1';
            document.getElementById('itemDiscount').value = '0';
            updateItemCalculations();
            return;
        }
        
        const selectedItem = items.find(i => i.id === itemId);
        if (selectedItem) {
            // Set values from master item
            document.getElementById('itemRate').value = selectedItem.rate || '0';
            document.getElementById('itemGst').value = selectedItem.gstRate || '0';
            document.getElementById('itemUom').value = selectedItem.uom || 'PCS';
            document.getElementById('itemQuantity').value = '1';
            document.getElementById('itemDiscount').value = '0';
            
            // Calculate preview amounts
            updateItemCalculations();
        }
    });
    
    // Add input handlers for real-time calculations
    ['itemQuantity', 'itemRate', 'itemDiscount', 'itemGst'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                updateItemCalculations();
            });
        }
    });

    // Initial calculation
    updateItemCalculations();
}

function handleItemSelect(event) {
    const itemId = event.target.value;
    if (!itemId) return;
    
    const item = items.find(i => i.id === itemId);
    if (item) {
        // Set rate and GST from master
        document.getElementById('itemRate').value = item.rate || '';
        document.getElementById('itemGst').value = item.gstRate || '';
        
        // Also store the item's HSN code and UOM
        document.getElementById('itemHsnCode').value = item.hsnCode || '';
        document.getElementById('itemUom').value = item.uom || 'PCS';
        
        // Update any dependent calculations
        updateItemCalculations();
    }
}

function updateItemCalculations() {
    // Get input values
    const rate = parseFloat(document.getElementById('itemRate').value) || 0;
    const quantity = parseFloat(document.getElementById('itemQuantity').value) || 0;
    const gstRate = parseFloat(document.getElementById('itemGst').value) || 0;
    const discountPercent = parseFloat(document.getElementById('itemDiscount').value) || 0;
    const isExclusive = document.getElementById('gstOption').value === 'exclusive';
    
    // Calculate base amount
    const baseAmount = rate * quantity;
    
    // Calculate discount
    const discountAmount = (baseAmount * discountPercent) / 100;
    const amountAfterDiscount = baseAmount - discountAmount;
    
    // Calculate GST based on option
    let gstAmount;
    let finalAmount;
    
    if (isExclusive) {
        // GST is added on top of discounted amount
        gstAmount = (amountAfterDiscount * gstRate) / 100;
        finalAmount = amountAfterDiscount + gstAmount;
    } else {
        // GST is included in the amount
        gstAmount = amountAfterDiscount - (amountAfterDiscount * 100 / (100 + gstRate));
        finalAmount = amountAfterDiscount;
    }
    
    // Update preview elements
    const elements = {
        baseAmount: document.getElementById('previewBaseAmount'),
        discountAmount: document.getElementById('previewDiscountAmount'),
        gstAmount: document.getElementById('previewGstAmount'),
        finalAmount: document.getElementById('previewFinalAmount')
    };
    
    if (elements.baseAmount) elements.baseAmount.textContent = `₹${baseAmount.toFixed(2)}`;
    if (elements.discountAmount) elements.discountAmount.textContent = `₹${discountAmount.toFixed(2)}`;
    if (elements.gstAmount) elements.gstAmount.textContent = `₹${gstAmount.toFixed(2)}`;
    if (elements.finalAmount) elements.finalAmount.textContent = `₹${finalAmount.toFixed(2)}`;
    
    return {
        baseAmount,
        discountAmount,
        amountAfterDiscount,
        gstAmount,
        finalAmount,
        gstRate
    };
}

function addItemToInvoice() {
    // Get form values
    const itemSelect = document.getElementById('itemSelect');
    const itemId = itemSelect.value;
    
    // Validate selection
    if (!itemId) {
        showError('Please select an item');
        return;
    }

    const selectedItem = items.find(i => i.id === itemId);
    if (!selectedItem) {
        showError('Selected item not found');
        return;
    }

    // Get input values
    const quantity = parseFloat(document.getElementById('itemQuantity').value) || 0;
    const rate = parseFloat(document.getElementById('itemRate').value) || 0;
    const gstRate = parseFloat(document.getElementById('itemGst').value) || 0;
    const discountPercent = parseFloat(document.getElementById('itemDiscount').value) || 0;
    const uom = document.getElementById('itemUom').value || 'PCS';

    // Validate inputs
    if (quantity <= 0 || rate <= 0) {
        showError('Please enter valid quantity and rate');
        return;
    }

    // Calculate amounts
    const baseAmount = quantity * rate;
    const discountAmount = (baseAmount * discountPercent) / 100;
    const amountAfterDiscount = baseAmount - discountAmount;
    
    // Calculate GST based on option
    const isExclusive = document.getElementById('gstOption').value === 'exclusive';
    let gstAmount;
    let finalAmount;
    
    if (isExclusive) {
        // GST is added on top of discounted amount
        gstAmount = (amountAfterDiscount * gstRate) / 100;
        finalAmount = amountAfterDiscount + gstAmount;
    } else {
        // GST is included in the amount
        gstAmount = amountAfterDiscount - (amountAfterDiscount * 100 / (100 + gstRate));
        finalAmount = amountAfterDiscount;
    }

    // Create new row
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            ${selectedItem.name}
            <input type="hidden" class="item-id" value="${selectedItem.id}">
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${uom}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <input type="number" class="quantity-input w-20 border-gray-300 rounded-md shadow-sm" value="${quantity}" min="1">
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <input type="number" class="rate-input w-24 border-gray-300 rounded-md shadow-sm" value="${rate}" min="0" step="0.01">
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <input type="number" class="discount-input w-20 border-gray-300 rounded-md shadow-sm" value="${discountPercent}" min="0" max="100">
            <span class="discount-amount ml-2">₹${discountAmount.toFixed(2)}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${gstRate}%
            <input type="hidden" class="gst-rate" value="${gstRate}">
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 item-amount">
            ₹${finalAmount.toFixed(2)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <button type="button" onclick="removeItem(this)" class="text-red-600 hover:text-red-900">Remove</button>
        </td>
    `;

    // Add row to table
    document.getElementById('itemsTableBody').appendChild(row);

    // Add event listeners for real-time updates
    const inputs = row.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            calculateItemAmount(row);
            recalculateTotals();
        });
    });

    // Update totals and close modal
    recalculateTotals();
    closeItemModal();

    // Clear the modal inputs for next use
    document.getElementById('itemSelect').value = '';
    document.getElementById('itemQuantity').value = '1';
    document.getElementById('itemRate').value = '';
    document.getElementById('itemGst').value = '';
    document.getElementById('itemDiscount').value = '0';
    document.getElementById('itemUom').value = 'PCS';
}

function calculateGst(amount, gstRate, isExclusive) {
    if (isExclusive) {
        // For GST exclusive: Calculate GST on top of amount
        return (amount * gstRate) / 100;
    } else {
        // For GST inclusive: Extract GST from amount
        return amount - (amount * 100 / (100 + gstRate));
    }
}

function calculateItemAmount(row) {
    const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
    const rate = parseFloat(row.querySelector('.rate-input').value) || 0;
    const discountPercent = parseFloat(row.querySelector('.discount-input').value) || 0;
    const gstRate = parseFloat(row.querySelector('.gst-rate').value) || 0;
    const isExclusive = document.getElementById('gstOption').value === 'exclusive';
    
    // Calculate base amount
    const baseAmount = quantity * rate;
    
    // Calculate discount
    const discountAmount = (baseAmount * discountPercent) / 100;
    const amountAfterDiscount = baseAmount - discountAmount;
    
    // Calculate GST based on option
    let gstAmount;
    let finalAmount;
    
    if (isExclusive) {
        // GST is added on top of discounted amount
        gstAmount = (amountAfterDiscount * gstRate) / 100;
        finalAmount = amountAfterDiscount + gstAmount;
    } else {
        // GST is included in the amount
        gstAmount = amountAfterDiscount - (amountAfterDiscount * 100 / (100 + gstRate));
        finalAmount = amountAfterDiscount;
    }
    
    // Update displays
    row.querySelector('.discount-amount').textContent = `₹${discountAmount.toFixed(2)}`;
    row.querySelector('.item-amount').textContent = `₹${finalAmount.toFixed(2)}`;
    
    return {
        baseAmount,
        discountAmount,
        amountAfterDiscount,
        gstAmount,
        finalAmount,
        gstRate
    };
}

function updateItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';
    
    currentInvoice.items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.uom}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <input type="number" class="quantity-input w-20 border-gray-300 rounded-md shadow-sm" value="${item.quantity}" min="1">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <input type="number" class="rate-input w-24 border-gray-300 rounded-md shadow-sm" value="${item.rate}" min="0" step="0.01">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <input type="number" class="discount-input w-20 border-gray-300 rounded-md shadow-sm" value="${item.discountPercent}" min="0" max="100">
                <span class="discount-amount">₹${item.discountAmount.toFixed(2)}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${item.gstRate}%
                <input type="hidden" class="gst-rate" value="${item.gstRate}">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 item-amount">₹${item.amount.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="removeItem(${index})" class="text-red-600 hover:text-red-900">Remove</button>
            </td>
        `;
        tbody.appendChild(row);

        // Add event listeners for real-time updates
        const inputs = row.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                calculateItemAmount(row);
                recalculateTotals();
            });
        });
    });
}

function removeItem(button) {
    const row = button.closest('tr');
    row.remove();
    recalculateTotals();
}

let sellerState = '';

// Load seller state on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const sellerDoc = await db.collection('settings').doc('seller').get();
        if (sellerDoc.exists) {
            sellerState = sellerDoc.data().state;
        }
    } catch (error) {
        console.error('Error loading seller state:', error);
    }
});

function recalculateTotals() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    const isExclusive = document.getElementById('gstOption').value === 'exclusive';
    
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    
    // Get customer state
    const customerId = document.getElementById('customerSelect').value;
    const customer = customers.find(c => c.id === customerId);
    const customerState = customer?.billingState;
    
    // Process each row
    rows.forEach(row => {
        const amounts = calculateItemAmount(row);
        
        // Add to subtotal based on GST option
        if (isExclusive) {
            // For exclusive GST, subtotal is amount before GST
            subtotal += amounts.amountAfterDiscount;
        } else {
            // For inclusive GST, subtotal is amount after removing GST
            subtotal += amounts.finalAmount - amounts.gstAmount;
        }
        
        // Split GST based on states
        if (customerState && sellerState && customerState === sellerState) {
            // Intra-state: Split GST into CGST & SGST
            const halfGst = amounts.gstAmount / 2;
            totalCgst += halfGst;
            totalSgst += halfGst;
        } else {
            // Inter-state: Full amount as IGST
            totalIgst += amounts.gstAmount;
        }
    });
    
    // Calculate round off
    const totalBeforeRound = subtotal + totalCgst + totalSgst + totalIgst;
    const roundedTotal = Math.round(totalBeforeRound);
    const roundOff = roundedTotal - totalBeforeRound;
    
    // Update display
    document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('cgst').textContent = `₹${totalCgst.toFixed(2)}`;
    document.getElementById('sgst').textContent = `₹${totalSgst.toFixed(2)}`;
    document.getElementById('igst').textContent = `₹${totalIgst.toFixed(2)}`;
    document.getElementById('roundOff').textContent = `₹${roundOff.toFixed(2)}`;
    document.getElementById('total').textContent = `₹${roundedTotal.toFixed(2)}`;
    document.getElementById('amountInWords').textContent = `Amount in words: ${numberToWords(roundedTotal)} Rupees Only`;
    
    // Update current invoice totals
    currentInvoice.totals = {
        subtotal,
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        roundOff,
        total: roundedTotal,
        amountInWords: numberToWords(roundedTotal)
    };
}

function closeItemModal() {
    document.getElementById('itemModal').classList.add('hidden');
}


function numberToWords(number) {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    function convertLessThanThousand(n) {
        if (n === 0) return '';
        
        if (n < 20) return units[n];
        
        if (n < 100) {
            return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
        }
        
        return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertLessThanThousand(n % 100) : '');
    }
    
    if (number === 0) return 'Zero';
    
    const wholePart = Math.floor(number);
    const decimalPart = Math.round((number - wholePart) * 100);
    
    let result = '';
    
    if (wholePart > 0) {
        const crores = Math.floor(wholePart / 10000000);
        const lakhs = Math.floor((wholePart % 10000000) / 100000);
        const thousands = Math.floor((wholePart % 100000) / 1000);
        const remainder = wholePart % 1000;
        
        if (crores > 0) {
            result += convertLessThanThousand(crores) + ' Crore ';
        }
        
        if (lakhs > 0) {
            result += convertLessThanThousand(lakhs) + ' Lakh ';
        }
        
        if (thousands > 0) {
            result += convertLessThanThousand(thousands) + ' Thousand ';
        }
        
        if (remainder > 0) {
            result += convertLessThanThousand(remainder);
        }
    }
    
    if (decimalPart > 0) {
        result += ' and ' + convertLessThanThousand(decimalPart) + ' Paise';
    }
    
    return result.trim();
}

async function generateInvoiceNumber() {
    try {
        const sellerDoc = await db.collection('settings').doc('seller').get();
        const sellerData = sellerDoc.exists ? sellerDoc.data() : {};
        
        const prefix = sellerData.invoicePrefix || '';
        const nextNumber = sellerData.nextInvoiceNumber || 1;
        const padding = sellerData.invoicePadding || 3;
        
        // Generate padded number
        const paddedNumber = nextNumber.toString().padStart(padding, '0');
        const invoiceNumber = `${prefix}${paddedNumber}`;
        
        // Update next invoice number
        await db.collection('settings').doc('seller').update({
            nextInvoiceNumber: nextNumber + 1
        });
        
        // Display the generated invoice number
        document.getElementById('invoiceNumber').value = invoiceNumber;
        
        return invoiceNumber;
    } catch (error) {
        console.error('Error generating invoice number:', error);
        throw new Error('Failed to generate invoice number');
    }
}

async function saveInvoice() {
    try {
        const customerId = document.getElementById('customerSelect').value;
        if (!customerId) {
            showError('Please select a customer');
            return;
        }
        
        if (currentInvoice.items.length === 0) {
            showError('Please add at least one item');
            return;
        }

        const db = firebase.firestore();
        
        // Get seller settings
        const sellerDoc = await db.collection('settings').doc('seller').get();
        const sellerData = sellerDoc.exists ? sellerDoc.data() : {};
        
    const invoiceData = {
        invoiceNumber: document.getElementById('invoiceNumber').value,
        date: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('invoiceDate').value)),
        customerId,
        customerName: customers.find(c => c.id === customerId)?.name,
        items: Array.from(document.querySelectorAll('#itemsTableBody tr')).map(row => ({
            itemId: row.querySelector('.item-id').value,
            name: row.querySelector('td:nth-child(1)').textContent.trim(),
            uom: row.querySelector('td:nth-child(2)').textContent.trim(),
            quantity: parseFloat(row.querySelector('.quantity-input').value) || 0,
            rate: parseFloat(row.querySelector('.rate-input').value) || 0,
            discountPercent: parseFloat(row.querySelector('.discount-input').value) || 0,
            discountAmount: parseFloat(row.querySelector('.discount-amount').textContent.replace('₹', '')) || 0,
            gstRate: parseFloat(row.querySelector('td:nth-child(6)').textContent.replace('%', '')) || 0,
            amount: parseFloat(row.querySelector('.item-amount').textContent.replace('₹', '')) || 0
        })),
        totals: {
            ...currentInvoice.totals,
            roundOff: parseFloat(document.getElementById('roundOff').textContent.replace('₹', '')) || 0,
            amountInWords: document.getElementById('amountInWords').textContent.replace('Amount in words: ', '')
        },
        bankDetails: document.getElementById('bankDetails').value || 'NA',
        transportDetails: document.getElementById('transportDetails').value || 'NA',
        termsConditions: document.getElementById('termsConditions').value,
        seller: {
            name: sellerData.name || '',
            addressLine1: sellerData.addressLine1 || '',
            addressLine2: sellerData.addressLine2 || '',
            state: sellerData.state || '',
            pincode: sellerData.pincode || '',
            phone: sellerData.phone || '',
            email: sellerData.email || '',
            gst: sellerData.gst || ''
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: firebase.auth().currentUser.uid,
        status: 'active'
        };
        await db.collection('invoices').add(invoiceData);
        
        // Show success message and redirect to invoice list
        alert('Invoice saved successfully!');
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error('Error saving invoice:', error);
        showError('Failed to save invoice.');
    }
}

function previewInvoice() {
    // Implementation for preview functionality
    // This could open a new window with the invoice preview
    // or show a modal with the preview
}

document.getElementById('exportPdfBtn').addEventListener('click', exportInvoiceToPDF);

function exportInvoiceToPDF() {
    import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(({ jsPDF }) => {
        const doc = new jsPDF.jsPDF();

        // Simple PDF export example: export invoice number and totals
        doc.setFontSize(16);
        doc.text(`Invoice Number: ${document.getElementById('invoiceNumber').value}`, 10, 20);
        doc.text(`Date: ${document.getElementById('invoiceDate').value}`, 10, 30);
        doc.text(`Customer: ${document.getElementById('customerSelect').selectedOptions[0]?.text || ''}`, 10, 40);

        doc.text('Items:', 10, 50);
        let y = 60;
        currentInvoice.items.forEach(item => {
            doc.text(`${item.name} - Qty: ${item.quantity} - Rate: ₹${item.rate.toFixed(2)} - Amount: ₹${item.amount.toFixed(2)}`, 10, y);
            y += 10;
        });

        doc.text(`Subtotal: ₹${currentInvoice.totals.subtotal.toFixed(2)}`, 10, y + 10);
        doc.text(`CGST: ₹${currentInvoice.totals.cgst.toFixed(2)}`, 10, y + 20);
        doc.text(`SGST: ₹${currentInvoice.totals.sgst.toFixed(2)}`, 10, y + 30);
        doc.text(`IGST: ₹${currentInvoice.totals.igst.toFixed(2)}`, 10, y + 40);
        doc.text(`Total: ₹${currentInvoice.totals.total.toFixed(2)}`, 10, y + 50);

        doc.save(`Invoice_${document.getElementById('invoiceNumber').value}.pdf`);
    }).catch(error => {
        console.error('Error loading jsPDF:', error);
        showError('Failed to export PDF.');
    });
}


async function loadExistingInvoice(invoiceId) {
    try {
        const db = firebase.firestore();
        const doc = await db.collection('invoices').doc(invoiceId).get();
        
        if (!doc.exists) {
            showError('Invoice not found');
            return;
        }
        
        const invoice = doc.data();
        
        // Populate form fields
        document.getElementById('invoiceNumber').value = invoice.invoiceNumber;
        document.getElementById('invoiceDate').valueAsDate = invoice.date.toDate();
        document.getElementById('customerSelect').value = invoice.customerId;
        document.getElementById('placeOfSupply').value = invoice.placeOfSupply;
        document.getElementById('bankDetails').value = invoice.bankDetails;
        document.getElementById('transportDetails').value = invoice.transportDetails;
        document.getElementById('termsConditions').value = invoice.termsConditions;
        document.getElementById('logoUrl').value = invoice.logoUrl;
        document.getElementById('signatureUrl').value = invoice.signatureUrl;
        
        // Update customer details
        handleCustomerSelect({ target: { value: invoice.customerId } });
        
        // Load items
        currentInvoice.items = invoice.items;
        updateItemsTable();
        calculateTotals();
        
        // Update previews
        updateLogoPreview();
        updateSignaturePreview();
        
    } catch (error) {
        console.error('Error loading invoice:', error);
        showError('Failed to load invoice.');
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

/*
To set up Firebase:
1. Go to Firebase Console (https://console.firebase.google.com/)
2. Create a new project
3. Add a web app to your project
4. Copy your Firebase configuration (from Project Settings > General > Your Apps)
5. Replace the configuration below with your own
6. Enable Email/Password authentication in Authentication > Sign-in method
7. Create your first admin user in Authentication > Users
8. Set up Firestore Database in test mode
*/

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4q7POvbezvxjC0Q6AIxsneH_cD6y34Xo",
  authDomain: "sample-firebase-ai-app-5f020.firebaseapp.com",
  projectId: "sample-firebase-ai-app-5f020",
  storageBucket: "sample-firebase-ai-app-5f020.firebasestorage.app",
  messagingSenderId: "996774519658",
  appId: "1:996774519658:web:633d157bdedce5bb653b13"
};

// Initialize Firebase with error handling
try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
    // Show user-friendly error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded';
    errorDiv.innerHTML = `
        <strong class="font-bold">Firebase Error!</strong>
        <span class="block sm:inline"> Please check your Firebase configuration.</span>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Authentication state observer with error handling
auth.onAuthStateChanged((user) => {
    try {
        if (user) {
            // User is signed in
            console.log('User is signed in:', user.email);
            
            // Store user info in localStorage for quick access
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userId', user.uid);
            
            // Redirect if on login page
            if (window.location.pathname.includes('login.html')) {
                window.location.href = 'index.html';
            }
        } else {
            // User is signed out
            console.log('User is signed out');
            
            // Clear user info from localStorage
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userId');
            
            // Redirect to login if not already there
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }
    } catch (error) {
        console.error('Auth state change error:', error);
        showError('Authentication error. Please refresh the page.');
    }
});

// Helper function to show errors
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

// Helper function to show success messages
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

// Add global error handling for Firebase operations
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason.code) {
        // This is likely a Firebase error
        let errorMessage = 'An error occurred.';
        switch (event.reason.code) {
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled. Please contact support.';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection.';
                break;
            case 'permission-denied':
                errorMessage = 'You do not have permission to perform this action.';
                break;
        }
        showError(errorMessage);
    }
});

// Export auth and db for use in other files
window.auth = auth;
window.db = db;
window.showError = showError;
window.showSuccess = showSuccess;

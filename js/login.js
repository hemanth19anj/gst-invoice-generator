document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // Function to show error message
    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    };

    // Function to hide error message
    const hideError = () => {
        errorMessage.classList.add('hidden');
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            // Add loading state to button
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = `
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
            `;
            submitButton.disabled = true;

            // Attempt to sign in
            await firebase.auth().signInWithEmailAndPassword(username, password);
            
            // If successful, redirect to dashboard
            window.location.href = 'index.html';
        } catch (error) {
            // Reset button state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.innerHTML = 'Sign in';
            submitButton.disabled = false;

            // Show appropriate error message
            switch (error.code) {
                case 'auth/invalid-email':
                    showError('Please enter a valid email address.');
                    break;
                case 'auth/user-disabled':
                    showError('This account has been disabled. Please contact support.');
                    break;
                case 'auth/user-not-found':
                    showError('No account found with this email.');
                    break;
                case 'auth/wrong-password':
                    showError('Incorrect password. Please try again.');
                    break;
                default:
                    showError('An error occurred. Please try again.');
                    console.error('Login error:', error);
            }
        }
    });

    // Clear error when user starts typing
    document.getElementById('username').addEventListener('input', hideError);
    document.getElementById('password').addEventListener('input', hideError);
});

// Check if user is already logged in
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        window.location.href = 'index.html';
    }
});

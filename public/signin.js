document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();

    if (location.hostname === "localhost") {
        auth.useEmulator('http://localhost:9099');
    }

    const googleProvider = new firebase.auth.GoogleAuthProvider();
    let recaptchaVerifier;
    let confirmationResult;

    const phoneInput = document.getElementById('phone-number');
    const phoneSignInButton = document.getElementById('phone-sign-in');
    const recaptchaContainer = document.getElementById('recaptcha-container');

    // Set up reCAPTCHA verifier
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': (response) => {
            phoneSignInButton.disabled = false;
        },
        'expired-callback': () => {
            phoneSignInButton.disabled = true;
        }
    });

    // Google Sign-In
    document.getElementById('google-sign-in').addEventListener('click', () => {
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                console.log('User signed in:', result.user);
                window.location.href = 'app.html'; // Redirect to main app
            }).catch((error) => {
                console.error('Error during Google sign-in:', error);
                showError('Error during Google sign-in: ' + error.message);
            });
    });

    // Show reCAPTCHA when phone number is valid
    phoneInput.addEventListener('input', function() {
        if (validatePhoneNumber(this.value)) {
            recaptchaContainer.classList.add('visible');
            if (!window.recaptchaWidgetId) {
                recaptchaVerifier.render().then((widgetId) => {
                    window.recaptchaWidgetId = widgetId;
                });
            }
        } else {
            recaptchaContainer.classList.remove('visible');
            phoneSignInButton.disabled = true;
        }
    });

    // Phone Number Sign-In
    phoneSignInButton.addEventListener('click', () => {
        const phoneNumber = phoneInput.value;
        if (!validatePhoneNumber(phoneNumber)) {
            showError('Please enter a valid phone number.');
            return;
        }
        
        const formattedPhoneNumber = '+1' + phoneNumber; // Assuming US numbers, adjust as needed
        
        auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier)
            .then((result) => {
                confirmationResult = result;
                document.getElementById('verification-code-container').classList.remove('hidden');
                document.getElementById('phone-signin-container').classList.add('hidden');
                showSuccess('Verification code sent!');
            }).catch((error) => {
                console.error('Error during phone number sign-in:', error);
                showError('Error during phone number sign-in: ' + error.message);
            });
    });

    // Verify Code
    document.getElementById('verify-code').addEventListener('click', () => {
        const code = document.getElementById('verification-code').value;
        confirmationResult.confirm(code).then((result) => {
            const user = result.user;
            console.log('User signed in:', user);
            window.location.href = 'app.html'; // Redirect to main app
        }).catch((error) => {
            console.error('Error during code verification:', error);
            showError('Error during code verification: ' + error.message);
        });
    });
});

function validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^\d{10}$/; // Assumes 10-digit US phone numbers
    return phoneRegex.test(phoneNumber);
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successElement = document.getElementById('success-message');
    successElement.textContent = message;
    successElement.style.display = 'block';
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 5000);
}
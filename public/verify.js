document.addEventListener('DOMContentLoaded', () => {
    const verifyCodeButton = document.getElementById('verify-code-button');
    const verificationCodeInput = document.getElementById('verification-code');

    verifyCodeButton.addEventListener('click', () => {
        const code = verificationCodeInput.value;

        window.confirmationResult.confirm(code)
            .then(async result => {
                const user = result.user;
                const userRef = db.collection('users').doc(user.uid);
                const userDoc = await userRef.get();
                if (!userDoc.exists()) {
                    // User does not exist, create new user
                    await userRef.set({
                        uid: user.uid,
                        phoneNumber: user.phoneNumber
                    });
                }
                window.location.href = 'app.html'; // Redirect to main application
            })
            .catch(error => {
                console.error('Error verifying code:', error);
            });
    });
});

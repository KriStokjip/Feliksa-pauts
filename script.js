        document.getElementById('signupForm').addEventListener('submit', function (event) {
            event.preventDefault();

            let username = document.getElementById('username').value;
            let email = document.getElementById('email').value;
            let password = document.getElementById('password').value;
            let confirmPassword = document.getElementById('confirmPassword').value;
            let message = document.getElementById('message');
            let passwordError = document.getElementById('passwordError');
            let confirmPasswordError = document.getElementById('confirmPasswordError');

            let passwordValid = validatePassword(password);
            if (!passwordValid) {
                passwordError.textContent = 'Password does not meet the requirements.';
                return;
            } else {
                passwordError.textContent = '';
            }

            if (password !== confirmPassword) {
                confirmPasswordError.textContent = 'Passwords do not match!';
                return;
            } else {
                confirmPasswordError.textContent = '';
            }

            // Here you can add code to send the form data to the server

            message.style.color = 'green';
            message.textContent = 'Signup successful!';
        });

        document.getElementById('password').addEventListener('focus', function () {
            document.getElementById('passwordHint').style.display = 'block';
        });

        document.getElementById('password').addEventListener('blur', function () {
            document.getElementById('passwordHint').style.display = 'none';
        });

        document.getElementById('password').addEventListener('input', function () {
            let password = this.value;
            let passwordStrength = document.getElementById('passwordStrength');
            let strength = getPasswordStrength(password);

            passwordStrength.innerHTML = ''; // Clear previous strength bars
            if (strength) {
                let strengthBar = document.createElement('div');
                strengthBar.className = strength;
                passwordStrength.appendChild(strengthBar);
            }
        });

        function validatePassword(password) {
            let regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            return regex.test(password);
        }

        function getPasswordStrength(password) {
            if (password.length < 8) {
                return 'weak';
            }
            if (password.match(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)) {
                return 'strong';
            }
            return 'medium';
        }

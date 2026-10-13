document.getElementById("register").addEventListener("submit", function (event) {
event.preventDefault();

```
const username = document.getElementById("username").value.trim();
const email = document.getElementById("email").value.trim();
const password = document.getElementById("password").value;
const confirmPassword = document.getElementById("confirmPassword").value;

const message = document.getElementById("message");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");

passwordError.textContent = "";
confirmPasswordError.textContent = "";
message.textContent = "";

// Check password
if (!validatePassword(password)) {
    passwordError.textContent =
        "Password must contain at least 8 characters, uppercase, lowercase, number and special character.";
    return;
}

// Check passwords match
if (password !== confirmPassword) {
    confirmPasswordError.textContent = "Passwords do not match!";
    return;
}

// Check if username already exists
const existingUser = localStorage.getItem("user");

if (existingUser) {
    const user = JSON.parse(existingUser);

    if (user.username.toLowerCase() === username.toLowerCase()) {
        message.style.color = "red";
        message.textContent = "This username is already registered.";
        return;
    }
}

// Save account
const user = {
    username: username,
    email: email,
    password: password
};

localStorage.setItem("user", JSON.stringify(user));

message.style.color = "green";
message.textContent = "Registration successful!";

// Clear form
document.getElementById("register").reset();

// Go to login after a short delay
setTimeout(function () {
    window.location.href = "login.html";
}, 1500);
```

});

// Show password hint
document.getElementById("password").addEventListener("focus", function () {
document.getElementById("passwordHint").style.display = "block";
});

// Hide password hint
document.getElementById("password").addEventListener("blur", function () {
document.getElementById("passwordHint").style.display = "none";
});

// Password strength
document.getElementById("password").addEventListener("input", function () {

```
const password = this.value;
const passwordStrength = document.getElementById("passwordStrength");

passwordStrength.innerHTML = "";

const strength = getPasswordStrength(password);

if (strength) {
    const strengthBar = document.createElement("div");

    strengthBar.className = strength;

    passwordStrength.appendChild(strengthBar);
}
```

});

// Validate password
function validatePassword(password) {

```
const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

return regex.test(password);
```

}

// Password strength
function getPasswordStrength(password) {

```
if (password.length === 0) {
    return "";
}

if (password.length < 8) {
    return "weak";
}

if (
    password.match(
        /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/
    )
) {
    return "strong";
}

return "medium";
```

}

document.getElementById("loginForm").addEventListener("submit", function (event) {
event.preventDefault();

```
const username = document.getElementById("loginUsername").value.trim();
const password = document.getElementById("loginPassword").value;

const message = document.getElementById("loginMessage");

// Get saved user
const savedUser = localStorage.getItem("user");

// No account registered
if (!savedUser) {
    message.style.color = "red";
    message.textContent = "No account found. Please register first.";
    return;
}

const user = JSON.parse(savedUser);

// Check login
if (
    username.toLowerCase() === user.username.toLowerCase() &&
    password === user.password
) {

    message.style.color = "green";
    message.textContent = "Login successful!";

    // Save logged-in state
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("currentUser", user.username);

    // Change this to the page you want after login
    setTimeout(function () {
        window.location.href = "game.html";
    }, 1000);

} else {

    message.style.color = "red";
    message.textContent = "Incorrect username or password.";
}
```

});

const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000"
        : "https://YOUR-RENDER-BACKEND.onrender.com";

const button = document.getElementById("googleLogin");

button.addEventListener("click", () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
});
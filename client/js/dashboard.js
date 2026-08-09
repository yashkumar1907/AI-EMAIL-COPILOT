// ==================================================
// API / CLIENT URL
// ==================================================

const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000"
        : "https://YOUR-RENDER-BACKEND.onrender.com";

const CLIENT_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? `${window.location.origin}/client`
        : "https://YOUR-FRONTEND-URL";


// ==================================================
// DOM ELEMENTS
// ==================================================

const emailList = document.getElementById("emailList");
const emailSubject = document.getElementById("emailSubject");
const emailFrom = document.getElementById("emailFrom");
const emailDate = document.getElementById("emailDate");
const emailBody = document.getElementById("emailBody");

const replyBtn = document.getElementById("replyBtn");
const replySection = document.getElementById("replySection");
const replyText = document.getElementById("replyText");
const sendReplyBtn = document.getElementById("sendReplyBtn");

const toast = document.getElementById("toast");

const closeReply = document.getElementById("closeReply");
const cancelReply = document.getElementById("cancelReply");

const profileImage = document.getElementById("profileImage");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");

const searchInput = document.getElementById("searchInput");
const emailCount = document.getElementById("emailCount");

const composeBtn = document.getElementById("composeBtn");
const composeModal = document.getElementById("composeModal");
const closeCompose = document.getElementById("closeCompose");

const composeTo = document.getElementById("composeTo");
const composeSubject = document.getElementById("composeSubject");
const composePrompt = document.getElementById("composePrompt");
const composeBody = document.getElementById("composeBody");

const generateComposeBtn =
    document.getElementById("generateComposeBtn");

const sendComposeBtn =
    document.getElementById("sendComposeBtn");

const summarizeEmailBtn =
    document.getElementById("summarizeEmailBtn");

const draftReplyBtn =
    document.getElementById("draftReplyBtn");

const translateEmailBtn =
    document.getElementById("translateEmailBtn");

const improveToneBtn =
    document.getElementById("improveToneBtn");

const toneSelect =
    document.getElementById("toneSelect");

const summaryText =
    document.getElementById("summaryText");

const actionItems =
    document.getElementById("actionItems");

const replySuggestion =
    document.getElementById("replySuggestion");

const translationResult =
    document.getElementById("translationResult");

const toneResult =
    document.getElementById("toneResult");

const aiLoading =
    document.getElementById("aiLoading");

const logoutBtn =
    document.getElementById("logoutBtn");

const copyReplyBtn =
    document.getElementById("copyReplyBtn");


// ==================================================
// STATE
// ==================================================

let currentEmail = null;
let allEmails = [];


// ==================================================
// TOAST
// ==================================================

let toastTimeout;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


// ==================================================
// AI LOADING
// ==================================================

function showAIThinking() {
    aiLoading.style.display = "block";
}

function hideAIThinking() {
    aiLoading.style.display = "none";
}


// ==================================================
// AUTHENTICATION CHECK
// ==================================================

async function checkAuthentication() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/auth/login/success`,
            {
                credentials: "include",
            }
        );

        if (!response.ok) {
            redirectToLogin();
            return false;
        }

        const data = await response.json();

        if (!data.success) {
            redirectToLogin();
            return false;
        }

        return true;
    } catch (error) {
        console.error("Authentication check failed:", error);
        redirectToLogin();
        return false;
    }
}

function redirectToLogin() {
    window.location.replace(
        `${CLIENT_BASE_URL}/login.html`
    );
}


// ==================================================
// API HELPER
// ==================================================

async function callAI(endpoint, body) {
    showAIThinking();

    try {
        const response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            }
        );

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error("Invalid server response.");
        }

        if (!response.ok || !data.success) {
            showToast(
                `❌ ${data.message || "AI request failed"}`
            );

            return null;
        }

        return data;
    } catch (error) {
        console.error("AI request error:", error);

        showToast("❌ Unable to connect to AI service.");

        return null;
    } finally {
        hideAIThinking();
    }
}


// ==================================================
// SAFE TEXT OUTPUT
// ==================================================

function setAIResult(element, text) {
    element.textContent =
        text || "No result generated.";
}


// ==================================================
// BASE64URL DECODER
// ==================================================

function decodeBase64Url(data) {
    if (!data) {
        return "";
    }

    try {
        const base64 = data
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const padded =
            base64 + "=".repeat(
                (4 - (base64.length % 4)) % 4
            );

        const binary = atob(padded);

        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new TextDecoder("utf-8").decode(bytes);
    } catch (error) {
        console.error("Failed to decode email:", error);
        return "";
    }
}


// ==================================================
// EMAIL BODY EXTRACTION
// ==================================================

function findMimePart(part, mimeType) {
    if (!part) {
        return null;
    }

    if (part.mimeType === mimeType && part.body?.data) {
        return part;
    }

    if (part.parts) {
        for (const child of part.parts) {
            const result = findMimePart(child, mimeType);

            if (result) {
                return result;
            }
        }
    }

    return null;
}


// ==================================================
// BASIC HTML SANITIZATION
// ==================================================

function sanitizeEmailHTML(html) {
    const parser = new DOMParser();

    const documentFragment = parser.parseFromString(
        html,
        "text/html"
    );

    // Remove dangerous elements.
    documentFragment
        .querySelectorAll(
            "script, iframe, object, embed, form, link, meta, style"
        )
        .forEach((element) => element.remove());

    // Remove inline event handlers.
    documentFragment
        .querySelectorAll("*")
        .forEach((element) => {
            [...element.attributes].forEach((attribute) => {
                if (attribute.name.toLowerCase().startsWith("on")) {
                    element.removeAttribute(attribute.name);
                }
            });
        });

    return documentFragment.body.innerHTML;
}


// ==================================================
// SUMMARIZE EMAIL
// ==================================================

async function summarizeEmail() {
    if (!currentEmail) {
        showToast("Select an email first.");
        return;
    }

    setAIResult(summaryText, "✨ Generating summary...");

    const result = await callAI(
        "/ai/summarize",
        {
            email: emailBody.innerText,
        }
    );

    if (!result) {
        setAIResult(summaryText, "Summary failed.");
        return;
    }

    setAIResult(summaryText, result.summary);
}


// ==================================================
// DRAFT REPLY
// ==================================================

async function generateDraftReply() {
    if (!currentEmail) {
        showToast("Select an email first.");
        return;
    }

    setAIResult(
        replySuggestion,
        "✨ Generating AI reply..."
    );

    const result = await callAI(
        "/ai/draft-reply",
        {
            email: emailBody.innerText,
        }
    );

    if (!result) {
        setAIResult(
            replySuggestion,
            "Failed to generate reply."
        );
        return;
    }

    setAIResult(
        replySuggestion,
        result.reply
    );

    replyText.value = result.reply;

    replySection.style.display = "block";
}


// ==================================================
// TRANSLATE EMAIL
// ==================================================

async function translateEmail() {
    if (!currentEmail) {
        showToast("Select an email first.");
        return;
    }

    setAIResult(
        translationResult,
        "🌍 Translating email..."
    );

    const result = await callAI(
        "/ai/translate",
        {
            email: emailBody.innerText,
            language: "Hindi",
        }
    );

    if (!result) {
        setAIResult(
            translationResult,
            "Translation failed."
        );
        return;
    }

    setAIResult(
        translationResult,
        result.translation
    );
}


// ==================================================
// IMPROVE TONE
// ==================================================

async function improveTone() {
    if (!currentEmail) {
        showToast("Select an email first.");
        return;
    }

    setAIResult(
        toneResult,
        "✨ Improving tone..."
    );

    const result = await callAI(
        "/ai/improve-tone",
        {
            email: emailBody.innerText,
            tone: toneSelect.value,
        }
    );

    if (!result) {
        setAIResult(
            toneResult,
            "Failed to improve tone."
        );
        return;
    }

    setAIResult(
        toneResult,
        result.improved
    );
}


// ==================================================
// ACTION ITEMS
// ==================================================

async function extractActionItems() {
    if (!currentEmail) {
        return;
    }

    setAIResult(
        actionItems,
        "🔍 Extracting action items..."
    );

    const result = await callAI(
        "/ai/action-items",
        {
            email: emailBody.innerText,
        }
    );

    if (!result) {
        setAIResult(
            actionItems,
            "Unable to extract action items."
        );
        return;
    }

    setAIResult(
        actionItems,
        result.actions
    );
}


// ==================================================
// AI COMPOSE
// ==================================================

async function generateComposeEmail() {
    if (!composePrompt.value.trim()) {
        showToast("Enter what you want to write.");
        return;
    }

    generateComposeBtn.disabled = true;
    generateComposeBtn.textContent = "Generating...";

    composeBody.value =
        "✨ Generating email...";

    try {
        const result = await callAI(
            "/ai/compose",
            {
                recipient: composeTo.value.trim(),
                subject: composeSubject.value.trim(),
                prompt: composePrompt.value.trim(),
            }
        );

        if (!result) {
            composeBody.value = "";
            return;
        }

        composeBody.value = result.body;
    } finally {
        generateComposeBtn.disabled = false;
        generateComposeBtn.textContent =
            "✨ Generate Email";
    }
}


// ==================================================
// SEND NEW EMAIL
// ==================================================

async function sendComposeEmail() {
    const to = composeTo.value.trim();
    const subject = composeSubject.value.trim();
    const message = composeBody.value.trim();

    if (!to || !subject || !message) {
        showToast("Complete all fields.");
        return;
    }

    sendComposeBtn.disabled = true;
    sendComposeBtn.textContent = "Sending...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/gmail/send`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    to,
                    subject,
                    message,
                }),
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(
                `❌ ${data.message || "Failed to send email"}`
            );
            return;
        }

        showToast("✅ Email sent successfully.");

        closeComposeModal();

        await loadEmails();
    } catch (error) {
        console.error("Send email error:", error);

        showToast("❌ Failed to send email.");
    } finally {
        sendComposeBtn.disabled = false;
        sendComposeBtn.textContent =
            "📤 Send Email";
    }
}


// ==================================================
// PROFILE
// ==================================================

async function loadProfile() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/auth/login/success`,
            {
                credentials: "include",
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            redirectToLogin();
            return;
        }

        profileName.textContent =
            data.user.name || "User";

        profileEmail.textContent =
            data.user.email || "";

        const fallbackImage =
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                data.user.name || "User"
            )}&background=2563eb&color=fff`;

        profileImage.src =
            data.user.profilePicture ||
            fallbackImage;

        profileImage.onerror = () => {
            profileImage.src = fallbackImage;
        };
    } catch (error) {
        console.error(
            "Profile loading error:",
            error
        );

        showToast("❌ Failed to load profile.");
    }
}


// ==================================================
// EMAIL LIST
// ==================================================

async function loadEmails() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/gmail/emails`,
            {
                credentials: "include",
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        if (!response.ok || !data.success) {
            showToast(
                `❌ ${data.message || "Failed to load emails"}`
            );
            return;
        }

        allEmails = data.emails || [];

        emailCount.textContent =
            `${allEmails.length} Emails`;

        renderEmails(allEmails);

        if (allEmails.length > 0) {
            await loadEmail(allEmails[0].id);
        } else {
            showEmptyInbox();
        }
    } catch (error) {
        console.error(
            "Email loading error:",
            error
        );

        showToast("❌ Failed to load emails.");
    }
}


// ==================================================
// RENDER EMAIL LIST
// ==================================================

function renderEmails(emails) {
    emailList.innerHTML = "";

    if (!emails.length) {
        emailList.innerHTML = `
            <div style="padding:20px;text-align:center;color:#6b7280;">
                No emails found.
            </div>
        `;

        return;
    }

    emails.forEach((email) => {
        const div = document.createElement("div");

        div.className = "email";

        if (
            currentEmail &&
            currentEmail.id === email.id
        ) {
            div.classList.add("active");
        }

        const sender =
            email.from?.split("<")[0].trim() ||
            "Unknown";

        const avatar =
            sender.charAt(0).toUpperCase();

        const subject =
            email.subject || "(No Subject)";

        const snippet =
            email.snippet || "";

        const formattedDate =
            email.date
                ? new Date(email.date).toLocaleDateString(
                      "en-IN",
                      {
                          day: "numeric",
                          month: "short",
                      }
                  )
                : "";

        // Build DOM safely instead of inserting
        // Gmail-controlled values through innerHTML.
        const item = document.createElement("div");
        item.className = "email-item";

        const avatarElement =
            document.createElement("div");

        avatarElement.className = "avatar";
        avatarElement.textContent = avatar;

        const info =
            document.createElement("div");

        info.className = "email-info";

        const header =
            document.createElement("div");

        header.className = "email-header";

        const subjectElement =
            document.createElement("h4");

        subjectElement.textContent = subject;

        const timeElement =
            document.createElement("span");

        timeElement.className = "time";
        timeElement.textContent = formattedDate;

        header.appendChild(subjectElement);
        header.appendChild(timeElement);

        const senderElement =
            document.createElement("p");

        senderElement.textContent = sender;

        const snippetElement =
            document.createElement("small");

        snippetElement.textContent =
            snippet.length > 70
                ? `${snippet.substring(0, 70)}...`
                : snippet;

        info.appendChild(header);
        info.appendChild(senderElement);
        info.appendChild(snippetElement);

        item.appendChild(avatarElement);
        item.appendChild(info);

        div.appendChild(item);

        div.addEventListener("click", () => {
            document
                .querySelectorAll(".email")
                .forEach((emailElement) => {
                    emailElement.classList.remove(
                        "active"
                    );
                });

            div.classList.add("active");

            loadEmail(email.id);
        });

        emailList.appendChild(div);
    });
}


// ==================================================
// EMPTY INBOX
// ==================================================

function showEmptyInbox() {
    emailSubject.textContent =
        "No Emails";

    emailFrom.textContent = "";
    emailDate.textContent = "";

    emailBody.textContent =
        "Your inbox is empty.";

    currentEmail = null;
}


// ==================================================
// EMAIL VIEWER
// ==================================================

async function loadEmail(id) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/gmail/email/${id}`,
            {
                credentials: "include",
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        if (!response.ok || !data.success) {
            showToast(
                `❌ ${data.message || "Failed to load email"}`
            );
            return;
        }

        const email = data.email;

        currentEmail = email;

        const headers =
            email.payload?.headers || [];

        const subject =
            headers.find(
                (header) =>
                    header.name.toLowerCase() ===
                    "subject"
            )?.value || "(No Subject)";

        const from =
            headers.find(
                (header) =>
                    header.name.toLowerCase() ===
                    "from"
            )?.value || "";

        const date =
            headers.find(
                (header) =>
                    header.name.toLowerCase() ===
                    "date"
            )?.value || "";

        emailSubject.textContent = subject;
        emailFrom.textContent = from;
        emailDate.textContent = date;

        // Prefer HTML email.
        const htmlPart =
            findMimePart(
                email.payload,
                "text/html"
            );

        // Fall back to plain text.
        const textPart =
            findMimePart(
                email.payload,
                "text/plain"
            );

        let body = "";

        if (htmlPart?.body?.data) {
            body = decodeBase64Url(
                htmlPart.body.data
            );

            emailBody.innerHTML =
                sanitizeEmailHTML(body);
        } else if (textPart?.body?.data) {
            body = decodeBase64Url(
                textPart.body.data
            );

            emailBody.textContent = body;
        } else if (email.payload?.body?.data) {
            body = decodeBase64Url(
                email.payload.body.data
            );

            emailBody.textContent = body;
        } else {
            emailBody.textContent =
                "No readable email content.";
        }

        // Reset AI results.
        setAIResult(
            summaryText,
            "Select 'Summarize' to generate AI summary."
        );

        setAIResult(
            replySuggestion,
            "Generate an AI draft reply."
        );

        setAIResult(
            translationResult,
            "Translate this email."
        );

        setAIResult(
            toneResult,
            "Improve writing style."
        );

        setAIResult(
            actionItems,
            "Extracting action items..."
        );

        replySection.style.display = "none";
        replyText.value = "";

        const sender =
            from.split("<")[0].trim() ||
            "Unknown";

        const senderAvatar =
            document.getElementById("senderAvatar");

        senderAvatar.textContent =
            sender.charAt(0).toUpperCase();

        /*
         * Generate action items only for the
         * currently selected email.
         *
         * We intentionally do not generate
         * action items for all 10 emails during
         * inbox loading because Gemini uses
         * API quota.
         */
        await extractActionItems();
    } catch (error) {
        console.error(
            "Email viewer error:",
            error
        );

        showToast("❌ Failed to open email.");
    }
}


// ==================================================
// REPLY
// ==================================================

async function sendReply() {
    if (!currentEmail) {
        showToast(
            "❌ Please select an email first."
        );
        return;
    }

    const headers =
        currentEmail.payload?.headers || [];

    const to =
        headers.find(
            (header) =>
                header.name.toLowerCase() === "from"
        )?.value || "";

    const subject =
        headers.find(
            (header) =>
                header.name.toLowerCase() === "subject"
        )?.value || "";

    const threadId =
        currentEmail.threadId;

    const message =
        replyText.value.trim();

    if (!message) {
        showToast("✍ Please write a reply.");
        return;
    }

    if (!to || !threadId) {
        showToast(
            "❌ Unable to determine reply details."
        );
        return;
    }

    sendReplyBtn.disabled = true;
    sendReplyBtn.textContent = "Sending...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/gmail/reply`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    threadId,
                    to,
                    subject,
                    message,
                }),
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        if (!response.ok || !data.success) {
            showToast(
                `❌ ${data.message || "Reply failed"}`
            );
            return;
        }

        showToast(
            "✅ Reply sent successfully."
        );

        replyText.value = "";
        replySection.style.display = "none";
    } catch (error) {
        console.error(
            "Reply error:",
            error
        );

        showToast("❌ Reply failed.");
    } finally {
        sendReplyBtn.disabled = false;
        sendReplyBtn.textContent =
            "➜ Send Reply";
    }
}


// ==================================================
// SEARCH
// ==================================================

function searchEmails() {
    const value =
        searchInput.value
            .trim()
            .toLowerCase();

    const filtered =
        allEmails.filter((email) =>
            (email.subject || "")
                .toLowerCase()
                .includes(value) ||

            (email.from || "")
                .toLowerCase()
                .includes(value) ||

            (email.snippet || "")
                .toLowerCase()
                .includes(value)
        );

    renderEmails(filtered);

    emailCount.textContent =
        `${filtered.length} Emails`;
}


// ==================================================
// LOGOUT
// ==================================================

async function logout() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/auth/logout`,
            {
                credentials: "include",
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(
                "❌ Logout failed."
            );
            return;
        }

        // Replace history entry so the user
        // cannot simply navigate back to dashboard.
        window.location.replace(
            `${CLIENT_BASE_URL}/login.html`
        );
    } catch (error) {
        console.error(
            "Logout error:",
            error
        );

        showToast("❌ Logout failed.");
    }
}


// ==================================================
// COPY AI REPLY
// ==================================================

async function copyReply() {
    const text =
        replySuggestion.innerText.trim();

    if (
        !text ||
        text === "Generate an AI draft reply."
    ) {
        showToast("Nothing to copy.");
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        showToast("✅ Reply copied.");
    } catch (error) {
        console.error(
            "Copy error:",
            error
        );

        showToast("❌ Copy failed.");
    }
}


// ==================================================
// COMPOSE MODAL
// ==================================================

function clearComposeFields() {
    composeTo.value = "";
    composeSubject.value = "";
    composePrompt.value = "";
    composeBody.value = "";
}

function closeComposeModal() {
    composeModal.style.display = "none";
    clearComposeFields();
}

composeBtn.addEventListener("click", () => {
    composeModal.style.display = "flex";
});

closeCompose.addEventListener(
    "click",
    closeComposeModal
);

window.addEventListener("click", (event) => {
    if (event.target === composeModal) {
        closeComposeModal();
    }
});


// ==================================================
// REPLY UI
// ==================================================

closeReply.addEventListener("click", () => {
    replySection.style.display = "none";
});

cancelReply.addEventListener("click", () => {
    replySection.style.display = "none";
});

replyBtn.addEventListener("click", () => {
    if (!currentEmail) {
        showToast("Select an email first.");
        return;
    }

    replySection.style.display = "block";
});


// ==================================================
// EVENT LISTENERS
// ==================================================

sendReplyBtn.addEventListener(
    "click",
    sendReply
);

searchInput.addEventListener(
    "input",
    searchEmails
);

summarizeEmailBtn.addEventListener(
    "click",
    summarizeEmail
);

draftReplyBtn.addEventListener(
    "click",
    generateDraftReply
);

translateEmailBtn.addEventListener(
    "click",
    translateEmail
);

improveToneBtn.addEventListener(
    "click",
    improveTone
);

generateComposeBtn.addEventListener(
    "click",
    generateComposeEmail
);

sendComposeBtn.addEventListener(
    "click",
    sendComposeEmail
);

logoutBtn.addEventListener(
    "click",
    logout
);

copyReplyBtn.addEventListener(
    "click",
    copyReply
);


// ==================================================
// INITIALIZATION
// ==================================================

async function initializeDashboard() {
    const authenticated =
        await checkAuthentication();

    if (!authenticated) {
        return;
    }

    await Promise.all([
        loadProfile(),
        loadEmails(),
    ]);
}

initializeDashboard();
// ==================================================
// API / CLIENT URL
// ==================================================
const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000"
        : "https://ai-email-copilot-backend.onrender.com";

const CLIENT_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? `${window.location.origin}/client`
        : "https://ai-email-copilot-frontend.onrender.com";


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

const retryActionItemsBtn =
    document.getElementById("retryActionItemsBtn");


// ==================================================
// STATE
// ==================================================

let currentEmail = null;
let allEmails = [];
let emailLoadSequence = 0;
let activeAIRequests = 0;


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
    activeAIRequests += 1;
    aiLoading.style.display = "block";
}

function hideAIThinking() {
    activeAIRequests = Math.max(0, activeAIRequests - 1);
    aiLoading.style.display = activeAIRequests ? "block" : "none";
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

        if (response.status === 401) {
            redirectToLogin();
            return null;
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

function sanitizeEmailStyle(styleText) {
    const allowedProperties = new Set([
        "background-color", "border", "border-bottom", "border-collapse",
        "border-color", "border-left", "border-radius", "border-right",
        "border-spacing", "border-style", "border-top", "border-width",
        "color", "display", "font-family", "font-size", "font-style",
        "font-weight", "height", "line-height", "list-style-type", "margin",
        "margin-bottom", "margin-left", "margin-right", "margin-top",
        "max-height", "max-width", "min-height", "min-width", "padding",
        "padding-bottom", "padding-left", "padding-right", "padding-top",
        "table-layout", "text-align", "text-decoration", "text-transform",
        "vertical-align", "white-space", "width", "word-break", "overflow-wrap",
    ]);
    const safeDeclarations = [];

    for (const declaration of styleText.split(";")) {
        const separator = declaration.indexOf(":");
        if (separator < 1) continue;

        const property = declaration.slice(0, separator).trim().toLowerCase();
        const value = declaration.slice(separator + 1).trim();

        if (
            !allowedProperties.has(property) ||
            !value ||
            /[\\{}<>]/.test(value) ||
            /url\s*\(|expression\s*\(|@import|-moz-binding|behavior\s*:/i.test(value)
        ) {
            continue;
        }

        if (property === "display" && !/^(inline|block|inline-block|table|table-row|table-cell|table-row-group|table-header-group|table-footer-group|list-item)$/i.test(value)) {
            continue;
        }

        safeDeclarations.push(`${property}: ${value}`);
    }

    return safeDeclarations.join("; ");
}

function sanitizeEmailHTML(html) {
    const parser = new DOMParser();

    const documentFragment = parser.parseFromString(
        html,
        "text/html"
    );

    // Remove dangerous elements.
    documentFragment
        .querySelectorAll(
            "script, iframe, object, embed, form, link, meta, style, svg, math, base"
        )
        .forEach((element) => element.remove());

    // Remove inline event handlers.
    documentFragment
        .querySelectorAll("*")
        .forEach((element) => {
            [...element.attributes].forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim();

                if (
                    name.startsWith("on") ||
                    name === "srcset" ||
                    name === "formaction" ||
                    name === "xlink:href"
                ) {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (name === "style") {
                    const safeStyle = sanitizeEmailStyle(value);
                    if (safeStyle) {
                        element.setAttribute("style", safeStyle);
                    } else {
                        element.removeAttribute("style");
                    }
                    return;
                }

                if (["href", "src", "action", "poster"].includes(name)) {
                    // Avoid loading remote email images, which can disclose
                    // when and where the message was opened.
                    const safeUrl = name === "src"
                        ? /^data:image\/(?:png|gif|jpeg|webp);base64,/i.test(value)
                        : /^(https?:|mailto:|#)/i.test(value);
                    if (!safeUrl) {
                        element.removeAttribute(attribute.name);
                    }
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

    const requestSequence = emailLoadSequence;
    setAIResult(summaryText, "Generating summary…");

    const result = await callAI(
        "/ai/summarize",
        {
            email: emailBody.innerText,
        }
    );

    if (requestSequence !== emailLoadSequence) return;
    if (!result) {
        setAIResult(summaryText, "Summary failed. Select Summarize to retry.");
        return;
    }

    setAIResult(summaryText, result.summary?.trim() || "No summary was returned. Select Summarize to retry.");
}


// ==================================================
// DRAFT REPLY
// ==================================================

async function generateDraftReply() {
    if (!currentEmail) {
        showToast("Select an email first.");
        return;
    }

    const requestSequence = emailLoadSequence;
    setAIResult(
        replySuggestion,
        "Generating AI reply…"
    );

    const result = await callAI(
        "/ai/draft-reply",
        {
            email: emailBody.innerText,
        }
    );

    if (requestSequence !== emailLoadSequence) return;
    if (!result) {
        setAIResult(
            replySuggestion,
            "Reply generation failed. Select Draft reply to retry."
        );
        return;
    }

    if (!result.reply?.trim()) {
        setAIResult(replySuggestion, "No reply was returned. Select Draft reply to retry.");
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

    const requestSequence = emailLoadSequence;
    setAIResult(
        translationResult,
        "Translating email…"
    );

    const result = await callAI(
        "/ai/translate",
        {
            email: emailBody.innerText,
            language: "Hindi",
        }
    );

    if (requestSequence !== emailLoadSequence) return;
    if (!result) {
        setAIResult(
            translationResult,
            "Translation failed. Select Translate to retry."
        );
        return;
    }

    setAIResult(
        translationResult,
        result.translation?.trim() || "No translation was returned. Select Translate to retry."
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

    const requestSequence = emailLoadSequence;
    setAIResult(
        toneResult,
        "Improving tone…"
    );

    const result = await callAI(
        "/ai/improve-tone",
        {
            email: emailBody.innerText,
            tone: toneSelect.value,
        }
    );

    if (requestSequence !== emailLoadSequence) return;
    if (!result) {
        setAIResult(
            toneResult,
            "Tone improvement failed. Select Improve tone to retry."
        );
        return;
    }

    setAIResult(
        toneResult,
        result.improved?.trim() || "No revised text was returned. Select Improve tone to retry."
    );
}


// ==================================================
// ACTION ITEMS
// ==================================================

async function extractActionItems() {
    if (!currentEmail) {
        return;
    }

    const requestSequence = emailLoadSequence;
    setAIResult(
        actionItems,
        "Extracting action items…"
    );

    const result = await callAI(
        "/ai/action-items",
        {
            email: emailBody.innerText,
        }
    );

    if (requestSequence !== emailLoadSequence) return;
    if (!result) {
        setAIResult(
            actionItems,
            "Unable to extract action items. Use Retry to try again."
        );
        retryActionItemsBtn.hidden = false;
        return;
    }

    setAIResult(
        actionItems,
        result.actions?.trim() || "No action items found."
    );
    retryActionItemsBtn.hidden = true;
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

        composeBody.value = result.body?.trim() || "No draft was returned. Select Generate Email to retry.";
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

        if (response.status === 401) {
            redirectToLogin();
            return;
        }

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
    const requestSequence = ++emailLoadSequence;
    currentEmail = null;
    setAIResult(summaryText, "Select Summarize to generate a summary.");
    setAIResult(replySuggestion, "A thoughtful reply draft will appear here.");
    setAIResult(translationResult, "Select Translate to translate this email.");
    setAIResult(toneResult, "Select Improve tone to revise this email.");
    setAIResult(actionItems, "Loading action items…");
    retryActionItemsBtn.hidden = true;
    replySection.style.display = "none";
    replyText.value = "";

    try {
        const response = await fetch(
            `${API_BASE_URL}/gmail/email/${id}`,
            {
                credentials: "include",
            }
        );

        const data = await response.json();

        if (requestSequence !== emailLoadSequence) return;

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
        if (requestSequence !== emailLoadSequence) return;
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

    const inReplyTo =
        headers.find(
            (header) =>
                header.name.toLowerCase() === "message-id"
        )?.value || "";

    const references =
        headers.find(
            (header) =>
                header.name.toLowerCase() === "references"
        )?.value || "";

    const threadId =
        currentEmail.threadId;

    const message =
        replyText.value.trim();

    if (!message) {
        showToast("✍ Please write a reply.");
        return;
    }

    if (!to || !threadId || !inReplyTo) {
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
                    inReplyTo,
                    references,
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

retryActionItemsBtn.addEventListener(
    "click",
    extractActionItems
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

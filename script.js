// ======================================================
// 🌊 OCEANCHAT - SCRIPT PRINCIPAL
// ======================================================

"use strict";

// ------------------------------------------------------
// VARIABLES
// ------------------------------------------------------

let currentUser = null;
let messages = [];
let selectedPrivateUser = null;

const connectedUsers = new Map();

let presenceChannel = null;
let publicChannel = null;
let privateChannel = null;

const SUPABASE_URL = window.OCEANCHAT_SUPABASE_URL;
const SUPABASE_KEY = window.OCEANCHAT_SUPABASE_KEY;

let supabaseClient = null;

// ------------------------------------------------------
// SUPABASE
// ------------------------------------------------------

if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_KEY
) {
    try {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        console.log("🌊 Supabase connecté");
    } catch (error) {
        console.error("Erreur Supabase :", error);
    }
} else {
    console.error(
        "❌ Supabase non configuré. Vérifie supabase-config.js"
    );
}

// ------------------------------------------------------
// DOM
// ------------------------------------------------------

const profileForm = document.getElementById("profileForm");
const loginSection = document.getElementById("loginSection");
const chatSection = document.getElementById("chatSection");

const pseudoInput = document.getElementById("pseudo");
const ageInput = document.getElementById("age");
const sexeInput = document.getElementById("sexe");
const paysInput = document.getElementById("pays");

const messageInput = document.getElementById("messageInput");
const messagesContainer = document.getElementById("messages");

const usersList = document.getElementById("usersList");
const onlineCount = document.getElementById("onlineCount");

const privateModal = document.getElementById("privateModal");
const privateTitle = document.getElementById("privateTitle");
const privateMessages = document.getElementById("privateMessages");
const privateMessageInput =
    document.getElementById("privateMessageInput");

// ------------------------------------------------------
// UTILITAIRE
// ------------------------------------------------------

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

// ------------------------------------------------------
// CONNEXION UTILISATEUR
// ------------------------------------------------------

if (profileForm) {

    profileForm.addEventListener("submit", async function (event) {

        event.preventDefault();
        event.stopPropagation();

        console.log("🌊 Bouton Connecter cliqué");

        const pseudo = pseudoInput
            ? pseudoInput.value.trim()
            : "";

        const age = ageInput
            ? Number(ageInput.value)
            : 0;

        const sexe = sexeInput
            ? sexeInput.value
            : "";

        const pays = paysInput
            ? paysInput.value
            : "";

        // Vérifications
        if (!pseudo) {
            alert("Entre ton pseudo.");
            return;
        }

        if (!age || age < 18 || age > 120) {
            alert("Tu dois avoir entre 18 et 120 ans.");
            return;
        }

        if (!sexe) {
            alert("Choisis ton sexe.");
            return;
        }

        if (!pays) {
            alert("Choisis ton pays.");
            return;
        }

        if (!supabaseClient) {
            alert(
                "Erreur de connexion à Supabase. Vérifie ton fichier supabase-config.js."
            );
            return;
        }

        // Création de l'utilisateur
        currentUser = {
            id:
                typeof crypto !== "undefined" &&
                crypto.randomUUID
                    ? crypto.randomUUID()
                    : "user-" +
                      Date.now() +
                      "-" +
                      Math.random()
                          .toString(36)
                          .substring(2),

            pseudo: pseudo,
            age: age,
            sexe: sexe,
            pays: pays,
            connectedAt: Date.now()
        };

        console.log("👤 Utilisateur :", currentUser);

        // Afficher le chat
        if (loginSection) {
            loginSection.style.display = "none";
        }

        if (chatSection) {
            chatSection.style.display = "block";
        }

        updateUserInfo();

        // Connexion temps réel
        try {
            await connectRealtime();

            console.log("✅ Connexion réussie");
        } catch (error) {
            console.error(
                "Erreur connexion temps réel :",
                error
            );

            alert(
                "La connexion au chat a rencontré un problème."
            );
        }
    });
}

// ------------------------------------------------------
// INFORMATIONS UTILISATEUR
// ------------------------------------------------------

function updateUserInfo() {

    if (!currentUser) {
        return;
    }

    const elements =
        document.querySelectorAll("[data-current-user]");

    elements.forEach(function (element) {

        const type = element.dataset.currentUser;

        if (type === "pseudo") {
            element.textContent = currentUser.pseudo;
        }

        if (type === "age") {
            element.textContent = currentUser.age;
        }

        if (type === "sexe") {
            element.textContent = currentUser.sexe;
        }

        if (type === "pays") {
            element.textContent = currentUser.pays;
        }
    });
}

// ------------------------------------------------------
// REALTIME
// ------------------------------------------------------

async function connectRealtime() {

    if (!supabaseClient || !currentUser) {
        throw new Error(
            "Supabase ou utilisateur manquant."
        );
    }

    // --------------------------------------------
    // PRESENCE
    // --------------------------------------------

    presenceChannel =
        supabaseClient.channel(
            "oceanchat-presence",
            {
                config: {
                    presence: {
                        key: currentUser.id
                    }
                }
            }
        );

    presenceChannel
        .on(
            "presence",
            {
                event: "sync"
            },
            function () {

                const state =
                    presenceChannel.presenceState();

                connectedUsers.clear();

                Object.keys(state).forEach(function (key) {

                    const users = state[key];

                    if (
                        users &&
                        users.length > 0
                    ) {
                        connectedUsers.set(
                            key,
                            users[0]
                        );
                    }
                });

                updateUsersList();
            }
        );

    presenceChannel.on(
        "presence",
        {
            event: "join"
        },
        function () {
            updateUsersList();
        }
    );

    presenceChannel.on(
        "presence",
        {
            event: "leave"
        },
        function () {
            updateUsersList();
        }
    );

    await presenceChannel.subscribe(
        async function (status) {

            console.log(
                "Presence :",
                status
            );

            if (status === "SUBSCRIBED") {

                await presenceChannel.track({
                    id: currentUser.id,
                    pseudo: currentUser.pseudo,
                    age: currentUser.age,
                    sexe: currentUser.sexe,
                    pays: currentUser.pays
                });
            }
        }
    );

    // --------------------------------------------
    // CHAT PUBLIC
    // --------------------------------------------

    publicChannel =
        supabaseClient.channel(
            "oceanchat-public"
        );

    publicChannel.on(
        "broadcast",
        {
            event: "message"
        },
        function (payload) {

            if (!payload || !payload.payload) {
                return;
            }

            const message =
                payload.payload;

            // Ne pas afficher deux fois son propre message
            if (
                currentUser &&
                message.userId === currentUser.id
            ) {
                return;
            }

            displayPublicMessage(message);
        }
    );

    await publicChannel.subscribe();

    // --------------------------------------------
    // MESSAGES PRIVÉS
    // --------------------------------------------

    privateChannel =
        supabaseClient.channel(
            "oceanchat-private"
        );

    privateChannel.on(
        "broadcast",
        {
            event: "private-message"
        },
        function (payload) {

            if (!payload || !payload.payload) {
                return;
            }

            const message =
                payload.payload;

            if (!currentUser) {
                return;
            }

            if (
                message.to === currentUser.id ||
                message.from === currentUser.id
            ) {
                displayPrivateMessage(message);
            }
        }
    );

    await privateChannel.subscribe();

    console.log("🌊 OceanChat temps réel activé");
}

// ------------------------------------------------------
// ENVOYER MESSAGE PUBLIC
// ------------------------------------------------------

async function sendMessage() {

    if (!currentUser) {
        alert("Connecte-toi d'abord.");
        return;
    }

    if (!messageInput) {
        return;
    }

    const text =
        messageInput.value.trim();

    if (!text) {
        return;
    }

    const message = {
        id:
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2),

        userId: currentUser.id,
        pseudo: currentUser.pseudo,
        age: currentUser.age,
        pays: currentUser.pays,
        sexe: currentUser.sexe,
        text: text,
        createdAt: Date.now()
    };

    messages.push(message);

    // Affichage immédiat
    displayPublicMessage(message);

    messageInput.value = "";

    if (!publicChannel) {
        return;
    }

    try {

        await publicChannel.send({
            type: "broadcast",
            event: "message",
            payload: message
        });

    } catch (error) {

        console.error(
            "Erreur envoi message :",
            error
        );
    }
}

// ------------------------------------------------------
// AFFICHER MESSAGE PUBLIC
// ------------------------------------------------------

function displayPublicMessage(message) {

    if (!messagesContainer) {
        return;
    }

    const div =
        document.createElement("div");

    div.className =
        "chat-message";

    const name =
        escapeHtml(
            message.pseudo || "Utilisateur"
        );

    const text =
        escapeHtml(
            message.text || ""
        );

    div.innerHTML = `
        <div class="message-author">
            ${name}
        </div>

        <div class="message-text">
            ${text}
        </div>
    `;

    messagesContainer.appendChild(div);

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}

// ------------------------------------------------------
// UTILISATEURS CONNECTÉS
// ------------------------------------------------------

function updateUsersList() {

    if (!usersList) {
        return;
    }

    usersList.innerHTML = "";

    let count = 0;

    connectedUsers.forEach(
        function (user) {

            if (
                currentUser &&
                user.id === currentUser.id
            ) {
                return;
            }

            count++;

            const div =
                document.createElement("div");

            div.className =
                "online-user";

            div.innerHTML = `
                <div class="user-name">
                    🟢 ${escapeHtml(user.pseudo)}
                </div>

                <div class="user-info">
                    ${escapeHtml(String(user.age))} ans
                    • ${escapeHtml(user.sexe)}
                    • ${escapeHtml(user.pays)}
                </div>

                <button
                    type="button"
                    class="private-button"
                >
                    💬 Message privé
                </button>
            `;

            const button =
                div.querySelector(
                    ".private-button"
                );

            if (button) {

                button.addEventListener(
                    "click",
                    function () {
                        openPrivateChat(user);
                    }
                );
            }

            usersList.appendChild(div);
        }
    );

    if (onlineCount) {
        onlineCount.textContent =
            String(count + (currentUser ? 1 : 0));
    }

    if (count === 0) {

        const empty =
            document.createElement("div");

        empty.textContent =
            "Aucun autre utilisateur connecté.";

        usersList.appendChild(empty);
    }
}

// ------------------------------------------------------
// CHAT PRIVÉ
// ------------------------------------------------------

function openPrivateChat(user) {

    if (!user) {
        return;
    }

    selectedPrivateUser = user;

    if (privateModal) {
        privateModal.style.display = "flex";
    }

    if (privateTitle) {

        privateTitle.textContent =
            "💬 " +
            user.pseudo;
    }

    if (privateMessages) {
        privateMessages.innerHTML = "";
    }

    if (privateMessageInput) {
        privateMessageInput.focus();
    }
}

// ------------------------------------------------------
// FERMER CHAT PRIVÉ
// ------------------------------------------------------

function closePrivateChat() {

    selectedPrivateUser = null;

    if (privateModal) {
        privateModal.style.display = "none";
    }
}

// ------------------------------------------------------
// ENVOYER MESSAGE PRIVÉ
// ------------------------------------------------------

async function sendPrivateMessage() {

    if (!currentUser) {
        return;
    }

    if (!selectedPrivateUser) {
        return;
    }

    if (!privateMessageInput) {
        return;
    }

    const text =
        privateMessageInput.value.trim();

    if (!text) {
        return;
    }

    const message = {

        id:
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2),

        from: currentUser.id,

        fromPseudo:
            currentUser.pseudo,

        to:
            selectedPrivateUser.id,

        toPseudo:
            selectedPrivateUser.pseudo,

        text: text,

        createdAt:
            Date.now()
    };

    displayPrivateMessage(message);

    privateMessageInput.value = "";

    if (!privateChannel) {
        return;
    }

    try {

        await privateChannel.send({
            type: "broadcast",
            event: "private-message",
            payload: message
        });

    } catch (error) {

        console.error(
            "Erreur message privé :",
            error
        );
    }
}

// ------------------------------------------------------
// AFFICHER MESSAGE PRIVÉ
// ------------------------------------------------------

function displayPrivateMessage(message) {

    if (!privateMessages) {
        return;
    }

    if (!currentUser) {
        return;
    }

    // Si le message concerne une autre conversation,
    // on ne l'affiche pas dans la fenêtre actuelle.
    if (
        selectedPrivateUser &&
        message.from !== selectedPrivateUser.id &&
        message.to !== selectedPrivateUser.id
    ) {
        return;
    }

    const div =
        document.createElement("div");

    div.className =
        "private-message";

    const author =
        message.from === currentUser.id
            ? "Moi"
            : escapeHtml(
                message.fromPseudo ||
                "Utilisateur"
            );

    div.innerHTML = `
        <strong>${author}</strong>
        <div>${escapeHtml(message.text)}</div>
    `;

    privateMessages.appendChild(div);

    privateMessages.scrollTop =
        privateMessages.scrollHeight;
}

// ------------------------------------------------------
// DÉCONNEXION
// ------------------------------------------------------

async function logout() {

    console.log("👋 Déconnexion");

    try {

        if (presenceChannel) {
            await presenceChannel.untrack();
            await supabaseClient.removeChannel(
                presenceChannel
            );
        }

        if (publicChannel) {
            await supabaseClient.removeChannel(
                publicChannel
            );
        }

        if (privateChannel) {
            await supabaseClient.removeChannel(
                privateChannel
            );
        }

    } catch (error) {

        console.error(
            "Erreur déconnexion :",
            error
        );
    }

    currentUser = null;

    connectedUsers.clear();

    messages = [];

    presenceChannel = null;
    publicChannel = null;
    privateChannel = null;

    if (chatSection) {
        chatSection.style.display = "none";
    }

    if (loginSection) {
        loginSection.style.display = "block";
    }

    if (profileForm) {
        profileForm.reset();
    }

    if (messagesContainer) {
        messagesContainer.innerHTML = "";
    }

    if (usersList) {
        usersList.innerHTML = "";
    }
}

// ------------------------------------------------------
// BOUTON ENVOYER
// ------------------------------------------------------

const sendButton =
    document.getElementById("sendButton");

if (sendButton) {

    sendButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            sendMessage();
        }
    );
}

// ------------------------------------------------------
// TOUCHE ENTRÉE - CHAT PUBLIC
// ------------------------------------------------------

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );
}

// ------------------------------------------------------
// TOUCHE ENTRÉE - CHAT PRIVÉ
// ------------------------------------------------------

if (privateMessageInput) {

    privateMessageInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendPrivateMessage();
            }
        }
    );
}

// ------------------------------------------------------
// BOUTON CHAT PRIVÉ
// ------------------------------------------------------

const privateSendButton =
    document.getElementById(
        "privateSendButton"
    );

if (privateSendButton) {

    privateSendButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            sendPrivateMessage();
        }
    );
}

// ------------------------------------------------------
// BOUTON FERMER CHAT PRIVÉ
// ------------------------------------------------------

const privateCloseButton =
    document.getElementById(
        "privateCloseButton"
    );

if (privateCloseButton) {

    privateCloseButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            closePrivateChat();
        }
    );
}

// ------------------------------------------------------
// LOGOUT GLOBAL
// ------------------------------------------------------

const logoutButton =
    document.getElementById("logoutButton");

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            logout();
        }
    );
}

// ------------------------------------------------------
// INSCRIPTION
// ------------------------------------------------------

const signupButton =
    document.getElementById(
        "signupButton"
    );

if (signupButton) {

    signupButton.addEventListener(
        "click",
        function () {

            alert(
                "La création de comptes sera activée avec Supabase Auth."
            );
        }
    );
}

// ------------------------------------------------------
// INITIALISATION
// ------------------------------------------------------

console.log(
    "🌊 OceanChat chargé correctement."
);

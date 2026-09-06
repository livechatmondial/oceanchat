```javascript
/* =========================================================
   🌊 OCEANCHAT — SCRIPT COMPLET
   Chat public + utilisateurs en ligne + messages privés
   ========================================================= */

const SUPABASE_URL = window.OCEANCHAT_SUPABASE_URL;
const SUPABASE_KEY = window.OCEANCHAT_SUPABASE_KEY;

let supabaseClient = null;

let currentUser = null;
let presenceChannel = null;
let publicChannel = null;
let privateChannel = null;

let onlineUsers = {};
let selectedPrivateUser = null;

/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("Configuration Supabase introuvable.");
        alert("Erreur : configuration Supabase introuvable.");
        return;
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    setupLogin();
    setupPublicChat();
    setupPrivateChat();
    setupLogout();
});

/* =========================================================
   CONNEXION
   ========================================================= */

function setupLogin() {

    const form = document.getElementById("profileForm");

    if (!form) return;

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const pseudo = document.getElementById("pseudo")?.value.trim();
        const age = document.getElementById("age")?.value;
        const sexe = document.getElementById("sexe")?.value;
        const pays = document.getElementById("pays")?.value;

        if (!pseudo || !age || !sexe || !pays) {
            alert("Veuillez remplir tous les champs.");
            return;
        }

        currentUser = {
            id: crypto.randomUUID(),
            pseudo: pseudo,
            age: Number(age),
            sexe: sexe,
            pays: pays
        };

        const loginSection = document.getElementById("loginSection");
        const chatSection = document.getElementById("chatSection");

        if (loginSection) {
            loginSection.style.display = "none";
        }

        if (chatSection) {
            chatSection.style.display = "flex";
        }

        await startRealtime();

        console.log("Connecté :", currentUser);
    });
}

/* =========================================================
   REALTIME
   ========================================================= */

async function startRealtime() {

    /* -----------------------------
       UTILISATEURS EN LIGNE
       ----------------------------- */

    presenceChannel = supabaseClient.channel(
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
            () => {

                const state = presenceChannel.presenceState();

                onlineUsers = {};

                Object.keys(state).forEach((key) => {

                    const users = state[key];

                    if (users && users.length > 0) {
                        onlineUsers[key] = users[0];
                    }
                });

                renderOnlineUsers();
            }
        )
        .on(
            "presence",
            {
                event: "join"
            },
            () => {
                renderOnlineUsers();
            }
        )
        .on(
            "presence",
            {
                event: "leave"
            },
            () => {
                renderOnlineUsers();
            }
        );

    await presenceChannel.subscribe(async (status) => {

        if (status === "SUBSCRIBED") {

            await presenceChannel.track({
                id: currentUser.id,
                pseudo: currentUser.pseudo,
                age: currentUser.age,
                sexe: currentUser.sexe,
                pays: currentUser.pays
            });
        }
    });


    /* -----------------------------
       CHAT PUBLIC
       ----------------------------- */

    publicChannel = supabaseClient.channel(
        "oceanchat-public"
    );

    publicChannel.on(
        "broadcast",
        {
            event: "public-message"
        },
        ({ payload }) => {

            if (!payload) return;

            addPublicMessage(payload);
        }
    );

    await publicChannel.subscribe();


    /* -----------------------------
       CHAT PRIVÉ
       ----------------------------- */

    /*
       Tous les utilisateurs écoutent le même canal.

       Le message contient :
       - senderId
       - receiverId
       - sender
       - receiver
       - text
       - conversationId

       Seul le destinataire concerné traite le message.
    */

    privateChannel = supabaseClient.channel(
        "oceanchat-private-messages"
    );

    privateChannel.on(
        "broadcast",
        {
            event: "private-message"
        },
        ({ payload }) => {

            receivePrivateMessage(payload);
        }
    );

    await privateChannel.subscribe();
}

/* =========================================================
   UTILISATEURS EN LIGNE
   ========================================================= */

function renderOnlineUsers() {

    const usersList = document.getElementById("usersList");

    if (!usersList) return;

    usersList.innerHTML = "";

    Object.values(onlineUsers).forEach((user) => {

        if (!user || !user.id) return;

        const div = document.createElement("div");

        div.className = "user-item";

        const avatar = document.createElement("div");

        avatar.className = "user-avatar";

        avatar.textContent =
            String(user.pseudo || "?")
                .charAt(0)
                .toUpperCase();

        const info = document.createElement("div");

        info.className = "user-info";

        const name = document.createElement("div");

        name.className = "user-name";

        name.textContent =
            String(user.pseudo || "Utilisateur");

        const details = document.createElement("div");

        details.className = "user-details";

        details.textContent =
            `${user.age || ""} ans • ${user.pays || ""}`;

        info.appendChild(name);
        info.appendChild(details);

        const online = document.createElement("div");

        online.className = "user-online";

        div.appendChild(avatar);
        div.appendChild(info);
        div.appendChild(online);

        /*
           Cliquer sur l'utilisateur ouvre
           immédiatement la conversation privée.
        */

        if (user.id !== currentUser?.id) {

            div.addEventListener("click", () => {

                openPrivateChat(user);
            });
        }

        usersList.appendChild(div);
    });

    const onlineCount =
        document.getElementById("onlineCount");

    if (onlineCount) {

        onlineCount.textContent =
            String(Object.keys(onlineUsers).length);
    }
}

/* =========================================================
   CHAT PUBLIC
   ========================================================= */

function setupPublicChat() {

    const form =
        document.getElementById("messageForm");

    const input =
        document.getElementById("messageInput");

    const button =
        document.getElementById("sendMessage");

    if (!form || !input) return;

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        await sendPublicMessage();
    });

    if (button) {

        button.addEventListener("click", async (event) => {

            event.preventDefault();

            await sendPublicMessage();
        });
    }
}

async function sendPublicMessage() {

    const input =
        document.getElementById("messageInput");

    if (!input || !publicChannel || !currentUser) return;

    const text = input.value.trim();

    if (!text) return;

    const message = {

        id: crypto.randomUUID(),

        senderId: currentUser.id,

        sender: currentUser.pseudo,

        text: text,

        time: new Date().toISOString()
    };

    await publicChannel.send({

        type: "broadcast",

        event: "public-message",

        payload: message
    });

    input.value = "";
}

function addPublicMessage(message) {

    const messages =
        document.getElementById("messages");

    if (!messages) return;

    const wrapper =
        document.createElement("div");

    wrapper.className = "message";

    if (
        currentUser &&
        message.senderId === currentUser.id
    ) {
        wrapper.classList.add("mine");
    }

    const content =
        document.createElement("div");

    content.className = "message-content";

    const name =
        document.createElement("div");

    name.className = "message-name";

    name.textContent =
        String(message.sender || "Utilisateur");

    const text =
        document.createElement("div");

    text.className = "message-text";

    text.textContent =
        String(message.text || "");

    const time =
        document.createElement("div");

    time.className = "message-time";

    time.textContent =
        formatTime(message.time);

    content.appendChild(name);
    content.appendChild(text);
    content.appendChild(time);

    wrapper.appendChild(content);

    messages.appendChild(wrapper);

    messages.scrollTop =
        messages.scrollHeight;
}

/* =========================================================
   CHAT PRIVÉ
   ========================================================= */

function setupPrivateChat() {

    const form =
        document.getElementById("privateMessageForm");

    const input =
        document.getElementById("privateMessageInput");

    const closeButton =
        document.getElementById("closePrivate");

    if (form && input) {

        form.addEventListener("submit", async (event) => {

            event.preventDefault();

            await sendPrivateMessage();
        });
    }

    if (closeButton) {

        closeButton.addEventListener("click", () => {

            closePrivateChat();
        });
    }
}

/* =========================================================
   OUVRIR UNE CONVERSATION
   ========================================================= */

function openPrivateChat(user) {

    if (!user || !currentUser) return;

    selectedPrivateUser = user;

    const modal =
        document.getElementById("privateModal");

    const title =
        document.getElementById("privateTitle");

    const messages =
        document.getElementById("privateMessages");

    if (!modal) return;

    if (title) {

        title.textContent =
            `💬 ${user.pseudo}`;
    }

    /*
       On efface uniquement l'affichage actuel.
       La conversation reçue ensuite sera ajoutée.
    */

    if (messages) {

        messages.innerHTML = "";

        showPrivateInfo(
            `Conversation privée avec ${user.pseudo}`
        );
    }

    modal.style.display = "flex";

    /*
       Pour les CSS qui utilisent .active
    */

    modal.classList.add("active");

    const input =
        document.getElementById("privateMessageInput");

    if (input) {

        setTimeout(() => {

            input.focus();

        }, 100);
    }
}

/* =========================================================
   ENVOYER MESSAGE PRIVÉ
   ========================================================= */

async function sendPrivateMessage() {

    if (
        !privateChannel ||
        !currentUser ||
        !selectedPrivateUser
    ) {
        return;
    }

    const input =
        document.getElementById("privateMessageInput");

    if (!input) return;

    const text =
        input.value.trim();

    if (!text) return;

    const conversationId =
        createConversationId(
            currentUser.id,
            selectedPrivateUser.id
        );

    const message = {

        id: crypto.randomUUID(),

        type: "private",

        conversationId: conversationId,

        senderId: currentUser.id,

        receiverId: selectedPrivateUser.id,

        sender: currentUser.pseudo,

        receiver: selectedPrivateUser.pseudo,

        text: text,

        time: new Date().toISOString()
    };

    /*
       Envoi à TOUS les utilisateurs connectés.
       Chaque navigateur vérifie ensuite
       si le message lui est destiné.
    */

    await privateChannel.send({

        type: "broadcast",

        event: "private-message",

        payload: message
    });

    /*
       Affichage immédiat chez l'expéditeur.
    */

    addPrivateMessage(message);

    input.value = "";
}

/* =========================================================
   RECEVOIR MESSAGE PRIVÉ
   ========================================================= */

function receivePrivateMessage(message) {

    if (!message || !currentUser) return;

    /*
       IMPORTANT :

       On ignore tous les messages qui ne sont
       pas destinés à l'utilisateur actuel.
    */

    if (message.receiverId !== currentUser.id) {

        return;
    }

    /*
       Trouver automatiquement l'expéditeur.
    */

    const sender = {

        id: message.senderId,

        pseudo: message.sender || "Utilisateur"
    };

    /*
       Si aucune fenêtre privée n'est ouverte,
       on ouvre automatiquement la conversation.
    */

    if (
        !selectedPrivateUser ||
        selectedPrivateUser.id !== message.senderId
    ) {

        openPrivateChat(sender);
    }

    /*
       Ajouter le message dans la fenêtre privée.
    */

    addPrivateMessage(message);

    /*
       Notification sonore/visuelle légère.
    */

    showPrivateNotification(
        `💬 Nouveau message de ${message.sender}`
    );
}

/* =========================================================
   AFFICHER MESSAGE PRIVÉ
   ========================================================= */

function addPrivateMessage(message) {

    const messages =
        document.getElementById("privateMessages");

    if (!messages) return;

    /*
       Évite d'afficher deux fois le même message.
    */

    if (
        document.querySelector(
            `[data-message-id="${message.id}"]`
        )
    ) {
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "private-message";

    wrapper.dataset.messageId =
        message.id;

    if (
        currentUser &&
        message.senderId === currentUser.id
    ) {

        wrapper.classList.add("mine");
    }

    const text =
        document.createElement("div");

    text.textContent =
        String(message.text || "");

    const time =
        document.createElement("div");

    time.style.fontSize = "10px";
    time.style.opacity = "0.65";
    time.style.marginTop = "4px";

    time.textContent =
        formatTime(message.time);

    wrapper.appendChild(text);
    wrapper.appendChild(time);

    messages.appendChild(wrapper);

    messages.scrollTop =
        messages.scrollHeight;
}

/* =========================================================
   FERMER CHAT PRIVÉ
   ========================================================= */

function closePrivateChat() {

    const modal =
        document.getElementById("privateModal");

    if (modal) {

        modal.style.display = "none";

        modal.classList.remove("active");
    }

    selectedPrivateUser = null;
}

/* =========================================================
   IDENTIFIANT CONVERSATION
   ========================================================= */

function createConversationId(id1, id2) {

    return [id1, id2]
        .sort()
        .join("_");
}

/* =========================================================
   MESSAGE D'INFO PRIVÉ
   ========================================================= */

function showPrivateInfo(text) {

    const messages =
        document.getElementById("privateMessages");

    if (!messages) return;

    const info =
        document.createElement("div");

    info.style.textAlign = "center";
    info.style.color = "#7b8798";
    info.style.fontSize = "13px";
    info.style.padding = "15px";

    info.textContent = text;

    messages.appendChild(info);
}

/* =========================================================
   NOTIFICATION
   ========================================================= */

function showPrivateNotification(text) {

    /*
       Si la fenêtre privée est déjà ouverte,
       inutile de créer une grosse notification.
    */

    if (
        selectedPrivateUser &&
        document.getElementById("privateModal")?.style.display === "flex"
    ) {
        return;
    }

    const notification =
        document.createElement("div");

    notification.textContent = text;

    notification.style.position = "fixed";
    notification.style.top = "80px";
    notification.style.right = "20px";
    notification.style.zIndex = "9999";
    notification.style.background = "#0066ff";
    notification.style.color = "white";
    notification.style.padding = "13px 18px";
    notification.style.borderRadius = "12px";
    notification.style.fontWeight = "bold";
    notification.style.boxShadow =
        "0 8px 25px rgba(0,0,0,0.2)";

    document.body.appendChild(notification);

    setTimeout(() => {

        notification.remove();

    }, 3500);
}

/* =========================================================
   DÉCONNEXION
   ========================================================= */

function setupLogout() {

    const logoutButton =
        document.getElementById("logoutBtn") ||
        document.getElementById("logout");

    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {

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
        selectedPrivateUser = null;
        onlineUsers = {};

        const chatSection =
            document.getElementById("chatSection");

        const loginSection =
            document.getElementById("loginSection");

        if (chatSection) {

            chatSection.style.display = "none";
        }

        if (loginSection) {

            loginSection.style.display = "flex";
        }
    });
}

/* =========================================================
   HEURE
   ========================================================= */

function formatTime(time) {

    if (!time) return "";

    try {

        return new Date(time).toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch {

        return "";
    }
}
```

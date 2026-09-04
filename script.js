```javascript
// 🌊 OceanChat - Chat en temps réel avec Supabase

let currentUser = null;
let messages = [];
let privateMessages = new Map();
let selectedPrivateUser = null;

const connectedUsers = new Map();

let presenceChannel = null;
let publicChannel = null;
let privateChannel = null;


// ======================================================
// SUPABASE
// ======================================================

const SUPABASE_URL = window.OCEANCHAT_SUPABASE_URL;
const SUPABASE_KEY = window.OCEANCHAT_SUPABASE_KEY;

let supabaseClient = null;

if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_KEY
) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log("✅ Supabase connecté");
} else {
    console.error("❌ Configuration Supabase manquante");
}


// ======================================================
// CONNEXION AU PROFIL
// ======================================================

const profileForm = document.getElementById('profileForm');

if (profileForm) {

    profileForm.addEventListener(
        'submit',
        async function(e) {

            // Empêche le formulaire de recharger la page
            e.preventDefault();
            e.stopPropagation();

            const pseudo =
                document.getElementById('pseudo').value.trim();

            const age =
                parseInt(
                    document.getElementById('age').value,
                    10
                );

            const sexe =
                document.getElementById('sexe').value;

            const pays =
                document.getElementById('pays').value;


            // Vérification des champs
            if (
                !pseudo ||
                !age ||
                !sexe ||
                !pays
            ) {

                alert(
                    'Veuillez remplir tous les champs.'
                );

                return;
            }


            if (
                age < 18 ||
                age > 120
            ) {

                alert(
                    'Veuillez entrer un âge valide.'
                );

                return;
            }


            // Vérification Supabase
            if (!supabaseClient) {

                alert(
                    'Supabase n’est pas configuré. Vérifiez votre fichier de configuration.'
                );

                return;
            }


            // Identifiant unique de session
            let userId;

            try {

                userId =
                    crypto.randomUUID();

            } catch (error) {

                userId =
                    'user-' +
                    Date.now() +
                    '-' +
                    Math.random()
                        .toString(36)
                        .substring(2, 10);

            }


            currentUser = {

                id: userId,

                pseudo: pseudo,

                age: age,

                sexe: sexe,

                pays: pays,

                connectedAt: Date.now()

            };


            console.log(
                '👤 Utilisateur connecté :',
                currentUser
            );


            // Afficher le chat
            const loginSection =
                document.getElementById(
                    'loginSection'
                );

            const chatSection =
                document.getElementById(
                    'chatSection'
                );


            if (loginSection) {

                loginSection.style.display =
                    'none';

            }


            if (chatSection) {

                chatSection.style.display =
                    'flex';

            }


            updateUserInfo();


            // Connexion temps réel
            try {

                await connectRealtime();

            } catch (error) {

                console.error(
                    'Erreur connexion temps réel :',
                    error
                );

                addSystemMessage(
                    '⚠️ La connexion temps réel a rencontré un problème.'
                );

            }

        }
    );

}


// ======================================================
// CONNEXION REALTIME
// ======================================================

async function connectRealtime() {

    if (
        !supabaseClient ||
        !currentUser
    ) {

        throw new Error(
            'Supabase ou utilisateur manquant.'
        );

    }


    // -----------------------------
    // PRÉSENCE
    // -----------------------------

    presenceChannel =
        supabaseClient.channel(
            'oceanchat-presence',
            {
                config: {

                    presence: {

                        key: currentUser.id

                    }

                }

            }
        );


    presenceChannel.on(
        'presence',
        {
            event: 'sync'
        },
        updateOnlineUsers
    );


    presenceChannel.on(
        'presence',
        {
            event: 'join'
        },
        updateOnlineUsers
    );


    presenceChannel.on(
        'presence',
        {
            event: 'leave'
        },
        updateOnlineUsers
    );


    await presenceChannel.subscribe(
        async function(status) {

            console.log(
                'Statut présence :',
                status
            );


            if (
                status === 'SUBSCRIBED'
            ) {

                await presenceChannel.track(
                    currentUser
                );


                console.log(
                    '🟢 Utilisateur visible en ligne'
                );

            }

        }
    );


    // -----------------------------
    // CHAT PUBLIC
    // -----------------------------

    publicChannel =
        supabaseClient.channel(
            'oceanchat-public'
        );


    publicChannel.on(
        'broadcast',
        {
            event: 'message'
        },
        function(data) {

            const message =
                data.payload;


            if (!message) {

                return;

            }


            displayMessage(
                message,
                currentUser &&
                message.userId === currentUser.id
            );

        }
    );


    await publicChannel.subscribe();


    // -----------------------------
    // CHAT PRIVÉ
    // -----------------------------

    privateChannel =
        supabaseClient.channel(
            'oceanchat-private'
        );


    privateChannel.on(
        'broadcast',
        {
            event: 'private-message'
        },
        function(data) {

            const message =
                data.payload;


            if (!currentUser) {

                return;

            }


            if (
                message &&
                message.to === currentUser.id &&
                selectedPrivateUser &&
                message.from === selectedPrivateUser.id
            ) {

                if (
                    !privateMessages.has(
                        selectedPrivateUser.id
                    )
                ) {

                    privateMessages.set(
                        selectedPrivateUser.id,
                        []
                    );

                }


                privateMessages
                    .get(
                        selectedPrivateUser.id
                    )
                    .push(
                        message
                    );


                displayPrivateMessage(
                    message,
                    false
                );

            }

        }
    );


    await privateChannel.subscribe();


    addSystemMessage(
        '🟢 Vous êtes connecté en temps réel !'
    );

}


// ======================================================
// ACTUALISER LES UTILISATEURS EN LIGNE
// ======================================================

function updateOnlineUsers() {

    if (!presenceChannel) {

        return;

    }


    connectedUsers.clear();


    const state =
        presenceChannel.presenceState();


    Object.values(state)
        .flat()
        .forEach(
            function(user) {

                if (
                    user &&
                    user.id
                ) {

                    connectedUsers.set(
                        user.id,
                        user
                    );

                }

            }
        );


    updateUsersList();

}


// ======================================================
// INFORMATIONS UTILISATEUR
// ======================================================

function updateUserInfo() {

    if (!currentUser) {

        return;

    }


    const userDisplay =
        document.getElementById(
            'userDisplay'
        );


    if (userDisplay) {

        userDisplay.textContent =
            `${currentUser.pseudo} (${currentUser.age} ans, ${currentUser.pays})`;

    }

}


// ======================================================
// LISTE DES UTILISATEURS
// ======================================================

function updateUsersList() {

    const usersList =
        document.getElementById(
            'usersList'
        );


    if (!usersList) {

        return;

    }


    usersList.innerHTML = '';


    connectedUsers.forEach(
        function(user) {

            if (
                !currentUser ||
                user.id === currentUser.id
            ) {

                return;

            }


            const userItem =
                document.createElement(
                    'div'
                );


            userItem.className =
                'user-item';


            if (
                selectedPrivateUser &&
                selectedPrivateUser.id === user.id
            ) {

                userItem.classList.add(
                    'active'
                );

            }


            userItem.innerHTML = `

                <div class="user-item-name">
                    🟢 ${escapeHtml(user.pseudo)}
                </div>

                <div class="user-item-info">
                    ${escapeHtml(String(user.age))} ans •
                    ${escapeHtml(user.pays)}
                </div>

                <div class="user-item-info">
                    ${escapeHtml(user.sexe)}
                </div>

            `;


            userItem.addEventListener(
                'click',
                function() {

                    openPrivateChat(user);

                }
            );


            usersList.appendChild(
                userItem
            );

        }
    );


    const onlineCount =
        document.getElementById(
            'onlineCount'
        );


    if (onlineCount) {

        onlineCount.textContent =
            Math.max(
                0,
                connectedUsers.size - 1
            );

    }

}


// ======================================================
// ENVOYER MESSAGE PUBLIC
// ======================================================

async function sendMessage() {

    const messageInput =
        document.getElementById(
            'messageInput'
        );


    if (!messageInput) {

        return;

    }


    const messageText =
        messageInput.value.trim();


    if (
        !messageText ||
        !currentUser ||
        !publicChannel
    ) {

        return;

    }


    const message = {

        id: crypto.randomUUID(),

        userId: currentUser.id,

        pseudo: currentUser.pseudo,

        age: currentUser.age,

        pays: currentUser.pays,

        text: messageText,

        timestamp: Date.now()

    };


    try {

        await publicChannel.send({

            type: 'broadcast',

            event: 'message',

            payload: message

        });


        // Afficher aussi son propre message
        displayMessage(
            message,
            true
        );


        messageInput.value = '';

        messageInput.focus();

    } catch (error) {

        console.error(
            'Erreur envoi message :',
            error
        );

        alert(
            'Impossible d’envoyer le message.'
        );

    }

}


// ======================================================
// AFFICHER MESSAGE PUBLIC
// ======================================================

function displayMessage(
    message,
    isOwn = false
) {

    const messagesContainer =
        document.getElementById(
            'messages'
        );


    if (
        !messagesContainer ||
        !message
    ) {

        return;

    }


    const messageDiv =
        document.createElement(
            'div'
        );


    messageDiv.className =
        `message ${isOwn ? 'user' : 'other'}`;


    const time =
        new Date(
            message.timestamp
        ).toLocaleTimeString(
            'fr-FR',
            {
                hour: '2-digit',
                minute: '2-digit'
            }
        );


    messageDiv.innerHTML = `

        <div class="message-author">
            ${escapeHtml(message.pseudo)}
            (${escapeHtml(String(message.age))} ans,
            ${escapeHtml(message.pays)})
        </div>

        <div>
            ${escapeHtml(message.text)}
        </div>

        <div class="message-time">
            ${time}
        </div>

    `;


    messagesContainer.appendChild(
        messageDiv
    );


    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

}


// ======================================================
// MESSAGE SYSTÈME
// ======================================================

function addSystemMessage(text) {

    const messagesContainer =
        document.getElementById(
            'messages'
        );


    if (!messagesContainer) {

        return;

    }


    const messageDiv =
        document.createElement(
            'div'
        );


    messageDiv.className =
        'message system';


    messageDiv.textContent =
        text;


    messagesContainer.appendChild(
        messageDiv
    );


    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

}


// ======================================================
// CHAT PRIVÉ
// ======================================================

function openPrivateChat(user) {

    if (!user) {

        return;

    }


    selectedPrivateUser =
        user;


    const privateTitle =
        document.getElementById(
            'privateTitle'
        );


    if (privateTitle) {

        privateTitle.textContent =
            `Chat privé avec ${user.pseudo}`;

    }


    const privateModal =
        document.getElementById(
            'privateModal'
        );


    if (privateModal) {

        privateModal.style.display =
            'flex';

    }


    if (
        !privateMessages.has(
            user.id
        )
    ) {

        privateMessages.set(
            user.id,
            []
        );

    }


    displayPrivateMessages(
        user.id
    );


    const privateInput =
        document.getElementById(
            'privateMessageInput'
        );


    if (privateInput) {

        privateInput.focus();

    }


    updateUsersList();

}


// ======================================================
// FERMER CHAT PRIVÉ
// ======================================================

function closePrivateChat() {

    selectedPrivateUser =
        null;


    const privateModal =
        document.getElementById(
            'privateModal'
        );


    if (privateModal) {

        privateModal.style.display =
            'none';

    }


    const privateInput =
        document.getElementById(
            'privateMessageInput'
        );


    if (privateInput) {

        privateInput.value = '';

    }


    updateUsersList();

}


// ======================================================
// ENVOYER MESSAGE PRIVÉ
// ======================================================

async function sendPrivateMessage() {

    if (
        !selectedPrivateUser ||
        !currentUser ||
        !privateChannel
    ) {

        return;

    }


    const messageInput =
        document.getElementById(
            'privateMessageInput'
        );


    if (!messageInput) {

        return;

    }


    const messageText =
        messageInput.value.trim();


    if (!messageText) {

        return;

    }


    const message = {

        id: crypto.randomUUID(),

        from: currentUser.id,

        to: selectedPrivateUser.id,

        fromPseudo: currentUser.pseudo,

        toPseudo: selectedPrivateUser.pseudo,

        text: messageText,

        timestamp: Date.now()

    };


    if (
        !privateMessages.has(
            selectedPrivateUser.id
        )
    ) {

        privateMessages.set(
            selectedPrivateUser.id,
            []
        );

    }


    privateMessages
        .get(
            selectedPrivateUser.id
        )
        .push(
            message
        );


    try {

        await privateChannel.send({

            type: 'broadcast',

            event: 'private-message',

            payload: message

        });


        displayPrivateMessage(
            message,
            true
        );


        messageInput.value = '';

        messageInput.focus();

    } catch (error) {

        console.error(
            'Erreur message privé :',
            error
        );

        alert(
            'Impossible d’envoyer le message privé.'
        );

    }

}


// ======================================================
// AFFICHER MESSAGE PRIVÉ
// ======================================================

function displayPrivateMessage(
    message,
    isOwn = false
) {

    const container =
        document.getElementById(
            'privateMessages'
        );


    if (
        !container ||
        !message
    ) {

        return;

    }


    const messageDiv =
        document.createElement(
            'div'
        );


    messageDiv.className =
        `private-message ${isOwn ? 'sent' : 'received'}`;


    const time =
        new Date(
            message.timestamp
        ).toLocaleTimeString(
            'fr-FR',
            {
                hour: '2-digit',
                minute: '2-digit'
            }
        );


    messageDiv.innerHTML = `

        <div>
            ${escapeHtml(message.text)}
        </div>

        <small style="opacity:0.7;">
            ${time}
        </small>

    `;


    container.appendChild(
        messageDiv
    );


    container.scrollTop =
        container.scrollHeight;

}


// ======================================================
// AFFICHER HISTORIQUE PRIVÉ
// ======================================================

function displayPrivateMessages(
    userId
) {

    const container =
        document.getElementById(
            'privateMessages'
        );


    if (!container) {

        return;

    }


    container.innerHTML = '';


    const msgs =
        privateMessages.get(
            userId
        ) || [];


    if (msgs.length === 0) {

        container.innerHTML = `

            <div style="
                text-align:center;
                color:#999;
                padding:20px;
            ">
                Commencez une conversation ! 💬
            </div>

        `;

        return;

    }


    msgs.forEach(
        function(msg) {

            displayPrivateMessage(
                msg,
                currentUser &&
                msg.from === currentUser.id
            );

        }
    );

}


// ======================================================
// DÉCONNEXION
// ======================================================

async function logout() {

    if (!currentUser) {

        return;

    }


    if (presenceChannel) {

        try {

            await presenceChannel.untrack();

        } catch (error) {

            console.log(
                'Erreur déconnexion présence :',
                error
            );

        }


        try {

            await supabaseClient.removeChannel(
                presenceChannel
            );

        } catch (error) {

            console.log(error);

        }

    }


    if (publicChannel) {

        try {

            await supabaseClient.removeChannel(
                publicChannel
            );

        } catch (error) {

            console.log(error);

        }

    }


    if (privateChannel) {

        try {

            await supabaseClient.removeChannel(
                privateChannel
            );

        } catch (error) {

            console.log(error);

        }

    }


    presenceChannel = null;

    publicChannel = null;

    privateChannel = null;

    currentUser = null;

    selectedPrivateUser = null;

    connectedUsers.clear();

    privateMessages.clear();


    const profileForm =
        document.getElementById(
            'profileForm'
        );


    if (profileForm) {

        profileForm.reset();

    }


    const loginSection =
        document.getElementById(
            'loginSection'
        );


    if (loginSection) {

        loginSection.style.display =
            'block';

    }


    const chatSection =
        document.getElementById(
            'chatSection'
        );


    if (chatSection) {

        chatSection.style.display =
            'none';

    }


    const privateModal =
        document.getElementById(
            'privateModal'
        );


    if (privateModal) {

        privateModal.style.display =
            'none';

    }


    const usersList =
        document.getElementById(
            'usersList'
        );


    if (usersList) {

        usersList.innerHTML = '';

    }


    const onlineCount =
        document.getElementById(
            'onlineCount'
        );


    if (onlineCount) {

        onlineCount.textContent =
            '0';

    }


    const messagesContainer =
        document.getElementById(
            'messages'
        );


    if (messagesContainer) {

        messagesContainer.innerHTML =
            '<div class="message system">Bienvenue dans OceanChat ! 👋</div>';

    }

}


// ======================================================
// TOUCHE ENTRÉE
// ======================================================

const messageInput =
    document.getElementById(
        'messageInput'
    );


if (messageInput) {

    messageInput.addEventListener(
        'keypress',
        function(e) {

            if (
                e.key === 'Enter'
            ) {

                e.preventDefault();

                sendMessage();

            }

        }
    );

}


const privateMessageInput =
    document.getElementById(
        'privateMessageInput'
    );


if (privateMessageInput) {

    privateMessageInput.addEventListener(
        'keypress',
        function(e) {

            if (
                e.key === 'Enter'
            ) {

                e.preventDefault();

                sendPrivateMessage();

            }

        }
    );

}


// ======================================================
// INSCRIPTION
// ======================================================

const signupForm =
    document.getElementById(
        'signupForm'
    );


if (signupForm) {

    signupForm.addEventListener(
        'submit',
        function(e) {

            e.preventDefault();

            alert(
                "L'inscription avec Supabase Auth sera activée prochainement."
            );

        }
    );

}


// ======================================================
// SÉCURITÉ
// ======================================================

function escapeHtml(text) {

    const div =
        document.createElement(
            'div'
        );

    // CORRECTION DE L'ERREUR =p
    div.textContent =
        String(text);

    return div.innerHTML;

}


// ======================================================
// OCEANCHAT PRÊT
// ======================================================

console.log(
    '🌊 OceanChat est prêt !'
);
```

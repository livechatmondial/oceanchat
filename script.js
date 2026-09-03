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

document.getElementById('profileForm').addEventListener(
    'submit',
    async function(e) {

        e.preventDefault();

        const pseudo =
            document.getElementById('pseudo').value.trim();

        const age =
            parseInt(document.getElementById('age').value);

        const sexe =
            document.getElementById('sexe').value;

        const pays =
            document.getElementById('pays').value;


        if (!pseudo || !age || !sexe || !pays) {

            alert('Veuillez remplir tous les champs.');

            return;
        }


        if (!supabaseClient) {

            alert(
                'La connexion temps réel Supabase n’est pas configurée.'
            );

            return;
        }


        // Identifiant unique pour cette session
        currentUser = {

            id: crypto.randomUUID(),

            pseudo: pseudo,

            age: age,

            sexe: sexe,

            pays: pays,

            connectedAt: Date.now()
        };


        document.getElementById(
            'loginSection'
        ).style.display = 'none';


        document.getElementById(
            'chatSection'
        ).style.display = 'flex';


        updateUserInfo();


        await connectRealtime();

    }
);


// ======================================================
// CONNEXION REALTIME
// ======================================================

async function connectRealtime() {

    // -----------------------------
    // PRÉSENCE : UTILISATEURS EN LIGNE
    // -----------------------------

    presenceChannel = supabaseClient.channel(
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
        { event: 'sync' },
        updateOnlineUsers
    );


    presenceChannel.on(
        'presence',
        { event: 'join' },
        updateOnlineUsers
    );


    presenceChannel.on(
        'presence',
        { event: 'leave' },
        updateOnlineUsers
    );


    await presenceChannel.subscribe(
        async function(status) {

            console.log(
                'Statut présence :',
                status
            );


            if (status === 'SUBSCRIBED') {

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
        { event: 'message' },
        function(data) {

            const message =
                data.payload;


            displayMessage(
                message,
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
        { event: 'private-message' },
        function(data) {

            const message =
                data.payload;


            if (!currentUser) {
                return;
            }


            if (
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
                    .get(selectedPrivateUser.id)
                    .push(message);


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
        .forEach(function(user) {

            if (user && user.id) {

                connectedUsers.set(
                    user.id,
                    user
                );
            }

        });


    updateUsersList();
}


// ======================================================
// INFORMATIONS UTILISATEUR
// ======================================================

function updateUserInfo() {

    if (!currentUser) {
        return;
    }


    document.getElementById(
        'userDisplay'
    ).textContent =
        `${currentUser.pseudo} (${currentUser.age} ans, ${currentUser.pays})`;
}


// ======================================================
// LISTE DES UTILISATEURS
// ======================================================

function updateUsersList() {

    const usersList =
        document.getElementById('usersList');


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
                document.createElement('div');


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
                    ${user.age} ans •
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


    document.getElementById(
        'onlineCount'
    ).textContent =
        Math.max(
            0,
            connectedUsers.size - 1
        );
}


// ======================================================
// ENVOYER MESSAGE PUBLIC
// ======================================================

async function sendMessage() {

    const messageInput =
        document.getElementById(
            'messageInput'
        );


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


    await publicChannel.send({

        type: 'broadcast',

        event: 'message',

        payload: message

    });


    messageInput.value = '';

    messageInput.focus();
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
            (${message.age} ans,
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

    selectedPrivateUser =
        user;


    document.getElementById(
        'privateTitle'
    ).textContent =
        `Chat privé avec ${user.pseudo}`;


    document.getElementById(
        'privateModal'
    ).style.display =
        'flex';


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


    document.getElementById(
        'privateMessageInput'
    ).focus();


    updateUsersList();
}


// ======================================================
// FERMER CHAT PRIVÉ
// ======================================================

function closePrivateChat() {

    selectedPrivateUser =
        null;


    document.getElementById(
        'privateModal'
    ).style.display =
        'none';


    document.getElementById(
        'privateMessageInput'
    ).value = '';


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
        .get(selectedPrivateUser.id)
        .push(message);


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

            console.log(error);

        }


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


    presenceChannel = null;

    publicChannel = null;

    privateChannel = null;

    currentUser = null;

    selectedPrivateUser = null;

    connectedUsers.clear();


    document.getElementById(
        'profileForm'
    ).reset();


    document.getElementById(
        'loginSection'
    ).style.display =
        'block';


    document.getElementById(
        'chatSection'
    ).style.display =
        'none';


    document.getElementById(
        'privateModal'
    ).style.display =
        'none';


    document.getElementById(
        'usersList'
    ).innerHTML =
        '';


    document.getElementById(
        'onlineCount'
    ).textContent =
        '0';


    document.getElementById(
        'messages'
    ).innerHTML =
        '<div class="message system">Bienvenue dans OceanChat ! 👋</div>';
}


// ======================================================
// TOUCHE ENTRÉE
// ======================================================

document.getElementById(
    'messageInput'
).addEventListener(
    'keypress',
    function(e) {

        if (e.key === 'Enter') {
            sendMessage();
        }

    }
);


document.getElementById(
    'privateMessageInput'
).addEventListener(
    'keypress',
    function(e) {

        if (e.key === 'Enter') {
            sendPrivateMessage();
        }

    }
);


// ======================================================
// INSCRIPTION
// ======================================================

document.getElementById(
    'signupForm'
).addEventListener(
    'submit',
    function(e) {

        e.preventDefault();

        alert(
            "L'inscription sera activée avec Supabase Auth."
        );

    }
);


// ======================================================
// SÉCURITÉ
// ======================================================

function escapeHtml(text) {

    const div =
        document.createElement(
            'div'
        );

    div.textContent =
        String(text);

    return div.innerHTML;
}


console.log(
    '🌊 OceanChat est prêt !'
);
```

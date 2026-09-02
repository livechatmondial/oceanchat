// État de l'application
let currentUser = null;
let messages = [];
let privateMessages = new Map(); // { recipientId: [messages] }
let selectedPrivateUser = null;

// Stockage local des utilisateurs connectés
const connectedUsers = new Map();

// EVENT: Soumission du profil
document.getElementById('profileForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const pseudo = document.getElementById('pseudo').value.trim();
    const age = document.getElementById('age').value;
    const sexe = document.getElementById('sexe').value;
    const pays = document.getElementById('pays').value;

    if (!pseudo || !age || !sexe || !pays) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    // Créer l'utilisateur
    currentUser = {
        id: Date.now(),
        pseudo: pseudo,
        age: parseInt(age),
        sexe: sexe,
        pays: pays,
        connectedAt: new Date()
    };

    // Ajouter aux utilisateurs connectés
    connectedUsers.set(currentUser.id, currentUser);

    // Afficher la section chat
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('chatSection').style.display = 'flex';

    // Mettre à jour les infos utilisateur
    updateUserInfo();
    updateUsersList();

    // Message système
    addSystemMessage(`${pseudo} a rejoint le chat ! 🎉`);
});

// EVENT: Soumettre un message public
document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// EVENT: Soumettre un message privé
document.getElementById('privateMessageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendPrivateMessage();
    }
});

// FONCTION: Envoyer un message public
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();

    if (!messageText || !currentUser) return;

    // Créer le message
    const message = {
        id: Date.now(),
        userId: currentUser.id,
        pseudo: currentUser.pseudo,
        age: currentUser.age,
        pays: currentUser.pays,
        text: messageText,
        timestamp: new Date()
    };

    messages.push(message);

    // Afficher le message
    displayMessage(message, true);

    // Réinitialiser l'input
    messageInput.value = '';
    messageInput.focus();

    // Simuler des réponses (optionnel)
    simulateResponses(messageText);
}

// FONCTION: Afficher un message public
function displayMessage(message, isOwn = false) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${isOwn ? 'user' : 'other'}`;
    
    const time = message.timestamp.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    messageDiv.innerHTML = `
        <div class="message-author">${message.pseudo} (${message.age} ans, ${message.pays})</div>
        <div>${escapeHtml(message.text)}</div>
        <div class="message-time">${time}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// FONCTION: Ajouter un message système
function addSystemMessage(text) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// FONCTION: Mettre à jour les infos utilisateur
function updateUserInfo() {
    if (!currentUser) return;
    
    const userDisplay = document.getElementById('userDisplay');
    userDisplay.textContent = `${currentUser.pseudo} (${currentUser.age} ans, ${currentUser.pays})`;
}

// FONCTION: Mettre à jour la liste des utilisateurs
function updateUsersList() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    connectedUsers.forEach(user => {
        if (user.id === currentUser.id) return; // Ne pas afficher l'utilisateur actuel

        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        if (selectedPrivateUser && selectedPrivateUser.id === user.id) {
            userItem.classList.add('active');
        }

        userItem.innerHTML = `
            <div class="user-item-name">👤 ${user.pseudo}</div>
            <div class="user-item-info">${user.age} ans • ${user.pays}</div>
            <div class="user-item-info">${user.sexe}</div>
        `;

        userItem.addEventListener('click', () => openPrivateChat(user));
        usersList.appendChild(userItem);
    });

    // Mettre à jour le nombre d'utilisateurs
    document.getElementById('onlineCount').textContent = connectedUsers.size - 1; // Enlever l'utilisateur actuel
}

// FONCTION: Ouvrir le chat privé
function openPrivateChat(user) {
    selectedPrivateUser = user;

    // Mettre à jour le titre et initialiser les messages
    document.getElementById('privateTitle').textContent = `Chat privé avec ${user.pseudo}`;
    
    if (!privateMessages.has(user.id)) {
        privateMessages.set(user.id, []);
    }

    // Afficher le modal
    document.getElementById('privateModal').style.display = 'flex';

    // Afficher les messages privés
    displayPrivateMessages(user.id);

    // Focus sur l'input
    document.getElementById('privateMessageInput').focus();

    // Mettre à jour la liste (pour marquer comme actif)
    updateUsersList();
}

// FONCTION: Fermer le chat privé
function closePrivateChat() {
    selectedPrivateUser = null;
    document.getElementById('privateModal').style.display = 'none';
    document.getElementById('privateMessageInput').value = '';
    updateUsersList();
}

// FONCTION: Envoyer un message privé
function sendPrivateMessage() {
    if (!selectedPrivateUser) return;

    const messageInput = document.getElementById('privateMessageInput');
    const messageText = messageInput.value.trim();

    if (!messageText || !currentUser) return;

    // Créer le message privé
    const message = {
        id: Date.now(),
        from: currentUser.id,
        to: selectedPrivateUser.id,
        fromPseudo: currentUser.pseudo,
        toPseudo: selectedPrivateUser.pseudo,
        text: messageText,
        timestamp: new Date()
    };

    // Ajouter à la conversation
    if (!privateMessages.has(selectedPrivateUser.id)) {
        privateMessages.set(selectedPrivateUser.id, []);
    }
    privateMessages.get(selectedPrivateUser.id).push(message);

    // Afficher le message
    displayPrivateMessage(message, true);

    // Réinitialiser l'input
    messageInput.value = '';
    messageInput.focus();
}

// FONCTION: Afficher un message privé
function displayPrivateMessage(message, isOwn = false) {
    const container = document.getElementById('privateMessages');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `private-message ${isOwn ? 'sent' : 'received'}`;

    const time = message.timestamp.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    messageDiv.innerHTML = `
        <div>${escapeHtml(message.text)}</div>
        <small style="opacity: 0.7;">${time}</small>
    `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// FONCTION: Afficher les messages privés d'une conversation
function displayPrivateMessages(userId) {
    const container = document.getElementById('privateMessages');
    container.innerHTML = '';

    const msgs = privateMessages.get(userId) || [];

    if (msgs.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">Commencez une conversation ! 💬</div>';
        return;
    }

    msgs.forEach(msg => {
        displayPrivateMessage(msg, msg.from === currentUser.id);
    });
}

// FONCTION: Déconnexion
function logout() {
    if (!currentUser) return;

    addSystemMessage(`${currentUser.pseudo} a quitté le chat 👋`);
    connectedUsers.delete(currentUser.id);
    currentUser = null;
    selectedPrivateUser = null;

    // Réinitialiser le formulaire
    document.getElementById('profileForm').reset();
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('chatSection').style.display = 'none';
    document.getElementById('privateModal').style.display = 'none';
    document.getElementById('messages').innerHTML = '<div class="message system">Bienvenue dans OceanChat ! 👋</div>';
    document.getElementById('messageInput').value = '';

    updateUsersList();
}

// FONCTION: Simuler des réponses de bot
function simulateResponses(messageText) {
    const responses = [
        '😊 Bonne remarque !',
        '✨ C\'est intéressant !',
        '👍 Je suis d\'accord !',
        '🤔 Que penses-tu de ça ?',
        '💬 Parle-moi plus !',
    ];

    if (messageText.toLowerCase().includes('bonjour') || 
        messageText.toLowerCase().includes('salut') ||
        messageText.toLowerCase().includes('hello')) {
        
        setTimeout(() => {
            if (currentUser) {
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                const botMessage = {
                    id: Date.now(),
                    userId: 'bot',
                    pseudo: '🤖 OceanBot',
                    age: '?',
                    pays: 'Web',
                    text: randomResponse,
                    timestamp: new Date()
                };
                messages.push(botMessage);
                displayMessage(botMessage, false);
            }
        }, 500 + Math.random() * 1000);
    }
}

// FONCTION: Échapper les caractères HTML (sécurité)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// EVENT: Formulaire d'inscription
document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formInputs = this.querySelectorAll('input');
    const email = formInputs[0].value;
    const password = formInputs[1].value;
    const confirmPassword = formInputs[2].value;

    if (password !== confirmPassword) {
        alert('Les mots de passe ne correspondent pas');
        return;
    }

    if (password.length < 6) {
        alert('Le mot de passe doit contenir au moins 6 caractères');
        return;
    }

    alert(`✅ Inscription réussie pour ${email}!\\n\\nBienvenue sur OceanChat!`);
    this.reset();
});

// Initialisation
console.log('🌊 OceanChat est prêt !');
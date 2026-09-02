// État de l'application
let currentUser = null;
let users = [];
let messages = [];

// Stockage local des utilisateurs connectés
const connectedUsers = new Map();

// Événement soumission du profil
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
        age: age,
        sexe: sexe,
        pays: pays,
        connectedAt: new Date()
    };

    // Ajouter aux utilisateurs connectés
    connectedUsers.set(currentUser.id, currentUser);

    // Afficher la section chat
    document.getElementById('profileForm').parentElement.style.display = 'none';
    document.getElementById('chatSection').style.display = 'flex';

    // Mettre à jour les infos utilisateur
    updateUserInfo();
    updateUsersList();

    // Message système
    addSystemMessage(`${pseudo} a rejoint le chat ! 🎉`);
});

// Soumettre un message
document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

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

function displayMessage(message, isOwn = false) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${isOwn ? 'user' : 'other'}`;
    
    const time = message.timestamp.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    messageDiv.innerHTML = `
        <div class="message-author">${message.pseudo} (${message.age} ans) - ${message.pays}</div>
        <div>${escapeHtml(message.text)}</div>
        <small style="opacity: 0.7;">${time}</small>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addSystemMessage(text) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateUserInfo() {
    if (!currentUser) return;
    
    const userInfo = document.getElementById('userInfo');
    userInfo.innerHTML = `
        👤 ${currentUser.pseudo} (${currentUser.age} ans) - ${currentUser.sexe} - ${currentUser.pays}
    `;
}

function updateUsersList() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    connectedUsers.forEach(user => {
        const userBadge = document.createElement('div');
        userBadge.className = 'user-badge';
        userBadge.textContent = `${user.pseudo} (${user.age}a, ${user.pays})`;
        usersList.appendChild(userBadge);
    });

    // Afficher le nombre d'utilisateurs
    const onlineUsersHeader = document.querySelector('.online-users h3');
    onlineUsersHeader.textContent = `Utilisateurs en ligne (${connectedUsers.size})`;
}

function logout() {
    if (!currentUser) return;

    addSystemMessage(`${currentUser.pseudo} a quitté le chat 👋`);
    connectedUsers.delete(currentUser.id);
    currentUser = null;

    // Réinitialiser le formulaire
    document.getElementById('profileForm').reset();
    document.getElementById('profileForm').parentElement.style.display = 'block';
    document.getElementById('chatSection').style.display = 'none';
    document.getElementById('messages').innerHTML = '<div class="message system">Bienvenue dans OceanChat ! 👋</div>';
    document.getElementById('messageInput').value = '';

    updateUsersList();
}

// Simuler des réponses de bot (optionnel)
function simulateResponses(messageText) {
    const responses = [
        '😊 Bonne remarque !',
        '✨ C\'est intéressant !',
        '👍 Je suis d\'accord !',
        '🤔 Que penses-tu de ça ?',
        '💬 Parle-moi plus !',
    ];

    // Seulement si le message contient certains mots
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

// Fonction pour échapper les caractères HTML (sécurité)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Formulaire d'inscription
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

    alert(`✅ Inscription réussie pour ${email}!\n\nBienvenue sur OceanChat!`);
    this.reset();
});

// Initialisation
console.log('🌊 OceanChat est prêt !');
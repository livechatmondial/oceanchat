// 🌊 OceanChat - Script principal

const SUPABASE_URL = window.OCEANCHAT_SUPABASE_URL;
const SUPABASE_KEY = window.OCEANCHAT_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  alert("Erreur : configuration Supabase introuvable.");
  throw new Error("Configuration Supabase manquante.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ===============================
// UTILISATEUR ACTUEL
// ===============================

let currentUser = {
  id: crypto.randomUUID(),
  pseudo: "",
  age: "",
  sexe: "",
  pays: ""
};

let presenceChannel = null;
let publicChannel = null;
let privateChannel = null;

let onlineUsers = new Map();

// Conversations privées
const privateConversations = new Map();

let activeConversationId = null;

// ===============================
// ELEMENTS HTML
// ===============================

const loginSection = document.getElementById("loginSection");
const chatSection = document.getElementById("chatSection");

const profileForm = document.getElementById("profileForm");

const pseudoInput = document.getElementById("pseudo");
const ageInput = document.getElementById("age");
const sexeInput = document.getElementById("sexe");
const paysInput = document.getElementById("pays");

const usersList = document.getElementById("usersList");
const onlineCount = document.getElementById("onlineCount");

const logoutBtn = document.getElementById("logoutBtn");

const messages = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

const privateModal = document.getElementById("privateModal");
const privateTitle = document.getElementById("privateTitle");
const privateMessages = document.getElementById("privateMessages");

const privateMessageForm =
  document.getElementById("privateMessageForm");

const privateMessageInput =
  document.getElementById("privateMessageInput");

const minimizePrivate =
  document.getElementById("minimizePrivate");

const closePrivate =
  document.getElementById("closePrivate");

const privateChatsBar =
  document.getElementById("privateChatsBar");

// ===============================
// CONNEXION
// ===============================

profileForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const pseudo = pseudoInput.value.trim();
  const age = ageInput.value.trim();
  const sexe = sexeInput.value;
  const pays = paysInput.value.trim();

  if (!pseudo || !age || !sexe || !pays) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  currentUser.pseudo = pseudo;
  currentUser.age = age;
  currentUser.sexe = sexe;
  currentUser.pays = pays;

  loginSection.style.display = "none";
  chatSection.style.display = "flex";

  await startChat();
});

// ===============================
// DEMARRER LE CHAT
// ===============================

async function startChat() {
  await startPresence();
  startPublicChat();
  startPrivateChat();

  addSystemMessage(
    `Bienvenue ${currentUser.pseudo} 👋`
  );
}

// ===============================
// PRESENCE
// ===============================

async function startPresence() {
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

  presenceChannel.on(
    "presence",
    {
      event: "sync"
    },
    function () {
      updateOnlineUsers();
    }
  );

  presenceChannel.on(
    "presence",
    {
      event: "join"
    },
    function () {
      updateOnlineUsers();
    }
  );

  presenceChannel.on(
    "presence",
    {
      event: "leave"
    },
    function () {
      updateOnlineUsers();
    }
  );

  await presenceChannel.subscribe(async function (status) {
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
}

// ===============================
// UTILISATEURS EN LIGNE
// ===============================

function updateOnlineUsers() {
  if (!presenceChannel) return;

  const state = presenceChannel.presenceState();

  onlineUsers.clear();

  Object.keys(state).forEach(function (key) {
    const entries = state[key];

    if (!entries || entries.length === 0) return;

    const user = entries[entries.length - 1];

    if (user.id !== currentUser.id) {
      onlineUsers.set(user.id, user);
    }
  });

  renderOnlineUsers();
}

// ===============================
// AFFICHER LES UTILISATEURS
// ===============================

function renderOnlineUsers() {
  usersList.innerHTML = "";

  onlineCount.textContent = onlineUsers.size;

  if (onlineUsers.size === 0) {
    const empty = document.createElement("div");

    empty.className = "empty-users";
    empty.textContent = "Aucun autre utilisateur en ligne.";

    usersList.appendChild(empty);

    return;
  }

  onlineUsers.forEach(function (user) {
    const button = document.createElement("button");

    button.className = "online-user";

    button.type = "button";

    const name = document.createElement("strong");
    name.textContent = user.pseudo || "Utilisateur";

    const info = document.createElement("span");

    info.textContent =
      `${user.age || ""} ans • ${user.sexe || ""} • ${user.pays || ""}`;

    button.appendChild(name);
    button.appendChild(info);

    button.addEventListener("click", function () {
      openPrivateConversation(user);
    });

    usersList.appendChild(button);
  });
}

// ===============================
// CHAT PUBLIC
// ===============================

function startPublicChat() {
  publicChannel = supabaseClient.channel(
    "oceanchat-public"
  );

  publicChannel.on(
    "broadcast",
    {
      event: "public-message"
    },
    function (payload) {
      const data = payload.payload;

      if (!data) return;

      addPublicMessage(
        data.pseudo,
        data.text,
        data.userId === currentUser.id
      );
    }
  );

  publicChannel.subscribe();
}

// ===============================
// ENVOYER MESSAGE PUBLIC
// ===============================

messageForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text) return;

  messageInput.value = "";

  await publicChannel.send({
    type: "broadcast",
    event: "public-message",
    payload: {
      userId: currentUser.id,
      pseudo: currentUser.pseudo,
      text: text,
      timestamp: Date.now()
    }
  });
});

// ===============================
// AFFICHER MESSAGE PUBLIC
// ===============================

function addPublicMessage(pseudo, text, ownMessage) {
  const div = document.createElement("div");

  div.className =
    ownMessage
      ? "message own-message"
      : "message";

  const name = document.createElement("strong");
  name.textContent = pseudo + " : ";

  const content = document.createElement("span");
  content.textContent = text;

  div.appendChild(name);
  div.appendChild(content);

  messages.appendChild(div);

  messages.scrollTop = messages.scrollHeight;
}

// ===============================
// MESSAGE SYSTEME
// ===============================

function addSystemMessage(text) {
  const div = document.createElement("div");

  div.className = "system-message";

  div.textContent = text;

  messages.appendChild(div);

  messages.scrollTop = messages.scrollHeight;
}

// ===============================
// CHAT PRIVE
// ===============================

function startPrivateChat() {
  privateChannel = supabaseClient.channel(
    "oceanchat-private-messages"
  );

  privateChannel.on(
    "broadcast",
    {
      event: "private-message"
    },
    function (payload) {
      const data = payload.payload;

      if (!data) return;

      // Ignorer les messages qui ne nous concernent pas
      if (
        data.receiverId !== currentUser.id &&
        data.senderId !== currentUser.id
      ) {
        return;
      }

      // Si le message vient d'un autre utilisateur
      if (data.receiverId === currentUser.id) {
        const otherUser = {
          id: data.senderId,
          pseudo: data.senderPseudo,
          age: data.senderAge,
          sexe: data.senderSexe,
          pays: data.senderPays
        };

        savePrivateMessage(
          data.conversationId,
          data,
          otherUser
        );

        openPrivateConversation(
          otherUser,
          false
        );
      }
    }
  );

  privateChannel.subscribe();
}

// ===============================
// ID CONVERSATION
// ===============================

function getConversationId(userId1, userId2) {
  return [userId1, userId2]
    .sort()
    .join("_");
}

// ===============================
// OUVRIR CONVERSATION
// ===============================

function openPrivateConversation(user, clearExisting = false) {
  if (!user || !user.id) return;

  const conversationId = getConversationId(
    currentUser.id,
    user.id
  );

  if (!privateConversations.has(conversationId)) {
    privateConversations.set(conversationId, {
      user: user,
      messages: []
    });
  }

  privateConversations.get(conversationId).user = user;

  activeConversationId = conversationId;

  privateTitle.textContent =
    `💬 ${user.pseudo}`;

  renderPrivateMessages();

  privateModal.style.display = "flex";

  privateChatsBar.style.display = "flex";

  renderPrivateChatsBar();

  setTimeout(function () {
    privateMessageInput.focus();
  }, 100);
}

// ===============================
// AFFICHER MESSAGES PRIVES
// ===============================

function renderPrivateMessages() {
  privateMessages.innerHTML = "";

  if (!activeConversationId) return;

  const conversation =
    privateConversations.get(activeConversationId);

  if (!conversation) return;

  conversation.messages.forEach(function (message) {
    addPrivateMessageToScreen(
      message,
      message.senderId === currentUser.id
    );
  });

  privateMessages.scrollTop =
    privateMessages.scrollHeight;
}

// ===============================
// AFFICHER UN MESSAGE PRIVE
// ===============================

function addPrivateMessageToScreen(message, own) {
  const div = document.createElement("div");

  div.className =
    own
      ? "private-message own-private-message"
      : "private-message";

  const name = document.createElement("strong");

  name.textContent =
    own
      ? "Moi : "
      : `${message.senderPseudo || "Utilisateur"} : `;

  const text = document.createElement("span");

  text.textContent = message.text;

  div.appendChild(name);
  div.appendChild(text);

  privateMessages.appendChild(div);
}

// ===============================
// SAUVEGARDER MESSAGE EN MEMOIRE
// ===============================

function savePrivateMessage(
  conversationId,
  message,
  user
) {
  if (!privateConversations.has(conversationId)) {
    privateConversations.set(conversationId, {
      user: user,
      messages: []
    });
  }

  const conversation =
    privateConversations.get(conversationId);

  conversation.user = user;

  conversation.messages.push(message);
}

// ===============================
// ENVOYER MESSAGE PRIVE
// ===============================

privateMessageForm.addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    const text =
      privateMessageInput.value.trim();

    if (!text) return;

    if (!activeConversationId) return;

    const conversation =
      privateConversations.get(
        activeConversationId
      );

    if (!conversation) return;

    const receiver = conversation.user;

    const message = {
      conversationId: activeConversationId,

      senderId: currentUser.id,
      senderPseudo: currentUser.pseudo,
      senderAge: currentUser.age,
      senderSexe: currentUser.sexe,
      senderPays: currentUser.pays,

      receiverId: receiver.id,

      text: text,

      timestamp: Date.now()
    };

    // Vider immédiatement le champ
    privateMessageInput.value = "";

    // Ajouter notre message localement
    savePrivateMessage(
      activeConversationId,
      message,
      receiver
    );

    renderPrivateMessages();

    // Envoyer à l'autre utilisateur
    await privateChannel.send({
      type: "broadcast",
      event: "private-message",
      payload: message
    });

    privateMessageInput.focus();
  }
);

// ===============================
// BARRE DES CONVERSATIONS REDUITES
// ===============================

function renderPrivateChatsBar() {
  privateChatsBar.innerHTML = "";

  if (privateConversations.size === 0) {
    privateChatsBar.style.display = "none";
    return;
  }

  privateChatsBar.style.display = "flex";

  privateConversations.forEach(
    function (conversation, conversationId) {
      const button = document.createElement("button");

      button.type = "button";

      button.className =
        "minimized-private-chat";

      if (
        conversationId === activeConversationId &&
        privateModal.style.display === "none"
      ) {
        button.classList.add("active");
      }

      button.textContent =
        `💬 ${conversation.user.pseudo}`;

      button.addEventListener(
        "click",
        function () {
          activeConversationId =
            conversationId;

          privateTitle.textContent =
            `💬 ${conversation.user.pseudo}`;

          renderPrivateMessages();

          privateModal.style.display =
            "flex";

          renderPrivateChatsBar();

          setTimeout(function () {
            privateMessageInput.focus();
          }, 100);
        }
      );

      privateChatsBar.appendChild(button);
    }
  );
}

// ===============================
// REDUIRE FENETRE PRIVEE
// ===============================

minimizePrivate.addEventListener(
  "click",
  function () {
    privateModal.style.display = "none";

    renderPrivateChatsBar();
  }
);

// ===============================
// FERMER CONVERSATION
// ===============================

closePrivate.addEventListener(
  "click",
  function () {
    if (activeConversationId) {
      privateConversations.delete(
        activeConversationId
      );
    }

    activeConversationId = null;

    privateModal.style.display = "none";

    renderPrivateChatsBar();
  }
);

// ===============================
// DECONNEXION
// ===============================

logoutBtn.addEventListener(
  "click",
  async function () {
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
      console.error(error);
    }

    window.location.reload();
  }
);

// ===============================
// SECURITE
// ===============================

window.addEventListener(
  "beforeunload",
  function () {
    try {
      if (presenceChannel) {
        presenceChannel.untrack();
      }
    } catch (error) {
      console.error(error);
    }
  }
);

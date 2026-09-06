// 🌊 OceanChat - Script principal

document.addEventListener("DOMContentLoaded", () => {

  console.log("OceanChat : script chargé");

  // =========================
  // SUPABASE
  // =========================

  if (
    typeof window.supabase === "undefined" ||
    !window.OCEANCHAT_SUPABASE_URL ||
    !window.OCEANCHAT_SUPABASE_KEY
  ) {
    console.error("Configuration Supabase manquante.");
    alert("Erreur de configuration. Vérifie supabase-config.js.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    window.OCEANCHAT_SUPABASE_URL,
    window.OCEANCHAT_SUPABASE_KEY
  );

  // =========================
  // ELEMENTS
  // =========================

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

  // Vérification des éléments
  if (!profileForm) {
    console.error("profileForm introuvable.");
    return;
  }

  // =========================
  // UTILISATEUR
  // =========================

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

  const onlineUsers = new Map();
  const privateConversations = new Map();

  let activeConversationId = null;

  // =========================
  // CONNECTER
  // =========================

  profileForm.addEventListener("submit", async (event) => {

    // TRÈS IMPORTANT :
    // empêche la page de revenir à la page initiale
    event.preventDefault();
    event.stopPropagation();

    console.log("Bouton Connecter cliqué");

    const pseudo = pseudoInput.value.trim();
    const age = ageInput.value.trim();
    const sexe = sexeInput.value;
    const pays = paysInput.value.trim();

    if (!pseudo || !age || !sexe || !pays) {
      alert("Remplis tous les champs.");
      return;
    }

    currentUser.pseudo = pseudo;
    currentUser.age = age;
    currentUser.sexe = sexe;
    currentUser.pays = pays;

    console.log("Utilisateur connecté :", currentUser);

    // Cacher connexion
    loginSection.style.display = "none";

    // Afficher chat
    chatSection.style.display = "flex";

    // Démarrer les services
    await startPresence();
    startPublicChat();
    startPrivateChat();

    addSystemMessage(
      `Bienvenue ${currentUser.pseudo} 👋`
    );
  });

  // =========================
  // PRESENCE
  // =========================

  async function startPresence() {

    try {

      presenceChannel = supabaseClient.channel(
        "oceanchat-online-users",
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
        { event: "sync" },
        () => {
          updateOnlineUsers();
        }
      );

      presenceChannel.on(
        "presence",
        { event: "join" },
        () => {
          updateOnlineUsers();
        }
      );

      presenceChannel.on(
        "presence",
        { event: "leave" },
        () => {
          updateOnlineUsers();
        }
      );

      await presenceChannel.subscribe(async (status) => {

        console.log("Presence :", status);

        if (status === "SUBSCRIBED") {

          await presenceChannel.track({
            id: currentUser.id,
            pseudo: currentUser.pseudo,
            age: currentUser.age,
            sexe: currentUser.sexe,
            pays: currentUser.pays
          });

          updateOnlineUsers();
        }
      });

    } catch (error) {
      console.error("Erreur présence :", error);
    }
  }

  // =========================
  // UTILISATEURS EN LIGNE
  // =========================

  function updateOnlineUsers() {

    if (!presenceChannel) return;

    const state = presenceChannel.presenceState();

    onlineUsers.clear();

    Object.keys(state).forEach((key) => {

      const list = state[key];

      if (!list || list.length === 0) return;

      const user = list[list.length - 1];

      if (
        user.id &&
        user.id !== currentUser.id
      ) {
        onlineUsers.set(user.id, user);
      }
    });

    renderOnlineUsers();
  }

  function renderOnlineUsers() {

    usersList.innerHTML = "";

    onlineCount.textContent =
      onlineUsers.size;

    if (onlineUsers.size === 0) {

      const empty = document.createElement("div");

      empty.textContent =
        "Aucun autre utilisateur en ligne.";

      usersList.appendChild(empty);

      return;
    }

    onlineUsers.forEach((user) => {

      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "online-user";

      const name =
        document.createElement("strong");

      name.textContent =
        user.pseudo || "Utilisateur";

      const info =
        document.createElement("span");

      info.textContent =
        `${user.age || ""} ans • ${user.sexe || ""} • ${user.pays || ""}`;

      button.appendChild(name);
      button.appendChild(info);

      button.addEventListener("click", () => {
        openPrivateConversation(user);
      });

      usersList.appendChild(button);
    });
  }

  // =========================
  // CHAT PUBLIC
  // =========================

  function startPublicChat() {

    publicChannel =
      supabaseClient.channel(
        "oceanchat-public"
      );

    publicChannel.on(
      "broadcast",
      { event: "public-message" },
      (payload) => {

        const data = payload.payload;

        if (!data) return;

        addPublicMessage(
          data.pseudo,
          data.text,
          data.userId === currentUser.id
        );
      }
    );

    publicChannel.subscribe((status) => {
      console.log("Chat public :", status);
    });
  }

  // =========================
  // ENVOYER MESSAGE PUBLIC
  // =========================

  messageForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();
      event.stopPropagation();

      const text =
        messageInput.value.trim();

      if (!text) return;

      messageInput.value = "";

      if (!publicChannel) return;

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
    }
  );

  // =========================
  // MESSAGE PUBLIC
  // =========================

  function addPublicMessage(
    pseudo,
    text,
    own
  ) {

    const div =
      document.createElement("div");

    div.className =
      own
        ? "message own-message"
        : "message";

    const name =
      document.createElement("strong");

    name.textContent =
      `${pseudo} : `;

    const content =
      document.createElement("span");

    content.textContent = text;

    div.appendChild(name);
    div.appendChild(content);

    messages.appendChild(div);

    messages.scrollTop =
      messages.scrollHeight;
  }

  // =========================
  // MESSAGE SYSTEME
  // =========================

  function addSystemMessage(text) {

    const div =
      document.createElement("div");

    div.className =
      "system-message";

    div.textContent = text;

    messages.appendChild(div);

    messages.scrollTop =
      messages.scrollHeight;
  }

  // =========================
  // CHAT PRIVE
  // =========================

  function startPrivateChat() {

    privateChannel =
      supabaseClient.channel(
        "oceanchat-private"
      );

    privateChannel.on(
      "broadcast",
      { event: "private-message" },
      (payload) => {

        const data = payload.payload;

        if (!data) return;

        // Message reçu
        if (
          data.receiverId === currentUser.id
        ) {

          const user = {
            id: data.senderId,
            pseudo: data.senderPseudo,
            age: data.senderAge,
            sexe: data.senderSexe,
            pays: data.senderPays
          };

          savePrivateMessage(
            data.conversationId,
            data,
            user
          );

          openPrivateConversation(
            user
          );
        }
      }
    );

    privateChannel.subscribe((status) => {
      console.log("Chat privé :", status);
    });
  }

  // =========================
  // ID CONVERSATION
  // =========================

  function getConversationId(
    id1,
    id2
  ) {

    return [id1, id2]
      .sort()
      .join("_");
  }

  // =========================
  // OUVRIR CHAT PRIVE
  // =========================

  function openPrivateConversation(user) {

    if (!user || !user.id) return;

    const conversationId =
      getConversationId(
        currentUser.id,
        user.id
      );

    if (
      !privateConversations.has(
        conversationId
      )
    ) {

      privateConversations.set(
        conversationId,
        {
          user: user,
          messages: []
        }
      );
    }

    privateConversations.get(
      conversationId
    ).user = user;

    activeConversationId =
      conversationId;

    privateTitle.textContent =
      `💬 ${user.pseudo}`;

    renderPrivateMessages();

    privateModal.style.display =
      "flex";

    privateChatsBar.style.display =
      "flex";

    renderPrivateChatsBar();

    setTimeout(() => {
      privateMessageInput.focus();
    }, 100);
  }

  // =========================
  // AFFICHER MESSAGES PRIVES
  // =========================

  function renderPrivateMessages() {

    privateMessages.innerHTML = "";

    if (!activeConversationId) return;

    const conversation =
      privateConversations.get(
        activeConversationId
      );

    if (!conversation) return;

    conversation.messages.forEach(
      (message) => {

        addPrivateMessageToScreen(
          message,
          message.senderId ===
            currentUser.id
        );
      }
    );

    privateMessages.scrollTop =
      privateMessages.scrollHeight;
  }

  function addPrivateMessageToScreen(
    message,
    own
  ) {

    const div =
      document.createElement("div");

    div.className =
      own
        ? "private-message own-private-message"
        : "private-message";

    const name =
      document.createElement("strong");

    name.textContent =
      own
        ? "Moi : "
        : `${message.senderPseudo} : `;

    const text =
      document.createElement("span");

    text.textContent =
      message.text;

    div.appendChild(name);
    div.appendChild(text);

    privateMessages.appendChild(div);
  }

  // =========================
  // SAUVER MESSAGE
  // =========================

  function savePrivateMessage(
    conversationId,
    message,
    user
  ) {

    if (
      !privateConversations.has(
        conversationId
      )
    ) {

      privateConversations.set(
        conversationId,
        {
          user: user,
          messages: []
        }
      );
    }

    const conversation =
      privateConversations.get(
        conversationId
      );

    conversation.user = user;

    conversation.messages.push(
      message
    );
  }

  // =========================
  // ENVOYER MESSAGE PRIVE
  // =========================

  privateMessageForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();
      event.stopPropagation();

      const text =
        privateMessageInput.value.trim();

      if (!text) return;

      if (!activeConversationId) {
        alert("Choisis d'abord un utilisateur.");
        return;
      }

      const conversation =
        privateConversations.get(
          activeConversationId
        );

      if (!conversation) return;

      const receiver =
        conversation.user;

      const message = {

        conversationId:
          activeConversationId,

        senderId:
          currentUser.id,

        senderPseudo:
          currentUser.pseudo,

        senderAge:
          currentUser.age,

        senderSexe:
          currentUser.sexe,

        senderPays:
          currentUser.pays,

        receiverId:
          receiver.id,

        text:
          text,

        timestamp:
          Date.now()
      };

      privateMessageInput.value = "";

      savePrivateMessage(
        activeConversationId,
        message,
        receiver
      );

      renderPrivateMessages();

      if (privateChannel) {

        await privateChannel.send({

          type: "broadcast",

          event: "private-message",

          payload: message
        });
      }

      privateMessageInput.focus();
    }
  );

  // =========================
  // REDUIRE
  // =========================

  minimizePrivate.addEventListener(
    "click",
    () => {

      privateModal.style.display =
        "none";

      renderPrivateChatsBar();
    }
  );

  // =========================
  // FERMER
  // =========================

  closePrivate.addEventListener(
    "click",
    () => {

      if (activeConversationId) {

        privateConversations.delete(
          activeConversationId
        );
      }

      activeConversationId = null;

      privateModal.style.display =
        "none";

      renderPrivateChatsBar();
    }
  );

  // =========================
  // BARRE CHATS REDUITS
  // =========================

  function renderPrivateChatsBar() {

    privateChatsBar.innerHTML = "";

    if (
      privateConversations.size === 0
    ) {

      privateChatsBar.style.display =
        "none";

      return;
    }

    privateChatsBar.style.display =
      "flex";

    privateConversations.forEach(
      (conversation, id) => {

        const button =
          document.createElement("button");

        button.type = "button";

        button.className =
          "minimized-private-chat";

        button.textContent =
          `💬 ${conversation.user.pseudo}`;

        button.addEventListener(
          "click",
          () => {

            activeConversationId =
              id;

            privateTitle.textContent =
              `💬 ${conversation.user.pseudo}`;

            renderPrivateMessages();

            privateModal.style.display =
              "flex";

            renderPrivateChatsBar();

            privateMessageInput.focus();
          }
        );

        privateChatsBar.appendChild(
          button
        );
      }
    );
  }

  // =========================
  // DECONNEXION
  // =========================

  logoutBtn.addEventListener(
    "click",
    async () => {

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

      location.reload();
    }
  );

});

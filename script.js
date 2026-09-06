/* =========================================================
   🌊 OCEANCHAT
   CHAT PUBLIC + CHAT PRIVÉ + APPELS AUDIO/VIDÉO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =========================================================
     SUPABASE
     ========================================================= */

  if (
    !window.OCEANCHAT_SUPABASE_URL ||
    !window.OCEANCHAT_SUPABASE_KEY
  ) {
    console.error("Configuration Supabase introuvable.");
    alert("Erreur de configuration Supabase.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    window.OCEANCHAT_SUPABASE_URL,
    window.OCEANCHAT_SUPABASE_KEY
  );

  /* =========================================================
     ELEMENTS
     ========================================================= */

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
  const sendMessageBtn = document.getElementById("sendMessage");

  const privateModal = document.getElementById("privateModal");
  const privateTitle = document.getElementById("privateTitle");
  const minimizePrivate = document.getElementById("minimizePrivate");
  const closePrivate = document.getElementById("closePrivate");

  const privateMessages = document.getElementById("privateMessages");
  const privateMessageForm =
    document.getElementById("privateMessageForm");
  const privateMessageInput =
    document.getElementById("privateMessageInput");
  const sendPrivateMessage =
    document.getElementById("sendPrivateMessage");

  const privateChatsBar =
    document.getElementById("privateChatsBar");

  /* =========================================================
     UTILISATEUR
     ========================================================= */

  let currentUser = null;

  let presenceChannel = null;
  let publicChannel = null;

  /*
    IMPORTANT :
    Chaque utilisateur possède maintenant SON PROPRE
    canal privé.

    Exemple :

    utilisateur A :
    oceanchat-user-ID-A

    utilisateur B :
    oceanchat-user-ID-B

    Quand A écrit à B, le message est envoyé
    directement sur le canal de B.
  */

  let personalChannel = null;

  const onlineUsers = new Map();

  const privateConversations = new Map();

  let activePrivateUserId = null;

  /* =========================================================
     APPEL
     ========================================================= */

  let callState = {
    active: false,
    callId: null,
    type: null,
    role: null,
    peerId: null,
    peerPseudo: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    pendingOffer: null,
    pendingIceCandidates: []
  };

  /* =========================================================
     OUTILS
     ========================================================= */

  function createId() {
    if (window.crypto?.randomUUID) {
      return crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2)
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function scrollBottom(element) {
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }

  /* =========================================================
     INTERFACE APPEL
     ========================================================= */

  function createCallInterface() {

    if (!document.getElementById("oceanchat-call-style")) {

      const style = document.createElement("style");

      style.id = "oceanchat-call-style";

      style.textContent = `

        .oceanchat-call-buttons {
          display:flex;
          gap:5px;
          margin-left:auto;
          margin-right:5px;
        }

        .oceanchat-call-buttons button {
          width:34px;
          height:34px;
          border:0;
          border-radius:8px;
          background:rgba(255,255,255,.18);
          color:white;
          cursor:pointer;
          font-size:17px;
        }

        .oceanchat-call-buttons button:hover {
          background:rgba(255,255,255,.35);
        }

        .minimized-private-chat.new-message {
          background:#ff0000 !important;
          color:white !important;
          animation:oceanchatBlink .7s infinite;
        }

        @keyframes oceanchatBlink {
          0%,100% {
            opacity:1;
          }

          50% {
            opacity:.25;
          }
        }

        #oceanchatCallModal {
          position:fixed;
          inset:0;
          z-index:99999;
          display:none;
          align-items:center;
          justify-content:center;
          background:rgba(0,0,0,.82);
          padding:15px;
        }

        .oceanchat-call-box {
          width:100%;
          max-width:720px;
          background:white;
          border-radius:20px;
          padding:20px;
          text-align:center;
        }

        .oceanchat-call-box h2 {
          color:#0077b6;
          margin-bottom:8px;
        }

        .oceanchat-call-box p {
          color:#667085;
          margin-bottom:15px;
        }

        #oceanchatIncomingButtons {
          display:flex;
          justify-content:center;
          gap:12px;
          margin-bottom:15px;
        }

        #oceanchatAcceptCall,
        #oceanchatRejectCall,
        #oceanchatHangup {
          border:0;
          border-radius:10px;
          padding:12px 20px;
          font-weight:bold;
          cursor:pointer;
          color:white;
        }

        #oceanchatAcceptCall {
          background:#12b76a;
        }

        #oceanchatRejectCall,
        #oceanchatHangup {
          background:#e53935;
        }

        #oceanchatVideoContainer {
          position:relative;
          width:100%;
          aspect-ratio:16/9;
          background:#111;
          border-radius:15px;
          overflow:hidden;
          margin-bottom:15px;
        }

        #oceanchatRemoteVideo {
          width:100%;
          height:100%;
          object-fit:cover;
        }

        #oceanchatLocalVideo {
          position:absolute;
          right:12px;
          bottom:12px;
          width:25%;
          max-width:180px;
          border-radius:10px;
          border:2px solid white;
        }

        #oceanchatHangup {
          display:none;
        }

        .oceanchat-audio-icon {
          font-size:70px;
          margin:20px;
        }

        @media(max-width:600px) {

          .oceanchat-call-buttons button {
            width:30px;
            height:30px;
            font-size:15px;
          }

          .oceanchat-call-box {
            padding:15px;
          }

        }
      `;

      document.head.appendChild(style);
    }

    /* ---------- BOUTONS ---------- */

    const header =
      privateModal?.querySelector(".private-header") ||
      privateModal?.querySelector(".private-window-header");

    if (
      header &&
      !document.getElementById("oceanchatCallButtons")
    ) {

      const buttons = document.createElement("div");

      buttons.id = "oceanchatCallButtons";

      buttons.className =
        "oceanchat-call-buttons";

      buttons.innerHTML = `
        <button
          type="button"
          id="oceanchatVideoCallBtn"
          title="Appel vidéo"
        >📹</button>

        <button
          type="button"
          id="oceanchatAudioCallBtn"
          title="Appel vocal"
        >🎤</button>
      `;

      const controls =
        header.querySelector(".private-controls");

      if (controls) {
        header.insertBefore(buttons, controls);
      } else {
        header.appendChild(buttons);
      }
    }

    /* ---------- MODAL ---------- */

    if (!document.getElementById("oceanchatCallModal")) {

      const modal = document.createElement("div");

      modal.id = "oceanchatCallModal";

      modal.innerHTML = `
        <div class="oceanchat-call-box">

          <h2 id="oceanchatCallTitle">
            Appel
          </h2>

          <p id="oceanchatCallStatus">
            Connexion...
          </p>

          <div id="oceanchatIncomingButtons">

            <button
              type="button"
              id="oceanchatAcceptCall"
            >
              ✅ Accepter
            </button>

            <button
              type="button"
              id="oceanchatRejectCall"
            >
              ❌ Refuser
            </button>

          </div>

          <div id="oceanchatVideoContainer">

            <video
              id="oceanchatRemoteVideo"
              autoplay
              playsinline
            ></video>

            <video
              id="oceanchatLocalVideo"
              autoplay
              muted
              playsinline
            ></video>

          </div>

          <div
            id="oceanchatAudioIcon"
            class="oceanchat-audio-icon"
            style="display:none;"
          >
            🎤
          </div>

          <button
            type="button"
            id="oceanchatHangup"
          >
            📵 Raccrocher
          </button>

        </div>
      `;

      document.body.appendChild(modal);
    }
  }

  createCallInterface();

  const callModal =
    document.getElementById("oceanchatCallModal");

  const callTitle =
    document.getElementById("oceanchatCallTitle");

  const callStatus =
    document.getElementById("oceanchatCallStatus");

  const incomingButtons =
    document.getElementById(
      "oceanchatIncomingButtons"
    );

  const acceptCallBtn =
    document.getElementById(
      "oceanchatAcceptCall"
    );

  const rejectCallBtn =
    document.getElementById(
      "oceanchatRejectCall"
    );

  const hangupBtn =
    document.getElementById(
      "oceanchatHangup"
    );

  const remoteVideo =
    document.getElementById(
      "oceanchatRemoteVideo"
    );

  const localVideo =
    document.getElementById(
      "oceanchatLocalVideo"
    );

  const videoContainer =
    document.getElementById(
      "oceanchatVideoContainer"
    );

  const audioIcon =
    document.getElementById(
      "oceanchatAudioIcon"
    );

  const videoCallBtn =
    document.getElementById(
      "oceanchatVideoCallBtn"
    );

  const audioCallBtn =
    document.getElementById(
      "oceanchatAudioCallBtn"
    );

  /* =========================================================
     CONNEXION
     ========================================================= */

  if (profileForm) {

    profileForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();
        event.stopPropagation();

        const pseudo =
          pseudoInput?.value.trim();

        const age =
          ageInput?.value.trim();

        const sexe =
          sexeInput?.value.trim();

        const pays =
          paysInput?.value.trim();

        if (!pseudo) {
          alert("Entre ton pseudo.");
          return;
        }

        if (!age) {
          alert("Entre ton âge.");
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

        currentUser = {
          id: createId(),
          pseudo,
          age,
          sexe,
          pays
        };

        loginSection.style.display = "none";
        chatSection.style.display = "block";

        await startRealtime();

      }
    );
  }

  /* =========================================================
     REALTIME
     ========================================================= */

  async function startRealtime() {

    await startPresence();

    await startPublicChat();

    /*
      NOUVEAU :
      Chaque utilisateur s'abonne à son propre canal.
    */

    await startPersonalChannel();

    renderUsers();
  }

  /* =========================================================
     PRESENCE
     ========================================================= */

  async function startPresence() {

    presenceChannel =
      supabaseClient.channel(
        "oceanchat-online-users",
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
        { event: "sync" },
        () => {

          const state =
            presenceChannel.presenceState();

          onlineUsers.clear();

          Object.keys(state).forEach(
            (key) => {

              const list =
                state[key];

              if (!list?.length) {
                return;
              }

              const user = list[0];

              if (user?.id) {
                onlineUsers.set(
                  user.id,
                  user
                );
              }

            }
          );

          renderUsers();

        }
      )
      .on(
        "presence",
        { event: "join" },
        () => {
          renderUsers();
        }
      )
      .on(
        "presence",
        { event: "leave" },
        () => {
          renderUsers();
        }
      )
      .subscribe(
        async (status) => {

          if (status === "SUBSCRIBED") {

            await presenceChannel.track({
              id: currentUser.id,
              pseudo: currentUser.pseudo,
              age: currentUser.age,
              sexe: currentUser.sexe,
              pays: currentUser.pays,
              online_at:
                new Date().toISOString()
            });

          }

        }
      );
  }

  /* =========================================================
     UTILISATEURS
     ========================================================= */

  function renderUsers() {

    if (!usersList) return;

    usersList.innerHTML = "";

    const users =
      Array.from(onlineUsers.values())
        .filter(
          user =>
            user.id !== currentUser?.id
        )
        .sort(
          (a, b) =>
            String(a.pseudo).localeCompare(
              String(b.pseudo)
            )
        );

    if (onlineCount) {
      onlineCount.textContent =
        onlineUsers.size;
    }

    if (!users.length) {

      const empty =
        document.createElement("div");

      empty.textContent =
        "Aucun autre utilisateur en ligne.";

      usersList.appendChild(empty);

      return;
    }

    users.forEach((user) => {

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "online-user";

      button.innerHTML = `
        <span class="online-dot"></span>

        <span class="online-user-info">

          <strong>
            ${escapeHtml(user.pseudo)}
          </strong>

          <small>
            ${escapeHtml(user.age)} ans •
            ${escapeHtml(user.sexe)} •
            ${escapeHtml(user.pays)}
          </small>

        </span>
      `;

      button.addEventListener(
        "click",
        () => openPrivateChat(user)
      );

      usersList.appendChild(button);

    });
  }

  /* =========================================================
     CHAT PUBLIC
     ========================================================= */

  async function startPublicChat() {

    publicChannel =
      supabaseClient.channel(
        "oceanchat-public"
      );

    publicChannel
      .on(
        "broadcast",
        { event: "public-message" },
        ({ payload }) => {

          if (payload) {
            addPublicMessage(payload);
          }

        }
      )
      .subscribe();
  }

  function addPublicMessage(payload) {

    if (!messages) return;

    const div =
      document.createElement("div");

    div.className =
      payload.userId === currentUser.id
        ? "message own-message"
        : "message";

    div.innerHTML = `
      <div class="message-author">
        ${escapeHtml(payload.pseudo)}
      </div>

      <div class="message-text">
        ${escapeHtml(payload.text)}
      </div>
    `;

    messages.appendChild(div);

    scrollBottom(messages);
  }

  async function sendPublicMessage() {

    const text =
      messageInput?.value.trim();

    if (!text) return;

    messageInput.value = "";

    const payload = {
      id: createId(),
      userId: currentUser.id,
      pseudo: currentUser.pseudo,
      text,
      createdAt:
        new Date().toISOString()
    };

    await publicChannel.send({
      type: "broadcast",
      event: "public-message",
      payload
    });

    addPublicMessage(payload);
  }

  if (messageForm) {

    messageForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        await sendPublicMessage();

      }
    );
  }

  if (messageInput) {

    messageInput.addEventListener(
      "keydown",
      async (event) => {

        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {

          event.preventDefault();

          await sendPublicMessage();

        }

      }
    );
  }

  if (sendMessageBtn) {

    sendMessageBtn.addEventListener(
      "click",
      async (event) => {

        event.preventDefault();

        await sendPublicMessage();

      }
    );
  }

  /* =========================================================
     🔥 CANAL PERSONNEL
     ========================================================= */

  async function startPersonalChannel() {

    const channelName =
      `oceanchat-user-${currentUser.id}`;

    console.log(
      "📡 Connexion canal privé :",
      channelName
    );

    personalChannel =
      supabaseClient.channel(
        channelName
      );

    /*
      MESSAGE PRIVÉ
    */

    personalChannel.on(
      "broadcast",
      { event: "private-message" },
      ({ payload }) => {

        console.log(
          "📩 MESSAGE PRIVÉ REÇU :",
          payload
        );

        if (!payload) return;

        /*
          Vérification supplémentaire :
          le message doit être destiné à nous.
        */

        if (
          payload.to !== currentUser.id
        ) {
          return;
        }

        receivePrivateMessage(
          payload
        );
      }
    );

    /*
      APPEL
    */

    personalChannel.on(
      "broadcast",
      { event: "call-offer" },
      ({ payload }) => {
        receiveCallOffer(payload);
      }
    );

    personalChannel.on(
      "broadcast",
      { event: "call-answer" },
      ({ payload }) => {
        receiveCallAnswer(payload);
      }
    );

    personalChannel.on(
      "broadcast",
      { event: "ice-candidate" },
      ({ payload }) => {
        receiveIceCandidate(payload);
      }
    );

    personalChannel.on(
      "broadcast",
      { event: "call-reject" },
      ({ payload }) => {
        receiveCallReject(payload);
      }
    );

    personalChannel.on(
      "broadcast",
      { event: "call-end" },
      ({ payload }) => {
        receiveCallEnd(payload);
      }
    );

    /*
      IMPORTANT :
      on attend que le canal soit réellement connecté.
    */

    await new Promise((resolve) => {

      personalChannel.subscribe(
        (status) => {

          console.log(
            "Canal personnel :",
            status
          );

          if (
            status === "SUBSCRIBED"
          ) {

            console.log(
              "✅ Canal privé connecté"
            );

            resolve();

          }

        }
      );

    });
  }

  /* =========================================================
     ENVOYER MESSAGE PRIVE
     ========================================================= */

  async function sendPrivateMessageToUser(
    targetUser,
    text
  ) {

    if (!targetUser?.id) {
      console.error(
        "Destinataire introuvable"
      );
      return;
    }

    if (!text) return;

    /*
      LE MESSAGE EST ENVOYÉ SUR LE CANAL
      PERSONNEL DU DESTINATAIRE.
    */

    const targetChannelName =
      `oceanchat-user-${targetUser.id}`;

    console.log(
      "📤 Envoi message vers :",
      targetChannelName
    );

    const targetChannel =
      supabaseClient.channel(
        targetChannelName
      );

    const status =
      await new Promise((resolve) => {

        targetChannel.subscribe(
          (value) => {

            if (
              value === "SUBSCRIBED"
            ) {
              resolve(value);
            }

          }
        );

      });

    if (status !== "SUBSCRIBED") {

      console.error(
        "Impossible de connecter le canal destinataire."
      );

      await supabaseClient.removeChannel(
        targetChannel
      );

      return;
    }

    const payload = {
      id: createId(),

      from: currentUser.id,

      to: targetUser.id,

      pseudo: currentUser.pseudo,

      text,

      createdAt:
        new Date().toISOString()
    };

    console.log(
      "📤 MESSAGE ENVOYÉ :",
      payload
    );

    await targetChannel.send({
      type: "broadcast",
      event: "private-message",
      payload
    });

    /*
      On ferme le canal temporaire après l'envoi.
    */

    setTimeout(() => {

      supabaseClient.removeChannel(
        targetChannel
      );

    }, 1000);

    return payload;
  }

  /* =========================================================
     ENVOYER MESSAGE PRIVÉ DEPUIS FORMULAIRE
     ========================================================= */

  async function sendPrivate() {

    if (!activePrivateUserId) {
      return;
    }

    const text =
      privateMessageInput?.value.trim();

    if (!text) {
      return;
    }

    const conversation =
      privateConversations.get(
        activePrivateUserId
      );

    if (!conversation) {
      return;
    }

    privateMessageInput.value = "";

    const payload =
      await sendPrivateMessageToUser(
        conversation.user,
        text
      );

    if (!payload) {
      return;
    }

    /*
      Afficher immédiatement notre propre message.
    */

    conversation.messages.push(
      payload
    );

    conversation.unread = false;

    renderPrivateMessages();

    renderPrivateChatsBar();
  }

  if (privateMessageForm) {

    privateMessageForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        await sendPrivate();

      }
    );
  }

  if (privateMessageInput) {

    privateMessageInput.addEventListener(
      "keydown",
      async (event) => {

        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {

          event.preventDefault();

          await sendPrivate();

        }

      }
    );
  }

  if (sendPrivateMessage) {

    sendPrivateMessage.addEventListener(
      "click",
      async (event) => {

        event.preventDefault();

        await sendPrivate();

      }
    );
  }

  /* =========================================================
     RECEVOIR MESSAGE PRIVÉ
     ========================================================= */

  function receivePrivateMessage(
    payload
  ) {

    console.log(
      "💬 Traitement message privé :",
      payload
    );

    let conversation =
      privateConversations.get(
        payload.from
      );

    /*
      Si la conversation n'existe pas encore,
      on crée automatiquement la conversation.
    */

    if (!conversation) {

      let sender =
        onlineUsers.get(
          payload.from
        );

      /*
        Si l'utilisateur n'est plus dans
        la liste en ligne, on crée quand même
        son profil avec les informations du message.
      */

      if (!sender) {

        sender = {
          id: payload.from,
          pseudo:
            payload.pseudo ||
            "Utilisateur"
        };

      }

      conversation = {

        user: sender,

        messages: [],

        minimized: true,

        unread: true

      };

      privateConversations.set(
        payload.from,
        conversation
      );
    }

    conversation.messages.push(
      payload
    );

    /*
      Si cette conversation n'est pas ouverte,
      elle devient une notification rouge.
    */

    const isOpen =
      activePrivateUserId ===
        payload.from &&
      privateModal &&
      privateModal.style.display !==
        "none";

    if (!isOpen) {

      conversation.minimized = true;

      conversation.unread = true;

    }

    if (isOpen) {

      renderPrivateMessages();

    }

    renderPrivateChatsBar();

    /*
      Notification navigateur.
    */

    try {

      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission ===
          "granted"
      ) {

        new Notification(
          `Message de ${payload.pseudo}`,
          {
            body: payload.text
          }
        );

      }

    } catch (error) {}
  }

  /* =========================================================
     OUVRIR CONVERSATION
     ========================================================= */

  function openPrivateChat(user) {

    if (!user?.id) return;

    activePrivateUserId =
      user.id;

    if (!privateConversations.has(
      user.id
    )) {

      privateConversations.set(
        user.id,
        {
          user,
          messages: [],
          minimized: false,
          unread: false
        }
      );

    }

    const conversation =
      privateConversations.get(
        user.id
      );

    conversation.user = user;

    conversation.minimized = false;

    conversation.unread = false;

    if (privateModal) {
      privateModal.style.display =
        "flex";
    }

    if (privateTitle) {
      privateTitle.textContent =
        user.pseudo;
    }

    renderPrivateMessages();

    renderPrivateChatsBar();

    setTimeout(() => {

      privateMessageInput?.focus();

    }, 100);
  }

  /* =========================================================
     AFFICHER MESSAGES PRIVES
     ========================================================= */

  function renderPrivateMessages() {

    if (!privateMessages) return;

    privateMessages.innerHTML = "";

    if (!activePrivateUserId) {
      return;
    }

    const conversation =
      privateConversations.get(
        activePrivateUserId
      );

    if (!conversation) {
      return;
    }

    conversation.messages.forEach(
      (msg) => {

        const div =
          document.createElement("div");

        div.className =
          msg.from === currentUser.id
            ? "message own-message"
            : "message";

        div.innerHTML = `
          <div class="message-author">
            ${escapeHtml(msg.pseudo)}
          </div>

          <div class="message-text">
            ${escapeHtml(msg.text)}
          </div>
        `;

        privateMessages.appendChild(
          div
        );

      }
    );

    scrollBottom(
      privateMessages
    );
  }

  /* =========================================================
     BARRE NOTIFICATIONS PRIVÉES
     ========================================================= */

  function renderPrivateChatsBar() {

    if (!privateChatsBar) {
      return;
    }

    privateChatsBar.innerHTML = "";

    privateConversations.forEach(
      (conversation) => {

        const button =
          document.createElement("button");

        button.type = "button";

        button.className =
          "minimized-private-chat";

        if (conversation.unread) {

          button.classList.add(
            "new-message"
          );

        }

        button.textContent =
          `💬 ${
            conversation.user?.pseudo ||
            "Utilisateur"
          }`;

        button.addEventListener(
          "click",
          () => {

            openPrivateChat(
              conversation.user
            );

          }
        );

        privateChatsBar.appendChild(
          button
        );

      }
    );
  }

  /* =========================================================
     MINIMISER
     ========================================================= */

  if (minimizePrivate) {

    minimizePrivate.addEventListener(
      "click",
      () => {

        if (!activePrivateUserId) {
          return;
        }

        const conversation =
          privateConversations.get(
            activePrivateUserId
          );

        if (conversation) {

          conversation.minimized =
            true;

        }

        if (privateModal) {

          privateModal.style.display =
            "none";

        }

        renderPrivateChatsBar();

      }
    );
  }

  /* =========================================================
     FERMER
     ========================================================= */

  if (closePrivate) {

    closePrivate.addEventListener(
      "click",
      () => {

        if (!activePrivateUserId) {
          return;
        }

        privateConversations.delete(
          activePrivateUserId
        );

        activePrivateUserId = null;

        if (privateModal) {

          privateModal.style.display =
            "none";

        }

        renderPrivateChatsBar();

      }
    );
  }

  /* =========================================================
     WEBRTC
     ========================================================= */

  const rtcConfiguration = {

    iceServers: [
      {
        urls:
          "stun:stun.l.google.com:19302"
      },

      {
        urls:
          "stun:stun1.l.google.com:19302"
      }
    ]

  };

  /* =========================================================
     ENVOYER SIGNAL APPEL
     ========================================================= */

  async function sendCallSignal(
    eventName,
    payload
  ) {

    if (!payload?.to) {
      return;
    }

    const channelName =
      `oceanchat-user-${payload.to}`;

    const channel =
      supabaseClient.channel(
        channelName
      );

    await new Promise((resolve) => {

      channel.subscribe(
        (status) => {

          if (
            status === "SUBSCRIBED"
          ) {
            resolve();
          }

        }
      );

    });

    await channel.send({
      type: "broadcast",
      event: eventName,
      payload
    });

    setTimeout(() => {

      supabaseClient.removeChannel(
        channel
      );

    }, 1000);
  }

  /* =========================================================
     MEDIA
     ========================================================= */

  async function getMedia(type) {

    return navigator.mediaDevices.getUserMedia(
      type === "video"
        ? {
            audio: true,
            video: {
              facingMode: "user",
              width: {
                ideal: 1280
              },
              height: {
                ideal: 720
              }
            }
          }
        : {
            audio: true,
            video: false
          }
    );
  }

  /* =========================================================
     MODAL APPEL
     ========================================================= */

  function showCallModal(
    type,
    pseudo
  ) {

    callModal.style.display =
      "flex";

    callModal.classList.toggle(
      "oceanchat-audio-call",
      type === "audio"
    );

    callTitle.textContent =
      type === "video"
        ? `📹 Appel vidéo avec ${pseudo}`
        : `🎤 Appel vocal avec ${pseudo}`;

    videoContainer.style.display =
      type === "video"
        ? "block"
        : "none";

    audioIcon.style.display =
      type === "audio"
        ? "block"
        : "none";
  }

  function hideCallModal() {

    callModal.style.display =
      "none";
  }

  /* =========================================================
     PEER CONNECTION
     ========================================================= */

  function createPeerConnection() {

    const pc =
      new RTCPeerConnection(
        rtcConfiguration
      );

    callState.peerConnection =
      pc;

    if (callState.localStream) {

      callState.localStream
        .getTracks()
        .forEach(
          (track) => {

            pc.addTrack(
              track,
              callState.localStream
            );

          }
        );

    }

    callState.remoteStream =
      new MediaStream();

    remoteVideo.srcObject =
      callState.remoteStream;

    pc.ontrack = (event) => {

      event.streams[0]
        ?.getTracks()
        .forEach(
          (track) => {

            callState.remoteStream.addTrack(
              track
            );

          }
        );

    };

    pc.onicecandidate =
      async (event) => {

        if (!event.candidate) {
          return;
        }

        await sendCallSignal(
          "ice-candidate",
          {
            to: callState.peerId,
            from: currentUser.id,
            callId:
              callState.callId,
            candidate:
              event.candidate
          }
        );

      };

    pc.onconnectionstatechange =
      () => {

        console.log(
          "WebRTC :",
          pc.connectionState
        );

        if (
          pc.connectionState ===
          "connected"
        ) {

          callStatus.textContent =
            "🟢 Appel connecté";

          hangupBtn.style.display =
            "inline-block";

        }

        if (
          pc.connectionState ===
            "failed" ||
          pc.connectionState ===
            "closed"
        ) {

          setTimeout(() => {
            cleanupCall(false);
          }, 1000);

        }

      };

    return pc;
  }

  /* =========================================================
     DEMARRER APPEL
     ========================================================= */

  async function startCall(type) {

    if (
      !activePrivateUserId ||
      callState.active
    ) {
      return;
    }

    const conversation =
      privateConversations.get(
        activePrivateUserId
      );

    if (!conversation) {
      return;
    }

    const user =
      conversation.user;

    callState = {

      active: true,

      callId: createId(),

      type,

      role: "caller",

      peerId: user.id,

      peerPseudo: user.pseudo,

      peerConnection: null,

      localStream: null,

      remoteStream: null,

      pendingOffer: null,

      pendingIceCandidates: []

    };

    showCallModal(
      type,
      user.pseudo
    );

    incomingButtons.style.display =
      "none";

    hangupBtn.style.display =
      "inline-block";

    callStatus.textContent =
      "📞 Appel en cours...";

    try {

      callState.localStream =
        await getMedia(type);

      localVideo.srcObject =
        callState.localStream;

      const pc =
        createPeerConnection();

      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer
      );

      await sendCallSignal(
        "call-offer",
        {
          to: user.id,
          from: currentUser.id,
          callId:
            callState.callId,
          type,
          pseudo:
            currentUser.pseudo,
          sdp:
            pc.localDescription
        }
      );

      callStatus.textContent =
        "📞 En attente de réponse...";

    } catch (error) {

      console.error(error);

      callStatus.textContent =
        "❌ Micro ou caméra inaccessible.";

      setTimeout(
        () => cleanupCall(false),
        2000
      );
    }
  }

  /* =========================================================
     APPEL ENTRANT
     ========================================================= */

  function receiveCallOffer(payload) {

    if (!payload) return;

    if (
      payload.to !== currentUser.id
    ) {
      return;
    }

    if (callState.active) {

      sendCallSignal(
        "call-reject",
        {
          to: payload.from,
          from: currentUser.id,
          callId:
            payload.callId,
          reason: "busy"
        }
      );

      return;
    }

    callState = {

      active: true,

      callId:
        payload.callId,

      type:
        payload.type,

      role: "receiver",

      peerId:
        payload.from,

      peerPseudo:
        payload.pseudo ||
        "Utilisateur",

      peerConnection: null,

      localStream: null,

      remoteStream: null,

      pendingOffer:
        payload.sdp,

      pendingIceCandidates: []

    };

    showCallModal(
      payload.type,
      callState.peerPseudo
    );

    incomingButtons.style.display =
      "flex";

    hangupBtn.style.display =
      "none";

    callStatus.textContent =
      payload.type === "video"
        ? "📹 Appel vidéo entrant"
        : "🎤 Appel vocal entrant";
  }

  /* =========================================================
     ACCEPTER
     ========================================================= */

  async function acceptCall() {

    if (
      !callState.active ||
      !callState.pendingOffer
    ) {
      return;
    }

    incomingButtons.style.display =
      "none";

    callStatus.textContent =
      "🔄 Connexion...";

    try {

      callState.localStream =
        await getMedia(
          callState.type
        );

      localVideo.srcObject =
        callState.localStream;

      const pc =
        createPeerConnection();

      await pc.setRemoteDescription(
        new RTCSessionDescription(
          callState.pendingOffer
        )
      );

      const answer =
        await pc.createAnswer();

      await pc.setLocalDescription(
        answer
      );

      await sendCallSignal(
        "call-answer",
        {
          to: callState.peerId,

          from: currentUser.id,

          callId:
            callState.callId,

          sdp:
            pc.localDescription
        }
      );

      await flushIce();

    } catch (error) {

      console.error(error);

      await sendCallSignal(
        "call-reject",
        {
          to:
            callState.peerId,

          from:
            currentUser.id,

          callId:
            callState.callId,

          reason:
            "media-error"
        }
      );

      cleanupCall(false);

    }
  }

  /* =========================================================
     REFUSER
     ========================================================= */

  async function rejectCall() {

    if (
      callState.active &&
      callState.peerId
    ) {

      await sendCallSignal(
        "call-reject",
        {
          to:
            callState.peerId,

          from:
            currentUser.id,

          callId:
            callState.callId,

          reason:
            "rejected"
        }
      );

    }

    cleanupCall(false);
  }

  /* =========================================================
     ANSWER
     ========================================================= */

  async function receiveCallAnswer(
    payload
  ) {

    if (
      !payload ||
      payload.to !== currentUser.id
    ) {
      return;
    }

    if (
      !callState.active ||
      payload.callId !==
        callState.callId
    ) {
      return;
    }

    if (!callState.peerConnection) {
      return;
    }

    try {

      await callState.peerConnection
        .setRemoteDescription(
          new RTCSessionDescription(
            payload.sdp
          )
        );

      await flushIce();

    } catch (error) {

      console.error(error);

    }
  }

  /* =========================================================
     ICE
     ========================================================= */

  async function receiveIceCandidate(
    payload
  ) {

    if (
      !payload ||
      payload.to !== currentUser.id
    ) {
      return;
    }

    if (
      !callState.active ||
      payload.callId !==
        callState.callId
    ) {
      return;
    }

    if (
      !callState.peerConnection ||
      !callState.peerConnection
        .remoteDescription
    ) {

      callState.pendingIceCandidates
        .push(
          payload.candidate
        );

      return;
    }

    try {

      await callState.peerConnection
        .addIceCandidate(
          new RTCIceCandidate(
            payload.candidate
          )
        );

    } catch (error) {

      console.error(error);

    }
  }

  async function flushIce() {

    if (
      !callState.peerConnection ||
      !callState.peerConnection
        .remoteDescription
    ) {
      return;
    }

    const candidates =
      callState.pendingIceCandidates;

    callState.pendingIceCandidates =
      [];

    for (
      const candidate of candidates
    ) {

      try {

        await callState.peerConnection
          .addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );

      } catch (error) {

        console.error(error);

      }

    }
  }

  /* =========================================================
     REFUS APPEL
     ========================================================= */

  function receiveCallReject(payload) {

    if (
      !payload ||
      payload.to !== currentUser.id
    ) {
      return;
    }

    if (
      !callState.active ||
      payload.callId !==
        callState.callId
    ) {
      return;
    }

    callStatus.textContent =
      payload.reason === "busy"
        ? "🔴 Utilisateur déjà en appel."
        : "❌ Appel refusé.";

    setTimeout(
      () => cleanupCall(false),
      1500
    );
  }

  /* =========================================================
     FIN APPEL
     ========================================================= */

  async function hangupCall() {

    if (!callState.active) {
      return;
    }

    if (callState.peerId) {

      await sendCallSignal(
        "call-end",
        {
          to:
            callState.peerId,

          from:
            currentUser.id,

          callId:
            callState.callId
        }
      );

    }

    cleanupCall(false);
  }

  function receiveCallEnd(payload) {

    if (
      !payload ||
      payload.to !== currentUser.id
    ) {
      return;
    }

    if (
      !callState.active ||
      payload.callId !==
        callState.callId
    ) {
      return;
    }

    callStatus.textContent =
      "📵 Appel terminé.";

    setTimeout(
      () => cleanupCall(false),
      700
    );
  }

  /* =========================================================
     NETTOYAGE APPEL
     ========================================================= */

  function cleanupCall() {

    if (callState.localStream) {

      callState.localStream
        .getTracks()
        .forEach(
          track => {

            try {
              track.stop();
            } catch (e) {}

          }
        );
    }

    if (callState.peerConnection) {

      try {
        callState.peerConnection.close();
      } catch (e) {}

    }

    if (localVideo) {
      localVideo.srcObject = null;
    }

    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }

    callState = {

      active: false,

      callId: null,

      type: null,

      role: null,

      peerId: null,

      peerPseudo: null,

      peerConnection: null,

      localStream: null,

      remoteStream: null,

      pendingOffer: null,

      pendingIceCandidates: []

    };

    if (incomingButtons) {
      incomingButtons.style.display =
        "none";
    }

    if (hangupBtn) {
      hangupBtn.style.display =
        "none";
    }

    hideCallModal();
  }

  /* =========================================================
     BOUTONS APPEL
     ========================================================= */

  if (videoCallBtn) {

    videoCallBtn.addEventListener(
      "click",
      () => startCall("video")
    );

  }

  if (audioCallBtn) {

    audioCallBtn.addEventListener(
      "click",
      () => startCall("audio")
    );

  }

  if (acceptCallBtn) {

    acceptCallBtn.addEventListener(
      "click",
      acceptCall
    );

  }

  if (rejectCallBtn) {

    rejectCallBtn.addEventListener(
      "click",
      rejectCall
    );

  }

  if (hangupBtn) {

    hangupBtn.addEventListener(
      "click",
      hangupCall
    );

  }

  /* =========================================================
     DECONNEXION
     ========================================================= */

  if (logoutBtn) {

    logoutBtn.addEventListener(
      "click",
      async () => {

        if (callState.active) {
          await hangupCall();
        }

        try {

          if (presenceChannel) {

            await presenceChannel.untrack();

            await supabaseClient
              .removeChannel(
                presenceChannel
              );

          }

        } catch (e) {}

        try {

          if (publicChannel) {

            await supabaseClient
              .removeChannel(
                publicChannel
              );

          }

        } catch (e) {}

        try {

          if (personalChannel) {

            await supabaseClient
              .removeChannel(
                personalChannel
              );

          }

        } catch (e) {}

        location.reload();

      }
    );
  }

  /* =========================================================
     NOTIFICATIONS
     ========================================================= */

  try {

    if (
      "Notification" in window &&
      Notification.permission === "default"
    ) {

      Notification.requestPermission()
        .catch(() => {});

    }

  } catch (e) {}

  console.log(
    "🌊 OceanChat : système complet chargé."
  );

  console.log(
    "💬 Messages privés : canal personnel activé."
  );

  console.log(
    "📹 Appels vidéo activés."
  );

  console.log(
    "🎤 Appels audio activés."
  );

});

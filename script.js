/* =========================================================
   🌊 OCEANCHAT - SCRIPT COMPLET
   Chat public + utilisateurs + messages privés
   Appels audio + vidéo avec accepter/refuser
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =========================================================
     1. CONFIGURATION SUPABASE
     ========================================================= */

  if (!window.OCEANCHAT_SUPABASE_URL || !window.OCEANCHAT_SUPABASE_KEY) {
    console.error("❌ Configuration Supabase introuvable.");
    alert("Erreur : configuration Supabase introuvable.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    window.OCEANCHAT_SUPABASE_URL,
    window.OCEANCHAT_SUPABASE_KEY
  );

  /* =========================================================
     2. ELEMENTS HTML
     ========================================================= */

  const loginSection = document.getElementById("loginSection");
  const chatSection = document.getElementById("chatSection");

  const profileForm = document.getElementById("profileForm");

  const pseudoInput = document.getElementById("pseudo");
  const ageInput = document.getElementById("age");
  const sexeInput = document.getElementById("sexe");
  const paysInput = document.getElementById("pays");

  const connectBtn = document.getElementById("connectBtn");

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
  const privateMessageForm = document.getElementById("privateMessageForm");
  const privateMessageInput = document.getElementById("privateMessageInput");
  const sendPrivateMessage = document.getElementById("sendPrivateMessage");

  const privateChatsBar = document.getElementById("privateChatsBar");

  /* =========================================================
     3. ETAT UTILISATEUR
     ========================================================= */

  let currentUser = null;

  let presenceChannel = null;
  let publicChannel = null;
  let privateChannel = null;

  const onlineUsers = new Map();

  /*
    Conversations privées :

    {
      user: {...},
      messages: [],
      minimized: false,
      unread: false
    }
  */
  const privateConversations = new Map();

  let activePrivateUserId = null;

  /* =========================================================
     4. ETAT DES APPELS
     ========================================================= */

  let callState = {
    active: false,
    callId: null,
    type: null, // video / audio
    role: null, // caller / receiver
    peerId: null,
    peerPseudo: null,

    peerConnection: null,

    localStream: null,
    remoteStream: null,

    pendingOffer: null,

    pendingIceCandidates: []
  };

  /* =========================================================
     5. CREER AUTOMATIQUEMENT L'INTERFACE DES APPELS
     ========================================================= */

  function createCallInterface() {

    /* ---------- STYLE ---------- */

    if (!document.getElementById("oceanchat-call-style")) {

      const style = document.createElement("style");

      style.id = "oceanchat-call-style";

      style.textContent = `

        /* ============================
           BOUTONS APPEL
           ============================ */

        .private-user-title {
          display:flex;
          align-items:center;
          gap:8px;
          min-width:0;
        }

        #privateTitle {
          max-width:160px;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .oceanchat-call-buttons {
          display:flex;
          gap:5px;
          flex-shrink:0;
        }

        .oceanchat-call-buttons button {
          width:34px;
          height:34px;
          border:0;
          border-radius:8px;
          background:rgba(255,255,255,0.18);
          color:white;
          cursor:pointer;
          font-size:17px;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .oceanchat-call-buttons button:hover {
          background:rgba(255,255,255,0.35);
        }

        /* ============================
           MESSAGE NON LU
           ============================ */

        .minimized-private-chat.new-message {
          background:#ff1f1f !important;
          color:#fff !important;
          border-color:#ff0000 !important;
          animation:oceanchatBlink 0.7s infinite;
        }

        @keyframes oceanchatBlink {
          0%,100% {
            opacity:1;
          }

          50% {
            opacity:0.25;
          }
        }

        /* ============================
           FENETRE APPEL
           ============================ */

        #oceanchatCallModal {
          position:fixed;
          inset:0;
          z-index:99999;
          display:none;
          align-items:center;
          justify-content:center;
          background:rgba(0,0,0,0.82);
          padding:15px;
        }

        .oceanchat-call-box {
          width:100%;
          max-width:720px;
          background:#fff;
          border-radius:20px;
          padding:20px;
          text-align:center;
          box-shadow:0 20px 70px rgba(0,0,0,.5);
        }

        .oceanchat-call-box h2 {
          margin:0 0 8px;
          color:#0077b6;
        }

        .oceanchat-call-box p {
          margin:0 0 15px;
          color:#667085;
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
          background:#111;
        }

        #oceanchatLocalVideo {
          position:absolute;
          right:12px;
          bottom:12px;
          width:25%;
          max-width:180px;
          border-radius:10px;
          border:2px solid white;
          background:#222;
        }

        #oceanchatHangup {
          display:none;
        }

        .oceanchat-audio-call #oceanchatVideoContainer {
          display:none;
        }

        .oceanchat-audio-icon {
          font-size:70px;
          margin:20px;
        }

        @media(max-width:600px) {

          #privateTitle {
            max-width:100px;
            font-size:14px;
          }

          .oceanchat-call-buttons button {
            width:30px;
            height:30px;
            font-size:15px;
          }

          .oceanchat-call-box {
            padding:15px;
          }

          #oceanchatLocalVideo {
            width:32%;
          }
        }
      `;

      document.head.appendChild(style);
    }

    /* ---------- AJOUTER BOUTONS DANS HEADER PRIVE ---------- */

    const privateHeader =
      privateModal?.querySelector(".private-header") ||
      privateModal?.querySelector(".private-window-header");

    if (privateHeader && !document.getElementById("oceanchatCallButtons")) {

      const callButtons = document.createElement("div");

      callButtons.id = "oceanchatCallButtons";
      callButtons.className = "oceanchat-call-buttons";

      callButtons.innerHTML = `
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
        privateHeader.querySelector(".private-controls");

      if (controls) {
        privateHeader.insertBefore(callButtons, controls);
      } else {
        privateHeader.appendChild(callButtons);
      }
    }

    /* ---------- CREER MODAL APPEL ---------- */

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

  /* =========================================================
     6. ELEMENTS APPELS
     ========================================================= */

  const callModal =
    document.getElementById("oceanchatCallModal");

  const callTitle =
    document.getElementById("oceanchatCallTitle");

  const callStatus =
    document.getElementById("oceanchatCallStatus");

  const incomingButtons =
    document.getElementById("oceanchatIncomingButtons");

  const acceptCallBtn =
    document.getElementById("oceanchatAcceptCall");

  const rejectCallBtn =
    document.getElementById("oceanchatRejectCall");

  const hangupBtn =
    document.getElementById("oceanchatHangup");

  const remoteVideo =
    document.getElementById("oceanchatRemoteVideo");

  const localVideo =
    document.getElementById("oceanchatLocalVideo");

  const videoContainer =
    document.getElementById("oceanchatVideoContainer");

  const audioIcon =
    document.getElementById("oceanchatAudioIcon");

  const videoCallBtn =
    document.getElementById("oceanchatVideoCallBtn");

  const audioCallBtn =
    document.getElementById("oceanchatAudioCallBtn");

  /* =========================================================
     7. OUTILS
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

  function scrollToBottom(element) {

    if (!element) return;

    element.scrollTop = element.scrollHeight;
  }

  function showChat() {

    if (loginSection) {
      loginSection.style.display = "none";
    }

    if (chatSection) {
      chatSection.style.display = "block";
    }
  }

  function showLogin() {

    if (loginSection) {
      loginSection.style.display = "";
    }

    if (chatSection) {
      chatSection.style.display = "none";
    }
  }

  /* =========================================================
     8. CONNEXION
     ========================================================= */

  if (profileForm) {

    profileForm.addEventListener("submit", async (event) => {

      event.preventDefault();
      event.stopPropagation();

      const pseudo = pseudoInput?.value.trim();
      const age = ageInput?.value.trim();
      const sexe = sexeInput?.value.trim();
      const pays = paysInput?.value.trim();

      if (!pseudo) {
        alert("Entre ton pseudo.");
        pseudoInput?.focus();
        return;
      }

      if (!age) {
        alert("Entre ton âge.");
        ageInput?.focus();
        return;
      }

      if (!sexe) {
        alert("Choisis ton sexe.");
        sexeInput?.focus();
        return;
      }

      if (!pays) {
        alert("Choisis ton pays.");
        paysInput?.focus();
        return;
      }

      currentUser = {
        id: createId(),
        pseudo,
        age,
        sexe,
        pays,
        joinedAt: new Date().toISOString()
      };

      showChat();

      await startRealtime();

    });
  }

  /* =========================================================
     9. REALTIME
     ========================================================= */

  async function startRealtime() {

    if (!currentUser) return;

    await startPresence();
    await startPublicChat();
    await startPrivateChat();

    renderUsers();

  }

  /* =========================================================
     10. PRESENCE / UTILISATEURS EN LIGNE
     ========================================================= */

  async function startPresence() {

    presenceChannel =
      supabaseClient.channel("oceanchat-online-users", {
        config: {
          presence: {
            key: currentUser.id
          }
        }
      });

    presenceChannel
      .on(
        "presence",
        { event: "sync" },
        () => {

          const state =
            presenceChannel.presenceState();

          onlineUsers.clear();

          Object.keys(state).forEach((key) => {

            const entries = state[key];

            if (!entries || !entries.length) return;

            const user = entries[0];

            if (user?.id) {
              onlineUsers.set(user.id, user);
            }

          });

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
      .subscribe(async (status) => {

        if (status === "SUBSCRIBED") {

          await presenceChannel.track({
            id: currentUser.id,
            pseudo: currentUser.pseudo,
            age: currentUser.age,
            sexe: currentUser.sexe,
            pays: currentUser.pays,
            online_at: new Date().toISOString()
          });

        }

      });
  }

  /* =========================================================
     11. AFFICHER UTILISATEURS
     ========================================================= */

  function renderUsers() {

    if (!usersList) return;

    usersList.innerHTML = "";

    const users = Array.from(
      onlineUsers.values()
    )
      .filter((user) => user.id !== currentUser?.id)
      .sort((a, b) =>
        String(a.pseudo).localeCompare(
          String(b.pseudo)
        )
      );

    if (onlineCount) {
      onlineCount.textContent =
        onlineUsers.size;
    }

    if (!users.length) {

      const empty = document.createElement("div");

      empty.className = "empty-users";

      empty.textContent =
        "Aucun autre utilisateur en ligne.";

      usersList.appendChild(empty);

      return;
    }

    users.forEach((user) => {

      const item = document.createElement("button");

      item.type = "button";
      item.className = "online-user";

      item.innerHTML = `
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

      item.addEventListener("click", () => {

        openPrivateChat(user);

      });

      usersList.appendChild(item);

    });
  }

  /* =========================================================
     12. CHAT PUBLIC
     ========================================================= */

  async function startPublicChat() {

    publicChannel =
      supabaseClient.channel("oceanchat-public");

    publicChannel
      .on(
        "broadcast",
        { event: "public-message" },
        ({ payload }) => {

          if (!payload) return;

          addPublicMessage(payload);

        }
      )
      .subscribe();
  }

  function addPublicMessage(payload) {

    if (!messages) return;

    const div = document.createElement("div");

    div.className =
      payload.userId === currentUser?.id
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

    scrollToBottom(messages);
  }

  async function sendPublicMessage() {

    const text =
      messageInput?.value.trim();

    if (!text || !publicChannel || !currentUser) {
      return;
    }

    messageInput.value = "";

    await publicChannel.send({
      type: "broadcast",
      event: "public-message",
      payload: {
        id: createId(),
        userId: currentUser.id,
        pseudo: currentUser.pseudo,
        text,
        createdAt: new Date().toISOString()
      }
    });

    addPublicMessage({
      id: createId(),
      userId: currentUser.id,
      pseudo: currentUser.pseudo,
      text,
      createdAt: new Date().toISOString()
    });
  }

  if (messageForm) {

    messageForm.addEventListener("submit", async (event) => {

      event.preventDefault();
      event.stopPropagation();

      await sendPublicMessage();

    });
  }

  if (messageInput) {

    messageInput.addEventListener("keydown", async (event) => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        await sendPublicMessage();

      }

    });
  }

  if (sendMessageBtn) {

    sendMessageBtn.addEventListener("click", async (event) => {

      event.preventDefault();

      await sendPublicMessage();

    });
  }

  /* =========================================================
     13. CHAT PRIVE
     ========================================================= */

  async function startPrivateChat() {

    privateChannel =
      supabaseClient.channel("oceanchat-private");

    privateChannel
      .on(
        "broadcast",
        { event: "private-message" },
        ({ payload }) => {

          if (!payload) return;

          if (
            payload.to !== currentUser?.id
          ) {
            return;
          }

          receivePrivateMessage(payload);

        }
      )
      .on(
        "broadcast",
        { event: "call-offer" },
        ({ payload }) => {

          receiveCallOffer(payload);

        }
      )
      .on(
        "broadcast",
        { event: "call-answer" },
        ({ payload }) => {

          receiveCallAnswer(payload);

        }
      )
      .on(
        "broadcast",
        { event: "ice-candidate" },
        ({ payload }) => {

          receiveIceCandidate(payload);

        }
      )
      .on(
        "broadcast",
        { event: "call-reject" },
        ({ payload }) => {

          receiveCallReject(payload);

        }
      )
      .on(
        "broadcast",
        { event: "call-end" },
        ({ payload }) => {

          receiveCallEnd(payload);

        }
      )
      .subscribe();
  }

  /* =========================================================
     14. OUVRIR CHAT PRIVE
     ========================================================= */

  function openPrivateChat(user) {

    if (!user || !currentUser) return;

    activePrivateUserId = user.id;

    if (!privateConversations.has(user.id)) {

      privateConversations.set(user.id, {
        user,
        messages: [],
        minimized: false,
        unread: false
      });

    }

    const conversation =
      privateConversations.get(user.id);

    conversation.user = user;
    conversation.minimized = false;
    conversation.unread = false;

    if (privateModal) {
      privateModal.style.display = "flex";
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
     15. RENDRE MESSAGES PRIVES
     ========================================================= */

  function renderPrivateMessages() {

    if (!privateMessages) return;

    privateMessages.innerHTML = "";

    if (!activePrivateUserId) return;

    const conversation =
      privateConversations.get(
        activePrivateUserId
      );

    if (!conversation) return;

    conversation.messages.forEach((msg) => {

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

      privateMessages.appendChild(div);

    });

    scrollToBottom(privateMessages);
  }

  /* =========================================================
     16. ENVOYER MESSAGE PRIVE
     ========================================================= */

  async function sendPrivate() {

    if (!currentUser || !activePrivateUserId) {
      return;
    }

    const text =
      privateMessageInput?.value.trim();

    if (!text) return;

    const conversation =
      privateConversations.get(
        activePrivateUserId
      );

    if (!conversation) return;

    const message = {
      id: createId(),
      from: currentUser.id,
      to: activePrivateUserId,
      pseudo: currentUser.pseudo,
      text,
      createdAt: new Date().toISOString()
    };

    privateMessageInput.value = "";

    conversation.messages.push(message);

    renderPrivateMessages();

    if (privateChannel) {

      await privateChannel.send({
        type: "broadcast",
        event: "private-message",
        payload: message
      });

    }
  }

  if (privateMessageForm) {

    privateMessageForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();
        event.stopPropagation();

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
     17. RECEVOIR MESSAGE PRIVE
     ========================================================= */

  function receivePrivateMessage(payload) {

    if (!payload?.from) return;

    let conversation =
      privateConversations.get(payload.from);

    if (!conversation) {

      const user =
        onlineUsers.get(payload.from) || {
          id: payload.from,
          pseudo: payload.pseudo || "Utilisateur"
        };

      conversation = {
        user,
        messages: [],
        minimized: true,
        unread: true
      };

      privateConversations.set(
        payload.from,
        conversation
      );
    }

    conversation.messages.push(payload);

    const isActive =
      activePrivateUserId === payload.from &&
      privateModal &&
      privateModal.style.display !== "none";

    if (!isActive) {

      conversation.minimized = true;
      conversation.unread = true;

    }

    if (isActive) {
      renderPrivateMessages();
    }

    renderPrivateChatsBar();

    /* Notification navigateur si disponible */

    try {

      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {

        new Notification(
          `Nouveau message de ${payload.pseudo}`,
          {
            body: payload.text
          }
        );

      }

    } catch (error) {
      console.log(error);
    }
  }

  /* =========================================================
     18. BARRE DES CONVERSATIONS REDUITES
     ========================================================= */

  function renderPrivateChatsBar() {

    if (!privateChatsBar) return;

    privateChatsBar.innerHTML = "";

    privateConversations.forEach(
      (conversation, userId) => {

        const button =
          document.createElement("button");

        button.type = "button";

        button.className =
          "minimized-private-chat";

        if (conversation.unread) {
          button.classList.add("new-message");
        }

        button.innerHTML = `
          💬 ${escapeHtml(
            conversation.user?.pseudo ||
            "Utilisateur"
          )}
        `;

        button.addEventListener(
          "click",
          () => {

            openPrivateChat(
              conversation.user
            );

          }
        );

        privateChatsBar.appendChild(button);

      }
    );
  }

  /* =========================================================
     19. MINIMISER CHAT PRIVE
     ========================================================= */

  if (minimizePrivate) {

    minimizePrivate.addEventListener(
      "click",
      () => {

        if (!activePrivateUserId) return;

        const conversation =
          privateConversations.get(
            activePrivateUserId
          );

        if (conversation) {
          conversation.minimized = true;
        }

        if (privateModal) {
          privateModal.style.display = "none";
        }

        renderPrivateChatsBar();

      }
    );
  }

  /* =========================================================
     20. FERMER CHAT PRIVE
     ========================================================= */

  if (closePrivate) {

    closePrivate.addEventListener(
      "click",
      () => {

        if (!activePrivateUserId) return;

        privateConversations.delete(
          activePrivateUserId
        );

        activePrivateUserId = null;

        if (privateModal) {
          privateModal.style.display = "none";
        }

        renderPrivateChatsBar();

      }
    );
  }

  /* =========================================================
     21. WEBRTC
     ========================================================= */

  const rtcConfiguration = {

    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      },
      {
        urls: "stun:stun1.l.google.com:19302"
      }
    ]

  };

  /* =========================================================
     22. OBTENIR MICRO / CAMERA
     ========================================================= */

  async function getMedia(type) {

    const constraints =
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
          };

    try {

      return await navigator.mediaDevices.getUserMedia(
        constraints
      );

    } catch (error) {

      console.error(
        "Erreur caméra/micro :",
        error
      );

      throw error;
    }
  }

  /* =========================================================
     23. AFFICHER INTERFACE APPEL
     ========================================================= */

  function showCallModal(type, pseudo) {

    if (!callModal) return;

    callModal.style.display = "flex";

    callModal.classList.toggle(
      "oceanchat-audio-call",
      type === "audio"
    );

    if (callTitle) {

      callTitle.textContent =
        type === "video"
          ? `📹 Appel vidéo avec ${pseudo}`
          : `🎤 Appel vocal avec ${pseudo}`;

    }

    if (videoContainer) {
      videoContainer.style.display =
        type === "video"
          ? "block"
          : "none";
    }

    if (audioIcon) {
      audioIcon.style.display =
        type === "audio"
          ? "block"
          : "none";
    }
  }

  function hideCallModal() {

    if (callModal) {
      callModal.style.display = "none";
    }
  }

  /* =========================================================
     24. CREER PEER CONNECTION
     ========================================================= */

  function createPeerConnection() {

    if (callState.peerConnection) {

      try {
        callState.peerConnection.close();
      } catch (error) {}

    }

    const pc =
      new RTCPeerConnection(
        rtcConfiguration
      );

    callState.peerConnection = pc;

    /* ---------- TRACKS LOCALES ---------- */

    if (callState.localStream) {

      callState.localStream
        .getTracks()
        .forEach((track) => {

          pc.addTrack(
            track,
            callState.localStream
          );

        });

    }

    /* ---------- TRACKS DISTANTES ---------- */

    callState.remoteStream =
      new MediaStream();

    if (remoteVideo) {

      remoteVideo.srcObject =
        callState.remoteStream;

    }

    pc.ontrack = (event) => {

      event.streams[0]
        ?.getTracks()
        .forEach((track) => {

          callState.remoteStream.addTrack(
            track
          );

        });

    };

    /* ---------- ICE ---------- */

    pc.onicecandidate = async (event) => {

      if (!event.candidate) return;

      if (
        !callState.peerId ||
        !callState.callId
      ) {
        return;
      }

      await sendCallSignal(
        "ice-candidate",
        {
          to: callState.peerId,
          callId: callState.callId,
          from: currentUser.id,
          candidate: event.candidate
        }
      );

    };

    /* ---------- ETAT CONNEXION ---------- */

    pc.onconnectionstatechange = () => {

      const state =
        pc.connectionState;

      console.log(
        "WebRTC:",
        state
      );

      if (state === "connected") {

        if (callStatus) {
          callStatus.textContent =
            "🟢 Appel connecté";
        }

        if (hangupBtn) {
          hangupBtn.style.display =
            "inline-block";
        }

      }

      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {

        if (state === "failed") {

          if (callStatus) {
            callStatus.textContent =
              "❌ La connexion a échoué.";
          }

          setTimeout(() => {
            cleanupCall(false);
          }, 2000);

        }

      }

    };

    return pc;
  }

  /* =========================================================
     25. ENVOYER SIGNAL APPEL
     ========================================================= */

  async function sendCallSignal(
    eventName,
    payload
  ) {

    if (!privateChannel) return;

    await privateChannel.send({
      type: "broadcast",
      event: eventName,
      payload
    });
  }

  /* =========================================================
     26. DEMARRER APPEL SORTANT
     ========================================================= */

  async function startCall(type) {

    if (!currentUser) return;

    if (!activePrivateUserId) {

      alert(
        "Ouvre d'abord une conversation privée."
      );

      return;
    }

    if (callState.active) {

      alert(
        "Tu es déjà dans un appel."
      );

      return;
    }

    const conversation =
      privateConversations.get(
        activePrivateUserId
      );

    if (!conversation) return;

    const targetUser =
      conversation.user;

    if (!targetUser?.id) return;

    callState = {
      active: true,
      callId: createId(),
      type,
      role: "caller",
      peerId: targetUser.id,
      peerPseudo: targetUser.pseudo,
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      pendingOffer: null,
      pendingIceCandidates: []
    };

    showCallModal(
      type,
      targetUser.pseudo
    );

    if (incomingButtons) {
      incomingButtons.style.display =
        "none";
    }

    if (hangupBtn) {
      hangupBtn.style.display =
        "inline-block";
    }

    if (callStatus) {
      callStatus.textContent =
        "📞 Appel en cours...";
    }

    try {

      callState.localStream =
        await getMedia(type);

      if (localVideo) {
        localVideo.srcObject =
          callState.localStream;
      }

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
          to: targetUser.id,
          from: currentUser.id,

          callId: callState.callId,

          type,

          pseudo: currentUser.pseudo,

          sdp: pc.localDescription
        }
      );

      if (callStatus) {
        callStatus.textContent =
          "📞 Appel envoyé... En attente de réponse";
      }

    } catch (error) {

      console.error(
        "Erreur appel :",
        error
      );

      if (callStatus) {

        callStatus.textContent =
          "❌ Impossible d'utiliser le micro ou la caméra.";

      }

      setTimeout(() => {
        cleanupCall(false);
      }, 2500);

    }
  }

  /* =========================================================
     27. RECEVOIR APPEL
     ========================================================= */

  function receiveCallOffer(payload) {

    if (!payload) return;

    if (!currentUser) return;

    if (payload.to !== currentUser.id) {
      return;
    }

    /* Si déjà en appel */

    if (callState.active) {

      sendCallSignal(
        "call-reject",
        {
          to: payload.from,
          from: currentUser.id,
          callId: payload.callId,
          reason: "busy"
        }
      );

      return;
    }

    callState = {
      active: true,

      callId: payload.callId,

      type: payload.type,

      role: "receiver",

      peerId: payload.from,

      peerPseudo: payload.pseudo ||
        "Utilisateur",

      peerConnection: null,

      localStream: null,

      remoteStream: null,

      pendingOffer: payload.sdp,

      pendingIceCandidates: []
    };

    showCallModal(
      payload.type,
      payload.pseudo || "Utilisateur"
    );

    if (incomingButtons) {
      incomingButtons.style.display =
        "flex";
    }

    if (hangupBtn) {
      hangupBtn.style.display =
        "none";
    }

    if (callStatus) {

      callStatus.textContent =
        payload.type === "video"
          ? "📹 Appel vidéo entrant"
          : "🎤 Appel vocal entrant";

    }

    /* Son de notification */

    try {
      playCallSound();
    } catch (error) {}

  }

  /* =========================================================
     28. ACCEPTER APPEL
     ========================================================= */

  async function acceptCall() {

    if (
      !callState.active ||
      callState.role !== "receiver"
    ) {
      return;
    }

    if (!callState.pendingOffer) {
      return;
    }

    if (incomingButtons) {
      incomingButtons.style.display =
        "none";
    }

    if (callStatus) {
      callStatus.textContent =
        "🔄 Connexion à l'appel...";
    }

    try {

      callState.localStream =
        await getMedia(
          callState.type
        );

      if (localVideo) {

        localVideo.srcObject =
          callState.localStream;

      }

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

          callId: callState.callId,

          sdp: pc.localDescription
        }
      );

      /* ICE reçus avant l'acceptation */

      await flushPendingIceCandidates();

      if (callStatus) {
        callStatus.textContent =
          "📞 Appel accepté. Connexion...";
      }

      if (hangupBtn) {
        hangupBtn.style.display =
          "inline-block";
      }

    } catch (error) {

      console.error(
        "Erreur acceptation appel :",
        error
      );

      await sendCallSignal(
        "call-reject",
        {
          to: callState.peerId,
          from: currentUser.id,
          callId: callState.callId,
          reason: "media-error"
        }
      );

      cleanupCall(false);

      alert(
        "Impossible d'accéder au micro ou à la caméra."
      );
    }
  }

  /* =========================================================
     29. REFUSER APPEL
     ========================================================= */

  async function rejectCall() {

    if (
      !callState.active ||
      !callState.peerId
    ) {
      cleanupCall(false);
      return;
    }

    await sendCallSignal(
      "call-reject",
      {
        to: callState.peerId,

        from: currentUser.id,

        callId: callState.callId,

        reason: "rejected"
      }
    );

    cleanupCall(false);
  }

  /* =========================================================
     30. RECEVOIR REPONSE
     ========================================================= */

  async function receiveCallAnswer(
    payload
  ) {

    if (!payload) return;

    if (!currentUser) return;

    if (payload.to !== currentUser.id) {
      return;
    }

    if (!callState.active) return;

    if (
      payload.callId !==
      callState.callId
    ) {
      return;
    }

    if (
      callState.role !== "caller"
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

      await flushPendingIceCandidates();

      if (callStatus) {
        callStatus.textContent =
          "🔄 Connexion à l'appel...";
      }

    } catch (error) {

      console.error(
        "Erreur réponse WebRTC :",
        error
      );

    }
  }

  /* =========================================================
     31. ICE CANDIDATE
     ========================================================= */

  async function receiveIceCandidate(
    payload
  ) {

    if (!payload) return;

    if (!currentUser) return;

    if (payload.to !== currentUser.id) {
      return;
    }

    if (!callState.active) return;

    if (
      payload.callId !==
      callState.callId
    ) {
      return;
    }

    const candidate =
      payload.candidate;

    if (!candidate) return;

    if (
      !callState.peerConnection ||
      !callState.peerConnection.remoteDescription
    ) {

      callState.pendingIceCandidates.push(
        candidate
      );

      return;
    }

    try {

      await callState.peerConnection
        .addIceCandidate(
          new RTCIceCandidate(
            candidate
          )
        );

    } catch (error) {

      console.error(
        "Erreur ICE :",
        error
      );

    }
  }

  /* =========================================================
     32. TRAITER ICE EN ATTENTE
     ========================================================= */

  async function flushPendingIceCandidates() {

    if (
      !callState.peerConnection ||
      !callState.peerConnection.remoteDescription
    ) {
      return;
    }

    const candidates =
      callState.pendingIceCandidates;

    callState.pendingIceCandidates = [];

    for (const candidate of candidates) {

      try {

        await callState.peerConnection
          .addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );

      } catch (error) {

        console.error(
          "Erreur ICE en attente :",
          error
        );

      }
    }
  }

  /* =========================================================
     33. APPEL REFUSE PAR L'AUTRE
     ========================================================= */

  function receiveCallReject(payload) {

    if (!payload) return;

    if (
      payload.to !== currentUser?.id
    ) {
      return;
    }

    if (
      !callState.active ||
      payload.callId !== callState.callId
    ) {
      return;
    }

    if (callStatus) {

      callStatus.textContent =
        payload.reason === "busy"
          ? "🔴 Utilisateur déjà en appel."
          : "❌ Appel refusé.";

    }

    setTimeout(() => {

      cleanupCall(false);

    }, 1500);
  }

  /* =========================================================
     34. RACCROCHER
     ========================================================= */

  async function hangupCall() {

    if (!callState.active) {
      return;
    }

    if (callState.peerId) {

      await sendCallSignal(
        "call-end",
        {
          to: callState.peerId,

          from: currentUser.id,

          callId: callState.callId
        }
      );

    }

    cleanupCall(false);
  }

  /* =========================================================
     35. APPEL TERMINE DISTANT
     ========================================================= */

  function receiveCallEnd(payload) {

    if (!payload) return;

    if (
      payload.to !== currentUser?.id
    ) {
      return;
    }

    if (
      !callState.active ||
      payload.callId !== callState.callId
    ) {
      return;
    }

    if (callStatus) {
      callStatus.textContent =
        "📵 L'appel est terminé.";
    }

    setTimeout(() => {

      cleanupCall(false);

    }, 700);
  }

  /* =========================================================
     36. NETTOYER APPEL
     ========================================================= */

  function cleanupCall(sendEnd) {

    const oldPeerId =
      callState.peerId;

    const oldCallId =
      callState.callId;

    if (
      sendEnd &&
      oldPeerId &&
      currentUser
    ) {

      sendCallSignal(
        "call-end",
        {
          to: oldPeerId,

          from: currentUser.id,

          callId: oldCallId
        }
      ).catch(() => {});

    }

    /* ---------- STOP LOCAL ---------- */

    if (callState.localStream) {

      callState.localStream
        .getTracks()
        .forEach((track) => {

          try {
            track.stop();
          } catch (error) {}

        });

    }

    /* ---------- PEER ---------- */

    if (callState.peerConnection) {

      try {
        callState.peerConnection.close();
      } catch (error) {}

    }

    /* ---------- VIDEO ---------- */

    if (localVideo) {
      localVideo.srcObject = null;
    }

    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }

    /* ---------- RESET ---------- */

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

    if (callStatus) {
      callStatus.textContent = "";
    }

    hideCallModal();
  }

  /* =========================================================
     37. BOUTONS APPEL
     ========================================================= */

  if (videoCallBtn) {

    videoCallBtn.addEventListener(
      "click",
      async () => {

        await startCall("video");

      }
    );
  }

  if (audioCallBtn) {

    audioCallBtn.addEventListener(
      "click",
      async () => {

        await startCall("audio");

      }
    );
  }

  if (acceptCallBtn) {

    acceptCallBtn.addEventListener(
      "click",
      async () => {

        await acceptCall();

      }
    );
  }

  if (rejectCallBtn) {

    rejectCallBtn.addEventListener(
      "click",
      async () => {

        await rejectCall();

      }
    );
  }

  if (hangupBtn) {

    hangupBtn.addEventListener(
      "click",
      async () => {

        await hangupCall();

      }
    );
  }

  /* =========================================================
     38. SON D'APPEL
     ========================================================= */

  function playCallSound() {

    try {

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) return;

      const context =
        new AudioContext();

      const oscillator =
        context.createOscillator();

      const gain =
        context.createGain();

      oscillator.type = "sine";

      oscillator.frequency.value =
        700;

      gain.gain.value =
        0.12;

      oscillator.connect(gain);

      gain.connect(
        context.destination
      );

      oscillator.start();

      setTimeout(() => {

        try {
          oscillator.stop();
          context.close();
        } catch (error) {}

      }, 500);

    } catch (error) {
      console.log(error);
    }
  }

  /* =========================================================
     39. DEMANDER NOTIFICATION NAVIGATEUR
     ========================================================= */

  function requestNotifications() {

    try {

      if (
        "Notification" in window &&
        Notification.permission === "default"
      ) {

        Notification.requestPermission()
          .catch(() => {});

      }

    } catch (error) {}

  }

  /* =========================================================
     40. DECONNEXION
     ========================================================= */

  if (logoutBtn) {

    logoutBtn.addEventListener(
      "click",
      async () => {

        /* Raccrocher si appel */

        if (callState.active) {
          await hangupCall();
        }

        /* Supprimer présence */

        try {

          if (presenceChannel) {

            await presenceChannel.untrack();

            await supabaseClient
              .removeChannel(
                presenceChannel
              );

          }

        } catch (error) {

          console.error(error);

        }

        /* Supprimer channels */

        try {

          if (publicChannel) {

            await supabaseClient
              .removeChannel(
                publicChannel
              );

          }

        } catch (error) {}

        try {

          if (privateChannel) {

            await supabaseClient
              .removeChannel(
                privateChannel
              );

          }

        } catch (error) {}

        currentUser = null;

        onlineUsers.clear();

        privateConversations.clear();

        activePrivateUserId = null;

        showLogin();

        location.reload();

      }
    );
  }

  /* =========================================================
     41. NOTIFICATIONS
     ========================================================= */

  requestNotifications();

  /* =========================================================
     42. LOG DE DEMARRAGE
     ========================================================= */

  console.log(
    "🌊 OceanChat démarré avec succès."
  );

  console.log(
    "📹 Appels vidéo activés."
  );

  console.log(
    "🎤 Appels vocaux activés."
  );

});

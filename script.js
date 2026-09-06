/* =========================================================
   🌊 OCEANCHAT
   VERSION MOBILE
   Chat public + privé + conversations réduites
   Appels audio + vidéo
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
    alert("Erreur de configuration Supabase.");
    console.error("Configuration Supabase manquante.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    window.OCEANCHAT_SUPABASE_URL,
    window.OCEANCHAT_SUPABASE_KEY
  );

  /* =========================================================
     ELEMENTS
     ========================================================= */

  const loginSection =
    document.getElementById("loginSection");

  const chatSection =
    document.getElementById("chatSection");

  const profileForm =
    document.getElementById("profileForm");

  const pseudoInput =
    document.getElementById("pseudo");

  const ageInput =
    document.getElementById("age");

  const sexeInput =
    document.getElementById("sexe");

  const paysInput =
    document.getElementById("pays");

  const usersList =
    document.getElementById("usersList");

  const onlineCount =
    document.getElementById("onlineCount");

  const logoutBtn =
    document.getElementById("logoutBtn");

  const messages =
    document.getElementById("messages");

  const messageForm =
    document.getElementById("messageForm");

  const messageInput =
    document.getElementById("messageInput");

  const sendMessageBtn =
    document.getElementById("sendMessage");

  const privateModal =
    document.getElementById("privateModal");

  const privateTitle =
    document.getElementById("privateTitle");

  const minimizePrivate =
    document.getElementById("minimizePrivate");

  const closePrivate =
    document.getElementById("closePrivate");

  const privateMessages =
    document.getElementById("privateMessages");

  const privateMessageForm =
    document.getElementById("privateMessageForm");

  const privateMessageInput =
    document.getElementById("privateMessageInput");

  const sendPrivateMessage =
    document.getElementById("sendPrivateMessage");

  /* =========================================================
     ETAT
     ========================================================= */

  let currentUser = null;

  let presenceChannel = null;

  let publicChannel = null;

  let personalChannel = null;

  const onlineUsers = new Map();

  const privateConversations = new Map();

  let activePrivateUserId = null;

  /* =========================================================
     ETAT APPEL
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
      Math.random()
        .toString(36)
        .substring(2)
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
      element.scrollTop =
        element.scrollHeight;
    }
  }

  /* =========================================================
     STYLE MOBILE + BARRE DISCUSSIONS REDUITES
     ========================================================= */

  function installMobileStyles() {

    if (
      document.getElementById(
        "oceanchat-mobile-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "oceanchat-mobile-styles";

    style.textContent = `

      /* =========================================
         BARRE DES DISCUSSIONS REDUITES
         ========================================= */

      #privateChatsBar {
        position:relative !important;

        width:100% !important;

        min-height:0;

        display:flex !important;

        flex-direction:row !important;

        align-items:center !important;

        gap:8px !important;

        padding:8px !important;

        margin:0 !important;

        overflow-x:auto !important;

        overflow-y:hidden !important;

        background:#f1f5f9 !important;

        border-top:1px solid #d9e2ec !important;

        border-bottom:1px solid #d9e2ec !important;

        -webkit-overflow-scrolling:touch;

        scrollbar-width:none;

        z-index:20;
      }

      #privateChatsBar::-webkit-scrollbar {
        display:none;
      }

      /* =========================================
         BOUTON DISCUSSION REDUITE
         ========================================= */

      #privateChatsBar
      .minimized-private-chat {

        flex:0 0 auto !important;

        min-width:120px !important;

        max-width:180px !important;

        height:44px !important;

        padding:0 13px !important;

        border:1px solid #cbd5e1 !important;

        border-radius:22px !important;

        background:white !important;

        color:#0f172a !important;

        font-size:14px !important;

        font-weight:600 !important;

        white-space:nowrap !important;

        overflow:hidden !important;

        text-overflow:ellipsis !important;

        cursor:pointer !important;

        box-shadow:0 2px 5px rgba(0,0,0,.08);

        touch-action:manipulation;
      }

      #privateChatsBar
      .minimized-private-chat:active {

        transform:scale(.96);

      }

      /* =========================================
         NOUVEAU MESSAGE
         ========================================= */

      #privateChatsBar
      .minimized-private-chat.new-message {

        background:#ff1f1f !important;

        color:white !important;

        border-color:#ff0000 !important;

        animation:
          oceanchatPrivateBlink
          .7s infinite;
      }

      @keyframes oceanchatPrivateBlink {

        0%,100% {
          opacity:1;
        }

        50% {
          opacity:.25;
        }

      }

      /* =========================================
         HEADER CHAT PRIVE
         ========================================= */

      .oceanchat-call-buttons {

        display:flex;

        align-items:center;

        gap:5px;

        margin-left:auto;

        margin-right:5px;

      }

      .oceanchat-call-buttons button {

        width:34px;

        height:34px;

        border:0;

        border-radius:9px;

        background:rgba(255,255,255,.18);

        color:white;

        font-size:17px;

        cursor:pointer;

        touch-action:manipulation;

      }

      /* =========================================
         APPEL
         ========================================= */

      #oceanchatCallModal {

        position:fixed;

        inset:0;

        z-index:99999;

        display:none;

        align-items:center;

        justify-content:center;

        background:rgba(0,0,0,.85);

        padding:12px;

      }

      .oceanchat-call-box {

        width:100%;

        max-width:720px;

        background:white;

        border-radius:20px;

        padding:18px;

        text-align:center;

        box-sizing:border-box;

      }

      .oceanchat-call-box h2 {

        margin:0 0 8px;

        color:#0077b6;

        font-size:20px;

      }

      .oceanchat-call-box p {

        color:#667085;

        margin:0 0 15px;

      }

      #oceanchatIncomingButtons {

        display:flex;

        justify-content:center;

        gap:10px;

        margin-bottom:15px;

      }

      #oceanchatAcceptCall,
      #oceanchatRejectCall,
      #oceanchatHangup {

        border:0;

        border-radius:12px;

        padding:13px 18px;

        font-weight:bold;

        font-size:15px;

        cursor:pointer;

        touch-action:manipulation;

      }

      #oceanchatAcceptCall {

        background:#12b76a;

        color:white;

      }

      #oceanchatRejectCall,
      #oceanchatHangup {

        background:#e53935;

        color:white;

      }

      #oceanchatVideoContainer {

        position:relative;

        width:100%;

        aspect-ratio:16/9;

        background:#111;

        border-radius:14px;

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

        right:10px;

        bottom:10px;

        width:28%;

        max-width:170px;

        border:2px solid white;

        border-radius:10px;

        background:#222;

      }

      #oceanchatHangup {

        display:none;

      }

      .oceanchat-audio-icon {

        font-size:65px;

        padding:25px;

      }

      /* =========================================
         TELEPHONE
         ========================================= */

      @media(max-width:600px) {

        #privateChatsBar {

          padding:7px !important;

          gap:6px !important;

        }

        #privateChatsBar
        .minimized-private-chat {

          min-width:110px !important;

          max-width:145px !important;

          height:42px !important;

          font-size:13px !important;

          padding:0 11px !important;

        }

        .oceanchat-call-buttons {

          gap:3px;

        }

        .oceanchat-call-buttons button {

          width:31px;

          height:31px;

          font-size:15px;

        }

        .oceanchat-call-box {

          padding:14px;

          border-radius:16px;

        }

        .oceanchat-call-box h2 {

          font-size:18px;

        }

        #oceanchatAcceptCall,
        #oceanchatRejectCall,
        #oceanchatHangup {

          padding:12px 15px;

          font-size:14px;

        }

      }

    `;

    document.head.appendChild(style);
  }

  installMobileStyles();

  /* =========================================================
     CREER INTERFACE APPEL
     ========================================================= */

  function createCallInterface() {

    const header =
      privateModal?.querySelector(
        ".private-header"
      ) ||
      privateModal?.querySelector(
        ".private-window-header"
      );

    /* ---------- BOUTONS ---------- */

    if (
      header &&
      !document.getElementById(
        "oceanchatCallButtons"
      )
    ) {

      const buttons =
        document.createElement("div");

      buttons.id =
        "oceanchatCallButtons";

      buttons.className =
        "oceanchat-call-buttons";

      buttons.innerHTML = `

        <button
          type="button"
          id="oceanchatVideoCallBtn"
          title="Appel vidéo"
        >
          📹
        </button>

        <button
          type="button"
          id="oceanchatAudioCallBtn"
          title="Appel vocal"
        >
          🎤
        </button>

      `;

      const controls =
        header.querySelector(
          ".private-controls"
        );

      if (controls) {

        header.insertBefore(
          buttons,
          controls
        );

      } else {

        header.appendChild(
          buttons
        );

      }
    }

    /* ---------- MODAL ---------- */

    if (
      !document.getElementById(
        "oceanchatCallModal"
      )
    ) {

      const modal =
        document.createElement("div");

      modal.id =
        "oceanchatCallModal";

      modal.innerHTML = `

        <div class="oceanchat-call-box">

          <h2
            id="oceanchatCallTitle"
          >
            Appel
          </h2>

          <p
            id="oceanchatCallStatus"
          >
            Connexion...
          </p>

          <div
            id="oceanchatIncomingButtons"
          >

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

          <div
            id="oceanchatVideoContainer"
          >

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

      document.body.appendChild(
        modal
      );
    }
  }

  createCallInterface();

  /* =========================================================
     ELEMENTS APPEL
     ========================================================= */

  const callModal =
    document.getElementById(
      "oceanchatCallModal"
    );

  const callTitle =
    document.getElementById(
      "oceanchatCallTitle"
    );

  const callStatus =
    document.getElementById(
      "oceanchatCallStatus"
    );

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
     CONNEXION UTILISATEUR
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

          id:createId(),

          pseudo,

          age,

          sexe,

          pays

        };

        loginSection.style.display =
          "none";

        chatSection.style.display =
          "block";

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
          config:{
            presence:{
              key:
                currentUser.id
            }
          }
        }
      );

    presenceChannel
      .on(
        "presence",
        {
          event:"sync"
        },
        () => {

          const state =
            presenceChannel.presenceState();

          onlineUsers.clear();

          Object.keys(state).forEach(
            key => {

              const list =
                state[key];

              if (!list?.length) {
                return;
              }

              const user =
                list[0];

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
      .subscribe(
        async status => {

          if (
            status ===
            "SUBSCRIBED"
          ) {

            await presenceChannel.track({

              id:
                currentUser.id,

              pseudo:
                currentUser.pseudo,

              age:
                currentUser.age,

              sexe:
                currentUser.sexe,

              pays:
                currentUser.pays

            });

          }

        }
      );
  }

  /* =========================================================
     UTILISATEURS
     ========================================================= */

  function renderUsers() {

    if (!usersList) {
      return;
    }

    usersList.innerHTML = "";

    const users =
      Array.from(
        onlineUsers.values()
      )
      .filter(
        user =>
          user.id !==
          currentUser?.id
      );

    if (onlineCount) {

      onlineCount.textContent =
        onlineUsers.size;

    }

    if (!users.length) {

      const empty =
        document.createElement(
          "div"
        );

      empty.textContent =
        "Aucun autre utilisateur en ligne.";

      usersList.appendChild(
        empty
      );

      return;
    }

    users.forEach(user => {

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "online-user";

      button.innerHTML = `

        <span class="online-dot">
        </span>

        <span class="online-user-info">

          <strong>
            ${escapeHtml(
              user.pseudo
            )}
          </strong>

          <small>
            ${escapeHtml(
              user.age
            )} ans •
            ${escapeHtml(
              user.sexe
            )} •
            ${escapeHtml(
              user.pays
            )}
          </small>

        </span>

      `;

      button.addEventListener(
        "click",
        () => {

          openPrivateChat(
            user
          );

        }
      );

      usersList.appendChild(
        button
      );

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
        {
          event:
            "public-message"
        },
        ({payload}) => {

          if (payload) {

            addPublicMessage(
              payload
            );

          }

        }
      )
      .subscribe();
  }

  function addPublicMessage(
    payload
  ) {

    if (!messages) {
      return;
    }

    const div =
      document.createElement(
        "div"
      );

    div.className =
      payload.userId ===
      currentUser.id
        ? "message own-message"
        : "message";

    div.innerHTML = `

      <div class="message-author">
        ${escapeHtml(
          payload.pseudo
        )}
      </div>

      <div class="message-text">
        ${escapeHtml(
          payload.text
        )}
      </div>

    `;

    messages.appendChild(
      div
    );

    scrollBottom(
      messages
    );
  }

  async function sendPublicMessage() {

    const text =
      messageInput?.value.trim();

    if (!text) {
      return;
    }

    messageInput.value = "";

    const payload = {

      id:
        createId(),

      userId:
        currentUser.id,

      pseudo:
        currentUser.pseudo,

      text,

      createdAt:
        new Date().toISOString()

    };

    await publicChannel.send({

      type:
        "broadcast",

      event:
        "public-message",

      payload

    });

    addPublicMessage(
      payload
    );
  }

  if (messageForm) {

    messageForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        await sendPublicMessage();

      }
    );
  }

  if (messageInput) {

    messageInput.addEventListener(
      "keydown",
      async event => {

        if (
          event.key ===
            "Enter" &&
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
      async event => {

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

    personalChannel =
      supabaseClient.channel(
        channelName
      );

    /* MESSAGE */

    personalChannel.on(
      "broadcast",
      {
        event:
          "private-message"
      },
      ({payload}) => {

        console.log(
          "📩 Message reçu",
          payload
        );

        if (!payload) {
          return;
        }

        if (
          payload.to !==
          currentUser.id
        ) {
          return;
        }

        receivePrivateMessage(
          payload
        );

      }
    );

    /* APPELS */

    personalChannel.on(
      "broadcast",
      {
        event:
          "call-offer"
      },
      ({payload}) => {

        receiveCallOffer(
          payload
        );

      }
    );

    personalChannel.on(
      "broadcast",
      {
        event:
          "call-answer"
      },
      ({payload}) => {

        receiveCallAnswer(
          payload
        );

      }
    );

    personalChannel.on(
      "broadcast",
      {
        event:
          "ice-candidate"
      },
      ({payload}) => {

        receiveIceCandidate(
          payload
        );

      }
    );

    personalChannel.on(
      "broadcast",
      {
        event:
          "call-reject"
      },
      ({payload}) => {

        receiveCallReject(
          payload
        );

      }
    );

    personalChannel.on(
      "broadcast",
      {
        event:
          "call-end"
      },
      ({payload}) => {

        receiveCallEnd(
          payload
        );

      }
    );

    return new Promise(
      resolve => {

        personalChannel.subscribe(
          status => {

            console.log(
              "Canal personnel:",
              status
            );

            if (
              status ===
              "SUBSCRIBED"
            ) {

              console.log(
                "✅ Canal personnel prêt"
              );

              resolve();

            }

          }
        );

      }
    );
  }

  /* =========================================================
     OUVRIR DISCUSSION
     ========================================================= */

  function openPrivateChat(
    user
  ) {

    if (!user?.id) {
      return;
    }

    activePrivateUserId =
      user.id;

    if (
      !privateConversations.has(
        user.id
      )
    ) {

      privateConversations.set(
        user.id,
        {

          user,

          messages:[],

          minimized:false,

          unread:false

        }
      );

    }

    const conversation =
      privateConversations.get(
        user.id
      );

    conversation.user =
      user;

    conversation.minimized =
      false;

    conversation.unread =
      false;

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

    setTimeout(
      () => {

        privateMessageInput?.focus();

      },
      100
    );
  }

  /* =========================================================
     AFFICHER MESSAGES PRIVES
     ========================================================= */

  function renderPrivateMessages() {

    if (!privateMessages) {
      return;
    }

    privateMessages.innerHTML =
      "";

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
      msg => {

        const div =
          document.createElement(
            "div"
          );

        div.className =
          msg.from ===
          currentUser.id
            ? "message own-message"
            : "message";

        div.innerHTML = `

          <div class="message-author">
            ${escapeHtml(
              msg.pseudo
            )}
          </div>

          <div class="message-text">
            ${escapeHtml(
              msg.text
            )}
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
     ENVOYER MESSAGE PRIVE
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

    privateMessageInput.value =
      "";

    const targetUser =
      conversation.user;

    const payload = {

      id:
        createId(),

      from:
        currentUser.id,

      to:
        targetUser.id,

      pseudo:
        currentUser.pseudo,

      text,

      createdAt:
        new Date().toISOString()

    };

    /*
      Affichage immédiat chez l'expéditeur.
    */

    conversation.messages.push(
      payload
    );

    conversation.unread =
      false;

    renderPrivateMessages();

    renderPrivateChatsBar();

    /*
      Envoi direct au canal personnel
      du destinataire.
    */

    const targetChannel =
      supabaseClient.channel(
        `oceanchat-user-${targetUser.id}`
      );

    await new Promise(
      resolve => {

        targetChannel.subscribe(
          status => {

            if (
              status ===
              "SUBSCRIBED"
            ) {

              resolve();

            }

          }
        );

      }
    );

    await targetChannel.send({

      type:
        "broadcast",

      event:
        "private-message",

      payload

    });

    /*
      Supprimer le canal temporaire
      après l'envoi.
    */

    setTimeout(
      () => {

        supabaseClient.removeChannel(
          targetChannel
        );

      },
      1000
    );
  }

  if (privateMessageForm) {

    privateMessageForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        await sendPrivate();

      }
    );
  }

  if (privateMessageInput) {

    privateMessageInput.addEventListener(
      "keydown",
      async event => {

        if (
          event.key ===
            "Enter" &&
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
      async event => {

        event.preventDefault();

        await sendPrivate();

      }
    );
  }

  /* =========================================================
     RECEVOIR MESSAGE
     ========================================================= */

  function receivePrivateMessage(
    payload
  ) {

    let conversation =
      privateConversations.get(
        payload.from
      );

    if (!conversation) {

      let sender =
        onlineUsers.get(
          payload.from
        );

      if (!sender) {

        sender = {

          id:
            payload.from,

          pseudo:
            payload.pseudo ||
            "Utilisateur"

        };

      }

      conversation = {

        user:
          sender,

        messages:[],

        minimized:true,

        unread:true

      };

      privateConversations.set(
        payload.from,
        conversation
      );

    }

    conversation.messages.push(
      payload
    );

    const isOpen =
      activePrivateUserId ===
        payload.from &&
      privateModal &&
      privateModal.style.display !==
        "none";

    /*
      Si la discussion n'est pas ouverte :
      elle reste dans la barre du bas
      et clignote en rouge.
    */

    if (!isOpen) {

      conversation.minimized =
        true;

      conversation.unread =
        true;

    }

    if (isOpen) {

      renderPrivateMessages();

    }

    renderPrivateChatsBar();

  }

  /* =========================================================
     ⭐ BARRE DISCUSSIONS REDUITES
     ========================================================= */

  function renderPrivateChatsBar() {

    if (!privateChatsBar) {
      return;
    }

    /*
      IMPORTANT :
      On ne cache PLUS la barre.
    */

    privateChatsBar.style.display =
      "flex";

    privateChatsBar.innerHTML =
      "";

    privateConversations.forEach(
      (conversation) => {

        /*
          Une discussion existe dans
          la barre tant qu'elle n'est
          pas actuellement ouverte.
        */

        if (
          activePrivateUserId ===
          conversation.user?.id &&
          privateModal &&
          privateModal.style.display !==
            "none"
        ) {

          return;

        }

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "minimized-private-chat";

        if (
          conversation.unread
        ) {

          button.classList.add(
            "new-message"
          );

        }

        button.textContent =
          `💬 ${
            conversation.user?.pseudo ||
            "Utilisateur"
          }`;

        button.title =
          "Ouvrir la discussion";

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

    /*
      Si aucune discussion réduite :
      on garde quand même un petit espace
      propre sous le chat.
    */

    if (
      privateChatsBar.children.length ===
      0
    ) {

      privateChatsBar.style.display =
        "none";

    } else {

      privateChatsBar.style.display =
        "flex";

    }
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

        /*
          On ferme seulement la fenêtre
          privée.

          La discussion reste visible
          dans la barre EN BAS.
        */

        if (privateModal) {

          privateModal.style.display =
            "none";

        }

        /*
          Très important :
          on ne supprime PAS
          activePrivateUserId.

          On le remet simplement à null.
        */

        activePrivateUserId =
          null;

        renderPrivateChatsBar();

      }
    );
  }

  /* =========================================================
     FERMER COMPLETEMENT
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

        activePrivateUserId =
          null;

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
     SIGNAL APPEL
     ========================================================= */

  async function sendCallSignal(
    eventName,
    payload
  ) {

    if (!payload?.to) {
      return;
    }

    const channel =
      supabaseClient.channel(
        `oceanchat-user-${payload.to}`
      );

    await new Promise(
      resolve => {

        channel.subscribe(
          status => {

            if (
              status ===
              "SUBSCRIBED"
            ) {

              resolve();

            }

          }
        );

      }
    );

    await channel.send({

      type:
        "broadcast",

      event:
        eventName,

      payload

    });

    setTimeout(
      () => {

        supabaseClient.removeChannel(
          channel
        );

      },
      1000
    );
  }

  /* =========================================================
     MEDIA
     ========================================================= */

  async function getMedia(
    type
  ) {

    return navigator.mediaDevices
      .getUserMedia(

        type === "video"

          ? {
              audio:true,

              video:{
                facingMode:"user",
                width:{
                  ideal:1280
                },
                height:{
                  ideal:720
                }
              }
            }

          : {
              audio:true,
              video:false
            }

      );
  }

  /* =========================================================
     AFFICHER APPEL
     ========================================================= */

  function showCallModal(
    type,
    pseudo
  ) {

    callModal.style.display =
      "flex";

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
          track => {

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

    pc.ontrack =
      event => {

        event.streams[0]
          ?.getTracks()
          .forEach(
            track => {

              callState.remoteStream
                .addTrack(
                  track
                );

            }
          );

      };

    pc.onicecandidate =
      async event => {

        if (!event.candidate) {
          return;
        }

        await sendCallSignal(
          "ice-candidate",
          {

            to:
              callState.peerId,

            from:
              currentUser.id,

            callId:
              callState.callId,

            candidate:
              event.candidate

          }
        );

      };

    pc.onconnectionstatechange =
      () => {

        if (
          pc.connectionState ===
          "connected"
        ) {

          callStatus.textContent =
            "🟢 Appel connecté";

        }

        if (
          pc.connectionState ===
            "failed" ||
          pc.connectionState ===
            "closed"
        ) {

          setTimeout(
            () =>
              cleanupCall(),
            1000
          );

        }

      };

    return pc;
  }

  /* =========================================================
     APPEL SORTANT
     ========================================================= */

  async function startCall(
    type
  ) {

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

      active:true,

      callId:
        createId(),

      type,

      role:
        "caller",

      peerId:
        user.id,

      peerPseudo:
        user.pseudo,

      peerConnection:null,

      localStream:null,

      remoteStream:null,

      pendingOffer:null,

      pendingIceCandidates:[]

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
        await getMedia(
          type
        );

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

          to:
            user.id,

          from:
            currentUser.id,

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

      console.error(
        error
      );

      callStatus.textContent =
        "❌ Impossible d'utiliser le micro ou la caméra.";

      setTimeout(
        () =>
          cleanupCall(),
        2000
      );

    }
  }

  /* =========================================================
     APPEL ENTRANT
     ========================================================= */

  function receiveCallOffer(
    payload
  ) {

    if (!payload) {
      return;
    }

    if (
      payload.to !==
      currentUser.id
    ) {
      return;
    }

    if (callState.active) {

      sendCallSignal(
        "call-reject",
        {

          to:
            payload.from,

          from:
            currentUser.id,

          callId:
            payload.callId,

          reason:
            "busy"

        }
      );

      return;
    }

    callState = {

      active:true,

      callId:
        payload.callId,

      type:
        payload.type,

      role:
        "receiver",

      peerId:
        payload.from,

      peerPseudo:
        payload.pseudo ||
        "Utilisateur",

      peerConnection:null,

      localStream:null,

      remoteStream:null,

      pendingOffer:
        payload.sdp,

      pendingIceCandidates:[]

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
     ACCEPTER APPEL
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

          to:
            callState.peerId,

          from:
            currentUser.id,

          callId:
            callState.callId,

          sdp:
            pc.localDescription

        }
      );

      await flushIce();

    } catch (error) {

      console.error(
        error
      );

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

      cleanupCall();

    }
  }

  /* =========================================================
     REFUSER APPEL
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

    cleanupCall();

  }

  /* =========================================================
     REPONSE APPEL
     ========================================================= */

  async function receiveCallAnswer(
    payload
  ) {

    if (
      !payload ||
      payload.to !==
        currentUser.id
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

      console.error(
        error
      );

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
      payload.to !==
        currentUser.id
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

      console.error(
        error
      );

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
      const candidate of
      candidates
    ) {

      try {

        await callState.peerConnection
          .addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );

      } catch (error) {

        console.error(
          error
        );

      }

    }
  }

  /* =========================================================
     APPEL REFUSE
     ========================================================= */

  function receiveCallReject(
    payload
  ) {

    if (
      !payload ||
      payload.to !==
        currentUser.id
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
      payload.reason ===
      "busy"
        ? "🔴 Utilisateur déjà en appel."
        : "❌ Appel refusé.";

    setTimeout(
      () =>
        cleanupCall(),
      1500
    );
  }

  /* =========================================================
     RACCROCHER
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

    cleanupCall();

  }

  /* =========================================================
     APPEL TERMINE
     ========================================================= */

  function receiveCallEnd(
    payload
  ) {

    if (
      !payload ||
      payload.to !==
        currentUser.id
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
      () =>
        cleanupCall(),
      700
    );
  }

  /* =========================================================
     NETTOYER APPEL
     ========================================================= */

  function cleanupCall() {

    if (
      callState.localStream
    ) {

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

    if (
      callState.peerConnection
    ) {

      try {

        callState.peerConnection
          .close();

      } catch (e) {}

    }

    if (localVideo) {
      localVideo.srcObject =
        null;
    }

    if (remoteVideo) {
      remoteVideo.srcObject =
        null;
    }

    callState = {

      active:false,

      callId:null,

      type:null,

      role:null,

      peerId:null,

      peerPseudo:null,

      peerConnection:null,

      localStream:null,

      remoteStream:null,

      pendingOffer:null,

      pendingIceCandidates:[]

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
      () =>
        startCall("video")
    );

  }

  if (audioCallBtn) {

    audioCallBtn.addEventListener(
      "click",
      () =>
        startCall("audio")
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

            await presenceChannel
              .untrack();

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
     FIN
     ========================================================= */

  console.log(
    "🌊 OceanChat mobile chargé."
  );

  console.log(
    "💬 Discussions réduites en bas du salon."
  );

  console.log(
    "📹 Appels vidéo activés."
  );

  console.log(
    "🎤 Appels audio activés."
  );

});

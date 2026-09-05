import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getRoomMessages,
} from "../../services/roomService";

import FileAttachmentPicker from "../FileAttachmentPicker";
import VoiceRecorder from "../VoiceRecorder";
import VoiceMessagePlayer from "../VoiceMessagePlayer";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const getAudioUrl = (value) => {
  if (!value) {
    return "";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  const serverUrl = String(API_URL)
    .trim()
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");

  return value.startsWith("/")
    ? `${serverUrl}${value}`
    : `${serverUrl}/${value}`;
};

// =====================================================
// GROUP CHAT
// =====================================================

const GroupChat = ({
  socket,
  room,
  currentUser,
}) => {
  // =====================================================
  // STATE
  // =====================================================

  const [messages, setMessages] = useState([]);

  const [message, setMessage] =
    useState("");

  const [typingUsers, setTypingUsers] =
    useState({});

  const [loading, setLoading] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  // =====================================================
  // REFS
  // =====================================================

  const messagesEndRef =
    useRef(null);

  const typingTimeoutsRef =
    useRef(new Map());

  const currentRoomIdRef =
    useRef(null);

  // =====================================================
  // HELPERS
  // =====================================================

  const getCurrentUserId = useCallback(
    () =>
      String(
        currentUser?._id ||
          currentUser?.id ||
          ""
      ),
    [currentUser]
  );

  const getMessageId = (msg) =>
    String(
      msg?._id ||
        msg?.id ||
        ""
    );

  const getSenderId = (msg) =>
    String(
      msg?.sender?._id ||
        msg?.sender?.id ||
        msg?.sender ||
        ""
    );

  const getRoomId = (msg) =>
    String(
      msg?.roomId || ""
    );

  const isMine = useCallback(
    (msg) =>
      getSenderId(msg) ===
      getCurrentUserId(),
    [getCurrentUserId]
  );

  const clearError = () => {
    setError("");
  };

  // =====================================================
  // CURRENT ROOM ID
  // =====================================================

  const roomId = useMemo(
    () =>
      room?._id
        ? String(room._id)
        : null,
    [room?._id]
  );

  // =====================================================
  // AUTO SCROLL
  // =====================================================

  const scrollToBottom = useCallback(
    (behavior = "smooth") => {
      messagesEndRef.current?.scrollIntoView(
        {
          behavior,
        }
      );
    },
    []
  );

  useEffect(() => {
    scrollToBottom();
  }, [
    messages,
    scrollToBottom,
  ]);

  // =====================================================
  // LOAD ROOM MESSAGE HISTORY
  // =====================================================

  const loadMessages = useCallback(
    async () => {
      if (!roomId) {
        setMessages([]);
        return;
      }

      try {
        setLoading(true);
        clearError();

        const data =
          await getRoomMessages(
            roomId
          );

        const safeMessages =
          Array.isArray(data)
            ? data
            : [];

        setMessages(
          safeMessages
        );

        // Mark the entire room as read
        // after the history has loaded.
        if (socket) {
          socket.emit(
            "mark_room_read",
            roomId
          );
        }

        requestAnimationFrame(
          () => {
            scrollToBottom(
              "auto"
            );
          }
        );
      } catch (err) {
        console.error(
          "[GROUP CHAT] Failed to load messages:",
          err
        );

        setError(
          err.response?.data
            ?.message ||
            err.message ||
            "Failed to load room messages."
        );

        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [
      roomId,
      socket,
      scrollToBottom,
    ]
  );

  // =====================================================
  // LOAD WHEN ROOM CHANGES
  // =====================================================

  useEffect(() => {
    currentRoomIdRef.current =
      roomId;

    setMessages([]);
    setMessage("");
    setTypingUsers({});
    clearError();

    if (!roomId) {
      return;
    }

    loadMessages();
  }, [
    roomId,
    loadMessages,
  ]);

  // =====================================================
  // STOP ALL TYPING
  // =====================================================

  const clearTypingUsers =
    useCallback(() => {
      typingTimeoutsRef.current.forEach(
        (timeout) => {
          clearTimeout(timeout);
        }
      );

      typingTimeoutsRef.current.clear();

      setTypingUsers({});
    }, []);

  // =====================================================
  // ADD MESSAGE SAFELY
  // =====================================================

  const addMessage = useCallback(
    (newMessage) => {
      if (!newMessage) {
        return;
      }

      const messageRoomId =
        getRoomId(newMessage);

      if (
        !messageRoomId ||
        messageRoomId !== roomId
      ) {
        return;
      }

      const newMessageId =
        getMessageId(
          newMessage
        );

      setMessages((prev) => {
        // Prevent duplicate messages.
        if (
          newMessageId &&
          prev.some(
            (item) =>
              getMessageId(
                item
              ) === newMessageId
          )
        ) {
          return prev;
        }

        return [
          ...prev,
          newMessage,
        ];
      });
    },
    [roomId]
  );

  // =====================================================
  // SOCKET LISTENERS
  // =====================================================

  useEffect(() => {
    if (!socket || !roomId) {
      return;
    }

    // ---------------------------------------------------
    // RECEIVE MESSAGE
    // ---------------------------------------------------

    const handleReceiveMessage =
      (newMessage) => {
        if (
          getRoomId(
            newMessage
          ) !== roomId
        ) {
          return;
        }

        addMessage(
          newMessage
        );

        // If the current user is viewing
        // this room, mark the message as read.
        const messageSenderId =
          getSenderId(
            newMessage
          );

        if (
          messageSenderId &&
          messageSenderId !==
            getCurrentUserId()
        ) {
          const messageId =
            getMessageId(
              newMessage
            );

          if (messageId) {
            socket.emit(
              "mark_room_message_read",
              {
                messageId,
                roomId,
              }
            );
          }
        }

        // Room is currently open,
        // therefore keep the read state
        // up to date.
        socket.emit(
          "mark_room_read",
          roomId
        );
      };

    // ---------------------------------------------------
    // USER TYPING
    // ---------------------------------------------------

    const handleTyping = (
      data = {}
    ) => {
      if (
        String(
          data.roomId || ""
        ) !== roomId
      ) {
        return;
      }

      const typingUserId =
        String(
          data.userId || ""
        );

      if (
        !typingUserId ||
        typingUserId ===
          getCurrentUserId()
      ) {
        return;
      }

      const username =
        data.username ||
        "Someone";

      setTypingUsers(
        (prev) => ({
          ...prev,
          [typingUserId]:
            username,
        })
      );

      const existingTimeout =
        typingTimeoutsRef.current.get(
          typingUserId
        );

      if (existingTimeout) {
        clearTimeout(
          existingTimeout
        );
      }

      const timeout =
        setTimeout(() => {
          setTypingUsers(
            (prev) => {
              const next = {
                ...prev,
              };

              delete next[
                typingUserId
              ];

              return next;
            }
          );

          typingTimeoutsRef.current.delete(
            typingUserId
          );
        }, 3000);

      typingTimeoutsRef.current.set(
        typingUserId,
        timeout
      );
    };

    // ---------------------------------------------------
    // USER STOP TYPING
    // ---------------------------------------------------

    const handleStopTyping = (
      data = {}
    ) => {
      if (
        String(
          data.roomId || ""
        ) !== roomId
      ) {
        return;
      }

      const typingUserId =
        String(
          data.userId || ""
        );

      if (!typingUserId) {
        return;
      }

      const timeout =
        typingTimeoutsRef.current.get(
          typingUserId
        );

      if (timeout) {
        clearTimeout(
          timeout
        );

        typingTimeoutsRef.current.delete(
          typingUserId
        );
      }

      setTypingUsers(
        (prev) => {
          const next = {
            ...prev,
          };

          delete next[
            typingUserId
          ];

          return next;
        }
      );
    };

    // ---------------------------------------------------
    // ROOM MESSAGE READ CONFIRMATION
    // ---------------------------------------------------

    const handleRoomMessageReadConfirmed =
      (data = {}) => {
        if (
          String(
            data.roomId || ""
          ) !== roomId
        ) {
          return;
        }

        const messageId =
          String(
            data.messageId || ""
          );

        if (!messageId) {
          return;
        }

        setMessages(
          (prev) =>
            prev.map(
              (msg) =>
                getMessageId(
                  msg
                ) === messageId
                  ? {
                      ...msg,
                      readAt:
                        data.readAt ||
                        msg.readAt ||
                        null,
                    }
                  : msg
            )
        );
      };

    // ---------------------------------------------------
    // ROOM READ CONFIRMATION
    // ---------------------------------------------------

    const handleRoomReadConfirmed =
      (data = {}) => {
        if (
          String(
            data.roomId || ""
          ) !== roomId
        ) {
          return;
        }

        // No visual state is required
        // at the moment, but this event
        // confirms the backend read state.
      };

    // ---------------------------------------------------
    // ROOM JOINED
    // ---------------------------------------------------

    const handleRoomJoined =
      (data = {}) => {
        if (
          String(
            data.roomId || ""
          ) !== roomId
        ) {
          return;
        }

        clearError();

        // Make sure the socket is
        // synchronized with the room.
        socket.emit(
          "mark_room_read",
          roomId
        );
      };

    // ---------------------------------------------------
    // ROOM ERROR
    // ---------------------------------------------------

    const handleRoomError =
      (data = {}) => {
        if (data?.error) {
          setError(
            data.error
          );
        }
      };

    socket.on(
      "receive_message",
      handleReceiveMessage
    );

    socket.on(
      "user_typing",
      handleTyping
    );

    socket.on(
      "user_stop_typing",
      handleStopTyping
    );

    socket.on(
      "room_message_read_confirmed",
      handleRoomMessageReadConfirmed
    );

    socket.on(
      "room_read_confirmed",
      handleRoomReadConfirmed
    );

    socket.on(
      "room_joined",
      handleRoomJoined
    );

    socket.on(
      "room_error",
      handleRoomError
    );

    return () => {
      socket.off(
        "receive_message",
        handleReceiveMessage
      );

      socket.off(
        "user_typing",
        handleTyping
      );

      socket.off(
        "user_stop_typing",
        handleStopTyping
      );

      socket.off(
        "room_message_read_confirmed",
        handleRoomMessageReadConfirmed
      );

      socket.off(
        "room_read_confirmed",
        handleRoomReadConfirmed
      );

      socket.off(
        "room_joined",
        handleRoomJoined
      );

      socket.off(
        "room_error",
        handleRoomError
      );

      clearTypingUsers();
    };
  }, [
    socket,
    roomId,
    addMessage,
    getCurrentUserId,
    clearTypingUsers,
  ]);

  // =====================================================
  // SEND MESSAGE
  // =====================================================

  const handleSendMessage = async (
    event
  ) => {
    event.preventDefault();

    const trimmedMessage =
      message.trim();

    if (
      !trimmedMessage ||
      !socket ||
      !roomId ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      clearError();

      socket.emit(
        "send_message",
        {
          roomId,
          message:
            trimmedMessage,
          messageType:
            "text",
        }
      );

      setMessage("");

      socket.emit(
        "stop_typing",
        {
          roomId,
        }
      );
    } catch (err) {
      console.error(
        "[GROUP CHAT] Send message error:",
        err
      );

      setError(
        "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  };

  const handleSendVoice = async (
    attachmentUrl
  ) => {
    if (!socket || !roomId) {
      setError("Select a room first.");
      return;
    }

    socket.emit(
      "send_message",
      {
        roomId,
        message: "Voice message",
        messageType: "audio",
        attachmentUrl,
      }
    );
  };

  const handleSendAttachment = async (
    attachment
  ) => {
    if (!socket || !roomId || !attachment?.attachmentUrl) {
      setError("Select a room first.");
      return;
    }

    socket.emit(
      "send_message",
      {
        roomId,
        message:
          attachment.attachmentName ||
          "Attachment",
        messageType:
          attachment.messageType ||
          "file",
        attachmentUrl:
          attachment.attachmentUrl,
        attachmentName:
          attachment.attachmentName,
        attachmentMimeType:
          attachment.attachmentMimeType,
      }
    );
  };

  // =====================================================
  // TYPING
  // =====================================================

  const handleTyping = (
    event
  ) => {
    const value =
      event.target.value;

    setMessage(value);

    if (!socket || !roomId) {
      return;
    }

    if (!value.trim()) {
      socket.emit(
        "stop_typing",
        {
          roomId,
        }
      );

      return;
    }

    socket.emit(
      "typing",
      {
        roomId,
      }
    );
  };

  // =====================================================
  // MARK MESSAGE READ
  // =====================================================

  const handleMessageRead = (
    msg
  ) => {
    if (
      !socket ||
      !roomId ||
      !msg?._id
    ) {
      return;
    }

    if (isMine(msg)) {
      return;
    }

    socket.emit(
      "mark_room_message_read",
      {
        messageId:
          String(msg._id),
        roomId,
      }
    );
  };

  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = (
    value
  ) => {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // =====================================================
  // TYPING LABEL
  // =====================================================

  const typingNames =
    Object.values(
      typingUsers
    );

  const typingLabel =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length > 1
        ? `${typingNames.join(
            ", "
          )} are typing...`
        : "";

  // =====================================================
  // EMPTY ROOM
  // =====================================================

  if (!room) {
    return (
      <div className="empty-chat">
        Select a room to start
        chatting.
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="group-chat">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="group-chat-header">
        <div>
          <h2>
            {room.name ||
              "Room"}
          </h2>

          {room.description && (
            <p>
              {room.description}
            </p>
          )}

          <span>
            {Array.isArray(
              room.members
            )
              ? room.members.length
              : 0}{" "}
            member
            {Array.isArray(
              room.members
            ) &&
            room.members.length ===
              1
              ? ""
              : "s"}
          </span>
        </div>

        {room.code && (
          <div className="group-room-code">
            <small>
              Room Code
            </small>

            <strong>
              {room.code}
            </strong>
          </div>
        )}
      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="group-chat-error">
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={
              clearError
            }
          >
            ×
          </button>
        </div>
      )}

      {/* =================================================
          MESSAGES
      ================================================= */}

      <div className="group-messages">

        {loading ? (
          <div className="group-chat-loading">
            Loading messages...
          </div>
        ) : messages.length ===
          0 ? (
          <div className="group-chat-empty">
            <p>
              No messages yet.
            </p>

            <span>
              Start the
              conversation.
            </span>
          </div>
        ) : (
          messages.map(
            (msg) => {
              const mine =
                isMine(msg);

              const messageId =
                getMessageId(
                  msg
                );

              const senderName =
                msg.sender
                  ?.username ||
                "User";

              const displayMessage =
                msg.message ||
                "";

              const wasTranslated =
                Boolean(
                  msg.translated
                );

              const originalMessage =
                msg.originalMessage ||
                msg.message ||
                "";

              const translatedMessage =
                msg.translatedMessage ||
                null;

              const displayLanguage =
                msg.displayLanguage ||
                msg.originalLanguage ||
                null;

              return (
                <div
                  key={
                    messageId
                  }
                  className={
                    mine
                      ? "message mine"
                      : "message"
                  }
                  onMouseEnter={() =>
                    handleMessageRead(
                      msg
                    )
                  }
                >

                  {/* SENDER */}

                  {!mine && (
                    <strong className="message-sender">
                      {
                        senderName
                      }
                    </strong>
                  )}

                  {/* MESSAGE */}

                  {msg.messageType === "audio" &&
                  msg.attachmentUrl ? (
                    <VoiceMessagePlayer
                      src={getAudioUrl(msg.attachmentUrl)}
                    />
                  ) : msg.messageType === "video" &&
                    msg.attachmentUrl ? (
                    <video
                      controls
                      src={getAudioUrl(
                        msg.attachmentUrl
                      )}
                    />
                  ) : msg.messageType === "image" &&
                    msg.attachmentUrl ? (
                    <img
                      src={getAudioUrl(
                        msg.attachmentUrl
                      )}
                      alt={
                        msg.attachmentName ||
                        "Shared image"
                      }
                      className="message-attachment-image"
                    />
                  ) : msg.attachmentUrl ? (
                    <a
                      href={getAudioUrl(
                        msg.attachmentUrl
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {msg.attachmentName ||
                        msg.message ||
                        "Download attachment"}
                    </a>
                  ) : (
                    <p className="message-text">
                      {displayMessage}
                    </p>
                  )}

                  {/* TRANSLATION INFO */}

                  {wasTranslated && (
                    <div className="message-translation">
                      <small>
                        Translated
                        {displayLanguage
                          ? ` • ${displayLanguage}`
                          : ""}
                      </small>
                    </div>
                  )}

                  {/* ORIGINAL MESSAGE */}

                  {!mine &&
                    wasTranslated &&
                    originalMessage &&
                    originalMessage !==
                      displayMessage && (
                      <div className="message-original">
                        <small>
                          Original:
                        </small>

                        <p>
                          {
                            originalMessage
                          }
                        </p>
                      </div>
                    )}

                  {/* TRANSLATED MESSAGE
                      CACHE */}

                  {mine &&
                    translatedMessage &&
                    translatedMessage !==
                      originalMessage && (
                      <div className="message-translation-preview">
                        <small>
                          Translation
                        </small>

                        <p>
                          {
                            translatedMessage
                          }
                        </p>
                      </div>
                    )}

                  {/* META */}

                  <div className="message-meta">
                    {formatTime(
                      msg.createdAt
                    )}

                    {mine && (
                      <span className="message-status">
                        {msg.deliveryStatus ===
                        "read"
                          ? "Read"
                          : msg.deliveryStatus ===
                              "delivered"
                            ? "Delivered"
                            : "Sent"}
                      </span>
                    )}
                  </div>

                </div>
              );
            }
          )
        )}

        <div
          ref={
            messagesEndRef
          }
        />
      </div>

      {/* =================================================
          TYPING
      ================================================= */}

      {typingLabel && (
        <div className="typing-indicator">
          {typingLabel}
        </div>
      )}

      {/* =================================================
          INPUT
      ================================================= */}

      <form
        onSubmit={
          handleSendMessage
        }
        className="message-form group-message-form"
      >
        <span className="message-input-shell">
          <FileAttachmentPicker
            disabled={!socket}
            onSendAttachment={
              handleSendAttachment
            }
          />

          <input
            type="text"
            value={message}
            onChange={
              handleTyping
            }
            placeholder="Type a message..."
            disabled={
              !socket ||
              loading ||
              sending
            }
            autoComplete="off"
          />
        </span>

        <VoiceRecorder
          disabled={!socket}
          onSendVoice={
            handleSendVoice
          }
        />

        <button
          type="submit"
          disabled={
            !message.trim() ||
            !socket ||
            loading ||
            sending
          }
        >
          {sending
            ? "Sending..."
            : "Send"}
        </button>
      </form>
    </div>
  );
};

export default GroupChat;
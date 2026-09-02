const mongoose = require("mongoose");

const Message = require("../models/Message");
const Room = require("../models/Room");
const ReadState = require("../models/ReadState");
const User = require("../models/User");
const Friendship = require("../models/Friendship");

const {
  normalizeLanguageCode,
  translateText,
} = require(
  "../services/translationService"
);

// =========================================================
// USER FIELDS
// =========================================================

const USER_FIELDS =
  "_id username email language bio profilePicture";

// =========================================================
// CONSTANTS
// =========================================================

const MESSAGE_TYPES = [
  "text",
  "audio",
  "image",
  "video",
  "file",
];

const DEFAULT_LANGUAGE = "en";

// =========================================================
// CONNECTED USERS
// =========================================================
//
// userId -> Set(socketId)
//
// Supports:
// - multiple browser tabs
// - multiple devices
// - reconnects
// =========================================================

const connectedUsers = new Map();

// =========================================================
// HELPERS
// =========================================================

const getUserId = (socket) =>
  String(socket?.userId || "").trim();

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const normalizeRoomId = (roomId) =>
  roomId == null
    ? ""
    : String(roomId).trim();

const normalizeUserId = (userId) =>
  userId == null
    ? ""
    : String(userId).trim();

const areFriends = async (firstUserId, secondUserId) => {
  return Boolean(await Friendship.exists({
    status: "accepted",
    $or: [
      { requester: firstUserId, recipient: secondUserId },
      { requester: secondUserId, recipient: firstUserId },
    ],
  }));
};

// =========================================================
// CONNECTED USER HELPERS
// =========================================================

const getSocketIds = (userId) => {
  return (
    connectedUsers.get(
      normalizeUserId(userId)
    ) || new Set()
  );
};

const isUserOnline = (userId) => {
  return (
    getSocketIds(userId).size > 0
  );
};

const addConnectedSocket = (
  userId,
  socketId
) => {
  const normalizedUserId =
    normalizeUserId(userId);

  if (
    !connectedUsers.has(
      normalizedUserId
    )
  ) {
    connectedUsers.set(
      normalizedUserId,
      new Set()
    );
  }

  connectedUsers
    .get(normalizedUserId)
    .add(socketId);
};

const removeConnectedSocket = (
  userId,
  socketId
) => {
  const normalizedUserId =
    normalizeUserId(userId);

  const sockets =
    connectedUsers.get(
      normalizedUserId
    );

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    connectedUsers.delete(
      normalizedUserId
    );
  }
};

// =========================================================
// ONLINE USERS
// =========================================================

const emitOnlineUsers = (io) => {
  io.emit(
    "online_users",
    Array.from(
      connectedUsers.keys()
    )
  );
};

// =========================================================
// GET SAFE USER
// =========================================================

const getSafeUser = async (
  userId
) => {
  if (
    !isValidObjectId(userId)
  ) {
    return null;
  }

  return User.findById(userId)
    .select(USER_FIELDS)
    .lean();
};

// =========================================================
// SYNC SOCKET USER
// =========================================================

const syncSocketUser = async (
  socket,
  userId
) => {
  const user =
    await getSafeUser(userId);

  if (!user) {
    return null;
  }

  socket.username =
    user.username || "User";

  socket.userLanguage =
    user.language ||
    DEFAULT_LANGUAGE;

  socket.profilePicture =
    user.profilePicture || null;

  return user;
};

// =========================================================
// EMIT TO ALL USER SOCKETS
// =========================================================

const emitToUser = (
  io,
  userId,
  event,
  payload
) => {
  const socketIds =
    getSocketIds(userId);

  socketIds.forEach(
    (socketId) => {
      io.to(socketId).emit(
        event,
        payload
      );
    }
  );
};

// =========================================================
// PROFILE UPDATED
// =========================================================

const emitProfileUpdated = async (
  io,
  userId
) => {
  try {
    const user =
      await getSafeUser(userId);

    if (!user) {
      return;
    }

    io.emit(
      "profile_updated",
      {
        user,
      }
    );
  } catch (error) {
    console.error(
      "[SOCKET] Profile update error:",
      error.message
    );
  }
};

// =========================================================
// SOCKET ERROR
// =========================================================

const emitError = (
  socket,
  event,
  message
) => {
  socket.emit(
    event,
    {
      error:
        message ||
        "Something went wrong.",
    }
  );
};

// =========================================================
// BUILD MESSAGE PAYLOAD
// =========================================================

const buildMessagePayload = (
  message,
  {
    displayMessage,
    deliveryStatus,
  }
) => {
  return {
    _id: String(
      message._id
    ),

    id: String(
      message._id
    ),

    sender:
      message.sender || null,

    receiver:
      message.receiver || null,

    roomId:
      message.roomId
        ? String(message.roomId)
        : null,

    message:
      displayMessage,

    attachmentUrl:
      message.attachmentUrl ||
      null,

    attachmentName:
      message.attachmentName ||
      null,

    attachmentMimeType:
      message.attachmentMimeType ||
      null,

    // Keep original message for
    // compatibility with existing frontend.
    originalMessage:
      message.message,

    originalLanguage:
      message.originalLanguage ||
      DEFAULT_LANGUAGE,

    translatedMessage:
      message.translatedMessage ||
      null,

    translatedLanguage:
      message.translatedLanguage ||
      null,

    messageType:
      message.messageType ||
      "text",

    deliveryStatus,

    readAt:
      message.readAt || null,

    createdAt:
      message.createdAt,

    updatedAt:
      message.updatedAt,
  };
};

// =========================================================
// CHECK ROOM MEMBERSHIP
// =========================================================

const getMemberRoom = async (
  roomId,
  userId
) => {
  if (
    !isValidObjectId(roomId) ||
    !isValidObjectId(userId)
  ) {
    return null;
  }

  return Room.findOne({
    _id: roomId,
    members: userId,
  }).lean();
};

// =========================================================
// GET ROOM SOCKETS
// =========================================================

const getRoomSockets = async (
  io,
  roomId
) => {
  return io
    .in(String(roomId))
    .fetchSockets();
};

// =========================================================
// INITIALIZE CHAT SOCKET
// =========================================================

const initializeChatSocket = (
  io
) => {
  io.on(
    "connection",
    (socket) => {
      const userId =
        getUserId(socket);

      // =====================================================
      // VALIDATE CONNECTION
      // =====================================================

      if (
        !userId ||
        !isValidObjectId(userId)
      ) {
        console.error(
          "[SOCKET] Invalid or missing user ID."
        );

        socket.disconnect(true);

        return;
      }

      console.log(
        `[SOCKET] Connected user=${userId} socket=${socket.id}`
      );

      // =====================================================
      // REGISTER SOCKET
      // =====================================================

      addConnectedSocket(
        userId,
        socket.id
      );

      emitOnlineUsers(io);

      // =====================================================
      // PROFILE SYNC
      // =====================================================

      syncSocketUser(
        socket,
        userId
      )
        .then((user) => {
          if (!user) {
            return;
          }

          socket.emit(
            "profile_updated",
            {
              user,
            }
          );
        })
        .catch((error) => {
          console.error(
            "[SOCKET] Profile sync error:",
            error.message
          );
        });

      // =====================================================
      // REFRESH PROFILE
      // =====================================================

      socket.on(
        "refresh_profile",
        async () => {
          try {
            const user =
              await syncSocketUser(
                socket,
                userId
              );

            if (!user) {
              return emitError(
                socket,
                "message_error",
                "User not found."
              );
            }

            socket.emit(
              "profile_updated",
              {
                user,
              }
            );
          } catch (error) {
            console.error(
              "[SOCKET] Refresh profile error:",
              error.message
            );
          }
        }
      );

      // =====================================================
      // SET LANGUAGE
      // =====================================================
      //
      // Language is saved on the User and used for private
      // message translation.
      //
      // =====================================================

      socket.on(
        "set_language",
        async (language) => {
          try {
            if (
              typeof language !==
                "string" ||
              !language.trim()
            ) {
              return emitError(
                socket,
                "message_error",
                "Language is required."
              );
            }

            const updatedUser =
              await User.findByIdAndUpdate(
                userId,
                {
                  $set: {
                    language:
                      language.trim(),
                  },
                },
                {
                  new: true,
                  runValidators: true,
                }
              )
                .select(USER_FIELDS)
                .lean();

            if (!updatedUser) {
              return emitError(
                socket,
                "message_error",
                "User not found."
              );
            }

            socket.userLanguage =
              updatedUser.language ||
              DEFAULT_LANGUAGE;

            socket.emit(
              "language_set",
              {
                language:
                  updatedUser.language,
              }
            );

            await emitProfileUpdated(
              io,
              userId
            );
          } catch (error) {
            console.error(
              "[SOCKET] Set language error:",
              error.message
            );

            emitError(
              socket,
              "message_error",
              error.message ||
                "Failed to update language."
            );
          }
        }
      );

      // =====================================================
      // WEBRTC CALL SIGNALING
      // =====================================================

      socket.on(
        "call_offer",
        (data = {}) => {
          const targetUserId =
            normalizeUserId(data.to);

          if (!isValidObjectId(targetUserId)) {
            return emitError(
              socket,
              "call_error",
              "Invalid call recipient."
            );
          }

          if (getSocketIds(targetUserId).size === 0) {
            return emitError(
              socket,
              "call_error",
              "That user is currently offline."
            );
          }

          emitToUser(
            io,
            targetUserId,
            "call_offer",
            {
              from: userId,
              username: socket.username || "User",
              offer: data.offer,
              callType: data.callType === "audio" ? "audio" : "video",
            }
          );
        }
      );

      socket.on(
        "call_answer",
        (data = {}) => {
          const targetUserId =
            normalizeUserId(data.to);

          if (isValidObjectId(targetUserId)) {
            emitToUser(
              io,
              targetUserId,
              "call_answer",
              {
                from: userId,
                answer: data.answer,
              }
            );
          }
        }
      );

      socket.on(
        "call_ice_candidate",
        (data = {}) => {
          const targetUserId =
            normalizeUserId(data.to);

          if (isValidObjectId(targetUserId)) {
            emitToUser(
              io,
              targetUserId,
              "call_ice_candidate",
              {
                from: userId,
                candidate: data.candidate,
              }
            );
          }
        }
      );

      ["call_rejected", "call_ended"].forEach(
        (eventName) => {
          socket.on(eventName, (data = {}) => {
            const targetUserId =
              normalizeUserId(data.to);

            if (isValidObjectId(targetUserId)) {
              emitToUser(
                io,
                targetUserId,
                eventName,
                { from: userId }
              );
            }
          });
        }
      );

      // =====================================================
      // JOIN ROOM
      // =====================================================

      socket.on(
        "join_room",
        async (roomId) => {
          try {
            const normalizedRoomId =
              normalizeRoomId(
                roomId
              );

            if (
              !normalizedRoomId
            ) {
              return emitError(
                socket,
                "room_error",
                "Room ID is required."
              );
            }

            if (
              !isValidObjectId(
                normalizedRoomId
              )
            ) {
              return emitError(
                socket,
                "room_error",
                "Invalid room ID."
              );
            }

            const room =
              await getMemberRoom(
                normalizedRoomId,
                userId
              );

            if (!room) {
              return emitError(
                socket,
                "room_error",
                "Room not found or you are not a member of this room."
              );
            }

            const roomIdString =
              String(room._id);

            const alreadyJoined =
              socket.rooms.has(
                roomIdString
              );

            if (!alreadyJoined) {
              await socket.join(
                roomIdString
              );
            }

            const currentUser =
              await syncSocketUser(
                socket,
                userId
              );

            socket.emit(
              "room_joined",
              {
                roomId:
                  roomIdString,

                roomName:
                  room.name,

                roomCode:
                  room.code,

                user:
                  currentUser,
              }
            );

            if (!alreadyJoined) {
              socket
                .to(roomIdString)
                .emit(
                  "room_user_joined",
                  {
                    roomId:
                      roomIdString,

                    userId,

                    username:
                      currentUser?.username ||
                      "User",

                    profilePicture:
                      currentUser?.profilePicture ||
                      null,
                  }
                );
            }
          } catch (error) {
            console.error(
              "[SOCKET] Join room error:",
              error.message
            );

            emitError(
              socket,
              "room_error",
              "Failed to join room."
            );
          }
        }
      );

      // =====================================================
      // LEAVE SOCKET ROOM
      // =====================================================

      socket.on(
        "leave_room",
        async (roomId) => {
          try {
            const normalizedRoomId =
              normalizeRoomId(
                roomId
              );

            if (
              !isValidObjectId(
                normalizedRoomId
              )
            ) {
              return emitError(
                socket,
                "room_error",
                "Invalid room ID."
              );
            }

            const room =
              await getMemberRoom(
                normalizedRoomId,
                userId
              );

            if (!room) {
              return emitError(
                socket,
                "room_error",
                "You are not a member of this room."
              );
            }

            const roomIdString =
              String(room._id);

            if (
              !socket.rooms.has(
                roomIdString
              )
            ) {
              return emitError(
                socket,
                "room_error",
                "You are not currently in this room."
              );
            }

            await socket.leave(
              roomIdString
            );

            socket.emit(
              "room_left",
              {
                roomId:
                  roomIdString,
              }
            );

            socket
              .to(roomIdString)
              .emit(
                "user_left_room",
                {
                  roomId:
                    roomIdString,

                  userId,
                }
              );
          } catch (error) {
            console.error(
              "[SOCKET] Leave room error:",
              error.message
            );

            emitError(
              socket,
              "room_error",
              "Failed to leave room."
            );
          }
        }
      );

      // =====================================================
      // MARK PRIVATE MESSAGE READ
      // =====================================================

      socket.on(
        "mark_message_read",
        async (messageId) => {
          try {
            if (
              !isValidObjectId(
                messageId
              )
            ) {
              return;
            }

            const message =
              await Message.findOne({
                _id: messageId,

                receiver: userId,

                roomId: null,
              });

            if (!message) {
              return;
            }

            const readAt =
              message.readAt ||
              new Date();

            if (
              message.deliveryStatus !==
                "read" ||
              !message.readAt
            ) {
              message.deliveryStatus =
                "read";

              message.readAt =
                readAt;

              await message.save();
            }

            await ReadState.findOneAndUpdate(
              {
                user: userId,

                scopeType:
                  "private",

                target:
                  String(
                    message.sender
                  ),
              },
              {
                $set: {
                  lastReadAt:
                    readAt,
                },
              },
              {
                upsert: true,

                new: true,

                setDefaultsOnInsert:
                  true,
              }
            );

            const payload = {
              messageId:
                String(
                  message._id
                ),

              readerId:
                userId,

              deliveryStatus:
                "read",

              readAt,
            };

            emitToUser(
              io,
              message.sender,
              "message_read",
              payload
            );

            socket.emit(
              "message_read_confirmed",
              payload
            );
          } catch (error) {
            console.error(
              "[SOCKET] Message read error:",
              error.message
            );
          }
        }
      );

      // =====================================================
      // MARK PRIVATE CONVERSATION READ
      // =====================================================

      socket.on(
        "mark_conversation_read",
        async (otherUserId) => {
          try {
            const otherId =
              normalizeUserId(
                otherUserId
              );

            if (
              !isValidObjectId(
                otherId
              ) ||
              otherId === userId
            ) {
              return;
            }

            const readAt =
              new Date();

            const unread =
              await Message.find({
                sender: otherId,

                receiver: userId,

                roomId: null,

                deliveryStatus: {
                  $ne: "read",
                },
              })
                .select("_id")
                .lean();

            const messageIds =
              unread.map(
                (item) =>
                  item._id
              );

            if (
              messageIds.length > 0
            ) {
              await Message.updateMany(
                {
                  _id: {
                    $in:
                      messageIds,
                  },

                  sender:
                    otherId,

                  receiver:
                    userId,

                  roomId: null,
                },
                {
                  $set: {
                    deliveryStatus:
                      "read",

                    readAt,
                  },
                }
              );

              emitToUser(
                io,
                otherId,
                "messages_read",
                {
                  messageIds:
                    messageIds.map(
                      String
                    ),

                  readerId:
                    userId,

                  deliveryStatus:
                    "read",

                  readAt,
                }
              );
            }

            await ReadState.findOneAndUpdate(
              {
                user: userId,

                scopeType:
                  "private",

                target:
                  otherId,
              },
              {
                $set: {
                  lastReadAt:
                    readAt,
                },
              },
              {
                upsert: true,

                new: true,

                setDefaultsOnInsert:
                  true,
              }
            );

            socket.emit(
              "messages_read",
              {
                messageIds:
                  messageIds.map(
                    String
                  ),

                readerId:
                  userId,

                deliveryStatus:
                  "read",

                readAt,
              }
            );
          } catch (error) {
            console.error(
              "[SOCKET] Conversation read error:",
              error.message
            );
          }
        }
      );

      // =====================================================
      // MARK ROOM MESSAGE READ
      // =====================================================

      socket.on(
        "mark_room_message_read",
        async ({
          messageId,
          roomId,
        } = {}) => {
          try {
            const normalizedRoomId =
              normalizeRoomId(
                roomId
              );

            if (
              !isValidObjectId(
                messageId
              ) ||
              !isValidObjectId(
                normalizedRoomId
              )
            ) {
              return;
            }

            const room =
              await getMemberRoom(
                normalizedRoomId,
                userId
              );

            if (!room) {
              return;
            }

            const message =
              await Message.findOne({
                _id: messageId,

                roomId:
                  normalizedRoomId,

                sender: {
                  $ne: userId,
                },
              });

            if (!message) {
              return;
            }

            const readAt =
              new Date();

            await ReadState.findOneAndUpdate(
              {
                user: userId,

                scopeType:
                  "room",

                target:
                  normalizedRoomId,
              },
              {
                $set: {
                  lastReadAt:
                    readAt,
                },
              },
              {
                upsert: true,

                new: true,

                setDefaultsOnInsert:
                  true,
              }
            );

            socket.emit(
              "room_message_read_confirmed",
              {
                messageId:
                  String(
                    message._id
                  ),

                roomId:
                  normalizedRoomId,

                readerId:
                  userId,

                readAt,
              }
            );
          } catch (error) {
            console.error(
              "[SOCKET] Room message read error:",
              error.message
            );
          }
        }
      );

      // =====================================================
      // MARK ENTIRE ROOM READ
      // =====================================================

      socket.on(
        "mark_room_read",
        async (roomId) => {
          try {
            const normalizedRoomId =
              normalizeRoomId(
                roomId
              );

            if (
              !isValidObjectId(
                normalizedRoomId
              )
            ) {
              return;
            }

            const room =
              await getMemberRoom(
                normalizedRoomId,
                userId
              );

            if (!room) {
              return;
            }

            const readAt =
              new Date();

            await ReadState.findOneAndUpdate(
              {
                user: userId,

                scopeType:
                  "room",

                target:
                  normalizedRoomId,
              },
              {
                $set: {
                  lastReadAt:
                    readAt,
                },
              },
              {
                upsert: true,

                new: true,

                setDefaultsOnInsert:
                  true,
              }
            );

            socket.emit(
              "room_read_confirmed",
              {
                roomId:
                  normalizedRoomId,

                readerId:
                  userId,

                readAt,
              }
            );
          } catch (error) {
            console.error(
              "[SOCKET] Mark room read error:",
              error.message
            );
          }
        }
      );

      // =====================================================
      // SEND MESSAGE
      // =====================================================

      socket.on(
        "send_message",
        async (data = {}) => {
          try {
            const {
              receiver,
              roomId,
              message,
              messageType,
              attachmentUrl,
              attachmentName,
              attachmentMimeType,
            } = data;

            // =================================================
            // VALIDATE MESSAGE
            // =================================================

            if (
              typeof message !==
                "string" ||
              !message.trim()
            ) {
              return emitError(
                socket,
                "message_error",
                "Message cannot be empty."
              );
            }

            const hasReceiver =
              Boolean(receiver);

            const hasRoom =
              Boolean(roomId);

            if (
              hasReceiver &&
              hasRoom
            ) {
              return emitError(
                socket,
                "message_error",
                "Message cannot have both receiver and roomId."
              );
            }

            if (
              !hasReceiver &&
              !hasRoom
            ) {
              return emitError(
                socket,
                "message_error",
                "A receiver or roomId is required."
              );
            }

            const originalMessage =
              message.trim();

            const finalMessageType =
              MESSAGE_TYPES.includes(
                messageType
              )
                ? messageType
                : "text";

            if (
              ["audio", "image", "video", "file"].includes(
                finalMessageType
              ) &&
              (typeof attachmentUrl !== "string" ||
                !attachmentUrl.trim())
            ) {
              return emitError(
                socket,
                "message_error",
                "Attachment URL is required."
              );
            }

            // =================================================
            // GET SENDER
            // =================================================

            const senderUser =
              await getSafeUser(
                userId
              );

            if (!senderUser) {
              return emitError(
                socket,
                "message_error",
                "Sender not found."
              );
            }

            const senderLanguage =
              normalizeLanguageCode(
                senderUser.language ||
                  DEFAULT_LANGUAGE
              );

            // =================================================
            // ROOM MESSAGE
            // =================================================

            if (hasRoom) {
              const normalizedRoomId =
                normalizeRoomId(
                  roomId
                );

              if (
                !isValidObjectId(
                  normalizedRoomId
                )
              ) {
                return emitError(
                  socket,
                  "message_error",
                  "Invalid room ID."
                );
              }

              // -------------------------------------------------
              // CHECK MEMBERSHIP
              // -------------------------------------------------

              const room =
                await getMemberRoom(
                  normalizedRoomId,
                  userId
                );

              if (!room) {
                return emitError(
                  socket,
                  "message_error",
                  "Room not found or you are not a member of this room."
                );
              }

              const roomIdString =
                String(room._id);

              // -------------------------------------------------
              // CHECK SOCKET ROOM
              // -------------------------------------------------

              if (
                !socket.rooms.has(
                  roomIdString
                )
              ) {
                return emitError(
                  socket,
                  "message_error",
                  "You must join the room before sending messages."
                );
              }

              // -------------------------------------------------
              // CREATE ROOM MESSAGE
              // -------------------------------------------------

              const newMessage =
                await Message.create({
                  sender:
                    userId,

                  receiver:
                    null,

                  roomId:
                    roomIdString,

                  message:
                    originalMessage,

                  attachmentUrl:
                    finalMessageType !== "text"
                      ? attachmentUrl.trim()
                      : null,

                  attachmentName:
                    finalMessageType !== "text"
                      ? String(attachmentName || "Attachment").slice(0, 255)
                      : null,

                  attachmentMimeType:
                    finalMessageType !== "text"
                      ? String(attachmentMimeType || "application/octet-stream").slice(0, 100)
                      : null,

                  originalLanguage:
                    senderLanguage,

                  translatedMessage:
                    null,

                  translatedLanguage:
                    null,

                  messageType:
                    finalMessageType,

                  deliveryStatus:
                    "sent",
                });

              // -------------------------------------------------
              // POPULATE MESSAGE
              // -------------------------------------------------

              const populatedMessage =
                await Message.findById(
                  newMessage._id
                )
                  .populate(
                    "sender",
                    USER_FIELDS
                  )
                  .lean();

              if (
                !populatedMessage
              ) {
                return emitError(
                  socket,
                  "message_error",
                  "Failed to load created message."
                );
              }

              // -------------------------------------------------
              // GET ROOM SOCKETS
              // -------------------------------------------------

              const roomSockets =
                await getRoomSockets(
                  io,
                  roomIdString
                );

              const recipientSockets =
                roomSockets.filter(
                  (roomSocket) =>
                    String(
                      roomSocket.userId
                    ) !== userId
                );

              const hasRecipients =
                recipientSockets.length >
                0;

              const deliveryStatus =
                hasRecipients
                  ? "delivered"
                  : "sent";

              // -------------------------------------------------
              // UPDATE DELIVERY STATUS
              // -------------------------------------------------

              if (hasRecipients) {
                await Message.findByIdAndUpdate(
                  newMessage._id,
                  {
                    $set: {
                      deliveryStatus:
                        "delivered",
                    },
                  }
                );

                populatedMessage.deliveryStatus =
                  "delivered";
              }

              // -------------------------------------------------
              // DELIVER TO ALL ROOM MEMBERS
              // -------------------------------------------------

              await Promise.all(
                roomSockets.map(
                  async (memberSocket) => {
                  const memberUserId =
                    String(
                      memberSocket.userId
                    );

                  const isSender =
                    memberUserId ===
                    userId;

                    let displayMessage =
                      originalMessage;

                    if (!isSender) {
                      const memberLanguage =
                        normalizeLanguageCode(
                          memberSocket.userLanguage ||
                            DEFAULT_LANGUAGE
                        );

                      displayMessage =
                        await translateText(
                          originalMessage,
                          senderLanguage,
                          memberLanguage
                        );
                    }

                    const payload =
                      buildMessagePayload(
                        populatedMessage,
                        {
                          displayMessage,
                          deliveryStatus:
                            isSender
                              ? deliveryStatus
                              : "delivered",
                        }
                      );

                    payload.translatedMessage =
                      isSender
                        ? null
                        : displayMessage;

                    payload.translatedLanguage =
                      isSender
                        ? null
                        : normalizeLanguageCode(
                            memberSocket.userLanguage ||
                              DEFAULT_LANGUAGE
                          );

                    memberSocket.emit(
                      "receive_message",
                      payload
                    );
                  }
                )
              );

              return;
            }

            // =================================================
            // PRIVATE MESSAGE
            // =================================================

            const receiverId =
              normalizeUserId(
                receiver
              );

            if (
              !isValidObjectId(
                receiverId
              )
            ) {
              return emitError(
                socket,
                "message_error",
                "Invalid receiver ID."
              );
            }

            if (
              receiverId === userId
            ) {
              return emitError(
                socket,
                "message_error",
                "You cannot send a message to yourself."
              );
            }

            if (!await areFriends(userId, receiverId)) {
              return emitError(
                socket,
                "message_error",
                "You can only chat with accepted friends."
              );
            }

            // -------------------------------------------------
            // FIND RECEIVER
            // -------------------------------------------------

            const receiverUser =
              await getSafeUser(
                receiverId
              );

            if (!receiverUser) {
              return emitError(
                socket,
                "message_error",
                "Receiver not found."
              );
            }

            const receiverOnline =
              isUserOnline(
                receiverId
              );

            const receiverLanguage =
              normalizeLanguageCode(
                receiverUser.language ||
                  DEFAULT_LANGUAGE
              );

            const translatedMessage =
              await translateText(
                originalMessage,
                senderLanguage,
                receiverLanguage
              );

            // -------------------------------------------------
            // CREATE PRIVATE MESSAGE
            // -------------------------------------------------

            const newMessage =
              await Message.create({
                sender:
                  userId,

                receiver:
                  receiverId,

                roomId:
                  null,

                message:
                  originalMessage,

                attachmentUrl:
                  finalMessageType !== "text"
                    ? attachmentUrl.trim()
                    : null,

                attachmentName:
                  finalMessageType !== "text"
                    ? String(attachmentName || "Attachment").slice(0, 255)
                    : null,

                attachmentMimeType:
                  finalMessageType !== "text"
                    ? String(attachmentMimeType || "application/octet-stream").slice(0, 100)
                    : null,

                originalLanguage:
                  senderLanguage,

                translatedMessage:
                  translatedMessage,

                translatedLanguage:
                  receiverLanguage,

                messageType:
                  finalMessageType,

                deliveryStatus:
                  receiverOnline
                    ? "delivered"
                    : "sent",
              });

            // -------------------------------------------------
            // POPULATE
            // -------------------------------------------------

            const populatedMessage =
              await Message.findById(
                newMessage._id
              )
                .populate(
                  "sender",
                  USER_FIELDS
                )
                .populate(
                  "receiver",
                  USER_FIELDS
                )
                .lean();

            if (
              !populatedMessage
            ) {
              return emitError(
                socket,
                "message_error",
                "Failed to load created message."
              );
            }

            const deliveryStatus =
              receiverOnline
                ? "delivered"
                : "sent";

            // -------------------------------------------------
            // SEND TO RECEIVER
            // -------------------------------------------------

            if (receiverOnline) {
              emitToUser(
                io,
                receiverId,
                "receive_message",
                buildMessagePayload(
                  populatedMessage,
                  {
                    displayMessage:
                      populatedMessage.translatedMessage ||
                      originalMessage,

                    deliveryStatus:
                      "delivered",
                  }
                )
              );
            }

            // -------------------------------------------------
            // SEND BACK TO SENDER
            // -------------------------------------------------

            socket.emit(
              "receive_message",
              buildMessagePayload(
                populatedMessage,
                {
                  displayMessage:
                    originalMessage,

                  deliveryStatus,
                }
              )
            );
          } catch (error) {
            console.error(
              "[SOCKET] Send message error:",
              error
            );

            emitError(
              socket,
              "message_error",
              "Failed to send message."
            );
          }
        }
      );

      // =====================================================
      // TYPING
      // =====================================================

      socket.on(
        "typing",
        (data = {}) => {
          try {
            const {
              receiver,
              roomId,
            } = data;

            const username =
              socket.username ||
              "User";

            // -------------------------------------------------
            // ROOM TYPING
            // -------------------------------------------------

            if (roomId) {
              const normalizedRoomId =
                normalizeRoomId(
                  roomId
                );

              if (
                !isValidObjectId(
                  normalizedRoomId
                )
              ) {
                return;
              }

              if (
                !socket.rooms.has(
                  normalizedRoomId
                )
              ) {
                return;
              }

              socket
                .to(normalizedRoomId)
                .emit(
                  "user_typing",
                  {
                    userId,

                    username,

                    roomId:
                      normalizedRoomId,
                  }
                );

              return;
            }

            // -------------------------------------------------
            // PRIVATE TYPING
            // -------------------------------------------------

            if (
              receiver &&
              isValidObjectId(
                receiver
              )
            ) {
              emitToUser(
                io,
                receiver,
                "user_typing",
                {
                  userId,

                  username,
                }
              );
            }
          } catch (error) {
            console.error(
              "[SOCKET] Typing error:",
              error.message
            );
          }
        }
      );

      // =====================================================
      // STOP TYPING
      // =====================================================

      socket.on(
        "stop_typing",
        (data = {}) => {
          try {
            const {
              receiver,
              roomId,
            } = data;

            // -------------------------------------------------
            // ROOM
            // -------------------------------------------------

            if (roomId) {
              const normalizedRoomId =
                normalizeRoomId(
                  roomId
                );

              if (
                !isValidObjectId(
                  normalizedRoomId
                )
              ) {
                return;
              }

              if (
                !socket.rooms.has(
                  normalizedRoomId
                )
              ) {
                return;
              }

              socket
                .to(normalizedRoomId)
                .emit(
                  "user_stop_typing",
                  {
                    userId,

                    roomId:
                      normalizedRoomId,
                  }
                );

              return;
            }

            // -------------------------------------------------
            // PRIVATE
            // -------------------------------------------------

            if (
              receiver &&
              isValidObjectId(
                receiver
              )
            ) {
              emitToUser(
                io,
                receiver,
                "user_stop_typing",
                {
                  userId,
                }
              );
            }
          } catch (error) {
            console.error(
              "[SOCKET] Stop typing error:",
              error.message
            );
          }
        }
      );

      // =====================================================
      // DISCONNECT
      // =====================================================

      socket.on(
        "disconnect",
        (reason) => {
          console.log(
            `[SOCKET] Disconnected user=${userId} socket=${socket.id} reason=${reason}`
          );

          removeConnectedSocket(
            userId,
            socket.id
          );

          emitOnlineUsers(io);
        }
      );
    }
  );
};

// =========================================================
// EXPORT
// =========================================================

module.exports =
  initializeChatSocket;
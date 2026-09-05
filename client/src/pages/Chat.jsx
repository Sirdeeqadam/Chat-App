import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import api from "../services/api";
import socket from "../services/socket";

import {
  useAuth,
} from "../context/AuthContext";

import {
  useLanguage,
} from "../context/LanguageContext";

import LanguageSelector from "../components/LanguageSelector";
import AddFriendsPicker from "../components/AddFriendsPicker";
import VoiceRecorder from "../components/VoiceRecorder";
import VoiceMessagePlayer from "../components/VoiceMessagePlayer";
import FileAttachmentPicker from "../components/FileAttachmentPicker";

import {
  getFriends,
  getRecentPrivateChats,
  sendFriendRequest,
  updateFriendRequest,
} from "../services/friendService";
import { searchApp } from "../services/searchService";

import {
  discoverRooms,
  createRoom,
  joinRoom,
  joinRoomByCode,
  leaveRoom,
  getRoomMessages,
  removeRoomMember,
  deleteRoom,
} from "../services/roomService";

import {
  getUnreadCounts,
  markPrivateRead,
  markRoomRead,
} from "../services/readStateService";

// =====================================================
// API SERVER URL
// =====================================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

// =====================================================
// HELPERS
// =====================================================

const getApiServerUrl = () => {
  return String(API_URL)
    .trim()
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");
};

const getImageUrl = (picture) => {
  if (!picture) {
    return null;
  }

  const value = String(picture).trim();

  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${getApiServerUrl()}${value}`;
  }

  return `${getApiServerUrl()}/${value}`;
};

const getInitial = (value) => {
  return String(value || "U")
    .trim()
    .charAt(0)
    .toUpperCase();
};

const getUserId = (value) => {
  return String(
    value?._id ||
      value?.id ||
      value ||
      ""
  );
};

// =====================================================
// CHAT
// =====================================================

const Chat = () => {
  const {
    user,
    updateUser,
    logout,
  } = useAuth();

  const { t } = useLanguage();

  const navigate = useNavigate();

  const currentUserId = String(
    user?._id ||
      user?.id ||
      ""
  );

  // ===================================================
  // PROFILE
  // ===================================================

  const profileImage = getImageUrl(
    user?.profilePicture
  );

  const profileInitial = getInitial(
    user?.username ||
      user?.email ||
      "U"
  );

  // ===================================================
  // PRIVATE CHAT
  // ===================================================

  const [users, setUsers] =
    useState([]);

  const [friendSearchResults, setFriendSearchResults] =
    useState([]);

  const [pendingFriendRequests, setPendingFriendRequests] =
    useState([]);

  const [selectedUser, setSelectedUser] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [lastMessageTime, setLastMessageTime] =
    useState({});

  // ===================================================
  // GENERAL
  // ===================================================

  const [onlineUsers, setOnlineUsers] =
    useState([]);

  const [socketError, setSocketError] =
    useState("");

  const [activeView, setActiveView] =
    useState("chats");

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [userSearch, setUserSearch] =
    useState("");

  const [globalSearchResults, setGlobalSearchResults] =
    useState({ friends: [], groups: [], messages: [], links: [] });

  const [globalSearchLoading, setGlobalSearchLoading] =
    useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  // ===================================================
  // ROOMS
  // ===================================================

  const [rooms, setRooms] =
    useState([]);

  const [selectedRoom, setSelectedRoom] =
    useState(null);

  const [roomMessages, setRoomMessages] =
    useState([]);

  const [roomMessage, setRoomMessage] =
    useState("");

  const [roomName, setRoomName] =
    useState("");

  const [roomDescription, setRoomDescription] =
    useState("");

  const [roomCode, setRoomCode] =
    useState("");

  const [showCreateRoom, setShowCreateRoom] =
    useState(false);

  const [showJoinRoom, setShowJoinRoom] =
    useState(false);

  const [showRoomMembers, setShowRoomMembers] =
    useState(false);

  const [roomLoading, setRoomLoading] =
    useState(false);

  const [roomActionLoading, setRoomActionLoading] =
    useState(false);

  // ===================================================
  // UNREAD
  // ===================================================

  const [privateUnreadCounts, setPrivateUnreadCounts] =
    useState({});

  const [roomUnreadCounts, setRoomUnreadCounts] =
    useState({});

  // ===================================================
  // TYPING
  // ===================================================

  const [privateTypingUser, setPrivateTypingUser] =
    useState("");

  const [roomTypingUsers, setRoomTypingUsers] =
    useState([]);

  const typingTimeoutRef =
    useRef(null);

  // ===================================================
  // SCROLL
  // ===================================================

  const privateMessagesEndRef =
    useRef(null);

  const roomMessagesEndRef =
    useRef(null);

  // ===================================================
  // LIVE REFS
  // ===================================================

  const selectedUserRef =
    useRef(selectedUser);

  const selectedRoomRef =
    useRef(selectedRoom);

  const currentUserIdRef =
    useRef(currentUserId);

  const activeViewRef =
    useRef(activeView);

  const markedReadMessageIdsRef =
    useRef(new Set());

  // ===================================================
  // CALLS
  // ===================================================

  const [callStatus, setCallStatus] =
    useState("idle");

  const [callType, setCallType] =
    useState("video");

  const [incomingCall, setIncomingCall] =
    useState(null);

  const [callError, setCallError] =
    useState("");

  const [isMuted, setIsMuted] =
    useState(false);

  const [cameraEnabled, setCameraEnabled] =
    useState(true);

  const [callHistory, setCallHistory] =
    useState([]);

  const peerConnectionRef =
    useRef(null);

  const localStreamRef =
    useRef(null);

  const callPeerIdRef =
    useRef("");

  const pendingIceCandidatesRef =
    useRef([]);

  const localVideoRef =
    useRef(null);

  const remoteVideoRef =
    useRef(null);

  const remoteAudioRef =
    useRef(null);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    try {
      const savedCalls = JSON.parse(
        localStorage.getItem(
          `chat-call-history-${currentUserId}`
        ) || "[]"
      );

      setCallHistory(
        Array.isArray(savedCalls)
          ? savedCalls
          : []
      );
    } catch {
      setCallHistory([]);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(
        `chat-call-history-${currentUserId}`,
        JSON.stringify(callHistory)
      );
    }
  }, [callHistory, currentUserId]);

  const remoteStreamRef =
    useRef(null);

  useEffect(() => {
    selectedUserRef.current =
      selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    selectedRoomRef.current =
      selectedRoom;
  }, [selectedRoom]);

  useEffect(() => {
    currentUserIdRef.current =
      currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    activeViewRef.current =
      activeView;
  }, [activeView]);

  // ===================================================
  // CLEAR TYPING
  // ===================================================

  const clearTypingTimer =
    useCallback(() => {
      if (typingTimeoutRef.current) {
        clearTimeout(
          typingTimeoutRef.current
        );

        typingTimeoutRef.current = null;
      }
    }, []);

  const recordCall =
    useCallback((entry) => {
      setCallHistory((previousCalls) => [
        entry,
        ...previousCalls,
      ].slice(0, 30));
    }, []);

  const stopCall =
    useCallback((notifyPeer = true) => {
      const peerId = callPeerIdRef.current;

      if (notifyPeer && peerId && socket.connected) {
        socket.emit("call_ended", { to: peerId });
      }

      localStreamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );

      if (peerConnectionRef.current) {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.close();
      }

      peerConnectionRef.current = null;
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      callPeerIdRef.current = "";
      pendingIceCandidatesRef.current = [];

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      setCallStatus("idle");
      setIncomingCall(null);
      setIsMuted(false);
      setCameraEnabled(true);
    }, []);

  const createPeerConnection =
    useCallback((peerId, mediaType) => {
      const connection =
        new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
          ],
        });

      callPeerIdRef.current = peerId;

      connection.onicecandidate = (event) => {
        if (event.candidate && socket.connected) {
          socket.emit("call_ice_candidate", {
            to: peerId,
            candidate: event.candidate,
          });
        }
      };

      connection.ontrack = (event) => {
        const stream = event.streams[0];
        remoteStreamRef.current = stream;

        if (mediaType === "video" && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }

        if (mediaType === "audio" && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
      };

      connection.onconnectionstatechange = () => {
        if (
          ["failed", "disconnected", "closed"].includes(
            connection.connectionState
          )
        ) {
          stopCall(false);
        }
      };

      peerConnectionRef.current = connection;
      return connection;
    }, [stopCall]);

  const startCall =
    useCallback(async (requestedType) => {
      const target = selectedUserRef.current;

      if (!target?._id || callStatus !== "idle") {
        return;
      }

      try {
        setCallError("");
        setCallType(requestedType);

        recordCall({
          id: `${target._id}-${Date.now()}`,
          userId: String(target._id),
          username: target.username || "User",
          profilePicture: target.profilePicture || null,
          type: requestedType,
          direction: "outgoing",
          timestamp: Date.now(),
        });

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: requestedType === "video",
          });

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const connection = createPeerConnection(
          String(target._id),
          requestedType
        );

        stream.getTracks().forEach((track) =>
          connection.addTrack(track, stream)
        );

        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        socket.emit("call_offer", {
          to: String(target._id),
          offer,
          callType: requestedType,
        });

        setCallStatus("calling");
      } catch (error) {
        stopCall(false);
        setCallError(
          error.name === "NotAllowedError"
            ? "Microphone or camera permission was denied."
            : "Unable to start the call."
        );
      }
    }, [callStatus, createPeerConnection, recordCall, stopCall]);

  const acceptCall =
    useCallback(async () => {
      if (!incomingCall) {
        return;
      }

      const { from, offer, callType: requestedType } = incomingCall;

      try {
        setCallError("");
        setCallType(requestedType);

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: requestedType === "video",
          });

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const connection = createPeerConnection(
          String(from),
          requestedType
        );

        stream.getTracks().forEach((track) =>
          connection.addTrack(track, stream)
        );

        await connection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        for (const candidate of pendingIceCandidatesRef.current) {
          await connection.addIceCandidate(candidate);
        }

        pendingIceCandidatesRef.current = [];

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        socket.emit("call_answer", {
          to: String(from),
          answer,
        });

        setIncomingCall(null);
        setCallStatus("connected");
      } catch (error) {
        stopCall(false);
        setCallError("Unable to accept the call.");
      }
    }, [createPeerConnection, incomingCall, stopCall]);

  const rejectCall =
    useCallback(() => {
      if (incomingCall?.from && socket.connected) {
        socket.emit("call_rejected", {
          to: incomingCall.from,
        });
      }

      setIncomingCall(null);
    }, [incomingCall]);

  const toggleMute =
    () => {
      const track = localStreamRef.current?.getAudioTracks()[0];

      if (!track) {
        return;
      }

      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    };

  const toggleCamera =
    () => {
      const track = localStreamRef.current?.getVideoTracks()[0];

      if (!track) {
        return;
      }

      track.enabled = !track.enabled;
      setCameraEnabled(track.enabled);
    };

  useEffect(() => {
    const handleCallOffer = (data) => {
      if (callStatus !== "idle" || incomingCall) {
        socket.emit("call_rejected", { to: data?.from });
        return;
      }

      recordCall({
        id: `${data.from}-${Date.now()}`,
        userId: String(data.from),
        username: data.username || "User",
        type: data.callType === "audio" ? "audio" : "video",
        direction: "incoming",
        timestamp: Date.now(),
      });

      setIncomingCall(data);
    };

    const handleCallAnswer = async (data) => {
      if (!peerConnectionRef.current || !data?.answer) {
        return;
      }

      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );

      for (const candidate of pendingIceCandidatesRef.current) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      }

      pendingIceCandidatesRef.current = [];
      setCallStatus("connected");
    };

    const handleIceCandidate = async (data) => {
      if (!data?.candidate) {
        return;
      }

      const candidate =
        new RTCIceCandidate(data.candidate);

      if (peerConnectionRef.current?.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } else {
        pendingIceCandidatesRef.current.push(candidate);
      }
    };

    const handleCallEnded = () => stopCall(false);
    const handleCallRejected = () => {
      stopCall(false);
      setCallError("The call was declined.");
    };
    const handleCallError = (error) => {
      stopCall(false);
      setCallError(error?.error || "Call unavailable.");
    };

    socket.on("call_offer", handleCallOffer);
    socket.on("call_answer", handleCallAnswer);
    socket.on("call_ice_candidate", handleIceCandidate);
    socket.on("call_ended", handleCallEnded);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_error", handleCallError);

    return () => {
      socket.off("call_offer", handleCallOffer);
      socket.off("call_answer", handleCallAnswer);
      socket.off("call_ice_candidate", handleIceCandidate);
      socket.off("call_ended", handleCallEnded);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_error", handleCallError);
    };
  }, [callStatus, incomingCall, recordCall, stopCall]);

  useEffect(() => {
    if (callStatus === "idle") {
      return;
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }
  }, [callStatus, callType]);

  useEffect(() => () => stopCall(false), [stopCall]);

  // ===================================================
  // UNREAD COUNTS
  // ===================================================

  const refreshUnreadCounts =
    useCallback(async () => {
      try {
        const data =
          await getUnreadCounts();

        setPrivateUnreadCounts(
          data?.private &&
            typeof data.private ===
              "object"
            ? data.private
            : {}
        );

        setRoomUnreadCounts(
          data?.rooms &&
            typeof data.rooms ===
              "object"
            ? data.rooms
            : {}
        );
      } catch (error) {
        console.error(
          "Failed to load unread counts:",
          error
        );
      }
    }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    refreshUnreadCounts();
  }, [
    currentUserId,
    refreshUnreadCounts,
  ]);

  // ===================================================
  // MARK MESSAGE READ
  // ===================================================

  const markMessageAsRead =
    useCallback((messageId) => {
      if (!messageId) {
        return;
      }

      const id = String(messageId);

      if (
        markedReadMessageIdsRef.current.has(id)
      ) {
        return;
      }

      markedReadMessageIdsRef.current.add(id);

      if (socket.connected) {
        socket.emit(
          "mark_message_read",
          id
        );
      }
    }, []);

  // ===================================================
  // LOAD USERS
  // ===================================================

  const loadFriends =
    useCallback(async () => {
      if (!currentUserId) {
        return;
      }

      try {
        const relationships = await getFriends();
        setUsers(
          relationships
            .filter((item) => item.status === "accepted")
            .map((item) => item.user)
            .filter(Boolean)
        );
        setPendingFriendRequests(
          relationships.filter(
            (item) => item.status === "pending" && item.direction === "incoming"
          )
        );
      } catch (error) {
        console.error("Failed to load friends:", error);

        setSocketError(
          error.response?.data
            ?.message ||
            "Failed to load friends."
        );
      }
    }, [currentUserId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const loadRecentChatTimes = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    try {
      const recentChatTimes = await getRecentPrivateChats();
      setLastMessageTime(recentChatTimes);
    } catch (error) {
      console.error("Failed to load recent chat times:", error);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadRecentChatTimes();
  }, [loadRecentChatTimes]);

  useEffect(() => {
    const refreshTimer = setInterval(loadFriends, 30000);
    return () => clearInterval(refreshTimer);
  }, [loadFriends]);

  useEffect(() => {
    const query = userSearch.trim();
    if (query.length < 2) {
      setGlobalSearchResults({ friends: [], groups: [], messages: [], links: [] });
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setGlobalSearchLoading(true);
      searchApp(query)
        .then((results) => {
          if (!cancelled) setGlobalSearchResults(results);
        })
        .catch((error) => {
          console.error("Failed to search the app:", error);
          if (!cancelled) setGlobalSearchResults({ friends: [], groups: [], messages: [], links: [] });
        })
        .finally(() => {
          if (!cancelled) setGlobalSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userSearch]);

  const handleFriendRequest = async (targetId) => {
    try {
      await sendFriendRequest(targetId);
      setFriendSearchResults((previous) => previous.map((item) =>
        getUserId(item) === String(targetId) ? { ...item, relationship: "outgoing" } : item
      ));
    } catch (error) {
      setSocketError(error.response?.data?.message || "Failed to send friend request.");
    }
  };

  const handleFriendRequestUpdate = async (requestId, action) => {
    try {
      await updateFriendRequest(requestId, action);
      await loadFriends();
    } catch (error) {
      setSocketError(error.response?.data?.message || "Failed to update friend request.");
    }
  };

  // ===================================================
  // PROFILE UPDATED IN CURRENT TAB
  // ===================================================

  const applyProfileUpdate =
    useCallback(
      (updatedUser) => {
        if (!updatedUser) {
          return;
        }

        const updatedId =
          getUserId(updatedUser);

        if (!updatedId) {
          return;
        }

        // Update authenticated user.
        if (
          updatedId ===
          currentUserIdRef.current
        ) {
          updateUser(updatedUser);
        }

        // Update private users.
        setUsers(
          (previousUsers) =>
            previousUsers.map(
              (item) =>
                getUserId(item) ===
                updatedId
                  ? {
                      ...item,
                      ...updatedUser,
                    }
                  : item
            )
        );

        // Update selected private user.
        setSelectedUser(
          (previousUser) =>
            previousUser &&
            getUserId(
              previousUser
            ) === updatedId
              ? {
                  ...previousUser,
                  ...updatedUser,
                }
              : previousUser
        );

        // Update selected room members.
        setSelectedRoom(
          (previousRoom) => {
            if (!previousRoom) {
              return previousRoom;
            }

            const members =
              Array.isArray(
                previousRoom.members
              )
                ? previousRoom.members
                : [];

            const updatedMembers =
              members.map(
                (member) =>
                  getUserId(member) ===
                  updatedId
                    ? {
                        ...member,
                        ...updatedUser,
                      }
                    : member
              );

            const creator =
              getUserId(
                previousRoom.creator
              ) === updatedId
                ? {
                    ...previousRoom.creator,
                    ...updatedUser,
                  }
                : previousRoom.creator;

            return {
              ...previousRoom,
              members:
                updatedMembers,
              creator,
            };
          }
        );

        // Update rooms list.
        setRooms(
          (previousRooms) =>
            previousRooms.map(
              (room) => {
                const members =
                  Array.isArray(
                    room.members
                  )
                    ? room.members
                    : [];

                const updatedMembers =
                  members.map(
                    (member) =>
                      getUserId(member) ===
                      updatedId
                        ? {
                            ...member,
                            ...updatedUser,
                          }
                        : member
                  );

                const creator =
                  getUserId(
                    room.creator
                  ) === updatedId
                    ? {
                        ...room.creator,
                        ...updatedUser,
                      }
                    : room.creator;

                return {
                  ...room,
                  members:
                    updatedMembers,
                  creator,
                };
              }
            )
        );

        // Update loaded room messages.
        setRoomMessages(
          (previousMessages) =>
            previousMessages.map(
              (msg) => {
                if (
                  getUserId(
                    msg?.sender
                  ) !== updatedId
                ) {
                  return msg;
                }

                return {
                  ...msg,
                  sender: {
                    ...(msg.sender || {}),
                    ...updatedUser,
                  },
                };
              }
            )
        );
      },
      [updateUser]
    );

  useEffect(() => {
    const handleProfileUpdated =
      (event) => {
        const updatedUser =
          event?.detail;

        if (!updatedUser) {
          return;
        }

        applyProfileUpdate(
          updatedUser
        );
      };

    window.addEventListener(
      "profile_updated",
      handleProfileUpdated
    );

    return () => {
      window.removeEventListener(
        "profile_updated",
        handleProfileUpdated
      );
    };
  }, [applyProfileUpdate]);

  // ===================================================
  // CONNECT SOCKET
  // ===================================================

  useEffect(() => {
    const token =
      localStorage.getItem(
        "token"
      );

    if (!token) {
      setSocketError(
        "Authentication token not found."
      );

      return;
    }

    socket.auth = {
      token,
    };

    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  // ===================================================
  // LOAD ROOMS
  // ===================================================

  const loadRooms =
    useCallback(async () => {
      try {
        setRoomLoading(true);

        const data =
          await discoverRooms();

        setRooms(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load rooms:",
          error
        );

        setSocketError(
          error.response?.data
            ?.message ||
            "Failed to load rooms."
        );
      } finally {
        setRoomLoading(false);
      }
    }, []);

  useEffect(() => {
    if (
      activeView === "rooms" &&
      currentUserId
    ) {
      loadRooms();
    }
  }, [
    activeView,
    currentUserId,
    loadRooms,
  ]);

  // ===================================================
  // REFRESH SELECTED ROOM
  // ===================================================

  const refreshSelectedRoom =
    useCallback(
      async (roomId) => {
        if (!roomId) {
          return null;
        }

        try {
          const response =
            await api.get(
              `/rooms/${roomId}`
            );

          const updatedRoom =
            response.data;

          if (!updatedRoom?._id) {
            return null;
          }

          setSelectedRoom(
            (currentRoom) => {
              if (
                currentRoom &&
                String(
                  currentRoom._id
                ) !==
                  String(
                    updatedRoom._id
                  )
              ) {
                return currentRoom;
              }

              return updatedRoom;
            }
          );

          setRooms(
            (previousRooms) =>
              previousRooms.map(
                (room) =>
                  String(
                    room._id
                  ) ===
                  String(
                    updatedRoom._id
                  )
                    ? {
                        ...room,
                        ...updatedRoom,
                        isMember:
                          true,
                      }
                    : room
              )
          );

          return updatedRoom;
        } catch (error) {
          console.error(
            "Failed to refresh room:",
            error
          );

          return null;
        }
      },
      []
    );

  // ===================================================
  // FIND ROOM MEMBER
  // ===================================================

  const getRoomMember =
    useCallback(
      (memberId) => {
        if (
          !selectedRoom ||
          !memberId
        ) {
          return null;
        }

        const id =
          String(memberId);

        const members =
          Array.isArray(
            selectedRoom.members
          )
            ? selectedRoom.members
            : [];

        return (
          members.find(
            (member) =>
              getUserId(member) ===
              id
          ) || null
        );
      },
      [selectedRoom]
    );

  // ===================================================
  // SOCKET EVENTS
  // ===================================================

  useEffect(() => {
    const appendUniqueMessage =
      (
        previousMessages,
        newMessage
      ) => {
        const id =
          newMessage?._id ||
          newMessage?.id;

        if (!id) {
          return [
            ...previousMessages,
            newMessage,
          ];
        }

        const exists =
          previousMessages.some(
            (item) =>
              String(
                item?._id ||
                  item?.id
              ) ===
              String(id)
          );

        if (exists) {
          return previousMessages;
        }

        return [
          ...previousMessages,
          newMessage,
        ];
      };

    // =================================================
    // RECEIVE MESSAGE
    // =================================================

    const handleReceiveMessage =
      (newMessage) => {
        if (!newMessage) {
          return;
        }

        const senderId =
          getUserId(
            newMessage?.sender
          );

        const receiverId =
          getUserId(
            newMessage?.receiver
          );

        const currentId =
          currentUserIdRef.current;

        const isMine =
          senderId === currentId;

        // ===============================================
        // ROOM MESSAGE
        // ===============================================

        if (newMessage?.roomId) {
          const roomId =
            String(
              newMessage.roomId
            );

          const currentRoom =
            selectedRoomRef.current;

          const isCurrentRoom =
            currentRoom &&
            activeViewRef.current ===
              "rooms" &&
            String(
              currentRoom._id
            ) === roomId;

          let messageToDisplay =
            newMessage;

          // Fill missing sender profile
          // information from room members.
          if (
            isCurrentRoom &&
            senderId
          ) {
            const members =
              Array.isArray(
                currentRoom.members
              )
                ? currentRoom.members
                : [];

            const roomMember =
              members.find(
                (member) =>
                  getUserId(
                    member
                  ) === senderId
              );

            if (
              roomMember
            ) {
              messageToDisplay = {
                ...newMessage,
                sender: {
                  ...(newMessage.sender ||
                    {}),
                  ...roomMember,
                },
              };
            }
          }

          if (isCurrentRoom) {
            setRoomMessages(
              (previousMessages) =>
                appendUniqueMessage(
                  previousMessages,
                  messageToDisplay
                )
            );

            if (!isMine) {
              markRoomRead(roomId)
                .then(
                  refreshUnreadCounts
                )
                .catch(
                  (error) =>
                    console.error(
                      "Failed to mark room read:",
                      error
                    )
                );
            }

            return;
          }

          if (!isMine) {
            refreshUnreadCounts();
          }

          return;
        }

        // ===============================================
        // PRIVATE MESSAGE
        // ===============================================

        const otherUserId =
          isMine
            ? receiverId
            : senderId;

        if (!otherUserId) {
          return;
        }

        // Track last message time for recent chats
        setLastMessageTime(
          (previousTimes) => ({
            ...previousTimes,
            [otherUserId]:
              newMessage.createdAt ||
              Date.now(),
          })
        );

        const selected =
          selectedUserRef.current;

        const isCurrentChat =
          selected &&
          activeViewRef.current ===
            "chats" &&
          getUserId(selected) ===
            otherUserId;

        if (isCurrentChat) {
          setMessages(
            (previousMessages) =>
              appendUniqueMessage(
                previousMessages,
                newMessage
              )
          );

          if (!isMine) {
            markMessageAsRead(
              newMessage._id ||
                newMessage.id
            );

            refreshUnreadCounts();
          }

          return;
        }

        if (!isMine) {
          refreshUnreadCounts();
        }
      };

    // =================================================
    // MESSAGE ERROR
    // =================================================

    const handleMessageError =
      (error) => {
        console.error(
          "Message error:",
          error
        );

        setSocketError(
          error?.error ||
            error?.message ||
            "Unable to send message."
        );
      };

    // =================================================
    // ONLINE USERS
    // =================================================

    const handleOnlineUsers =
      (ids) => {
        setOnlineUsers(
          Array.isArray(ids)
            ? ids
            : []
        );
      };

    // =================================================
    // CONNECT
    // =================================================

    const handleConnect =
      () => {
        console.log(
          "Socket connected:",
          socket.id
        );

        setSocketError("");

        refreshUnreadCounts();

        const currentRoom =
          selectedRoomRef.current;

        if (currentRoom) {
          socket.emit(
            "join_room",
            String(
              currentRoom._id
            )
          );
        }

        if (user?.language) {
          socket.emit(
            "set_language",
            user.language
          );
        }
      };

    // =================================================
    // CONNECT ERROR
    // =================================================

    const handleConnectError =
      (error) => {
        console.error(
          "Socket connection error:",
          error?.message
        );

        setSocketError(
          error?.message ||
            "Socket connection failed."
        );
      };

    // =================================================
    // MESSAGE READ
    // =================================================

    const handleMessageRead =
      (data) => {
        const messageId =
          String(
            data?.messageId || ""
          );

        if (!messageId) {
          return;
        }

        setMessages(
          (previousMessages) =>
            previousMessages.map(
              (msg) => {
                if (
                  String(
                    msg?._id ||
                      msg?.id ||
                      ""
                  ) !==
                  messageId
                ) {
                  return msg;
                }

                return {
                  ...msg,
                  deliveryStatus:
                    "read",
                  readAt:
                    data?.readAt ||
                    new Date().toISOString(),
                };
              }
            )
        );
      };

    // =================================================
    // MULTIPLE MESSAGES READ
    // =================================================

    const handleMessagesRead =
      (data) => {
        const messageIds =
          Array.isArray(
            data?.messageIds
          )
            ? data.messageIds.map(
                (id) => String(id)
              )
            : [];

        if (!messageIds.length) {
          return;
        }

        const idSet =
          new Set(messageIds);

        setMessages(
          (previousMessages) =>
            previousMessages.map(
              (msg) => {
                const id =
                  String(
                    msg?._id ||
                      msg?.id ||
                      ""
                  );

                if (
                  !idSet.has(id)
                ) {
                  return msg;
                }

                return {
                  ...msg,
                  deliveryStatus:
                    "read",
                  readAt:
                    data?.readAt ||
                    new Date().toISOString(),
                };
              }
            )
        );
      };

    // =================================================
    // READ CONFIRMATION
    // =================================================

    const handleMessageReadConfirmed =
      (data) => {
        const messageId =
          String(
            data?.messageId || ""
          );

        if (!messageId) {
          return;
        }

        setMessages(
          (previousMessages) =>
            previousMessages.map(
              (msg) => {
                if (
                  String(
                    msg?._id ||
                      msg?.id ||
                      ""
                  ) !==
                  messageId
                ) {
                  return msg;
                }

                return {
                  ...msg,
                  deliveryStatus:
                    "read",
                  readAt:
                    data?.readAt ||
                    msg?.readAt ||
                    new Date().toISOString(),
                };
              }
            )
        );
      };

    // =================================================
    // ROOM JOINED
    // =================================================

    const handleRoomJoined =
      () => {
        setSocketError("");
      };

    // =================================================
    // ROOM ERROR
    // =================================================

    const handleRoomError =
      (data) => {
        console.error(
          "Room error:",
          data
        );

        setSocketError(
          data?.error ||
            "Room operation failed."
        );
      };

    // =================================================
    // ROOM LEFT
    // =================================================

    const handleRoomLeft =
      () => {
        clearTypingTimer();

        setSelectedRoom(null);
        setRoomMessages([]);
        setRoomMessage("");
        setRoomTypingUsers([]);
        setShowRoomMembers(false);

        refreshUnreadCounts();
      };

    // =================================================
    // USER JOINED ROOM
    // =================================================

    const handleRoomUserJoined =
      async (data) => {
        const currentRoom =
          selectedRoomRef.current;

        if (
          !currentRoom ||
          String(
            data?.roomId
          ) !==
            String(
              currentRoom._id
            )
        ) {
          return;
        }

        await refreshSelectedRoom(
          currentRoom._id
        );

        await loadRooms();
      };

    // =================================================
    // USER LEFT ROOM
    // =================================================

    const handleUserLeftRoom =
      async (data) => {
        if (data?.userId) {
          setRoomTypingUsers(
            (previousUsers) =>
              previousUsers.filter(
                (item) =>
                  String(
                    item.userId
                  ) !==
                  String(
                    data.userId
                  )
              )
          );
        }

        const currentRoom =
          selectedRoomRef.current;

        if (
          !currentRoom ||
          String(
            data?.roomId
          ) !==
            String(
              currentRoom._id
            )
        ) {
          return;
        }

        await refreshSelectedRoom(
          currentRoom._id
        );

        await loadRooms();
      };

    // =================================================
    // ROOM MEMBER REMOVED
    // =================================================

    const handleRoomMemberRemoved =
      async (data) => {
        const currentRoom =
          selectedRoomRef.current;

        if (
          !currentRoom ||
          String(
            data?.roomId
          ) !==
            String(
              currentRoom._id
            )
        ) {
          return;
        }

        setRoomTypingUsers(
          (previousUsers) =>
            previousUsers.filter(
              (item) =>
                String(
                  item.userId
                ) !==
                String(
                  data.userId
                )
            )
        );

        await refreshSelectedRoom(
          currentRoom._id
        );

        await loadRooms();
      };

    // =================================================
    // REMOVED FROM ROOM
    // =================================================

    const handleRemovedFromRoom =
      async (data) => {
        const currentRoom =
          selectedRoomRef.current;

        if (
          !currentRoom ||
          String(
            data?.roomId
          ) !==
            String(
              currentRoom._id
            )
        ) {
          return;
        }

        clearTypingTimer();

        setSelectedRoom(null);
        setRoomMessages([]);
        setRoomMessage("");
        setRoomTypingUsers([]);
        setShowRoomMembers(false);

        setSocketError(
          `You were removed from "${
            data?.roomName ||
            "this room"
          }".`
        );

        await refreshUnreadCounts();
        await loadRooms();
      };

    // =================================================
    // ROOM DELETED
    // =================================================

    const handleRoomDeleted =
      async (data) => {
        const roomId =
          String(
            data?.roomId || ""
          );

        if (!roomId) {
          return;
        }

        setRooms(
          (previousRooms) =>
            previousRooms.filter(
              (room) =>
                String(
                  room._id
                ) !== roomId
            )
        );

        const currentRoom =
          selectedRoomRef.current;

        if (
          currentRoom &&
          String(
            currentRoom._id
          ) === roomId
        ) {
          clearTypingTimer();

          setSelectedRoom(null);
          setRoomMessages([]);
          setRoomMessage("");
          setRoomTypingUsers([]);
          setShowRoomMembers(false);

          setSocketError(
            `Room "${
              data?.roomName ||
              "this room"
            }" was deleted.`
          );
        }

        await refreshUnreadCounts();
        await loadRooms();
      };

    // =================================================
    // USER TYPING
    // =================================================

    const handleUserTyping =
      (data) => {
        if (data?.roomId) {
          const room =
            selectedRoomRef.current;

          if (
            !room ||
            String(
              data.roomId
            ) !==
              String(
                room._id
              )
          ) {
            return;
          }

          const typingUserId =
            String(
              data.userId
            );

          if (
            typingUserId ===
            currentUserIdRef.current
          ) {
            return;
          }

          setRoomTypingUsers(
            (previousUsers) => {
              const exists =
                previousUsers.some(
                  (item) =>
                    String(
                      item.userId
                    ) ===
                    typingUserId
                );

              if (exists) {
                return previousUsers;
              }

              return [
                ...previousUsers,
                {
                  userId:
                    typingUserId,
                  username:
                    data.username ||
                    "Someone",
                },
              ];
            }
          );

          return;
        }

        const selected =
          selectedUserRef.current;

        if (!selected) {
          return;
        }

        if (
          String(
            data.userId
          ) !==
          getUserId(selected)
        ) {
          return;
        }

        setPrivateTypingUser(
          data.username ||
            selected.username ||
            "Someone"
        );
      };

    // =================================================
    // STOP TYPING
    // =================================================

    const handleUserStopTyping =
      (data) => {
        if (data?.roomId) {
          const room =
            selectedRoomRef.current;

          if (
            !room ||
            String(
              data.roomId
            ) !==
              String(
                room._id
              )
          ) {
            return;
          }

          setRoomTypingUsers(
            (previousUsers) =>
              previousUsers.filter(
                (item) =>
                  String(
                    item.userId
                  ) !==
                  String(
                    data.userId
                  )
              )
          );

          return;
        }

        const selected =
          selectedUserRef.current;

        if (
          selected &&
          String(
            data.userId
          ) ===
            getUserId(selected)
        ) {
          setPrivateTypingUser("");
        }
      };

    // =================================================
    // REGISTER EVENTS
    // =================================================

    socket.on(
      "receive_message",
      handleReceiveMessage
    );

    socket.on(
      "message_error",
      handleMessageError
    );

    socket.on(
      "online_users",
      handleOnlineUsers
    );

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "connect_error",
      handleConnectError
    );

    socket.on(
      "message_read",
      handleMessageRead
    );

    socket.on(
      "messages_read",
      handleMessagesRead
    );

    socket.on(
      "message_read_confirmed",
      handleMessageReadConfirmed
    );

    socket.on(
      "room_joined",
      handleRoomJoined
    );

    socket.on(
      "room_error",
      handleRoomError
    );

    socket.on(
      "room_left",
      handleRoomLeft
    );

    socket.on(
      "room_user_joined",
      handleRoomUserJoined
    );

    socket.on(
      "user_left_room",
      handleUserLeftRoom
    );

    socket.on(
      "room_member_removed",
      handleRoomMemberRemoved
    );

    socket.on(
      "removed_from_room",
      handleRemovedFromRoom
    );

    socket.on(
      "room_deleted",
      handleRoomDeleted
    );

    socket.on(
      "user_typing",
      handleUserTyping
    );

    socket.on(
      "user_stop_typing",
      handleUserStopTyping
    );

    // =================================================
    // CLEANUP
    // =================================================

    return () => {
      socket.off(
        "receive_message",
        handleReceiveMessage
      );

      socket.off(
        "message_error",
        handleMessageError
      );

      socket.off(
        "online_users",
        handleOnlineUsers
      );

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "connect_error",
        handleConnectError
      );

      socket.off(
        "message_read",
        handleMessageRead
      );

      socket.off(
        "messages_read",
        handleMessagesRead
      );

      socket.off(
        "message_read_confirmed",
        handleMessageReadConfirmed
      );

      socket.off(
        "room_joined",
        handleRoomJoined
      );

      socket.off(
        "room_error",
        handleRoomError
      );

      socket.off(
        "room_left",
        handleRoomLeft
      );

      socket.off(
        "room_user_joined",
        handleRoomUserJoined
      );

      socket.off(
        "user_left_room",
        handleUserLeftRoom
      );

      socket.off(
        "room_member_removed",
        handleRoomMemberRemoved
      );

      socket.off(
        "removed_from_room",
        handleRemovedFromRoom
      );

      socket.off(
        "room_deleted",
        handleRoomDeleted
      );

      socket.off(
        "user_typing",
        handleUserTyping
      );

      socket.off(
        "user_stop_typing",
        handleUserStopTyping
      );
    };
  }, [
    clearTypingTimer,
    loadRooms,
    markMessageAsRead,
    refreshSelectedRoom,
    refreshUnreadCounts,
    user?.language,
  ]);

  // ===================================================
  // PRIVATE HISTORY
  // ===================================================

  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadPrivateHistory =
      async () => {
        try {
          setSocketError("");

          const response =
            await api.get(
              `/messages/private/${currentUserId}/${selectedUser._id}`
            );

          if (cancelled) {
            return;
          }

          const loadedMessages =
            Array.isArray(
              response.data
            )
              ? response.data
              : [];

          setMessages(
            loadedMessages
          );

          loadedMessages.forEach(
            (msg) => {
              const senderId =
                getUserId(
                  msg?.sender
                );

              const receiverId =
                getUserId(
                  msg?.receiver
                );

              const messageId =
                msg?._id ||
                msg?.id;

              if (
                senderId !==
                  currentUserId &&
                receiverId ===
                  currentUserId &&
                messageId &&
                msg.deliveryStatus !==
                  "read"
              ) {
                markMessageAsRead(
                  messageId
                );
              }
            }
          );

          if (socket.connected) {
            socket.emit(
              "mark_conversation_read",
              String(
                selectedUser._id
              )
            );
          }

          await markPrivateRead(
            selectedUser._id
          );

          await refreshUnreadCounts();
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error(
            "Failed to load private history:",
            error
          );

          setMessages([]);

          setSocketError(
            error.response?.data
              ?.message ||
              "Failed to load chat history."
          );
        }
      };

    loadPrivateHistory();

    return () => {
      cancelled = true;
    };
  }, [
    selectedUser,
    currentUserId,
    markMessageAsRead,
    refreshUnreadCounts,
  ]);

  // ===================================================
  // ROOM HISTORY
  // ===================================================

  useEffect(() => {
    if (!selectedRoom) {
      setRoomMessages([]);
      return;
    }

    let cancelled = false;

    const loadRoomHistory =
      async () => {
        try {
          setSocketError("");

          const data =
            await getRoomMessages(
              selectedRoom._id
            );

          if (cancelled) {
            return;
          }

          const loadedMessages =
            Array.isArray(data)
              ? data
              : [];

          // Ensure historical room messages
          // have profile data from the selected room
          // even when the API only returns sender ID.
          const normalizedMessages =
            loadedMessages.map(
              (msg) => {
                const senderId =
                  getUserId(
                    msg?.sender
                  );

                const roomMember =
                  selectedRoom.members?.find(
                    (member) =>
                      getUserId(
                        member
                      ) === senderId
                  );

                if (!roomMember) {
                  return msg;
                }

                return {
                  ...msg,
                  sender: {
                    ...(msg.sender || {}),
                    ...roomMember,
                  },
                };
              }
            );

          setRoomMessages(
            normalizedMessages
          );

          await markRoomRead(
            selectedRoom._id
          );

          await refreshUnreadCounts();

          if (socket.connected) {
            socket.emit(
              "join_room",
              String(
                selectedRoom._id
              )
            );
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error(
            "Failed to load room history:",
            error
          );

          setRoomMessages([]);

          setSocketError(
            error.response?.data
              ?.message ||
              "Failed to load room messages."
          );
        }
      };

    loadRoomHistory();

    return () => {
      cancelled = true;
    };
  }, [
    selectedRoom,
    refreshUnreadCounts,
  ]);

  // ===================================================
  // AUTO SCROLL
  // ===================================================

  useEffect(() => {
    privateMessagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    roomMessagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [roomMessages]);

  // ===================================================
  // SELECT PRIVATE USER
  // ===================================================

  const selectUser =
    async (selected) => {
      if (!selected?._id) {
        return;
      }

      const previousUser =
        selectedUserRef.current;

      const previousRoom =
        selectedRoomRef.current;

      if (
        previousUser &&
        socket.connected
      ) {
        socket.emit(
          "stop_typing",
          {
            receiver:
              String(
                previousUser._id
              ),
          }
        );
      }

      if (
        previousRoom &&
        socket.connected
      ) {
        socket.emit(
          "stop_typing",
          {
            roomId:
              String(
                previousRoom._id
              ),
          }
        );
      }

      clearTypingTimer();

      setPrivateTypingUser("");
      setRoomTypingUsers([]);
      setShowRoomMembers(false);

      setActiveView("chats");

      setSelectedUser(selected);
      setSelectedRoom(null);

      setMessages([]);
      setRoomMessages([]);

      setMessage("");
      setRoomMessage("");

      setSocketError("");

      try {
        await markPrivateRead(
          selected._id
        );

        await refreshUnreadCounts();

        if (socket.connected) {
          socket.emit(
            "mark_conversation_read",
            String(
              selected._id
            )
          );
        }
      } catch (error) {
        console.error(
          "Failed to mark private chat as read:",
          error
        );
      }
    };

  // ===================================================
  // PRIVATE TYPING
  // ===================================================

  const handlePrivateTyping =
    (event) => {
      const value =
        event.target.value;

      setMessage(value);

      if (
        !selectedUser ||
        !socket.connected
      ) {
        return;
      }

      const receiver =
        String(
          selectedUser._id
        );

      clearTypingTimer();

      if (!value.trim()) {
        socket.emit(
          "stop_typing",
          {
            receiver,
          }
        );

        setPrivateTypingUser("");

        return;
      }

      socket.emit(
        "typing",
        {
          receiver,
          username:
            user?.username ||
            "User",
        }
      );

      typingTimeoutRef.current =
        setTimeout(() => {
          socket.emit(
            "stop_typing",
            {
              receiver,
            }
          );
        }, 1000);
    };

  // ===================================================
  // SEND PRIVATE
  // ===================================================

  const sendMessage =
    (event) => {
      event.preventDefault();

      const text =
        message.trim();

      if (!text) {
        return;
      }

      if (!selectedUser) {
        setSocketError(
          "Please select a user."
        );

        return;
      }

      if (!socket.connected) {
        setSocketError(
          "Chat server is not connected."
        );

        return;
      }

      const receiver =
        String(
          selectedUser._id
        );

      // Track last message time for recent chats
      setLastMessageTime(
        (previousTimes) => ({
          ...previousTimes,
          [receiver]: Date.now(),
        })
      );

      clearTypingTimer();

      socket.emit(
        "stop_typing",
        {
          receiver,
        }
      );

      socket.emit(
        "send_message",
        {
          receiver,
          message: text,
          messageType:
            "text",
        }
      );

      setMessage("");
      setPrivateTypingUser("");
    };

  const sendVoiceMessage =
    async (attachmentUrl) => {
      if (!selectedUser || !socket.connected) {
        setSocketError(
          "Chat server is not connected."
        );
        return;
      }

      socket.emit(
        "send_message",
        {
          receiver: String(
            selectedUser._id
          ),
          message: "Voice message",
          messageType: "audio",
          attachmentUrl,
        }
      );
    };

  const sendAttachmentMessage =
    async (attachment) => {
      if (
        !selectedUser ||
        !socket.connected ||
        !attachment?.attachmentUrl
      ) {
        setSocketError(
          "Chat server is not connected."
        );
        return;
      }

      socket.emit(
        "send_message",
        {
          receiver: String(
            selectedUser._id
          ),
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

  // ===================================================
  // CREATE ROOM
  // ===================================================

  const handleCreateRoom =
    async (event) => {
      event.preventDefault();

      const name =
        roomName.trim();

      const description =
        roomDescription.trim();

      if (!name) {
        setSocketError(
          "Please enter a room name."
        );

        return;
      }

      if (description.length > 500) {
        setSocketError(
          "Room description cannot exceed 500 characters."
        );

        return;
      }

      try {
        setRoomLoading(true);
        setSocketError("");

        const newRoom =
          await createRoom(
            name,
            description
          );

        if (!newRoom?._id) {
          throw new Error(
            "Server returned an invalid room."
          );
        }

        setRooms(
          (previousRooms) => [
            newRoom,
            ...previousRooms.filter(
              (room) =>
                String(
                  room._id
                ) !==
                String(
                  newRoom._id
                )
            ),
          ]
        );

        setRoomName("");
        setRoomDescription("");
        setShowCreateRoom(false);

        await markRoomRead(
          newRoom._id
        );

        await refreshUnreadCounts();

        await openRoom(newRoom);
      } catch (error) {
        console.error(
          "Create room error:",
          error
        );

        setSocketError(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to create room."
        );
      } finally {
        setRoomLoading(false);
      }
    };

  // ===================================================
  // JOIN ROOM BY CODE
  // ===================================================

  const handleJoinRoomByCode =
    async (event) => {
      event.preventDefault();

      const code =
        roomCode
          .trim()
          .toUpperCase();

      if (
        !/^[A-Z0-9]{6}$/.test(
          code
        )
      ) {
        setSocketError(
          "Enter a valid 6-character room code."
        );

        return;
      }

      try {
        setRoomLoading(true);
        setSocketError("");

        const response =
          await joinRoomByCode(code);

        const joinedRoom =
          response?.room;

        if (!joinedRoom?._id) {
          throw new Error(
            "The server did not return a valid room."
          );
        }

        setRooms(
          (previousRooms) => [
            joinedRoom,
            ...previousRooms.filter(
              (room) =>
                String(
                  room._id
                ) !==
                String(
                  joinedRoom._id
                )
            ),
          ]
        );

        setRoomCode("");
        setShowJoinRoom(false);

        await markRoomRead(
          joinedRoom._id
        );

        await refreshUnreadCounts();

        await openRoom(
          joinedRoom
        );
      } catch (error) {
        console.error(
          "Join-by-code failed:",
          error
        );

        setSocketError(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to join room."
        );
      } finally {
        setRoomLoading(false);
      }
    };

  // ===================================================
  // JOIN ROOM BY ID
  // ===================================================

  const handleJoinRoom =
    async (room) => {
      if (!room?._id) {
        return;
      }

      try {
        setRoomLoading(true);
        setSocketError("");

        const response =
          await joinRoom(
            room._id
          );

        const updatedRoom =
          response?.room;

        if (!updatedRoom?._id) {
          throw new Error(
            "Server returned an invalid room."
          );
        }

        setRooms(
          (previousRooms) =>
            previousRooms.map(
              (item) =>
                String(
                  item._id
                ) ===
                String(
                  updatedRoom._id
                )
                  ? {
                      ...updatedRoom,
                      isMember: true,
                    }
                  : item
            )
        );

        await markRoomRead(
          updatedRoom._id
        );

        await refreshUnreadCounts();

        await openRoom(
          updatedRoom
        );
      } catch (error) {
        console.error(
          "Join room error:",
          error
        );

        setSocketError(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to join room."
        );
      } finally {
        setRoomLoading(false);
      }
    };

  // ===================================================
  // ROOM MEMBERSHIP
  // ===================================================

  const isRoomMember =
    (room) => {
      if (!room) {
        return false;
      }

      if (room.isMember === true) {
        return true;
      }

      return (
        Array.isArray(
          room.members
        ) &&
        room.members.some(
          (member) =>
            getUserId(member) ===
            currentUserId
        )
      );
    };

  // ===================================================
  // ROOM MEMBERS
  // ===================================================

  const getRoomMembers =
    () =>
      Array.isArray(
        selectedRoom?.members
      )
        ? selectedRoom.members
        : [];

  const isMemberOnline =
    (member) => {
      const memberId =
        getUserId(member);

      return onlineUsers.some(
        (onlineId) =>
          String(
            onlineId
          ) === memberId
      );
    };

  const isCurrentUserCreator =
    useCallback(
      () => {
        if (!selectedRoom) {
          return false;
        }

        return (
          getUserId(
            selectedRoom.creator
          ) === currentUserId
        );
      },
      [
        selectedRoom,
        currentUserId,
      ]
    );

  // ===================================================
  // REMOVE MEMBER
  // ===================================================

  const handleRemoveRoomMember =
    async (member) => {
      if (!selectedRoom) {
        return;
      }

      if (
        !isCurrentUserCreator()
      ) {
        setSocketError(
          "Only the room creator can remove members."
        );

        return;
      }

      const memberId =
        getUserId(member);

      if (!memberId) {
        return;
      }

      if (
        memberId ===
        currentUserId
      ) {
        setSocketError(
          "You cannot remove yourself from the room."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Remove ${
            member?.username ||
            "this member"
          } from "${selectedRoom.name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setRoomActionLoading(true);
        setSocketError("");

        const response =
          await removeRoomMember(
            selectedRoom._id,
            memberId
          );

        if (response?.room) {
          setSelectedRoom(
            response.room
          );

          setRooms(
            (previousRooms) =>
              previousRooms.map(
                (room) =>
                  String(
                    room._id
                  ) ===
                  String(
                    response.room
                      ._id
                  )
                    ? {
                        ...room,
                        ...response.room,
                        isMember:
                          true,
                      }
                    : room
              )
          );
        }

        await refreshUnreadCounts();
      } catch (error) {
        console.error(
          "Remove member error:",
          error
        );

        setSocketError(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to remove member."
        );
      } finally {
        setRoomActionLoading(
          false
        );
      }
    };

  // ===================================================
  // DELETE ROOM
  // ===================================================

  const handleDeleteRoom =
    async () => {
      if (!selectedRoom) {
        return;
      }

      if (
        !isCurrentUserCreator()
      ) {
        setSocketError(
          "Only the room creator can delete the room."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Delete "${selectedRoom.name}" permanently? All messages in this room will also be deleted.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setRoomActionLoading(true);
        setSocketError("");

        const roomId =
          String(
            selectedRoom._id
          );

        clearTypingTimer();

        if (socket.connected) {
          socket.emit(
            "stop_typing",
            {
              roomId,
            }
          );
        }

        await deleteRoom(
          roomId
        );

        setRooms(
          (previousRooms) =>
            previousRooms.filter(
              (room) =>
                String(
                  room._id
                ) !== roomId
            )
        );

        setSelectedRoom(null);
        setRoomMessages([]);
        setRoomMessage("");
        setRoomTypingUsers([]);
        setShowRoomMembers(false);

        await refreshUnreadCounts();
      } catch (error) {
        console.error(
          "Delete room error:",
          error
        );

        setSocketError(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to delete room."
        );
      } finally {
        setRoomActionLoading(
          false
        );
      }
    };

  // ===================================================
  // OPEN ROOM
  // ===================================================

  const openRoom =
    async (room) => {
      if (!room?._id) {
        return;
      }

      if (!isRoomMember(room)) {
        setSocketError(
          "Join this room first."
        );

        return;
      }

      const previousUser =
        selectedUserRef.current;

      if (
        previousUser &&
        socket.connected
      ) {
        socket.emit(
          "stop_typing",
          {
            receiver:
              String(
                previousUser._id
              ),
          }
        );
      }

      clearTypingTimer();

      setPrivateTypingUser("");
      setRoomTypingUsers([]);
      setShowRoomMembers(false);

      setActiveView("rooms");

      setSelectedUser(null);
      setSelectedRoom(room);

      setMessages([]);
      setRoomMessages([]);

      setMessage("");
      setRoomMessage("");

      setSocketError("");

      try {
        await markRoomRead(
          room._id
        );

        await refreshUnreadCounts();
      } catch (error) {
        console.error(
          "Failed to mark room as read:",
          error
        );
      }

      if (socket.connected) {
        socket.emit(
          "join_room",
          String(
            room._id
          )
        );
      }
    };

  // ===================================================
  // ROOM TYPING
  // ===================================================

  const handleRoomTyping =
    (event) => {
      const value =
        event.target.value;

      setRoomMessage(value);

      if (
        !selectedRoom ||
        !socket.connected
      ) {
        return;
      }

      const roomId =
        String(
          selectedRoom._id
        );

      clearTypingTimer();

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
          username:
            user?.username ||
            "User",
        }
      );

      typingTimeoutRef.current =
        setTimeout(() => {
          socket.emit(
            "stop_typing",
            {
              roomId,
            }
          );
        }, 1000);
    };

  // ===================================================
  // LEAVE ROOM
  // ===================================================

  const handleLeaveRoom =
    async (room) => {
      if (!room?._id) {
        return;
      }

      const creatorId =
        getUserId(
          room.creator
        );

      if (
        creatorId ===
        currentUserId
      ) {
        setSocketError(
          "The room creator cannot leave the room."
        );

        return;
      }

      try {
        setRoomLoading(true);
        setSocketError("");

        clearTypingTimer();

        const roomId =
          String(
            room._id
          );

        if (socket.connected) {
          socket.emit(
            "stop_typing",
            {
              roomId,
            }
          );
        }

        await leaveRoom(
          roomId
        );

        setRooms(
          (previousRooms) =>
            previousRooms.map(
              (item) => {
                if (
                  String(
                    item._id
                  ) !== roomId
                ) {
                  return item;
                }

                return {
                  ...item,
                  isMember: false,
                  members:
                    Array.isArray(
                      item.members
                    )
                      ? item.members.filter(
                          (member) =>
                            getUserId(
                              member
                            ) !==
                            currentUserId
                        )
                      : [],
                };
              }
            )
        );

        if (
          selectedRoom &&
          String(
            selectedRoom._id
          ) === roomId
        ) {
          setSelectedRoom(null);
          setRoomMessages([]);
          setRoomMessage("");
          setRoomTypingUsers([]);
          setShowRoomMembers(false);
        }

        await refreshUnreadCounts();
      } catch (error) {
        console.error(
          "Leave room error:",
          error
        );

        setSocketError(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to leave room."
        );
      } finally {
        setRoomLoading(false);
      }
    };

  // ===================================================
  // SEND ROOM MESSAGE
  // ===================================================

  const sendRoomMessage =
    (event) => {
      event.preventDefault();

      const text =
        roomMessage.trim();

      if (!text) {
        return;
      }

      if (!selectedRoom) {
        setSocketError(
          "Please select a room."
        );

        return;
      }

      if (!socket.connected) {
        setSocketError(
          "Chat server is not connected."
        );

        return;
      }

      const roomId =
        String(
          selectedRoom._id
        );

      clearTypingTimer();

      socket.emit(
        "stop_typing",
        {
          roomId,
        }
      );

      socket.emit(
        "send_message",
        {
          roomId,
          message: text,
          messageType:
            "text",
        }
      );

      setRoomMessage("");
      setRoomTypingUsers([]);
    };

  const sendRoomVoiceMessage =
    async (attachmentUrl) => {
      if (!selectedRoom || !socket.connected) {
        setSocketError(
          "Chat server is not connected."
        );
        return;
      }

      socket.emit(
        "send_message",
        {
          roomId: String(
            selectedRoom._id
          ),
          message: "Voice message",
          messageType: "audio",
          attachmentUrl,
        }
      );
    };

  const sendRoomAttachmentMessage =
    async (attachment) => {
      if (
        !selectedRoom ||
        !socket.connected ||
        !attachment?.attachmentUrl
      ) {
        setSocketError(
          "Chat server is not connected."
        );
        return;
      }

      socket.emit(
        "send_message",
        {
          roomId: String(
            selectedRoom._id
          ),
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

  // ===================================================
  // LOGOUT
  // ===================================================

  const handleLogout =
    () => {
      clearTypingTimer();

      socket.disconnect();

      logout();
    };

  // ===================================================
  // CLEANUP
  // ===================================================

  useEffect(() => {
    return () => {
      clearTypingTimer();
    };
  }, [clearTypingTimer]);

  // ===================================================
  // UNREAD TOTALS
  // ===================================================

  const totalPrivateUnread =
    Object.values(
      privateUnreadCounts
    ).reduce(
      (total, count) =>
        total +
        Number(count || 0),
      0
    );

  const totalRoomUnread =
    Object.values(
      roomUnreadCounts
    ).reduce(
      (total, count) =>
        total +
        Number(count || 0),
      0
    );

  const normalizedUserSearch =
    userSearch.trim().toLowerCase();

  const filteredUsers = users;

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div
      className={`chat-page ${
        selectedUser || selectedRoom
          ? "has-active-conversation"
          : ""
      }`}
    >

      {/* =================================================
          HEADER
      ================================================== */}

      <header className="chat-header">

        <div className="chat-header-identity">

          <button
            type="button"
            className="profile-header-button"
            onClick={() =>
              navigate("/profile")
            }
            title="My Profile"
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt={
                  user?.username ||
                  "Profile"
                }
                className="profile-header-image"
              />
            ) : (
              <span className="profile-header-avatar">
                {profileInitial}
              </span>
            )}

          </button>

          <div>
          <h2>
            Multilingual
          </h2>

          <p>
            {t.welcome},{" "}
            {user?.username || "User"}
          </p>
          </div>
        </div>

        <div className="chat-header-actions">

          <div className="dashboard-search-group">
            <button
              type="button"
              className={`dashboard-search-toggle ${
                searchOpen ? "active" : ""
              }`}
              onClick={() => {
                setSearchOpen((previous) => {
                  if (!previous) {
                    setActiveView("chats");
                  }

                  return !previous;
                });
                setUserSearch("");
              }}
              title="Search"
              aria-label="Search"
              aria-expanded={searchOpen}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="10.8" cy="10.8" r="6.2" />
                <path d="m16 16 4.5 4.5" />
              </svg>
            </button>

          {searchOpen && (
            <div className="dashboard-search">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="10.8" cy="10.8" r="6.2" />
                <path d="m16 16 4.5 4.5" />
              </svg>

              <input
                type="search"
                name="user-search"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search"
                autoFocus
                aria-label="Search"
              />

              {userSearch && (
                <button
                  type="button"
                  className="dashboard-search-clear"
                  onClick={() => setUserSearch("")}
                  aria-label="Clear user search"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {searchOpen && normalizedUserSearch.length >= 2 && (
            <div className="global-search-results">
              {globalSearchLoading ? (
                <p className="global-search-empty">Searching...</p>
              ) : (
                <>
                  {globalSearchResults.friends.length > 0 && (
                    <section>
                      <h4>Friends</h4>
                      {globalSearchResults.friends.map((friend) => (
                        <button type="button" className="global-search-result" key={friend._id} onClick={() => {
                          selectUser(friend);
                          setSearchOpen(false);
                          setUserSearch("");
                        }}>
                          <strong>{friend.username}</strong>
                          <span>{friend.email}</span>
                        </button>
                      ))}
                    </section>
                  )}

                  {globalSearchResults.groups.length > 0 && (
                    <section>
                      <h4>Groups</h4>
                      {globalSearchResults.groups.map((group) => (
                        <button type="button" className="global-search-result" key={group._id} onClick={() => {
                          openRoom(group);
                          setSearchOpen(false);
                          setUserSearch("");
                        }}>
                          <strong>{group.name}</strong>
                          <span>{group.description || `${group.members?.length || 0} members`}</span>
                        </button>
                      ))}
                    </section>
                  )}

                  {globalSearchResults.messages.length > 0 && (
                    <section>
                      <h4>Messages</h4>
                      {globalSearchResults.messages.map((result) => (
                        <button type="button" className="global-search-result" key={result._id} onClick={() => {
                          if (result.roomId) {
                            const room = rooms.find((item) => String(item._id) === String(result.roomId));
                            if (room) openRoom(room);
                          } else {
                            const otherUser = String(getUserId(result.sender)) === currentUserId ? result.receiver : result.sender;
                            if (otherUser) selectUser(otherUser);
                          }
                          setSearchOpen(false);
                          setUserSearch("");
                        }}>
                          <strong>{result.message || result.attachmentName || "Attachment"}</strong>
                          <span>{result.sender?.username || "Message"}</span>
                        </button>
                      ))}
                    </section>
                  )}

                  {globalSearchResults.links.length > 0 && (
                    <section>
                      <h4>Links</h4>
                      {globalSearchResults.links.map((link) => (
                        <a className="global-search-result" href={link.url} target="_blank" rel="noreferrer" key={link.id}>
                          <strong>{link.url}</strong>
                          <span>Open link</span>
                        </a>
                      ))}
                    </section>
                  )}

                  {!globalSearchResults.friends.length && !globalSearchResults.groups.length && !globalSearchResults.messages.length && !globalSearchResults.links.length && (
                    <p className="global-search-empty">No results found.</p>
                  )}
                </>
              )}
            </div>
          )}
          </div>

          <AddFriendsPicker
            className="header-add-friends-picker"
            incomingRequestCount={pendingFriendRequests.length}
            onRequestUpdated={loadFriends}
          />

          <LanguageSelector />

          <button
            type="button"
            onClick={
              handleLogout
            }
            className="dashboard-logout-button"
          >

            {t.logout}
          </button>

          <div className="dashboard-overflow-menu">
            <button
              type="button"
              className="dashboard-overflow-toggle"
              onClick={() =>
                setMobileMenuOpen((previous) => !previous)
              }
              title="More options"
              aria-label="More options"
              aria-expanded={mobileMenuOpen}
            >
              <span aria-hidden="true">&#8942;</span>
            </button>

            {mobileMenuOpen && (
              <div className="dashboard-overflow-panel">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  {t.logout}
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* =================================================
          SIDEBAR
      ================================================== */}

      <aside className="sidebar">

        <div className="sidebar-navigation">

          <button
            type="button"
            className={`sidebar-button ${
              activeView ===
              "chats"
                ? "active"
                : ""
            }`}
            onClick={() => {
              const room =
                selectedRoomRef.current;

              if (
                room &&
                socket.connected
              ) {
                socket.emit(
                  "stop_typing",
                  {
                    roomId:
                      String(
                        room._id
                      ),
                  }
                );
              }

              clearTypingTimer();

              setActiveView(
                "chats"
              );

              setSelectedRoom(null);
              setRoomMessages([]);
              setRoomTypingUsers([]);
              setShowRoomMembers(false);
              setSocketError("");
            }}
          >
            <span className="sidebar-button-label">
              <span className="sidebar-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
                  <path d="M7 10h10M7 13.5h6" />
                </svg>
              </span>
              <span>Chats</span>
            </span>

            {totalPrivateUnread >
              0 && (
              <span className="nav-unread-badge">
                {totalPrivateUnread >
                99
                  ? "99+"
                  : totalPrivateUnread}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`sidebar-button ${
              activeView ===
              "rooms"
                ? "active"
                : ""
            }`}
            onClick={() => {
              const privateUser =
                selectedUserRef.current;

              if (
                privateUser &&
                socket.connected
              ) {
                socket.emit(
                  "stop_typing",
                  {
                    receiver:
                      String(
                        privateUser._id
                      ),
                  }
                );
              }

              clearTypingTimer();

              setActiveView(
                "rooms"
              );

              setSelectedUser(null);
              setMessages([]);
              setPrivateTypingUser("");
              setShowRoomMembers(false);
              setSocketError("");
            }}
          >
            <span className="sidebar-button-label">
              <span className="sidebar-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <circle cx="9" cy="8" r="3" />
                  <path d="M3.5 18a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M16 13a5 5 0 0 1 4.5 5" />
                </svg>
              </span>
              <span>Rooms</span>
            </span>

            {totalRoomUnread >
              0 && (
              <span className="nav-unread-badge">
                {totalRoomUnread >
                99
                  ? "99+"
                  : totalRoomUnread}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`sidebar-button ${
              activeView === "calls"
                ? "active"
                : ""
            }`}
            onClick={() => {
              clearTypingTimer();
              setActiveView("calls");
              setSelectedUser(null);
              setSelectedRoom(null);
              setMessages([]);
              setRoomMessages([]);
              setPrivateTypingUser("");
              setRoomTypingUsers([]);
              setShowRoomMembers(false);
              setSocketError("");
            }}
          >
            <span className="sidebar-button-label">
              <span className="sidebar-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M6.6 3.2 9 2.5l2 4.8-1.8 1.5a14.7 14.7 0 0 0 5.9 5.9l1.5-1.8 4.8 2-.7 2.4c-.3 1.1-1.5 1.7-2.6 1.3A18.5 18.5 0 0 1 5.2 5.8c-.4-1.1.3-2.3 1.4-2.6Z" />
                </svg>
              </span>
              <span>Calls</span>
            </span>

            {callHistory.length > 0 && (
              <span className="nav-unread-badge">
                {callHistory.length > 99
                  ? "99+"
                  : callHistory.length}
              </span>
            )}
          </button>

        </div>

        {/* =================================================
            RECENT CHATS
        ================================================== */}

        {activeView ===
          "chats" && (
          <>
            <div className="sidebar-title">

              <div className="sidebar-title-left">
                <h3>
                  Chats
                </h3>

                <p>
                  Recent messages
                </p>
              </div>

              <AddFriendsPicker
                className="sidebar-add-friends-picker"
                incomingRequestCount={pendingFriendRequests.length}
                onRequestUpdated={loadFriends}
              />

            </div>

            <div className="user-list">

              {users.length ===
              0 ? (
                <p>
                  No recent chats. Use the Add Friends button to start chatting.
                </p>
              ) : (
                users
                  .map((item) => ({
                    ...item,
                    lastTime:
                      lastMessageTime[
                        getUserId(item)
                      ] || 0,
                  }))
                  .sort((a, b) =>
                    b.lastTime -
                    a.lastTime
                  )
                  .map((item) => {
                    const itemId =
                      getUserId(item);

                    const isOnline =
                      onlineUsers.some(
                        (id) =>
                          String(id) ===
                          itemId
                      );

                    const isSelected =
                      selectedUser &&
                      getUserId(
                        selectedUser
                      ) === itemId;

                    const unreadCount =
                      Number(
                        privateUnreadCounts[
                          itemId
                        ] || 0
                      );

                    const itemImage =
                      getImageUrl(
                        item?.profilePicture
                      );

                    return (
                      <button
                        type="button"
                        key={itemId}
                        className={
                          isSelected
                            ? "user-item selected"
                            : "user-item"
                        }
                        onClick={() =>
                          selectUser(item)
                        }
                      >

                        <span className="user-item-avatar">

                          {itemImage ? (
                            <img
                              src={
                                itemImage
                              }
                              alt={
                                item?.username ||
                                "User"
                              }
                              className="user-avatar-image"
                            />
                          ) : (
                            <span className="user-avatar-placeholder">
                              {getInitial(
                                item?.username
                              )}
                            </span>
                          )}

                        </span>

                        <span className="user-item-main">

                          <span>
                            {item.username}
                          </span>

                          <small>
                            {isOnline
                              ? t.online
                              : "Offline"}
                          </small>

                        </span>

                        {unreadCount >
                          0 && (
                          <span className="unread-badge">
                            {unreadCount >
                            99
                              ? "99+"
                              : unreadCount}
                          </span>
                        )}

                      </button>
                    );
                  }
                )
              )}

            </div>
          </>
        )}

        {/* =================================================
            ROOMS
        ================================================== */}

        {activeView ===
          "rooms" && (
          <div className="rooms-sidebar">

            <div className="rooms-title">

              <div>
                <h3>
                  Rooms
                </h3>

                <p>
                  Create or join
                  rooms
                </p>
              </div>

              <div className="room-header-actions">

                <button
                  type="button"
                  className="join-room-icon"
                  title="Join Room"
                  onClick={() => {
                    setShowJoinRoom(true);
                    setShowCreateRoom(false);
                    setSocketError("");
                  }}
                >
                  ⇥
                </button>

                <button
                  type="button"
                  className="create-room-icon"
                  title="Create Room"
                  onClick={() => {
                    setShowCreateRoom(true);
                    setShowJoinRoom(false);
                    setSocketError("");
                  }}
                >
                  +
                </button>

              </div>

            </div>

            {/* CREATE */}

            {showCreateRoom && (
              <form
                className="create-room-form"
                onSubmit={
                  handleCreateRoom
                }
              >

                <input
                  type="text"
                  name="room-name"
                  placeholder="Room name..."
                  value={roomName}
                  maxLength={50}
                  autoFocus
                  onChange={(event) =>
                    setRoomName(
                      event.target.value
                    )
                  }
                />

                <textarea
                  name="room-description"
                  placeholder="Room description (optional)..."
                  value={roomDescription}
                  maxLength={500}
                  rows={3}
                  disabled={roomLoading}
                  onChange={(event) =>
                    setRoomDescription(
                      event.target.value
                    )
                  }
                />

                <small className="room-description-count">
                  {roomDescription.length}/500
                </small>

                <div className="create-room-actions">

                  <button
                    type="submit"
                    disabled={
                      roomLoading
                    }
                  >
                    {roomLoading
                      ? "Creating..."
                      : "Create"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateRoom(false);
                      setRoomName("");
                        setRoomDescription("");
                    }}
                  >
                    Cancel
                  </button>

                </div>

              </form>
            )}

            {/* JOIN BY CODE */}

            {showJoinRoom && (
              <form
                className="create-room-form"
                onSubmit={
                  handleJoinRoomByCode
                }
              >

                <input
                  type="text"
                  name="room-code"
                  placeholder="6-character room code"
                  value={roomCode}
                  maxLength={6}
                  autoFocus
                  onChange={(event) =>
                    setRoomCode(
                      event.target.value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          ""
                        )
                        .slice(0, 6)
                    )
                  }
                />

                <div className="create-room-actions">

                  <button
                    type="submit"
                    disabled={
                      roomLoading
                    }
                  >
                    {roomLoading
                      ? "Joining..."
                      : "Join"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinRoom(false);
                      setRoomCode("");
                    }}
                  >
                    Cancel
                  </button>

                </div>

              </form>
            )}

            {socketError && (
              <div className="room-error">
                {socketError}
              </div>
            )}

            <div className="room-list">

              {roomLoading &&
              rooms.length ===
                0 ? (
                <p className="room-empty">
                  Loading rooms...
                </p>
              ) : rooms.length ===
                0 ? (
                <div className="room-empty">

                  <div className="room-empty-icon">
                    👥
                  </div>

                  <p>
                    No rooms
                    available.
                  </p>

                </div>
              ) : (
                rooms.map(
                  (room) => {
                    const member =
                      isRoomMember(room);

                    const isCreator =
                      getUserId(
                        room.creator
                      ) ===
                      currentUserId;

                    const selected =
                      selectedRoom &&
                      String(
                        selectedRoom._id
                      ) ===
                        String(
                          room._id
                        );

                    const unreadCount =
                      Number(
                        roomUnreadCounts[
                          String(
                            room._id
                          )
                        ] || 0
                      );

                    return (
                      <div
                        key={room._id}
                        className={`room-item ${
                          selected
                            ? "selected"
                            : ""
                        }`}
                      >

                        <button
                          type="button"
                          className="room-main-button"
                          disabled={!member}
                          onClick={() =>
                            openRoom(room)
                          }
                        >

                          <span className="room-icon">
                            👥
                          </span>

                          <span className="room-info">

                            <strong>
                              {room.name}
                            </strong>

                            <small>
                              {room.members
                                ?.length || 0}{" "}
                              members
                            </small>

                          </span>

                          {unreadCount >
                            0 && (
                            <span className="unread-badge room-unread-badge">
                              {unreadCount >
                              99
                                ? "99+"
                                : unreadCount}
                            </span>
                          )}

                        </button>

                        <div className="room-actions">

                          {member ? (
                            !isCreator && (
                              <button
                                type="button"
                                className="room-leave-button"
                                disabled={
                                  roomLoading ||
                                  roomActionLoading
                                }
                                onClick={() =>
                                  handleLeaveRoom(
                                    room
                                  )
                                }
                              >
                                Leave
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              className="room-join-button"
                              disabled={
                                roomLoading
                              }
                              onClick={() =>
                                handleJoinRoom(
                                  room
                                )
                              }
                            >
                              Join
                            </button>
                          )}

                        </div>

                      </div>
                    );
                  }
                )
              )}

            </div>

          </div>
        )}

        {activeView === "calls" && (
          <div className="call-list-sidebar">
            <div className="call-list-title">
              <div>
                <h3>Calls</h3>
                <p>Recent audio and video calls</p>
              </div>

              {callHistory.length > 0 && (
                <button
                  type="button"
                  className="clear-call-history"
                  onClick={() => setCallHistory([])}
                  title="Clear call history"
                  aria-label="Clear call history"
                >
                  ×
                </button>
              )}
            </div>

            {callHistory.length === 0 ? (
              <p className="call-list-empty">
                No recent calls
              </p>
            ) : (
              <div className="call-history-list">
                {callHistory.map((call) => (
                  <button
                    type="button"
                    key={call.id}
                    className="call-history-item"
                    onClick={() =>
                      selectUser({
                        _id: call.userId,
                        username: call.username,
                        profilePicture: call.profilePicture,
                      })
                    }
                  >
                    <span className="call-history-avatar">
                      {call.profilePicture ? (
                        <img
                          src={getImageUrl(call.profilePicture)}
                          alt={call.username}
                        />
                      ) : (
                        getInitial(call.username)
                      )}
                    </span>

                    <span className="call-history-info">
                      <strong>{call.username}</strong>
                      <small>
                        {call.direction === "incoming" ? "↙" : "↗"}{" "}
                        {call.type === "video" ? "Video call" : "Audio call"}
                      </small>
                    </span>

                    <time dateTime={new Date(call.timestamp).toISOString()}>
                      {new Date(call.timestamp).toLocaleDateString()}
                    </time>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </aside>

      {/* =================================================
          MAIN AREA
      ================================================== */}

      <main className="chat-area">

        {/* =================================================
            PRIVATE CHAT
        ================================================== */}

        {activeView ===
          "chats" && (
          !selectedUser ? (
            <div className="empty-chat">

              <h2>
                {t.welcome}
              </h2>

              <p>
                {t.selectUser}
              </p>

            </div>
          ) : (
            <>
              <div className="conversation-header">

                <button
                  type="button"
                  className="conversation-back-button mobile-back-button"
                  onClick={() => {
                    setSelectedUser(null);
                    setMessages([]);
                    setMessage("");
                    setSocketError("");
                  }}
                  title="Back to chats"
                  aria-label="Back to chats"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <div className="private-conversation-user">

                  {getImageUrl(
                    selectedUser?.profilePicture
                  ) ? (
                    <img
                      src={getImageUrl(
                        selectedUser?.profilePicture
                      )}
                      alt={
                        selectedUser?.username ||
                        "User"
                      }
                      className="conversation-avatar"
                    />
                  ) : (
                    <span className="conversation-avatar-placeholder">
                      {getInitial(
                        selectedUser?.username
                      )}
                    </span>
                  )}

                  <div>

                    <h3>
                      {selectedUser.username}
                    </h3>

                    <span>
                      {onlineUsers.some(
                        (id) =>
                          String(id) ===
                          getUserId(
                            selectedUser
                          )
                      )
                        ? t.online
                        : "Offline"}
                    </span>

                  </div>

                </div>

                <div className="call-actions">
                  <button
                    type="button"
                    className="call-action-button"
                    onClick={() => startCall("audio")}
                    disabled={callStatus !== "idle"}
                    title="Start audio call"
                    aria-label="Start audio call"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      focusable="false"
                    >
                      <path d="M6.6 3.2 9 2.5l2 4.8-1.8 1.5a14.7 14.7 0 0 0 5.9 5.9l1.5-1.8 4.8 2-.7 2.4c-.3 1.1-1.5 1.7-2.6 1.3A18.5 18.5 0 0 1 5.2 5.8c-.4-1.1.3-2.3 1.4-2.6Z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className="call-action-button"
                    onClick={() => startCall("video")}
                    disabled={callStatus !== "idle"}
                    title="Start video call"
                    aria-label="Start video call"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      focusable="false"
                    >
                      <rect x="3" y="6" width="12" height="12" rx="2" />
                      <path d="m15 10 6-3v10l-6-3Z" />
                    </svg>
                  </button>
                </div>

              </div>

              {(callStatus !== "idle" || incomingCall) && (
                <div className="call-panel">
                  {incomingCall && callStatus === "idle" ? (
                    <div className="incoming-call">
                      <strong>
                        {incomingCall.username || "Someone"} is calling
                      </strong>
                      <span>
                        Incoming {incomingCall.callType || "video"} call
                      </span>
                      <div className="incoming-call-actions">
                        <button
                          type="button"
                          className="call-accept-button"
                          onClick={acceptCall}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="call-reject-button"
                          onClick={rejectCall}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="active-call">
                      <div className="active-call-topbar">
                        <div className="active-call-peer">
                          <span className="active-call-avatar">
                            {getInitial(selectedUser?.username || incomingCall?.username || "U")}
                          </span>
                          <span>
                            <strong>{selectedUser?.username || incomingCall?.username || "User"}</strong>
                            <small>
                              {callStatus === "calling" ? "Calling" : "Connected"}
                            </small>
                          </span>
                        </div>
                        <span className="active-call-type">
                          {callType === "video" ? "Video call" : "Voice call"}
                        </span>
                      </div>

                      {callType === "video" && (
                        <>
                          <video
                            ref={remoteVideoRef}
                            className="remote-call-video"
                            autoPlay
                            playsInline
                          />
                          <video
                            ref={localVideoRef}
                            className="local-call-video"
                            autoPlay
                            muted
                            playsInline
                          />
                        </>
                      )}

                      <audio
                        ref={remoteAudioRef}
                        autoPlay
                      />

                      <div className="call-status-label">
                        {callStatus === "calling"
                          ? "Calling..."
                          : "Call connected"}
                      </div>

                      <div className="active-call-actions">
                        <button
                          type="button"
                          onClick={toggleMute}
                          className={isMuted ? "active" : ""}
                          title={isMuted ? "Unmute" : "Mute"}
                          aria-label={isMuted ? "Unmute" : "Mute"}
                        >
                          <span className="call-control-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 5.2 2" />
                              <path d="M5 11a7 7 0 0 0 12.2 4.7M12 18v3M8 21h8M19 11v1a7 7 0 0 1-.2 1.6M5 5l14 14" />
                            </svg>
                          </span>
                          <span>{isMuted ? "Unmute" : "Mute"}</span>
                        </button>

                        {callType === "video" && (
                          <button
                            type="button"
                            onClick={toggleCamera}
                            className={!cameraEnabled ? "active" : ""}
                            title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                            aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                          >
                            <span className="call-control-icon">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="6" width="12" height="12" rx="2" />
                                <path d="m15 10 6-3v10l-6-3Z" />
                              </svg>
                            </span>
                            <span>{cameraEnabled ? "Camera" : "Camera off"}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="end-call-button"
                          onClick={() => stopCall(true)}
                        >
                          <span className="call-control-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M5 10.5a11 11 0 0 1 14 0l-1.6 3.2-3-1.1-.9-2.1a8 8 0 0 0-3 0l-.9 2.1-3 1.1Z" />
                            </svg>
                          </span>
                          <span>End</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {socketError && (
                <div className="socket-error">
                  {socketError}
                </div>
              )}

              <div className="messages">

                {messages.length ===
                0 ? (
                  <div className="empty-messages">

                    <p>
                      {t.noMessages}
                    </p>

                  </div>
                ) : (
                  messages.map(
                    (msg) => {
                      const senderId =
                        getUserId(
                          msg?.sender
                        );

                      const isMine =
                        senderId ===
                        currentUserId;

                      const id =
                        msg?._id ||
                        msg?.id;

                      return (
                        <div
                          key={String(id)}
                          className={
                            isMine
                              ? "message sent"
                              : "message received"
                          }
                        >

                          {msg.messageType === "audio" &&
                          msg.attachmentUrl ? (
                            <VoiceMessagePlayer
                              src={getImageUrl(msg.attachmentUrl)}
                            />
                          ) : msg.messageType === "video" &&
                            msg.attachmentUrl ? (
                            <video
                              controls
                              src={getImageUrl(
                                msg.attachmentUrl
                              )}
                            />
                          ) : msg.messageType === "image" &&
                            msg.attachmentUrl ? (
                            <img
                              src={getImageUrl(
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
                              href={getImageUrl(
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
                            <p>
                              {isMine
                                ? msg.message
                                : msg.translatedMessage ||
                                  msg.message}
                            </p>
                          )}

                          <div className="message-meta">
                            <small className="message-time">
                              {msg.createdAt
                                ? new Date(
                                    msg.createdAt
                                  ).toLocaleTimeString()
                                : ""}
                            </small>

                            {isMine && (
                              <small
                                className={`message-status ${
                                  msg.deliveryStatus ===
                                  "read"
                                    ? "read"
                                    : ""
                                }`}
                              >
                                {msg.deliveryStatus ===
                                "read"
                                  ? "✓✓ Read"
                                  : msg.deliveryStatus ===
                                    "delivered"
                                  ? "✓✓ Delivered"
                                  : "✓ Sent"}
                              </small>
                            )}
                          </div>

                        </div>
                      );
                    }
                  )
                )}

                <div
                  ref={
                    privateMessagesEndRef
                  }
                />

              </div>

              {privateTypingUser && (
                <div className="typing-indicator">

                  <span>
                    {privateTypingUser}{" "}
                    is typing...
                  </span>

                </div>
              )}

              <form
                className="message-form"
                onSubmit={
                  sendMessage
                }
              >

                <span className="message-input-shell">
                  <FileAttachmentPicker
                    disabled={!socket.connected}
                    onSendAttachment={
                      sendAttachmentMessage
                    }
                  />

                  <input
                    type="text"
                    name="private-message"
                    value={message}
                    placeholder={`${t.typeMessage} ${selectedUser.username}...`}
                    onChange={
                      handlePrivateTyping
                    }
                  />
                </span>

                <VoiceRecorder
                  disabled={!socket.connected}
                  onSendVoice={
                    sendVoiceMessage
                  }
                />

                <button
                  type="submit"
                  className="send-button"
                  aria-label={t.send}
                  title={t.send}
                >
                  <span aria-hidden="true">&#10148;</span>
                </button>

              </form>

            </>
          )
        )}

        {/* =================================================
            ROOMS
        ================================================== */}

        {activeView ===
          "rooms" && (
          !selectedRoom ? (
            <div className="empty-chat">

              <div className="large-room-icon">
                👥
              </div>

              <h2>
                Rooms
              </h2>

              <p>
                Create a room,
                join one, or select
                an existing room.
              </p>

              <button
                type="button"
                className="empty-create-room-button"
                onClick={() => {
                  setShowCreateRoom(true);
                  setShowJoinRoom(false);
                }}
              >
                + Create Room
              </button>

            </div>
          ) : (
            <>
              {/* ROOM HEADER */}

              <div className="conversation-header room-header">

                <div className="room-header-information">

                  <h3>
                    👥{" "}
                    {selectedRoom.name}
                  </h3>

                  <div className="room-header-meta">

                    <span>
                      {
                        selectedRoom.members
                          ?.length ||
                        0
                      }{" "}
                      members
                    </span>

                    <button
                      type="button"
                      className="members-toggle-button"
                      onClick={() =>
                        setShowRoomMembers(
                          (previous) =>
                            !previous
                        )
                      }
                    >
                      {showRoomMembers
                        ? "Hide Members"
                        : "View Members"}
                    </button>

                  </div>

                </div>

                <div className="room-header-actions-main">

                  {isCurrentUserCreator() ? (
                    <button
                      type="button"
                      className="delete-room-button"
                      disabled={
                        roomActionLoading
                      }
                      onClick={
                        handleDeleteRoom
                      }
                    >
                      {roomActionLoading
                        ? "Deleting..."
                        : "Delete Room"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="header-leave-button"
                      disabled={
                        roomLoading ||
                        roomActionLoading
                      }
                      onClick={() =>
                        handleLeaveRoom(
                          selectedRoom
                        )
                      }
                    >
                      Leave Room
                    </button>
                  )}

                </div>

              </div>

              {/* ROOM MEMBERS */}

              {showRoomMembers && (
                <div className="room-members-panel">

                  <div className="room-members-title">

                    <strong>
                      Room Members
                    </strong>

                    <span>
                      {
                        getRoomMembers()
                          .length
                      }
                    </span>

                  </div>

                  <div className="room-members-list">

                    {getRoomMembers()
                      .length ===
                    0 ? (
                      <p className="room-members-empty">
                        No members
                        found.
                      </p>
                    ) : (
                      getRoomMembers().map(
                        (member) => {
                          const memberId =
                            getUserId(
                              member
                            );

                          const username =
                            member?.username ||
                            "User";

                          const memberImage =
                            getImageUrl(
                              member?.profilePicture
                            );

                          const online =
                            isMemberOnline(
                              member
                            );

                          const isCurrentUser =
                            memberId ===
                            currentUserId;

                          const isCreator =
                            getUserId(
                              selectedRoom.creator
                            ) ===
                            memberId;

                          return (
                            <div
                              key={
                                memberId
                              }
                              className="room-member-item"
                            >

                              <div className="room-member-avatar">

                                {memberImage ? (
                                  <img
                                    src={
                                      memberImage
                                    }
                                    alt={
                                      username
                                    }
                                    className="room-member-avatar-image"
                                  />
                                ) : (
                                  <span className="room-member-avatar-placeholder">
                                    {getInitial(
                                      username
                                    )}
                                  </span>
                                )}

                              </div>

                              <div className="room-member-information">

                                <strong>
                                  {username}

                                  {isCurrentUser && (
                                    <span className="member-you">
                                      {" "}
                                      You
                                    </span>
                                  )}
                                </strong>

                                <small>
                                  {isCreator
                                    ? "Creator"
                                    : "Member"}
                                </small>

                              </div>

                              <div className="room-member-actions">

                                <div className="room-member-status">

                                  <span
                                    className={
                                      online
                                        ? "online-dot online"
                                        : "online-dot offline"
                                    }
                                  />

                                  <span>
                                    {online
                                      ? "Online"
                                      : "Offline"}
                                  </span>

                                </div>

                                {isCurrentUserCreator() &&
                                  !isCurrentUser &&
                                  !isCreator && (
                                    <button
                                      type="button"
                                      className="remove-member-button"
                                      disabled={
                                        roomActionLoading
                                      }
                                      onClick={() =>
                                        handleRemoveRoomMember(
                                          member
                                        )
                                      }
                                    >
                                      {roomActionLoading
                                        ? "..."
                                        : "Remove"}
                                    </button>
                                  )}

                              </div>

                            </div>
                          );
                        }
                      )
                    )}

                  </div>

                </div>
              )}

              {socketError && (
                <div className="socket-error">
                  {socketError}
                </div>
              )}

              {/* =================================================
          ROOM MESSAGES
      ================================================== */}

      <div className="messages">

        {roomMessages.length === 0 ? (
          <div className="empty-messages">

            <div className="large-room-icon">
              👥
            </div>

            <p>
              No messages yet.
            </p>

            <small>
              Be the first to say hello!
            </small>

          </div>
        ) : (
          roomMessages.map((msg) => {
            const senderId =
              getUserId(msg?.sender);

            const isMine =
              senderId === currentUserId;

            const id =
              msg?._id ||
              msg?.id ||
              `${senderId}-${msg?.createdAt}-${msg?.message}`;

            const roomMember =
              getRoomMember(senderId);

            // Always prefer the freshest profile data.
            // For our own messages use AuthContext.
            // For other members use the populated room member.
            const sender =
              isMine
                ? user
                : roomMember ||
                  msg?.sender ||
                  null;

            const senderName =
              sender?.username ||
              msg?.sender?.username ||
              "User";

            const senderImage =
              getImageUrl(
                sender?.profilePicture ||
                  msg?.sender?.profilePicture
              );

            return (
              <div
                key={String(id)}
                className={
                  isMine
                    ? "room-message-row mine"
                    : "room-message-row theirs"
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: isMine
                    ? "flex-end"
                    : "flex-start",
                  gap: "8px",
                  marginBottom: "15px",
                }}
              >

                {/* =========================================
                    OTHER USER AVATAR
                ========================================== */}

                {!isMine && (
                  <div
                    className="room-message-avatar"
                    style={{
                      width: "30px",
                      height: "30px",
                      minWidth: "30px",
                      minHeight: "30px",
                      maxWidth: "30px",
                      maxHeight: "30px",
                      flex: "0 0 30px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#dbeafe",
                    }}
                  >
                    {senderImage ? (
                      <img
                        src={senderImage}
                        alt={senderName}
                        className="room-message-avatar-image"
                        style={{
                          width: "30px",
                          height: "30px",
                          minWidth: "30px",
                          minHeight: "30px",
                          maxWidth: "30px",
                          maxHeight: "30px",
                          display: "block",
                          objectFit: "cover",
                          objectPosition: "center",
                          borderRadius: "50%",
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";

                          const fallback =
                            event.currentTarget
                              .nextElementSibling;

                          if (fallback) {
                            fallback.style.display =
                              "flex";
                          }
                        }}
                      />
                    ) : null}

                    <span
                      className="room-message-avatar-placeholder"
                      style={{
                        width: "30px",
                        height: "30px",
                        minWidth: "30px",
                        minHeight: "30px",
                        display: senderImage
                          ? "none"
                          : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        background: "#dbeafe",
                        color: "#2563eb",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {getInitial(senderName)}
                    </span>
                  </div>
                )}

                {/* =========================================
                    MESSAGE BUBBLE
                ========================================== */}

                <div
                  className={
                    isMine
                      ? "message sent room-message"
                      : "message received room-message"
                  }
                  style={{
                    margin: 0,
                    maxWidth: "min(500px, 70%)",
                    flexShrink: 1,
                  }}
                >
                  {!isMine && (
                    <strong className="room-sender">
                      {senderName}
                    </strong>
                  )}

                  <p>
                    {msg.message}
                  </p>

                  <small className="message-time">
                    {msg.createdAt
                      ? new Date(
                          msg.createdAt
                        ).toLocaleTimeString()
                      : ""}
                  </small>
                </div>

                {/* =========================================
                    MY AVATAR
                ========================================== */}

                {isMine && (
                  <div
                    className="room-message-avatar"
                    style={{
                      width: "30px",
                      height: "30px",
                      minWidth: "30px",
                      minHeight: "30px",
                      maxWidth: "30px",
                      maxHeight: "30px",
                      flex: "0 0 30px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#dbeafe",
                    }}
                  >
                    {senderImage ? (
                      <img
                        src={senderImage}
                        alt={senderName}
                        className="room-message-avatar-image"
                        style={{
                          width: "30px",
                          height: "30px",
                          minWidth: "30px",
                          minHeight: "30px",
                          maxWidth: "30px",
                          maxHeight: "30px",
                          display: "block",
                          objectFit: "cover",
                          objectPosition: "center",
                          borderRadius: "50%",
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";

                          const fallback =
                            event.currentTarget
                              .nextElementSibling;

                          if (fallback) {
                            fallback.style.display =
                              "flex";
                          }
                        }}
                      />
                    ) : null}

                    <span
                      className="room-message-avatar-placeholder"
                      style={{
                        width: "30px",
                        height: "30px",
                        minWidth: "30px",
                        minHeight: "30px",
                        display: senderImage
                          ? "none"
                          : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        background: "#dbeafe",
                        color: "#2563eb",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {getInitial(senderName)}
                    </span>
                  </div>
                )}

              </div>
            );
          })
        )}

        <div ref={roomMessagesEndRef} />

      </div>

      {/* ROOM TYPING */}

              {roomTypingUsers.length >
                0 && (
                <div className="typing-indicator">

                  <span>
                    {roomTypingUsers
                      .map(
                        (item) =>
                          item.username
                      )
                      .join(", ")}{" "}
                    {roomTypingUsers.length ===
                    1
                      ? "is"
                      : "are"}{" "}
                    typing...
                  </span>

                </div>
              )}

              {/* ROOM FORM */}

              <form
                className="message-form"
                onSubmit={
                  sendRoomMessage
                }
              >

                <span className="message-input-shell">
                  <FileAttachmentPicker
                    disabled={!socket.connected}
                    onSendAttachment={
                      sendRoomAttachmentMessage
                    }
                  />

                  <input
                    type="text"
                    name="room-message"
                    value={roomMessage}
                    placeholder={`Message ${selectedRoom.name}...`}
                    onChange={
                      handleRoomTyping
                    }
                  />
                </span>

                <VoiceRecorder
                  disabled={!socket.connected}
                  onSendVoice={
                    sendRoomVoiceMessage
                  }
                />

                <button
                  type="submit"
                  className="send-button"
                  aria-label={t.send}
                  title={t.send}
                >
                  <span aria-hidden="true">&#10148;</span>
                </button>

              </form>

            </>
          )
        )}

      </main>
    </div>
  );
};

export default Chat;

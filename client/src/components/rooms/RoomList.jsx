import { useCallback, useEffect, useState } from "react";

import {
  getRooms,
  discoverRooms,
  createRoom,
  joinRoom,
  joinRoomByCode,
  leaveRoom,
  deleteRoom,
  updateRoom,
} from "../../services/roomService";

// =====================================================
// ROOM LIST
// =====================================================

const RoomList = ({
  socket,
  currentUser,
  onSelectRoom,
}) => {
  // =====================================================
  // STATE
  // =====================================================

  const [rooms, setRooms] = useState([]);

  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] =
    useState("");

  const [roomCode, setRoomCode] = useState("");

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [showJoinForm, setShowJoinForm] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("my");

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [editingRoomId, setEditingRoomId] =
    useState(null);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] =
    useState("");

  // =====================================================
  // HELPERS
  // =====================================================

  const getUserId = useCallback(() => {
    return String(
      currentUser?._id ||
        currentUser?.id ||
        ""
    ).trim();
  }, [
    currentUser?._id,
    currentUser?.id,
  ]);

  const getRoomId = (room) => {
    return String(
      room?._id ||
        room?.id ||
        ""
    ).trim();
  };

  const getMemberId = (member) => {
    if (!member) {
      return "";
    }

    if (typeof member === "string") {
      return String(member);
    }

    return String(
      member?._id ||
        member?.id ||
        ""
    );
  };

  const isMember = useCallback(
    (room) => {
      const userId = getUserId();

      if (!userId || !room) {
        return false;
      }

      // Prefer backend-provided value.
      if (
        typeof room.isMember ===
        "boolean"
      ) {
        return room.isMember;
      }

      if (
        typeof room.member ===
        "boolean"
      ) {
        return room.member;
      }

      if (!Array.isArray(room.members)) {
        return false;
      }

      return room.members.some(
        (member) =>
          getMemberId(member) ===
          userId
      );
    },
    [getUserId]
  );

  const isCreator = useCallback(
    (room) => {
      const userId = getUserId();

      if (!userId || !room) {
        return false;
      }

      // Prefer backend-provided value.
      if (
        typeof room.isCreator ===
        "boolean"
      ) {
        return room.isCreator;
      }

      if (
        typeof room.isOwner ===
        "boolean"
      ) {
        return room.isOwner;
      }

      return (
        String(
          room?.creator?._id ||
            room?.creator?.id ||
            room?.creator ||
            ""
        ) === userId
      );
    },
    [getUserId]
  );

  const getMemberCount = (room) => {
    if (
      typeof room?.memberCount ===
      "number"
    ) {
      return room.memberCount;
    }

    if (
      typeof room?.membersCount ===
      "number"
    ) {
      return room.membersCount;
    }

    return Array.isArray(room?.members)
      ? room.members.length
      : 0;
  };

  const clearError = () => {
    setError("");
  };

  const getErrorMessage = (
    error,
    fallback
  ) => {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      fallback
    );
  };

  // =====================================================
  // NORMALIZE ROOM RESPONSE
  // =====================================================

  const extractRoom = (data) => {
    if (!data) {
      return null;
    }

    if (data.room?._id) {
      return data.room;
    }

    if (data._id) {
      return data;
    }

    return null;
  };

  // =====================================================
  // LOAD MY ROOMS
  // =====================================================

  const loadMyRooms = useCallback(
    async () => {
      try {
        setLoading(true);
        clearError();

        const data =
          await getRooms();

        setRooms(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        console.error(
          "[ROOM LIST] Failed to load rooms:",
          error
        );

        setError(
          getErrorMessage(
            error,
            "Failed to load your rooms."
          )
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =====================================================
  // LOAD DISCOVER ROOMS
  // =====================================================

  const loadDiscoverRooms =
    useCallback(
      async () => {
        try {
          setLoading(true);
          clearError();

          const data =
            await discoverRooms();

          setRooms(
            Array.isArray(data)
              ? data
              : []
          );
        } catch (error) {
          console.error(
            "[ROOM LIST] Failed to discover rooms:",
            error
          );

          setError(
            getErrorMessage(
              error,
              "Failed to discover rooms."
            )
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  // =====================================================
  // LOAD ROOMS WHEN USER IS READY
  // =====================================================

  useEffect(() => {
    if (!getUserId()) {
      return;
    }

    if (activeTab === "my") {
      loadMyRooms();
      return;
    }

    loadDiscoverRooms();
  }, [
    getUserId,
    activeTab,
    loadMyRooms,
    loadDiscoverRooms,
  ]);

  // =====================================================
  // SOCKET ROOM EVENTS
  // =====================================================

  useEffect(() => {
    if (!socket) {
      return;
    }

    // ---------------------------------------------------
    // ROOM UPDATED
    // ---------------------------------------------------

    const handleRoomUpdated = (
      payload = {}
    ) => {
      const updatedRoom =
        payload.room ||
        payload;

      const roomId =
        payload.roomId ||
        updatedRoom?._id;

      if (!roomId) {
        return;
      }

      setRooms((prev) =>
        prev.map((room) =>
          getRoomId(room) ===
          String(roomId)
            ? {
                ...room,
                ...updatedRoom,
              }
            : room
        )
      );
    };

    // ---------------------------------------------------
    // ROOM USER JOINED
    // ---------------------------------------------------

    const handleRoomUserJoined = (
      payload = {}
    ) => {
      const {
        roomId,
        userId,
        username,
        profilePicture,
      } = payload;

      if (!roomId || !userId) {
        return;
      }

      setRooms((prev) =>
        prev.map((room) => {
          if (
            getRoomId(room) !==
            String(roomId)
          ) {
            return room;
          }

          const members =
            Array.isArray(
              room.members
            )
              ? [...room.members]
              : [];

          const alreadyMember =
            members.some(
              (member) =>
                getMemberId(member) ===
                String(userId)
            );

          if (alreadyMember) {
            return room;
          }

          /*
           * The socket event only gives us
           * basic user information.
           *
           * Add a lightweight member object
           * so the count/UI stays current.
           */

          members.push({
            _id: String(userId),
            username:
              username || "User",
            profilePicture:
              profilePicture || null,
          });

          return {
            ...room,
            members,
            memberCount:
              members.length,
          };
        })
      );
    };

    // ---------------------------------------------------
    // USER LEFT ROOM
    // ---------------------------------------------------

    const handleUserLeftRoom = (
      payload = {}
    ) => {
      const {
        roomId,
        userId,
      } = payload;

      if (!roomId || !userId) {
        return;
      }

      setRooms((prev) =>
        prev.map((room) => {
          if (
            getRoomId(room) !==
            String(roomId)
          ) {
            return room;
          }

          if (
            !Array.isArray(
              room.members
            )
          ) {
            return room;
          }

          const members =
            room.members.filter(
              (member) =>
                getMemberId(member) !==
                String(userId)
            );

          return {
            ...room,
            members,
            memberCount:
              members.length,
          };
        })
      );
    };

    // ---------------------------------------------------
    // ROOM MEMBER REMOVED
    // ---------------------------------------------------

    const handleRoomMemberRemoved = (
      payload = {}
    ) => {
      const {
        roomId,
        userId,
      } = payload;

      if (!roomId || !userId) {
        return;
      }

      const currentUserId =
        getUserId();

      setRooms((prev) =>
        prev
          .map((room) => {
            if (
              getRoomId(room) !==
              String(roomId)
            ) {
              return room;
            }

            if (
              !Array.isArray(
                room.members
              )
            ) {
              return room;
            }

            const members =
              room.members.filter(
                (member) =>
                  getMemberId(member) !==
                  String(userId)
              );

            return {
              ...room,
              members,
              memberCount:
                members.length,

              ...(String(userId) ===
              currentUserId
                ? {
                    isMember: false,
                  }
                : {}),
            };
          })
          .filter((room) => {
            /*
             * If the current user was removed
             * from their room, it should no
             * longer appear in My Rooms.
             *
             * Discover Rooms can still show it.
             */

            if (
              activeTab !== "my"
            ) {
              return true;
            }

            if (
              String(userId) !==
              currentUserId
            ) {
              return true;
            }

            return (
              getRoomId(room) !==
              String(roomId)
            );
          })
      );
    };

    // ---------------------------------------------------
    // ROOM DELETED
    // ---------------------------------------------------

    const handleRoomDeleted = (
      payload = {}
    ) => {
      const roomId =
        payload.roomId ||
        payload.room?._id;

      if (!roomId) {
        return;
      }

      setRooms((prev) =>
        prev.filter(
          (room) =>
            getRoomId(room) !==
            String(roomId)
        )
      );
    };

    // ---------------------------------------------------
    // ROOM LEFT
    // ---------------------------------------------------

    const handleRoomLeft = (
      payload = {}
    ) => {
      const roomId =
        payload.roomId;

      if (!roomId) {
        return;
      }

      /*
       * "room_left" can be emitted to the
       * user who performed the leave.
       *
       * Remove the room from My Rooms.
       */

      if (activeTab === "my") {
        setRooms((prev) =>
          prev.filter(
            (room) =>
              getRoomId(room) !==
              String(roomId)
          )
        );
      } else {
        setRooms((prev) =>
          prev.map((room) => {
            if (
              getRoomId(room) !==
              String(roomId)
            ) {
              return room;
            }

            const members =
              Array.isArray(
                room.members
              )
                ? room.members.filter(
                    (member) =>
                      getMemberId(
                        member
                      ) !==
                      getUserId()
                  )
                : [];

            return {
              ...room,
              members,
              memberCount:
                members.length,
              isMember: false,
            };
          })
        );
      }
    };

    // ---------------------------------------------------
    // REMOVED FROM ROOM
    // ---------------------------------------------------

    const handleRemovedFromRoom = (
      payload = {}
    ) => {
      const roomId =
        payload.roomId;

      if (!roomId) {
        return;
      }

      /*
       * If the current user was removed,
       * remove the room from My Rooms.
       */

      if (activeTab === "my") {
        setRooms((prev) =>
          prev.filter(
            (room) =>
              getRoomId(room) !==
              String(roomId)
          )
        );
      } else {
        setRooms((prev) =>
          prev.map((room) => {
            if (
              getRoomId(room) !==
              String(roomId)
            ) {
              return room;
            }

            const members =
              Array.isArray(
                room.members
              )
                ? room.members.filter(
                    (member) =>
                      getMemberId(
                        member
                      ) !==
                      getUserId()
                  )
                : [];

            return {
              ...room,
              members,
              memberCount:
                members.length,
              isMember: false,
            };
          })
        );
      }
    };

    // ---------------------------------------------------
    // REGISTER LISTENERS
    // ---------------------------------------------------

    socket.on(
      "room_updated",
      handleRoomUpdated
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
      "room_deleted",
      handleRoomDeleted
    );

    socket.on(
      "room_left",
      handleRoomLeft
    );

    socket.on(
      "removed_from_room",
      handleRemovedFromRoom
    );

    // ---------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------

    return () => {
      socket.off(
        "room_updated",
        handleRoomUpdated
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
        "room_deleted",
        handleRoomDeleted
      );

      socket.off(
        "room_left",
        handleRoomLeft
      );

      socket.off(
        "removed_from_room",
        handleRemovedFromRoom
      );
    };
  }, [
    socket,
    getUserId,
    activeTab,
  ]);

  // =====================================================
  // CREATE ROOM
  // =====================================================

  const handleCreateRoom = async (
    event
  ) => {
    event.preventDefault();

    const name =
      roomName.trim();

    const description =
      roomDescription.trim();

    if (!name) {
      setError(
        "Room name is required."
      );

      return;
    }

    if (name.length > 50) {
      setError(
        "Room name cannot exceed 50 characters."
      );

      return;
    }

    if (description.length > 250) {
      setError(
        "Room description cannot exceed 250 characters."
      );

      return;
    }

    try {
      setActionLoading(true);
      clearError();

      const data =
        await createRoom(
          name,
          description
        );

      const newRoom =
        extractRoom(data);

      if (!newRoom?._id) {
        throw new Error(
          "Invalid room response."
        );
      }

      setRooms((prev) => [
        newRoom,
        ...prev.filter(
          (room) =>
            getRoomId(room) !==
            getRoomId(newRoom)
        ),
      ]);

      setRoomName("");
      setRoomDescription("");
      setShowCreateForm(false);

      // ---------------------------------------------------
      // JOIN SOCKET ROOM
      // ---------------------------------------------------

      if (socket) {
        socket.emit(
          "join_room",
          newRoom._id
        );
      }

      // ---------------------------------------------------
      // OPEN ROOM
      // ---------------------------------------------------

      if (onSelectRoom) {
        onSelectRoom(newRoom);
      }
    } catch (error) {
      console.error(
        "[ROOM LIST] Create room error:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to create room."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  // =====================================================
  // JOIN ROOM
  // =====================================================

  const handleJoinRoom = async (
    room
  ) => {
    const roomId =
      getRoomId(room);

    if (!roomId) {
      return;
    }

    try {
      setActionLoading(true);
      clearError();

      const data =
        await joinRoom(roomId);

      const joinedRoom =
        extractRoom(data);

      if (!joinedRoom?._id) {
        throw new Error(
          "Invalid room response."
        );
      }

      setRooms((prev) => [
        joinedRoom,
        ...prev.filter(
          (item) =>
            getRoomId(item) !==
            getRoomId(joinedRoom)
        ),
      ]);

      if (socket) {
        socket.emit(
          "join_room",
          joinedRoom._id
        );
      }

      if (onSelectRoom) {
        onSelectRoom(
          joinedRoom
        );
      }
    } catch (error) {
      console.error(
        "[ROOM LIST] Join room error:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to join room."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  // =====================================================
  // JOIN BY CODE
  // =====================================================

  const handleJoinByCode = async (
    event
  ) => {
    event.preventDefault();

    const normalizedCode =
      roomCode
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z0-9]{6}$/.test(
        normalizedCode
      )
    ) {
      setError(
        "Enter a valid 6-character room code."
      );

      return;
    }

    try {
      setActionLoading(true);
      clearError();

      const data =
        await joinRoomByCode(
          normalizedCode
        );

      const joinedRoom =
        extractRoom(data);

      if (!joinedRoom?._id) {
        throw new Error(
          "Invalid room response."
        );
      }

      setRooms((prev) => [
        joinedRoom,
        ...prev.filter(
          (room) =>
            getRoomId(room) !==
            getRoomId(joinedRoom)
        ),
      ]);

      setRoomCode("");
      setShowJoinForm(false);

      if (socket) {
        socket.emit(
          "join_room",
          joinedRoom._id
        );
      }

      if (onSelectRoom) {
        onSelectRoom(
          joinedRoom
        );
      }
    } catch (error) {
      console.error(
        "[ROOM LIST] Join by code error:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to join room."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  // =====================================================
  // SELECT ROOM
  // =====================================================

  const handleSelectRoom = (
    room
  ) => {
    if (!room?._id) {
      return;
    }

    if (!isMember(room)) {
      setError(
        "You are not a member of this room."
      );

      return;
    }

    clearError();

    if (socket) {
      socket.emit(
        "join_room",
        room._id
      );
    }

    if (onSelectRoom) {
      onSelectRoom(room);
    }
  };

  // =====================================================
  // LEAVE ROOM
  // =====================================================

  const handleLeaveRoom = async (
    room
  ) => {
    const roomId =
      getRoomId(room);

    if (!roomId) {
      return;
    }

    if (isCreator(room)) {
      setError(
        "The room creator cannot leave the room."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Leave "${room.name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      clearError();

      await leaveRoom(roomId);

      /*
       * Remove immediately from My Rooms.
       *
       * The Socket.IO event will also arrive,
       * but filtering twice is harmless.
       */

      if (activeTab === "my") {
        setRooms((prev) =>
          prev.filter(
            (item) =>
              getRoomId(item) !==
              roomId
          )
        );
      } else {
        setRooms((prev) =>
          prev.map((item) => {
            if (
              getRoomId(item) !==
              roomId
            ) {
              return item;
            }

            const members =
              Array.isArray(
                item.members
              )
                ? item.members.filter(
                    (member) =>
                      getMemberId(
                        member
                      ) !==
                      getUserId()
                  )
                : [];

            return {
              ...item,
              members,
              memberCount:
                members.length,
              isMember: false,
            };
          })
        );
      }

      if (socket) {
        socket.emit(
          "leave_room",
          roomId
        );
      }
    } catch (error) {
      console.error(
        "[ROOM LIST] Leave room error:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to leave room."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  // =====================================================
  // DELETE ROOM
  // =====================================================

  const handleDeleteRoom = async (
    room
  ) => {
    const roomId =
      getRoomId(room);

    if (!roomId) {
      return;
    }

    if (!isCreator(room)) {
      setError(
        "Only the room creator can delete the room."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${room.name}" permanently?\n\nAll messages in this room will also be deleted.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      clearError();

      await deleteRoom(roomId);

      setRooms((prev) =>
        prev.filter(
          (item) =>
            getRoomId(item) !==
            roomId
        )
      );
    } catch (error) {
      console.error(
        "[ROOM LIST] Delete room error:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to delete room."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  // =====================================================
  // START EDIT
  // =====================================================

  const handleStartEdit = (
    room
  ) => {
    if (!isCreator(room)) {
      setError(
        "Only the room creator can edit this room."
      );

      return;
    }

    setEditingRoomId(
      getRoomId(room)
    );

    setEditName(
      room?.name || ""
    );

    setEditDescription(
      room?.description || ""
    );

    clearError();
  };

  // =====================================================
  // CANCEL EDIT
  // =====================================================

  const handleCancelEdit = () => {
    setEditingRoomId(null);
    setEditName("");
    setEditDescription("");
  };

  // =====================================================
  // SAVE EDIT
  // =====================================================

  const handleSaveEdit = async (
    room
  ) => {
    const roomId =
      getRoomId(room);

    if (!roomId) {
      return;
    }

    if (!isCreator(room)) {
      setError(
        "Only the room creator can edit this room."
      );

      return;
    }

    const name =
      editName.trim();

    const description =
      editDescription.trim();

    if (!name) {
      setError(
        "Room name cannot be empty."
      );

      return;
    }

    if (name.length > 50) {
      setError(
        "Room name cannot exceed 50 characters."
      );

      return;
    }

    if (description.length > 250) {
      setError(
        "Room description cannot exceed 250 characters."
      );

      return;
    }

    try {
      setActionLoading(true);
      clearError();

      const data =
        await updateRoom(
          roomId,
          {
            name,
            description,
          }
        );

      const updatedRoom =
        extractRoom(data);

      if (!updatedRoom?._id) {
        throw new Error(
          "Invalid updated room response."
        );
      }

      setRooms((prev) =>
        prev.map((item) =>
          getRoomId(item) ===
          roomId
            ? {
                ...item,
                ...updatedRoom,
              }
            : item
        )
      );

      handleCancelEdit();
    } catch (error) {
      console.error(
        "[ROOM LIST] Update room error:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to update room."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="room-list">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="room-list-header">
        <div>
          <h2>Rooms</h2>

          <p>
            Join a conversation or create
            your own room.
          </p>
        </div>

        <div className="room-header-actions">

          <button
            type="button"
            disabled={actionLoading}
            onClick={() => {
              setShowCreateForm(
                (prev) => !prev
              );

              setShowJoinForm(false);
              clearError();
            }}
          >
            {showCreateForm
              ? "Close"
              : "+ Create Room"}
          </button>

          <button
            type="button"
            disabled={actionLoading}
            onClick={() => {
              setShowJoinForm(
                (prev) => !prev
              );

              setShowCreateForm(false);
              clearError();
            }}
          >
            {showJoinForm
              ? "Close"
              : "Join by Code"}
          </button>

        </div>
      </div>

      {/* =================================================
          CREATE ROOM
      ================================================= */}

      {showCreateForm && (
        <form
          className="room-create-form"
          onSubmit={
            handleCreateRoom
          }
        >
          <input
            type="text"
            placeholder="Room name..."
            value={roomName}
            maxLength={50}
            disabled={actionLoading}
            onChange={(event) =>
              setRoomName(
                event.target.value
              )
            }
          />

          <textarea
            placeholder="Room description (optional)..."
            value={roomDescription}
            maxLength={250}
            disabled={actionLoading}
            onChange={(event) =>
              setRoomDescription(
                event.target.value
              )
            }
          />

          <div className="room-form-footer">

            <small>
              {roomName.length}/50
            </small>

            <small>
              {roomDescription.length}/250
            </small>

            <button
              type="submit"
              disabled={
                actionLoading ||
                !roomName.trim()
              }
            >
              {actionLoading
                ? "Creating..."
                : "Create Room"}
            </button>

          </div>
        </form>
      )}

      {/* =================================================
          JOIN BY CODE
      ================================================= */}

      {showJoinForm && (
        <form
          className="room-join-code-form"
          onSubmit={
            handleJoinByCode
          }
        >
          <input
            type="text"
            placeholder="Enter 6-character room code"
            value={roomCode}
            maxLength={6}
            disabled={actionLoading}
            onChange={(event) =>
              setRoomCode(
                event.target.value
                  .toUpperCase()
                  .replace(
                    /[^A-Z0-9]/g,
                    ""
                  )
              )
            }
          />

          <button
            type="submit"
            disabled={
              actionLoading ||
              roomCode.length !== 6
            }
          >
            {actionLoading
              ? "Joining..."
              : "Join Room"}
          </button>
        </form>
      )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="room-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={clearError}
          >
            ×
          </button>
        </div>
      )}

      {/* =================================================
          TABS
      ================================================= */}

      <div className="room-tabs">

        <button
          type="button"
          className={
            activeTab === "my"
              ? "active"
              : ""
          }
          disabled={loading}
          onClick={() => {
            clearError();
            setActiveTab("my");
          }}
        >
          My Rooms
        </button>

        <button
          type="button"
          className={
            activeTab === "discover"
              ? "active"
              : ""
          }
          disabled={loading}
          onClick={() => {
            clearError();
            setActiveTab(
              "discover"
            );
          }}
        >
          Discover Rooms
        </button>

      </div>

      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (
        <div className="room-loading">
          Loading rooms...
        </div>
      ) : rooms.length === 0 ? (
        <div className="room-empty">

          {activeTab === "my"
            ? "You have not joined any rooms yet."
            : "No rooms available."}

        </div>
      ) : (
        <div className="rooms">

          {rooms.map((room) => {
            const roomId =
              getRoomId(room);

            const member =
              isMember(room);

            const creator =
              isCreator(room);

            const editing =
              String(
                editingRoomId
              ) === roomId;

            const memberCount =
              getMemberCount(room);

            return (
              <div
                key={roomId}
                className="room-item"
              >

                {/* =======================================
                    EDIT MODE
                ======================================= */}

                {editing ? (
                  <div className="room-edit-form">

                    <input
                      type="text"
                      value={editName}
                      maxLength={50}
                      disabled={
                        actionLoading
                      }
                      onChange={(event) =>
                        setEditName(
                          event.target.value
                        )
                      }
                    />

                    <textarea
                      value={
                        editDescription
                      }
                      maxLength={250}
                      disabled={
                        actionLoading
                      }
                      onChange={(event) =>
                        setEditDescription(
                          event.target.value
                        )
                      }
                    />

                    <div className="room-edit-actions">

                      <button
                        type="button"
                        disabled={
                          actionLoading ||
                          !editName.trim()
                        }
                        onClick={() =>
                          handleSaveEdit(
                            room
                          )
                        }
                      >
                        {actionLoading
                          ? "Saving..."
                          : "Save"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          actionLoading
                        }
                        onClick={
                          handleCancelEdit
                        }
                      >
                        Cancel
                      </button>

                    </div>

                  </div>
                ) : (
                  <>
                    {/* ===================================
                        ROOM INFORMATION
                    =================================== */}

                    <div className="room-info">

                      <div className="room-title-row">

                        <h3>
                          {room.name}
                        </h3>

                        {creator && (
                          <span className="room-owner-badge">
                            Owner
                          </span>
                        )}

                        {member && (
                          <span className="room-member-badge">
                            Member
                          </span>
                        )}

                      </div>

                      {room.description && (
                        <p className="room-description">
                          {
                            room.description
                          }
                        </p>
                      )}

                      <div className="room-meta">

                        <small>
                          {memberCount}{" "}
                          member
                          {memberCount ===
                          1
                            ? ""
                            : "s"}
                        </small>

                        {room.code && (
                          <small>
                            Code:{" "}
                            <strong>
                              {
                                room.code
                              }
                            </strong>
                          </small>
                        )}

                      </div>

                    </div>

                    {/* ===================================
                        ACTIONS
                    =================================== */}

                    <div className="room-actions">

                      {member ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              actionLoading
                            }
                            onClick={() =>
                              handleSelectRoom(
                                room
                              )
                            }
                          >
                            Open
                          </button>

                          {creator && (
                            <>
                              <button
                                type="button"
                                disabled={
                                  actionLoading
                                }
                                onClick={() =>
                                  handleStartEdit(
                                    room
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={
                                  actionLoading
                                }
                                onClick={() =>
                                  handleDeleteRoom(
                                    room
                                  )
                                }
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {!creator && (
                            <button
                              type="button"
                              disabled={
                                actionLoading
                              }
                              onClick={() =>
                                handleLeaveRoom(
                                  room
                                )
                              }
                            >
                              Leave
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            actionLoading
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
                  </>
                )}

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
};

export default RoomList;
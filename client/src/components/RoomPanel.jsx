import {
  useEffect,
  useState,
} from "react";

import socket from "../services/socket";

import {
  discoverRooms,
  createRoom,
  joinRoom,
  leaveRoom,
} from "../services/roomService";

const RoomPanel = ({
  user,
  selectedRoom,
  onSelectRoom,
}) => {
  const [rooms, setRooms] =
    useState([]);

  const [roomName, setRoomName] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const currentUserId =
    String(user?._id || user?.id);

  // ==========================================
  // LOAD ROOMS
  // ==========================================

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError("");

      const data =
        await discoverRooms();

      setRooms(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Failed to discover rooms:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Failed to load rooms"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  // ==========================================
  // CREATE ROOM
  // ==========================================

  const handleCreateRoom = async (
    e
  ) => {
    e.preventDefault();

    const name =
      roomName.trim();

    if (!name) {
      setError(
        "Enter a room name."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data =
        await createRoom(name);

      const newRoom =
        data;

      setRooms((previous) => [
        newRoom,
        ...previous,
      ]);

      setRoomName("");
      setShowCreate(false);

      // Creator is automatically a member
      socket.emit(
        "join_room",
        String(newRoom._id)
      );

      onSelectRoom(newRoom);
    } catch (error) {
      console.error(
        "Create room error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Failed to create room"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // JOIN ROOM
  // ==========================================

  const handleJoinRoom = async (
    room
  ) => {
    try {
      setLoading(true);
      setError("");

      const data =
        await joinRoom(room._id);

      const updatedRoom =
        data.room;

      setRooms((previous) =>
        previous.map((item) =>
          String(item._id) ===
          String(updatedRoom._id)
            ? {
                ...updatedRoom,
                isMember: true,
              }
            : item
        )
      );

      // Join live Socket.IO room
      socket.emit(
        "join_room",
        String(updatedRoom._id)
      );

      onSelectRoom(
        updatedRoom
      );
    } catch (error) {
      console.error(
        "Join room error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Failed to join room"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // OPEN ROOM
  // ==========================================

  const handleOpenRoom = (
    room
  ) => {
    const isMember =
      room.isMember ||
      room.members?.some(
        (member) =>
          String(
            member._id || member
          ) === currentUserId
      );

    if (!isMember) {
      setError(
        "Join the room before opening it."
      );
      return;
    }

    socket.emit(
      "join_room",
      String(room._id)
    );

    onSelectRoom(room);
  };

  // ==========================================
  // LEAVE ROOM
  // ==========================================

  const handleLeaveRoom = async (
    room
  ) => {
    try {
      setLoading(true);
      setError("");

      await leaveRoom(
        room._id
      );

      socket.emit(
        "leave_room",
        String(room._id)
      );

      const updatedRooms =
        rooms.map((item) => {
          if (
            String(item._id) !==
            String(room._id)
          ) {
            return item;
          }

          return {
            ...item,
            isMember: false,
            members:
              item.members?.filter(
                (member) =>
                  String(
                    member._id ||
                      member
                  ) !== currentUserId
              ),
          };
        });

      setRooms(updatedRooms);

      if (
        selectedRoom &&
        String(
          selectedRoom._id
        ) === String(room._id)
      ) {
        onSelectRoom(null);
      }
    } catch (error) {
      console.error(
        "Leave room error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Failed to leave room"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="room-panel">

      {/* HEADER */}

      <div className="room-panel-header">
        <div>
          <h3>Rooms</h3>

          <small>
            Create or join a room
          </small>
        </div>

        <button
          type="button"
          className="create-room-icon"
          onClick={() =>
            setShowCreate(
              (previous) =>
                !previous
            )
          }
          title="Create room"
        >
          +
        </button>
      </div>

      {/* CREATE FORM */}

      {showCreate && (
        <form
          className="room-form"
          onSubmit={
            handleCreateRoom
          }
        >
          <input
            type="text"
            placeholder="Room name"
            value={roomName}
            onChange={(e) =>
              setRoomName(
                e.target.value
              )
            }
            maxLength={50}
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create Room"}
          </button>
        </form>
      )}

      {/* ERROR */}

      {error && (
        <div className="room-error">
          {error}
        </div>
      )}

      {/* ROOM LIST */}

      <div className="room-list">

        {loading &&
        rooms.length === 0 ? (
          <p>Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <div className="room-empty">
            <span>👥</span>
            <p>No rooms available.</p>
          </div>
        ) : (
          rooms.map((room) => {
            const isMember =
              room.isMember ||
              room.members?.some(
                (member) =>
                  String(
                    member._id ||
                      member
                  ) ===
                  currentUserId
              );

            const isCreator =
              String(
                room.creator?._id ||
                  room.creator
              ) ===
              currentUserId;

            const isSelected =
              selectedRoom &&
              String(
                selectedRoom._id
              ) ===
                String(room._id);

            return (
              <div
                key={room._id}
                className={`room-item ${
                  isSelected
                    ? "active"
                    : ""
                }`}
              >
                <button
                  type="button"
                  className="room-select"
                  onClick={() =>
                    handleOpenRoom(
                      room
                    )
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
                </button>

                {!isMember ? (
                  <button
                    type="button"
                    className="room-join-button"
                    onClick={() =>
                      handleJoinRoom(
                        room
                      )
                    }
                  >
                    Join
                  </button>
                ) : (
                  !isCreator && (
                    <button
                      type="button"
                      className="room-leave-button"
                      onClick={() =>
                        handleLeaveRoom(
                          room
                        )
                      }
                    >
                      Leave
                    </button>
                  )
                )}
              </div>
            );
          })
        )}

      </div>
    </div>
  );
};

export default RoomPanel;
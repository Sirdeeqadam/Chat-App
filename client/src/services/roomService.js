import api from "./api";

// =====================================================
// ROOM LIMITS
// =====================================================

const ROOM_NAME_MAX_LENGTH = 50;
const ROOM_DESCRIPTION_MAX_LENGTH = 500;
const ROOM_CODE_LENGTH = 6;

// =====================================================
// HELPERS
// =====================================================

const normalizeRoomId = (roomId) => {
  const value = String(roomId || "").trim();

  if (!value) {
    throw new Error("Room ID is required.");
  }

  return value;
};

const normalizeRoomName = (name) => {
  const value = String(name || "").trim();

  if (!value) {
    throw new Error("Room name is required.");
  }

  if (value.length > ROOM_NAME_MAX_LENGTH) {
    throw new Error(
      `Room name cannot exceed ${ROOM_NAME_MAX_LENGTH} characters.`
    );
  }

  return value;
};

const normalizeRoomDescription = (
  description
) => {
  const value = String(
    description || ""
  ).trim();

  if (
    value.length >
    ROOM_DESCRIPTION_MAX_LENGTH
  ) {
    throw new Error(
      `Room description cannot exceed ${ROOM_DESCRIPTION_MAX_LENGTH} characters.`
    );
  }

  return value;
};

const normalizeRoomCode = (code) => {
  const value = String(code || "")
    .trim()
    .toUpperCase();

  if (
    !new RegExp(
      `^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`
    ).test(value)
  ) {
    throw new Error(
      `Enter a valid ${ROOM_CODE_LENGTH}-character room code.`
    );
  }

  return value;
};

// =====================================================
// DISCOVER ROOMS
// GET /api/rooms/discover
// =====================================================
//
// Returns all rooms.
//
// Each room may contain:
// - name
// - description
// - code
// - creator
// - members
// - isMember
// - timestamps
//
// =====================================================

export const discoverRooms = async () => {
  const response = await api.get(
    "/rooms/discover"
  );

  return Array.isArray(response.data)
    ? response.data
    : [];
};

// =====================================================
// GET MY ROOMS
// GET /api/rooms
// =====================================================
//
// Returns rooms where the authenticated user
// is currently a member.
//
// =====================================================

export const getRooms = async () => {
  const response = await api.get(
    "/rooms"
  );

  return Array.isArray(response.data)
    ? response.data
    : [];
};

// =====================================================
// GET SINGLE ROOM
// GET /api/rooms/:roomId
// =====================================================
//
// User must be a member of the room.
//
// =====================================================

export const getRoom = async (roomId) => {
  const normalizedRoomId =
    normalizeRoomId(roomId);

  const response = await api.get(
    `/rooms/${normalizedRoomId}`
  );

  return response.data;
};

// =====================================================
// CREATE ROOM
// POST /api/rooms
// =====================================================
//
// Body:
//
// {
//   name: "Hausa Learners",
//   description:
//     "A room for people learning Hausa."
// }
//
// The backend automatically generates the
// 6-character room code.
//
// =====================================================

export const createRoom = async (
  name,
  description = ""
) => {
  const normalizedName =
    normalizeRoomName(name);

  const normalizedDescription =
    normalizeRoomDescription(
      description
    );

  const response = await api.post(
    "/rooms",
    {
      name: normalizedName,
      description:
        normalizedDescription,
    }
  );

  return response.data;
};

// =====================================================
// UPDATE ROOM
// PATCH /api/rooms/:roomId
// =====================================================
//
// Only the room creator can update the room.
//
// Supported fields:
//
// {
//   name: "New Room Name",
//   description: "New description"
// }
//
// At least one field must be provided.
//
// =====================================================

export const updateRoom = async (
  roomId,
  updates = {}
) => {
  const normalizedRoomId =
    normalizeRoomId(roomId);

  if (
    !updates ||
    typeof updates !== "object" ||
    Array.isArray(updates)
  ) {
    throw new Error(
      "Room update data is required."
    );
  }

  const hasName =
    Object.prototype.hasOwnProperty.call(
      updates,
      "name"
    );

  const hasDescription =
    Object.prototype.hasOwnProperty.call(
      updates,
      "description"
    );

  if (!hasName && !hasDescription) {
    throw new Error(
      "Provide a room name or description to update."
    );
  }

  const payload = {};

  if (hasName) {
    payload.name = normalizeRoomName(
      updates.name
    );
  }

  if (hasDescription) {
    payload.description =
      normalizeRoomDescription(
        updates.description
      );
  }

  const response = await api.patch(
    `/rooms/${normalizedRoomId}`,
    payload
  );

  return response.data;
};

// =====================================================
// JOIN ROOM BY ID
// POST /api/rooms/:roomId/join
// =====================================================
//
// The authenticated user joins the room.
//
// =====================================================

export const joinRoom = async (
  roomId
) => {
  const normalizedRoomId =
    normalizeRoomId(roomId);

  const response = await api.post(
    `/rooms/${normalizedRoomId}/join`
  );

  return response.data;
};

// =====================================================
// JOIN ROOM BY CODE
// POST /api/rooms/join-by-code
// =====================================================
//
// Example:
//
// ABC123
//
// =====================================================

export const joinRoomByCode = async (
  code
) => {
  const normalizedCode =
    normalizeRoomCode(code);

  const response = await api.post(
    "/rooms/join-by-code",
    {
      code: normalizedCode,
    }
  );

  return response.data;
};

// =====================================================
// GET ROOM MESSAGES
// GET /api/rooms/:roomId/messages
// =====================================================
//
// Only room members can retrieve messages.
//
// =====================================================

export const getRoomMessages = async (
  roomId
) => {
  const normalizedRoomId =
    normalizeRoomId(roomId);

  const response = await api.get(
    `/rooms/${normalizedRoomId}/messages`
  );

  return Array.isArray(response.data)
    ? response.data
    : [];
};

// =====================================================
// LEAVE ROOM
// POST /api/rooms/:roomId/leave
// =====================================================
//
// The room creator cannot leave their own room.
//
// =====================================================

export const leaveRoom = async (
  roomId
) => {
  const normalizedRoomId =
    normalizeRoomId(roomId);

  const response = await api.post(
    `/rooms/${normalizedRoomId}/leave`
  );

  return response.data;
};

// =====================================================
// REMOVE ROOM MEMBER
// DELETE /api/rooms/:roomId/members/:memberId
// =====================================================
//
// Only the room creator can remove members.
//
// The creator cannot remove themselves.
//
// =====================================================

export const removeRoomMember = async (
  roomId,
  memberId
) => {
  const normalizedRoomId =
    normalizeRoomId(roomId);

  const normalizedMemberId =
    String(memberId || "").trim();

  if (!normalizedMemberId) {
    throw new Error(
      "Member ID is required."
    );
  }

  const response = await api.delete(
    `/rooms/${normalizedRoomId}/members/${normalizedMemberId}`
  );

  return response.data;
};

// =====================================================
// DELETE ROOM
// DELETE /api/rooms/:roomId
// =====================================================
//
// Only the room creator can delete the room.
//
// The backend also removes:
// - Room messages
// - Room read states
//
// =====================================================

export const deleteRoom = async (
  roomId
) => {
  const normalizedRoomId =
    normalizeRoomId(roomId);

  const response = await api.delete(
    `/rooms/${normalizedRoomId}`
  );

  return response.data;
};

// =====================================================
// EXPORT DEFAULT
// =====================================================
//
// Optional default export so you can use:
//
// import roomApi from "./roomApi";
//
// roomApi.getRooms()
//
// =====================================================

const roomApi = {
  discoverRooms,
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  joinRoom,
  joinRoomByCode,
  getRoomMessages,
  leaveRoom,
  removeRoomMember,
  deleteRoom,
};

export default roomApi;
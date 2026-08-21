import api from "./api";

// =====================================================
// DISCOVER ALL ROOMS
// =====================================================

export const discoverRooms =
  async () => {
    const response =
      await api.get(
        "/rooms/discover"
      );

    return response.data;
  };

// =====================================================
// GET MY ROOMS
// =====================================================

export const getRooms =
  async () => {
    const response =
      await api.get(
        "/rooms"
      );

    return response.data;
  };

// =====================================================
// CREATE ROOM
// =====================================================

export const createRoom =
  async (name) => {
    const response =
      await api.post(
        "/rooms",
        {
          name,
        }
      );

    return response.data;
  };

// =====================================================
// GET ROOM
// =====================================================

export const getRoom =
  async (roomId) => {
    const response =
      await api.get(
        `/rooms/${roomId}`
      );

    return response.data;
  };

// =====================================================
// JOIN BY ROOM ID
// =====================================================

export const joinRoom =
  async (roomId) => {
    const response =
      await api.post(
        `/rooms/${roomId}/join`
      );

    return response.data;
  };

// =====================================================
// JOIN BY CODE
// =====================================================

export const joinRoomByCode =
  async (code) => {
    const response =
      await api.post(
        "/rooms/join-by-code",
        {
          code,
        }
      );

    return response.data;
  };

// =====================================================
// GET ROOM MESSAGES
// =====================================================

export const getRoomMessages =
  async (roomId) => {
    const response =
      await api.get(
        `/rooms/${roomId}/messages`
      );

    return response.data;
  };

// =====================================================
// LEAVE ROOM
// =====================================================

export const leaveRoom =
  async (roomId) => {
    const response =
      await api.post(
        `/rooms/${roomId}/leave`
      );

    return response.data;
  };

// =====================================================
// REMOVE ROOM MEMBER
// =====================================================

export const removeRoomMember =
  async (
    roomId,
    memberId
  ) => {
    const response =
      await api.delete(
        `/rooms/${roomId}/members/${memberId}`
      );

    return response.data;
  };

// =====================================================
// DELETE ROOM
// =====================================================

export const deleteRoom =
  async (roomId) => {
    const response =
      await api.delete(
        `/rooms/${roomId}`
      );

    return response.data;
  };
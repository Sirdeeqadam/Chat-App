import api from "./api";

// =====================================================
// GET UNREAD COUNTS
// =====================================================

export const getUnreadCounts =
  async () => {
    const response =
      await api.get(
        "/read-state"
      );

    return response.data;
  };

// =====================================================
// MARK PRIVATE READ
// =====================================================

export const markPrivateRead =
  async (userId) => {
    const response =
      await api.post(
        `/read-state/private/${userId}`
      );

    return response.data;
  };

// =====================================================
// MARK ROOM READ
// =====================================================

export const markRoomRead =
  async (roomId) => {
    const response =
      await api.post(
        `/read-state/room/${roomId}`
      );

    return response.data;
  };
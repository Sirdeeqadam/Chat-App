import api from "./api";

export const getAllUsers = async () => {
  const response = await api.get("/friends/all");
  return Array.isArray(response.data) ? response.data : [];
};

export const getFriends = async () => {
  const response = await api.get("/friends");
  return Array.isArray(response.data) ? response.data : [];
};

export const searchFriends = async (query) => {
  const response = await api.get("/friends/search", {
    params: { q: query },
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const sendFriendRequest = async (targetId) => {
  const response = await api.post(`/friends/requests/${targetId}`);
  return response.data;
};

export const updateFriendRequest = async (requestId, action) => {
  const response = await api.patch(`/friends/requests/${requestId}`, { action });
  return response.data;
};
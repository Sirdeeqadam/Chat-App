import api from "./api";

export const searchApp = async (query) => {
  const response = await api.get("/search", { params: { q: query } });
  return response.data || { friends: [], groups: [], messages: [], links: [] };
};
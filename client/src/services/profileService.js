import api from "./api";

export const getProfile =
  async () => {
    const response =
      await api.get(
        "/profile"
      );

    return response.data;
  };

export const updateProfile =
  async (profileData) => {
    const response =
      await api.put(
        "/profile",
        profileData
      );

    return response.data;
  };

export const uploadProfilePicture =
  async (file) => {
    if (!file) {
      throw new Error(
        "No profile picture selected."
      );
    }

    const formData =
      new FormData();

    formData.append(
      "profilePicture",
      file
    );

    const response =
      await api.post(
        "/profile/picture",
        formData
      );

    return response.data;
  };

export const removeProfilePicture =
  async () => {
    const response =
      await api.delete(
        "/profile/picture"
      );

    return response.data;
  };
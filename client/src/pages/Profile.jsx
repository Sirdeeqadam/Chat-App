import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  removeProfilePicture,
} from "../services/profileService";

import {
  useAuth,
} from "../context/AuthContext";

import socket from "../services/socket";

// =====================================================
// API SERVER URL
// =====================================================

const getApiServerUrl = () => {
  const configuredUrl =
    import.meta.env.VITE_API_URL;

  if (!configuredUrl) {
    return "http://localhost:5000";
  }

  return String(
    configuredUrl
  )
    .trim()
    .replace(
      /\/api\/?$/,
      ""
    )
    .replace(
      /\/+$/,
      ""
    );
};

// =====================================================
// IMAGE URL HELPER
// =====================================================

const getImageUrl = (
  picture
) => {
  if (!picture) {
    return null;
  }

  const value =
    String(picture).trim();

  if (!value) {
    return null;
  }

  if (
    value.startsWith(
      "http://"
    ) ||
    value.startsWith(
      "https://"
    ) ||
    value.startsWith(
      "data:"
    )
  ) {
    return value;
  }

  if (
    value.startsWith("/")
  ) {
    return `${getApiServerUrl()}${value}`;
  }

  return `${getApiServerUrl()}/${value}`;
};

// =====================================================
// PROFILE PAGE
// =====================================================

const Profile = () => {
  const navigate =
    useNavigate();

  const {
    user,
    updateUser,
  } = useAuth();

  const fileInputRef =
    useRef(null);

  const [profile, setProfile] =
    useState(null);

  const [username, setUsername] =
    useState("");

  const [language, setLanguage] =
    useState("English");

  const [bio, setBio] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // ===================================================
  // LOAD PROFILE
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    const loadProfile =
      async () => {
        try {
          setLoading(true);
          setError("");

          const data =
            await getProfile();

          if (
            cancelled
          ) {
            return;
          }

          if (!data) {
            throw new Error(
              "The server returned an empty profile."
            );
          }

          setProfile(data);

          setUsername(
            data.username ||
              ""
          );

          setLanguage(
            data.language ||
              "English"
          );

          setBio(
            data.bio ||
              ""
          );

          // Keep AuthContext synchronized.
          updateUser(data);
        } catch (
          loadError
        ) {
          if (
            cancelled
          ) {
            return;
          }

          console.error(
            "Failed to load profile:",
            loadError
          );

          const status =
            loadError.response
              ?.status;

          if (
            status === 401
          ) {
            setError(
              "Your session has expired. Please log in again."
            );
          } else {
            setError(
              loadError.response
                ?.data?.message ||
                loadError.message ||
                "Failed to load profile."
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      };

    loadProfile();

    return () => {
      cancelled = true;
    };

    // Profile should load once when
    // the page is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===================================================
  // APPLY USER UPDATE
  // ===================================================

  const applyUpdatedUser =
    (updatedUser) => {
      if (
        !updatedUser ||
        typeof updatedUser !==
          "object"
      ) {
        return;
      }

      setProfile(
        (previousProfile) => ({
          ...(previousProfile ||
            {}),
          ...updatedUser,
        })
      );

      setUsername(
        updatedUser.username ||
          ""
      );

      setLanguage(
        updatedUser.language ||
          "English"
      );

      setBio(
        updatedUser.bio ||
          ""
      );

      updateUser(
        updatedUser
      );
    };

  // ===================================================
  // SYNC SOCKET LANGUAGE
  // ===================================================

  const syncSocketLanguage =
    (selectedLanguage) => {
      if (
        !selectedLanguage
      ) {
        return;
      }

      if (
        socket.connected
      ) {
        socket.emit(
          "set_language",
          selectedLanguage
        );
      }
    };

  // ===================================================
  // SAVE PROFILE
  // ===================================================

  const handleSave =
    async (event) => {
      event.preventDefault();

      const cleanedUsername =
        username.trim();

      const cleanedBio =
        bio.trim();

      if (
        cleanedUsername.length <
        3
      ) {
        setError(
          "Username must be at least 3 characters."
        );

        return;
      }

      if (
        cleanedUsername.length >
        30
      ) {
        setError(
          "Username cannot exceed 30 characters."
        );

        return;
      }

      if (
        cleanedBio.length >
        160
      ) {
        setError(
          "Bio cannot exceed 160 characters."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        setError("");
        setMessage("");

        const response =
          await updateProfile({
            username:
              cleanedUsername,

            language,

            bio:
              cleanedBio,
          });

        const updatedUser =
          response?.user;

        if (
          !updatedUser
        ) {
          throw new Error(
            "The server did not return the updated profile."
          );
        }

        applyUpdatedUser(
          updatedUser
        );

        syncSocketLanguage(
          updatedUser.language
        );

        setMessage(
          response?.message ||
            "Profile updated successfully."
        );
      } catch (
        saveError
      ) {
        console.error(
          "Update profile error:",
          saveError
        );

        setError(
          saveError.response
            ?.data?.message ||
            saveError.message ||
            "Failed to update profile."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  // ===================================================
  // UPLOAD PROFILE PICTURE
  // ===================================================

  const handleSelectImage =
    async (event) => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];

      if (
        !allowedTypes.includes(
          file.type
        )
      ) {
        setError(
          "Only JPG, PNG, WEBP and GIF images are allowed."
        );

        event.target.value =
          "";

        return;
      }

      const maxSize =
        5 * 1024 * 1024;

      if (
        file.size > maxSize
      ) {
        setError(
          "Profile picture must be 5 MB or smaller."
        );

        event.target.value =
          "";

        return;
      }

      try {
        setUploading(
          true
        );

        setError("");
        setMessage("");

        const response =
          await uploadProfilePicture(
            file
          );

        const updatedUser =
          response?.user;

        if (
          !updatedUser
        ) {
          throw new Error(
            "The server did not return the updated profile."
          );
        }

        applyUpdatedUser(
          updatedUser
        );

        setMessage(
          response?.message ||
            "Profile picture updated successfully."
        );
      } catch (
        uploadError
      ) {
        console.error(
          "Profile picture upload error:",
          uploadError
        );

        setError(
          uploadError.response
            ?.data?.message ||
            uploadError.message ||
            "Failed to upload profile picture."
        );
      } finally {
        setUploading(
          false
        );

        event.target.value =
          "";
      }
    };

  // ===================================================
  // REMOVE PROFILE PICTURE
  // ===================================================

  const handleRemoveImage =
    async () => {
      if (uploading) {
        return;
      }

      const confirmed =
        window.confirm(
          "Remove your profile picture?"
        );

      if (!confirmed) {
        return;
      }

      try {
        setUploading(
          true
        );

        setError("");
        setMessage("");

        const response =
          await removeProfilePicture();

        const updatedUser =
          response?.user || {
            ...(profile || {}),
            profilePicture:
              null,
          };

        applyUpdatedUser(
          updatedUser
        );

        setMessage(
          response?.message ||
            "Profile picture removed successfully."
        );
      } catch (
        removeError
      ) {
        console.error(
          "Remove profile picture error:",
          removeError
        );

        setError(
          removeError.response
            ?.data?.message ||
            removeError.message ||
            "Failed to remove profile picture."
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  // ===================================================
  // BACK TO CHAT
  // ===================================================

  const handleBackToChat =
    () => {
      navigate(
        "/chat"
      );
    };

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <p>
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  const profileImage =
    getImageUrl(
      profile?.profilePicture
    );

  const avatarLetter =
    (
      username ||
      user?.username ||
      profile?.email ||
      "U"
    )
      .trim()
      .charAt(0)
      .toUpperCase();

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="profile-page">

      <div className="profile-card">

        {/* =================================================
            BACK
        ================================================== */}

        <div className="profile-top-actions">

          <button
            type="button"
            className="profile-back-button"
            onClick={
              handleBackToChat
            }
          >
            ← Back to Chat
          </button>

        </div>

        {/* =================================================
            HEADER
        ================================================== */}

        <div className="profile-header">

          <h2>
            My Profile
          </h2>

          <p>
            Manage your profile
            information.
          </p>

        </div>

        {/* =================================================
            FEEDBACK
        ================================================== */}

        {message && (
          <div className="success-message">
            {
              message
            }
          </div>
        )}

        {error && (
          <div className="error">
            {
              error
            }
          </div>
        )}

        {/* =================================================
            PROFILE PICTURE
        ================================================== */}

        <div className="profile-picture-section">

          <div className="profile-picture-wrapper">

            {profileImage ? (
              <img
                src={
                  profileImage
                }
                alt={
                  username ||
                  "Profile"
                }
                className="profile-picture"
              />
            ) : (
              <div className="profile-picture-placeholder">
                {
                  avatarLetter
                }
              </div>
            )}

          </div>

          <div className="profile-picture-actions">

            <button
              type="button"
              className="success-button"
              disabled={
                uploading
              }
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              {
                uploading
                  ? "Uploading..."
                  : "Change Picture"
              }
            </button>

            {profileImage && (
              <button
                type="button"
                className="danger-button"
                disabled={
                  uploading
                }
                onClick={
                  handleRemoveImage
                }
              >
                Remove
              </button>
            )}

          </div>

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={
              handleSelectImage
            }
          />

          <small>
            JPG, PNG, WEBP or GIF.
            Maximum 5 MB.
          </small>

        </div>

        {/* =================================================
            PROFILE FORM
        ================================================== */}

        <form
          className="profile-form"
          onSubmit={
            handleSave
          }
        >

          <label htmlFor="username">
            Username
          </label>

          <input
            id="username"
            type="text"
            value={
              username
            }
            maxLength={30}
            minLength={3}
            required
            disabled={
              saving
            }
            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }
          />

          <label htmlFor="email">
            Email
          </label>

          <input
            id="email"
            type="email"
            value={
              profile?.email ||
              user?.email ||
              ""
            }
            disabled
          />

          <label htmlFor="language">
            Language
          </label>

          <select
            id="language"
            value={
              language
            }
            disabled={
              saving
            }
            onChange={(event) =>
              setLanguage(
                event.target.value
              )
            }
          >
            <option value="English">
              English
            </option>

            <option value="Hausa">
              Hausa
            </option>

            <option value="French">
              French
            </option>

            <option value="Arabic">
              Arabic
            </option>
          </select>

          <label htmlFor="bio">
            Bio
          </label>

          <textarea
            id="bio"
            value={
              bio
            }
            rows={4}
            maxLength={160}
            disabled={
              saving
            }
            placeholder="Tell people a little about yourself..."
            onChange={(event) =>
              setBio(
                event.target.value
              )
            }
          />

          <div className="profile-form-footer">

            <span>
              {bio.length}/160
            </span>

            <button
              type="submit"
              className="success-button"
              disabled={
                saving
              }
            >
              {
                saving
                  ? "Saving..."
                  : "Save Changes"
              }
            </button>

          </div>

        </form>

      </div>
    </div>
  );
};

export default Profile;


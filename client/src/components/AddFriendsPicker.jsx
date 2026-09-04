import { useState, useEffect, useRef } from "react";
import {
  getAllUsers,
  searchFriends,
  sendFriendRequest,
  respondToFriendRequest,
} from "../services/friendService";

const AddFriendsPicker = ({ className = "" }) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestingUserId, setRequestingUserId] = useState(null);
  const modalRef = useRef(null);

  const getImageUrl = (picture) => {
    if (!picture) return null;
    const value = String(picture).trim();
    if (!value) return null;
    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:")
    ) {
      return value;
    }
    const apiServerUrl = String(
      import.meta.env.VITE_API_URL || "http://localhost:5000/api"
    )
      .trim()
      .replace(/\/api\/?$/, "")
      .replace(/\/+$/, "");

    if (value.startsWith("/")) {
      return `${apiServerUrl}${value}`;
    }
    return `${apiServerUrl}/${value}`;
  };

  const getInitial = (value) => {
    return String(value || "U")
      .trim()
      .charAt(0)
      .toUpperCase();
  };

  useEffect(() => {
    if (open && users.length === 0) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getAllUsers();
      setUsers(response);
      setFilteredUsers(response);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setFilteredUsers(users);
      return;
    }

    try {
      setLoading(true);
      const results = await searchFriends(query);
      setFilteredUsers(results);
    } catch (err) {
      console.error("Search error:", err);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId) => {
    if (requestingUserId === userId) return;

    try {
      setRequestingUserId(userId);
      setError("");
      await sendFriendRequest(userId);

      const updateUserStatus = (list) =>
        list.map((user) =>
          user._id === userId ? { ...user, relationship: "outgoing" } : user
        );

      setUsers(updateUserStatus);
      setFilteredUsers(updateUserStatus);
    } catch (err) {
      console.error("Failed to send friend request:", err);
      setError(
        err.response?.data?.message || "Failed to send friend request."
      );
    } finally {
      setRequestingUserId(null);
    }
  };

  const handleRespondRequest = async (user, action) => {
    if (!user.friendshipId || requestingUserId === user._id) return;

    try {
      setRequestingUserId(user._id);
      setError("");
      await respondToFriendRequest(user.friendshipId, action);

      const updateUserStatus = (list) =>
        list.map((item) => {
          if (item._id === user._id) {
            return {
              ...item,
              relationship: action === "accept" ? "friends" : "none",
              friendshipId: action === "accept" ? item.friendshipId : null,
            };
          }
          return item;
        });

      setUsers(updateUserStatus);
      setFilteredUsers(updateUserStatus);
    } catch (err) {
      console.error("Failed to update request:", err);
      setError(err.response?.data?.message || "Failed to respond to request.");
    } finally {
      setRequestingUserId(null);
    }
  };

  const getButtonContent = (user) => {
    switch (user.relationship) {
      case "friends":
        return <span className="friend-status">Friends</span>;
      case "outgoing":
        return <span className="request-pending">Pending</span>;
      case "incoming":
        return (
          <div className="request-action-group" style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className="accept-friend-btn"
              onClick={() => handleRespondRequest(user, "accept")}
              disabled={requestingUserId === user._id}
              style={{
                backgroundColor: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              {requestingUserId === user._id ? "..." : "Accept"}
            </button>
            <button
              type="button"
              className="decline-friend-btn"
              onClick={() => handleRespondRequest(user, "decline")}
              disabled={requestingUserId === user._id}
              style={{
                backgroundColor: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Decline
            </button>
          </div>
        );
      default:
        return (
          <button
            type="button"
            className="add-friend-btn"
            onClick={() => handleSendFriendRequest(user._id)}
            disabled={requestingUserId === user._id}
          >
            {requestingUserId === user._id ? "..." : "Add"}
          </button>
        );
    }
  };

  const handleClickOutside = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [open]);

  return (
    <div className={`add-friends-wrapper ${className}`.trim()} ref={modalRef}>
      <button
        type="button"
        className="add-friends-button"
        onClick={() => setOpen(!open)}
        title="Add friends"
        aria-label="Add friends"
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-hidden="true"
          focusable="false"
          className="add-friends-icon"
        >
          <circle cx="12" cy="9" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.5 20c0-2.5 3.2-4 7.5-4s7.5 1.5 7.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="17" cy="17" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 15v4M15 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="add-friends-modal">
          <div className="add-friends-header">
            <h3>Add Friends</h3>
            <button
              type="button"
              className="close-modal-btn"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="add-friends-search-container">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="10.8" cy="10.8" r="6.2" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
              aria-label="Search users"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => handleSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {error && <div className="add-friends-error">{error}</div>}

          <div className="add-friends-list">
            {loading ? (
              <div className="add-friends-loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="add-friends-empty">
                {searchQuery
                  ? "No users found matching your search."
                  : "No users available."}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user._id} className="add-friends-item">
                  <div className="user-avatar-section">
                    {user.profilePicture ? (
                      <img
                        src={getImageUrl(user.profilePicture)}
                        alt={user.username}
                        className="user-avatar-img"
                      />
                    ) : (
                      <span className="user-avatar-initial">
                        {getInitial(user.username || user.email)}
                      </span>
                    )}
                    <div className="user-info">
                      <div className="username">
                        {user.username || user.email}
                      </div>
                      {user.bio && <div className="user-bio">{user.bio}</div>}
                    </div>
                  </div>

                  <div className="user-action">{getButtonContent(user)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddFriendsPicker;
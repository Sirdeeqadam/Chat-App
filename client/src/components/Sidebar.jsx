<button
  onClick={() => setActiveView("rooms")}
  className={`sidebar-button ${
    activeView === "rooms" ? "active" : ""
  }`}
>
  <span className="sidebar-icon">👥</span>
  <span>Rooms</span>
</button>
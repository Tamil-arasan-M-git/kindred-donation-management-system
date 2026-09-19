import { useEffect, useState } from "react";
import api from "../../api/client";

const notificationList = (payload) => Array.isArray(payload) ? payload : payload?.notifications || [];

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    try {
      setNotifications(notificationList(await api.getNotifications({})));
    } catch {
      setError("Notifications are unavailable right now.");
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unread = notifications.filter((notification) => !notification.read && !notification.is_read).length;
  const markRead = async (notification) => {
    try {
      await api.markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true, is_read: true } : item));
    } catch {
      setError("That notification could not be marked as read.");
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true, is_read: true })));
    } catch {
      setError("Notifications could not be marked as read.");
    }
  };

  return (
    <div className="notification-area">
      <button type="button" className="notification-button" aria-label="Notifications" onClick={() => setOpen((current) => !current)}>
        🔔{unread ? <span className="notification-count">{unread}</span> : null}
      </button>
      {open ? (
        <div className="notification-panel">
          <div className="section-heading"><h2>Notifications</h2><button type="button" className="text-button" onClick={markAllRead} disabled={!unread}>Mark all read</button></div>
          {error ? <p className="muted-text">{error}</p> : null}
          {!error && !notifications.length ? <p className="muted-text">No new notifications.</p> : null}
          {notifications.map((notification) => (
            <button type="button" className={`notification-item ${notification.read || notification.is_read ? "read" : ""}`} key={notification.id} onClick={() => markRead(notification)}>
              <strong>{notification.title || "Kindred update"}</strong>
              <span>{notification.message || notification.body || ""}</span>
              <small>{notification.created_at ? new Date(notification.created_at).toLocaleString() : ""}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

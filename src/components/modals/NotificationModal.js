import React from 'react';

const NotificationModal = ({ 
  showNotificationModal, 
  notificationModalRef, 
  notifications, 
  handleNotificationClick, 
  clearAllNotifications 
}) => {
  return (
    <div 
      ref={notificationModalRef}
      className={`notification-modal ${showNotificationModal ? 'show' : ''}`}
    >
      <div className="notification-modal-header">
        <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>Notifications</span>
        <button className="clear-notifications-btn" onClick={clearAllNotifications}>
          Clear All
        </button>
      </div>
      <div className="notification-list">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification-item ${notification.read ? 'read' : 'unread'}`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="font-bold text-cyan-300">{notification.icao}</div>
            <div>{notification.text}</div>
            <div className="text-xs text-slate-500 mt-1">{notification.timestamp}</div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="text-center text-slate-400 py-4">No notifications</div>
        )}
      </div>
    </div>
  );
};

export default NotificationModal;
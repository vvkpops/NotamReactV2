import React, { useRef, useEffect } from 'react';
import '../styles/notifications.css';

const NotificationSystem = ({
  notifications,
  notificationCount,
  showNotificationModal,
  setShowNotificationModal,
  setNotifications,
  setNotificationCount,
  onNotificationClick
}) => {
  const notificationModalRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationModalRef.current && 
        !notificationModalRef.current.contains(event.target) &&
        !event.target.closest('.notification-bell')
      ) {
        setShowNotificationModal(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setShowNotificationModal]);

  return (
    <>
      {/* Notification Bell */}
      <div className="notification-bell" onClick={() => setShowNotificationModal(!showNotificationModal)}>
        <span style={{ fontSize: '26px', position: 'relative' }}>
          <i className="fa-solid fa-bell"></i>
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount}</span>
          )}
        </span>
      </div>

      {/* Notification Modal */}
      <div 
        ref={notificationModalRef}
        className={`notification-modal ${showNotificationModal ? 'show' : ''}`}
      >
        <div className="notification-modal-header">
          <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>Notifications</span>
          <button 
            className="clear-notifications-btn" 
            onClick={() => {
              setNotifications([]);
              setNotificationCount(0);
            }}
          >
            Clear All
          </button>
        </div>
        <div className="notification-list">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification-item ${notification.read ? 'read' : 'unread'}`}
              onClick={() => onNotificationClick(notification)}
            >
              <div style={{fontWeight: 'bold', color: '#67e8f9'}}>{notification.icao}</div>
              <div>{notification.text}</div>
              <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '4px'}}>
                {notification.timestamp}
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div style={{textAlign: 'center', color: '#94a3b8', padding: '1rem'}}>
              No notifications
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationSystem;

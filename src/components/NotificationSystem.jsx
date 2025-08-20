// ========================================
// src/components/NotificationSystem.jsx
// ========================================
import React from 'react';

const NotificationSystem = ({
  notifications,
  notificationCount,
  showNotificationModal,
  setShowNotificationModal,
  setNotifications,
  setNotificationCount,
  onNotificationClick
}) => {
  const clearAllNotifications = () => {
    setNotifications([]);
    setNotificationCount(0);
  };

  const toggleModal = () => {
    setShowNotificationModal(!showNotificationModal);
  };

  return (
    <>
      {/* Notification Bell */}
      <div className="notification-bell" onClick={toggleModal}>
        <i className="fa fa-bell text-xl"></i>
        {notificationCount > 0 && (
          <div className="notification-badge">
            {notificationCount > 99 ? '99+' : notificationCount}
          </div>
        )}
      </div>

      {/* Notification Modal */}
      <div className={`notification-modal ${showNotificationModal ? 'show' : ''}`}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #475569' }}>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-cyan-300">
              Notifications ({notificationCount})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={clearAllNotifications}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                disabled={notifications.length === 0}
              >
                Clear All
              </button>
              <button
                onClick={toggleModal}
                className="text-slate-400 hover:text-white text-lg"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
          {notifications.length === 0 ? (
            <div className="text-center text-slate-400 py-4">
              No new notifications
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    notification.read 
                      ? 'bg-slate-700 text-slate-300' 
                      : 'bg-cyan-900 text-cyan-100 hover:bg-cyan-800'
                  }`}
                  onClick={() => onNotificationClick(notification)}
                >
                  <div className="text-sm font-medium">
                    {notification.text}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {notification.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {showNotificationModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 998
          }}
          onClick={toggleModal}
        />
      )}
    </>
  );
};

export default NotificationSystem;

import { useState, useRef } from 'react';

export const useNotifications = () => {
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const notificationModalRef = useRef(null);

  const showNewNotamAlert = (text, icao, latestNewNotamKey) => {
    // Add to notification center with read status
    const newNotification = {
      id: Date.now(),
      text,
      icao,
      latestNewNotamKey,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
    setNotificationCount(prev => prev + 1);
    
    return newNotification;
  };

  const handleNotificationClick = (notification, setTabMode) => {
    setTabMode(notification.icao);
    setShowNotificationModal(false);
    
    // Mark this notification as read
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );
    
    // Update notification count
    updateNotificationCount();
    
    // Return the notification data for scrolling to the NOTAM
    return notification;
  };

  const updateNotificationCount = () => {
    // Count unread notifications
    setNotificationCount(notifications.filter(n => !n.read).length);
  };

  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    updateNotificationCount();
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setNotificationCount(0);
  };

  return {
    notificationCount,
    notifications,
    showNotificationModal,
    notificationModalRef,
    setShowNotificationModal,
    setNotifications,
    setNotificationCount,
    showNewNotamAlert,
    handleNotificationClick,
    updateNotificationCount,
    markNotificationAsRead,
    clearAllNotifications
  };
};
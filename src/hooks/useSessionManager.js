import { useState, useEffect, useRef } from 'react';

export const useSessionManager = () => {
  const [activeSession, setActiveSession] = useState(true);
  const sessionIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const bcRef = useRef(null);

  useEffect(() => {
    const SESSION_CHANNEL = 'notamDashboardSession';
    
    const claimActiveSession = () => {
      if (bcRef.current) {
        bcRef.current.postMessage({ type: 'new-session', sessionId: sessionIdRef.current });
      } else {
        localStorage.setItem(SESSION_CHANNEL, sessionIdRef.current);
      }
    };
    
    if (window.BroadcastChannel) {
      bcRef.current = new BroadcastChannel(SESSION_CHANNEL);
      bcRef.current.onmessage = (event) => {
        if (event.data && event.data.type === 'new-session' && event.data.sessionId !== sessionIdRef.current) {
          setActiveSession(false);
          
          document.body.innerHTML = `<div style="margin-top:80px;text-align:center;font-size:2em;color:#44f;">
            This NOTAM Dashboard session is now inactive because another session started in this browser.</div>`;
        }
      };
      claimActiveSession();
    } else {
      // Fallback for browsers without BroadcastChannel
      const handleStorage = (event) => {
        if (event.key === SESSION_CHANNEL && event.newValue !== sessionIdRef.current) {
          setActiveSession(false);
          
          document.body.innerHTML = `<div style="margin-top:80px;text-align:center;font-size:2em;color:#44f;">
            This NOTAM Dashboard session is now inactive because another session started in this browser.</div>`;
        }
      };
      window.addEventListener('storage', handleStorage);
      claimActiveSession();
      
      return () => window.removeEventListener('storage', handleStorage);
    }

    // Cleanup on unmount
    return () => {
      if (bcRef.current) bcRef.current.close();
    };
  }, []);

  return { activeSession };
};
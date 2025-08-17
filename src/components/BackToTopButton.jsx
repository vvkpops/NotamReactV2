
// ========================================
// src/components/BackToTopButton.jsx
// ========================================
import React, { useState, useEffect } from 'react';

const BackToTopButton = () => {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowButton(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      className={`back-to-top-btn ${showButton ? 'show' : ''}`}
      onClick={scrollToTop}
      title="Back to Top"
    >
      <i className="fa fa-arrow-up"></i>
    </button>
  );
};

export default BackToTopButton;

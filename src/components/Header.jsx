import React from 'react';

const Header = () => {
  return (
    <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-cyan-500 rounded-lg">
              <i className="fa-solid fa-plane-departure text-slate-900 text-lg"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-cyan-300 tracking-tight">
                NOTAM Dashboard
              </h1>
              <p className="text-sm text-slate-400">
                Real-time Notice to Airmen Monitoring
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm text-slate-400">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live</span>
              </div>
              <span>•</span>
              <span>v2.0</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

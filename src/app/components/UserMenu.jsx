'use client'
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const UserMenu = () => {
  const { userProfile, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="fixed bottom-4 right-4 z-50">
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-10 h-10 rounded-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow ring-2 ring-white"
        >
          {userProfile?.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-blue-500 flex items-center justify-center">
              <span className="text-white font-medium">
                {userProfile?.displayName?.charAt(0)}
              </span>
            </div>
          )}
        </button>

        {isMenuOpen && (
          <div className="absolute bottom-14 right-0 bg-white rounded-lg shadow-lg min-w-[200px] overflow-hidden animate-fade-in-up">
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userProfile.displayName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {userProfile.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="w-full px-4 py-3 text-sm text-red-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
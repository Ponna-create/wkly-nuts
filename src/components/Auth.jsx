import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import logo from '../assets/wkly-nuts-logo.png';

// Simple password authentication for internal use
// Password is stored in environment variable or localStorage
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'wklynuts2025'; // Change this!

export default function Auth({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const authStatus = localStorage.getItem('wklyNutsAuth');
    if (authStatus === 'authenticated') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (password === APP_PASSWORD) {
      localStorage.setItem('wklyNutsAuth', 'authenticated');
      setIsAuthenticated(true);
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wklyNutsAuth');
    setIsAuthenticated(false);
    setPassword('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <img 
              src={logo} 
              alt="WKLY Nuts Logo" 
              className="h-16 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900">WKLY Nuts</h1>
            <p className="text-sm text-gray-600 mt-1">Production Management System</p>
          </div>

          <div className="flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-primary-600" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Enter Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full"
                placeholder="Enter app password"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
            >
              Login
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Internal Use Only</p>
            <p className="mt-1">Contact administrator for access</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {/* Logout button - can be added to header if needed */}
    </>
  );
}

// Export logout function for use in other components
export const logout = () => {
  localStorage.removeItem('wklyNutsAuth');
  window.location.reload();
};


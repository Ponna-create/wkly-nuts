import React, { useState, useEffect } from 'react';
import { Lock, User } from 'lucide-react';
import logo from '../assets/wkly-nuts-logo.png';

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || '';
const APP_USERNAME = import.meta.env.VITE_APP_USERNAME || 'admin';
const SESSION_KEY = 'wklyNutsSession';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function getValidSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.token || !session.expiresAt) return null;
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function createSession() {
  const session = {
    token: generateSessionToken(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export default function Auth({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = getValidSession();
    if (session) setIsAuthenticated(true);
    // Migrate old localStorage auth to new system
    if (!session && localStorage.getItem('wklyNutsAuth') === 'authenticated') {
      localStorage.removeItem('wklyNutsAuth');
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!APP_PASSWORD) {
      setError('Password not configured. Set VITE_APP_PASSWORD in Vercel environment variables.');
      return;
    }

    if (APP_USERNAME && username.trim().toLowerCase() !== APP_USERNAME.toLowerCase()) {
      setError('Incorrect username. Please try again.');
      setUsername('');
      setPassword('');
      return;
    }

    // Constant-time-ish comparison to avoid timing attacks
    const inputPw = password;
    const correctPw = APP_PASSWORD;
    let match = inputPw.length === correctPw.length;
    for (let i = 0; i < Math.max(inputPw.length, correctPw.length); i++) {
      if ((inputPw[i] || '') !== (correctPw[i] || '')) match = false;
    }

    if (match) {
      createSession();
      setIsAuthenticated(true);
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
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
            <img src={logo} alt="WKLY Nuts Logo" className="h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">WKLY Nuts</h1>
            <p className="text-sm text-gray-600 mt-1">Production Management System</p>
          </div>

          <div className="flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-primary-600" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {APP_USERNAME && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    className="input-field w-full pl-10" placeholder="Enter username" autoFocus autoComplete="username" required />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-10" placeholder="Enter password" autoFocus={!APP_USERNAME} autoComplete="current-password" required />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
            )}

            <button type="submit" className="btn-primary w-full">Login</button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Internal Use Only</p>
            <p className="mt-1">Contact administrator for access</p>
            {!APP_PASSWORD && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                <p className="font-semibold">Password Not Configured</p>
                <p className="mt-1">Set VITE_APP_PASSWORD in Vercel environment variables</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export const logout = () => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('wklyNutsAuth');
  window.location.reload();
};

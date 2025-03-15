'use client'
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Weekly Menu</h1>
        <p className="text-gray-600">Please sign in to continue</p>
      </div>
      <button
        onClick={useAuth().login}
        className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg shadow-sm px-6 py-3 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
            fill="currentColor"
          />
        </svg>
        Sign in with Google
      </button>
    </div>
  </div>
);
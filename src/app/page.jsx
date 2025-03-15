"use client"
import React from 'react';
import WeeklyMenu from './components/WeeklyMenu';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './context/AuthContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import { UserMenu } from './components/UserMenu';

const App = () => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!token) {
    return <LoginPage />;
  }

  return (
    <>
      <UserMenu />
      <WeeklyMenu />
    </>
  );
};

export default App;
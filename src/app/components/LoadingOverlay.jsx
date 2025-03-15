// components/LoadingOverlay.jsx
'use client'

import { Spin } from 'antd';

export const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-white bg-opacity-75 z-50 flex items-center justify-center">
     <Spin size="large" />
  </div>
);
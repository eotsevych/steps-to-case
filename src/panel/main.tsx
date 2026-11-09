import React from 'react';
import { createRoot } from 'react-dom/client';
import { RecorderPanel } from './RecorderPanel';
import './index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<RecorderPanel />);
}

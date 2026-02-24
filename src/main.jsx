// ============================================================================
// Application Entry Point
// This is the ONLY file that touches the DOM. Everything else is React.
// ============================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@core/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

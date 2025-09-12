// Polyfill process and Buffer for browser compatibility
import process from 'process/browser.js';
import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
  window.process = process;
  window.Buffer = Buffer;
}

import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.js';
// Use main stylesheet (includes production styles)
import './styles/main.css';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('app')
);
import 'bootstrap/dist/css/bootstrap.min.css';
import './lab2.css';
import './auth.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthGate } from './AuthGate';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
  </React.StrictMode>
);

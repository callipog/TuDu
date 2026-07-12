import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {themeService} from './services/theme';
import './index.css';

// Aplica o tema salvo antes do primeiro render (evita flash de tema errado).
themeService.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

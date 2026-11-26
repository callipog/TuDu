import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {StickyNote} from './components/StickyNote';
import {themeService} from './services/theme';
import {boardStyleService} from './services/boardStyle';
import './index.css';

// Aplica o tema salvo antes do primeiro render (evita flash de tema errado).
themeService.init();
boardStyleService.init();

// Economizar memória (sem GPU): o desfoque atrás das janelas fica caro de
// desenhar pela CPU, então o CSS troca por um fundo mais escuro (index.css).
window.tudu?.settings.get().then(st => {
  document.documentElement.classList.toggle('save-memory', !!st.saveMemoryActive);
}).catch(() => { /* fora do app desktop */ });

// A mesma página serve os cards fixados na área de trabalho (?sticky=<id>):
// assim eles enxergam o mesmo banco que o app.
const stickyId = new URLSearchParams(location.search).get('sticky');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {stickyId ? <StickyNote taskId={stickyId} /> : <App />}
  </StrictMode>,
);

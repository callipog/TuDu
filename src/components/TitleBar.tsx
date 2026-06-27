import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const isElectron = typeof window !== 'undefined' && (window as any).require;

  const handleMinimize = () => {
    if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('window-minimize');
    }
  };

  const handleMaximize = () => {
    if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('window-maximize');
    }
  };

  const handleClose = () => {
    if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('window-close');
    }
  };

  return (
    <div 
      className="h-8 w-full bg-[#09090b] flex items-center justify-between flex-shrink-0 border-b border-white/5 select-none"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center px-4 gap-2">
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          <img src="icon.png" alt="Logo" className="w-full h-full object-contain opacity-50" />
        </div>
        <span className="text-[11px] text-zinc-500 font-medium tracking-wide">TuDu</span>
      </div>
      
      <div 
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button 
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Square size={12} />
        </button>
        <button 
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center text-zinc-400 hover:bg-red-500 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

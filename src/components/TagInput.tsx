import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Tag } from '../types';
import { tagService, PREDEFINED_COLORS } from '../services/tags';
import { Plus, X } from 'lucide-react';

interface TagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

const DROP_MAX_H = 200;

export function TagInput({ selectedTags, onChange }: TagInputProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setAvailableTags(tagService.getTags()); }, []);

  const reposition = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < DROP_MAX_H && r.top > DROP_MAX_H ? r.top - DROP_MAX_H - 6 : r.bottom + 6;
    setCoords({ top: Math.max(8, top), left: r.left, width: r.width });
  };

  useLayoutEffect(() => { if (showDropdown) reposition(); }, [showDropdown, inputValue, selectedTags.length]);

  useEffect(() => {
    if (!showDropdown) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) setShowDropdown(false);
    };
    const onScroll = () => setShowDropdown(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [showDropdown]);

  const handleAddTag = (tagName: string, color?: string) => {
    const name = tagName.trim();
    if (!name || selectedTags.includes(name)) return;
    if (!availableTags.find(t => t.name.toLowerCase() === name.toLowerCase())) {
      const randomColor = PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)];
      const newTag = tagService.addTag(name, color || randomColor);
      setAvailableTags([...availableTags, newTag]);
    }
    onChange([...selectedTags, name]);
    setInputValue('');
    setShowDropdown(false);
  };

  const handleRemoveTag = (tagName: string) => onChange(selectedTags.filter(t => t !== tagName));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddTag(inputValue); }
  };

  const filteredTags = availableTags.filter(t =>
    t.name.toLowerCase().includes(inputValue.toLowerCase()) && !selectedTags.includes(t.name)
  );
  const canCreate = inputValue && !availableTags.find(t => t.name.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div ref={wrapRef}>
      <div className="min-h-[42px] w-full bg-white/5 border border-white/10 rounded-lg p-2 flex flex-wrap gap-2 items-center focus-within:border-indigo-500 transition-colors">
        {selectedTags.map(tag => {
          const colorClass = tagService.getTagColor(tag);
          return (
            <span key={tag} className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white bg-white/10 border border-white/10 rounded-md">
              <span className={`w-2 h-2 rounded-full ${colorClass}`}></span>
              {tag}
              <button type="button" onClick={() => handleRemoveTag(tag)} className="text-zinc-400 hover:text-rose-400"><X size={12} /></button>
            </span>
          );
        })}
        <input
          type="text"
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-[100px] bg-transparent text-sm text-white focus:outline-none"
          placeholder={selectedTags.length === 0 ? "Ex: Trabalho, Urgente..." : "Adicionar tag..."}
        />
      </div>

      {showDropdown && (inputValue || filteredTags.length > 0) && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, maxHeight: DROP_MAX_H }}
          className="z-[80] bg-[#18181b] border border-white/10 rounded-lg shadow-xl overflow-y-auto custom-scrollbar"
        >
          {filteredTags.map(tag => (
            <button key={tag.id} type="button" onClick={() => handleAddTag(tag.name, tag.color)} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors">
              <span className={`w-2 h-2 rounded-full ${tag.color}`}></span>
              {tag.name}
            </button>
          ))}
          {canCreate && (
            <button type="button" onClick={() => handleAddTag(inputValue)} className="w-full text-left px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10 flex items-center gap-2 transition-colors border-t border-white/5">
              <Plus size={14} /> Criar nova tag "{inputValue}"
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

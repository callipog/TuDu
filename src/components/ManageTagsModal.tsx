import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Tag } from '../types';
import { tagService } from '../services/tags';
import { Trash2 } from 'lucide-react';

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsUpdated: () => void;
}

export function ManageTagsModal({ isOpen, onClose, onTagsUpdated }: ManageTagsModalProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTags(tagService.getTags());
    }
  }, [isOpen]);

  const handleDeleteTag = (id: string) => {
    tagService.deleteTag(id);
    setTags(tagService.getTags());
    onTagsUpdated();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Tags">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
        {tags.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhuma tag criada.</p>
        ) : (
          tags.map(tag => (
            <div key={tag.id} className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${tag.color}`}></span>
                <span className="text-sm text-white font-medium">{tag.name}</span>
              </div>
              <button
                onClick={() => handleDeleteTag(tag.id)}
                className="text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-md transition-colors"
                title="Excluir tag"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}

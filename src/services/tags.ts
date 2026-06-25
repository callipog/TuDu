import { Tag } from '../types';

const TAGS_STORAGE_KEY = 'focus_desk_custom_tags';

export const PREDEFINED_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
];

export const tagService = {
  getTags(): Tag[] {
    try {
      const data = localStorage.getItem(TAGS_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return [
      { id: '1', name: 'Trabalho', color: 'bg-blue-500' },
      { id: '2', name: 'Pessoal', color: 'bg-emerald-500' },
      { id: '3', name: 'Estudos', color: 'bg-purple-500' },
      { id: '4', name: 'Urgente', color: 'bg-rose-500' },
    ];
  },

  saveTags(tags: Tag[]) {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  },

  addTag(name: string, color: string): Tag {
    const tags = this.getTags();
    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Update color if it exists
      existing.color = color;
      this.saveTags(tags);
      return existing;
    }
    const newTag = { id: Math.random().toString(36).substring(7), name, color };
    tags.push(newTag);
    this.saveTags(tags);
    return newTag;
  },

  getTagColor(name: string): string {
    const tags = this.getTags();
    const tag = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    return tag ? tag.color : 'bg-zinc-500'; // Default color
  }
};

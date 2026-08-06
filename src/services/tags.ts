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

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const tagService = {
  /** Todas as tags, de qualquer escopo (usado por backup e gerenciamento). */
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

  /**
   * Tags que valem em um contexto: as globais mais as do projeto informado.
   * Sem projeto, só as globais.
   */
  getVisibleTags(projectId?: string): Tag[] {
    return this.getTags().filter(t => !t.projectId || t.projectId === projectId);
  },

  /**
   * Cria ou atualiza a cor de uma tag no escopo indicado.
   *
   * Como a tarefa guarda o NOME da tag (não o id), dois escopos visíveis ao
   * mesmo tempo não podem ter o mesmo nome — senão a cor viraria loteria. Por
   * isso, se o nome já existe no escopo visível, aqui reaproveita aquela tag em
   * vez de criar uma irmã ambígua.
   */
  addTag(name: string, color: string, projectId?: string): Tag {
    const tags = this.getTags();

    // Mesmo escopo: é a própria tag, então atualiza a cor.
    const mesmoEscopo = tags.find(t => sameName(t.name, name) && t.projectId === projectId);
    if (mesmoEscopo) {
      mesmoEscopo.color = color;
      this.saveTags(tags);
      return mesmoEscopo;
    }

    // Escopo diferente mas visível junto (ex.: já existe uma global com esse
    // nome): reaproveita a que existe SEM mexer nela — recolorir a tag global
    // porque alguém digitou o mesmo nome dentro de um projeto seria uma
    // mudança silenciosa e ampla demais.
    const jaVisivel = tags.find(t => sameName(t.name, name) && (!t.projectId || t.projectId === projectId));
    if (jaVisivel) return jaVisivel;
    const newTag: Tag = { id: crypto.randomUUID(), name: name.trim(), color, projectId };
    tags.push(newTag);
    this.saveTags(tags);
    return newTag;
  },

  /** A tag do projeto tem preferência sobre a global de mesmo nome. */
  getTagColor(name: string, projectId?: string): string {
    const tags = this.getTags();
    const doProjeto = projectId ? tags.find(t => t.projectId === projectId && sameName(t.name, name)) : undefined;
    const global = tags.find(t => !t.projectId && sameName(t.name, name));
    return (doProjeto ?? global)?.color ?? 'bg-zinc-500';
  },

  /** Move uma tag entre global e projeto (ou entre projetos). */
  setScope(id: string, projectId?: string): void {
    const tags = this.getTags();
    const tag = tags.find(t => t.id === id);
    if (!tag) return;
    // Não deixa a mudança criar duas tags de mesmo nome visíveis juntas.
    const conflito = tags.some(t => t.id !== id && sameName(t.name, tag.name) && (!t.projectId || t.projectId === projectId));
    if (conflito) return;
    tag.projectId = projectId;
    this.saveTags(tags);
  },

  deleteTag(id: string): void {
    const tags = this.getTags();
    const newTags = tags.filter(t => t.id !== id);
    this.saveTags(newTags);
  },

  /** Apaga TODAS as tags (reset). */
  clearTags(): void {
    this.saveTags([]);
  }
};

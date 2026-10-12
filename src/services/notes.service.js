import { NotesRepository } from '../repositories/notes.repository.js';

const VALID_COLORS = ['bg-sun', 'bg-lime', 'bg-lilac', 'bg-sky', 'bg-coral'];

export class NotesService {
  constructor() {
    this.repo = new NotesRepository();
  }

  async listNotes(userId, { page = 1, limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(1, Number(limit)), 50);
    const safePage  = Math.max(1, Number(page));
    return this.repo.findByUser(userId, { page: safePage, limit: safeLimit });
  }

  async getNote(userId, noteId) {
    const note = await this.repo.findById(noteId);
    if (!note)                  throw new Error('NOTE_NOT_FOUND');
    if (note.user_id !== userId) throw new Error('FORBIDDEN');
    return note;
  }

  async createNote(userId, data) {
    const { title = '', body = '', color = 'bg-sun', is_pinned = false } = data;
    const safeColor = VALID_COLORS.includes(color) ? color : 'bg-sun';
    return this.repo.create(userId, { title, body, color: safeColor, is_pinned: Boolean(is_pinned) });
  }

  async updateNote(userId, noteId, data) {
    const note = await this.repo.findById(noteId);
    if (!note)                  throw new Error('NOTE_NOT_FOUND');
    if (note.user_id !== userId) throw new Error('FORBIDDEN');

    const fields = {};
    if (data.title     !== undefined) fields.title     = data.title;
    if (data.body      !== undefined) fields.body      = data.body;
    if (data.color     !== undefined) fields.color     = VALID_COLORS.includes(data.color) ? data.color : note.color;
    if (data.is_pinned !== undefined) fields.is_pinned = Boolean(data.is_pinned);

    const updated = await this.repo.update(noteId, fields);
    if (!updated) throw new Error('NOTE_NOT_FOUND');
    return updated;
  }

  async deleteNote(userId, noteId) {
    const note = await this.repo.findById(noteId);
    if (!note)                  throw new Error('NOTE_NOT_FOUND');
    if (note.user_id !== userId) throw new Error('FORBIDDEN');
    return this.repo.delete(noteId);
  }
}

import { describe, it, expect } from 'vitest';
import { resolveResidencyPlacement, specialtyKey, tidySpecialtyName, isResidencySource } from './rezidentiatPlacement';

const f = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });
const tree = [
  f('root', 'Rezidențiat'),
  f('chir', 'Chirurgie', 'root'),
  f('med', 'Medicină internă', 'root'),
  f('s-card', 'Cardiologie', 'med'),
  f('s-diab', 'Diabet zaharat', 'med'),
  f('s-boli', 'Boli hepatice', 'med'),
  f('s-eso', 'Esofagul', 'chir'),
];

describe('specialty names', () => {
  it('treats diacritics, case, stop-words and word endings as the same key', () => {
    expect(specialtyKey('DIABETUL ZAHARAT')).toBe(specialtyKey('Diabet zaharat'));
    expect(specialtyKey('BOLILE HEPATICE')).toBe(specialtyKey('Boli hepatice'));
    expect(specialtyKey('Sepsisul ȘI tratamentul infecțiilor')).toBe(specialtyKey('sepsisul si tratamentul infectiilor'));
    expect(specialtyKey('Cardiologie')).not.toBe(specialtyKey('Pneumologie'));
  });

  it('turns SHOUTED chapter titles into sentence case and leaves normal ones alone', () => {
    expect(tidySpecialtyName('CARDIOLOGIE')).toBe('Cardiologie');
    expect(tidySpecialtyName('12. HEMATOLOGIE')).toBe('Hematologie');
    expect(tidySpecialtyName('Colon, rect și anus')).toBe('Colon, rect și anus');
  });
});

describe('resolveResidencyPlacement', () => {
  it('reuses the existing specialty (and its discipline) for a matching chapter', () => {
    const p = resolveResidencyPlacement('Kumar și Clark – Medicină Clinică.pdf', 'DIABETUL ZAHARAT', tree);
    expect(p).toEqual({ disciplineName: 'Medicină internă', specialtyName: 'Diabet zaharat', disciplineId: 'med', specialtyId: 's-diab' });
  });

  it('follows the specialty even when the book would suggest another discipline', () => {
    const p = resolveResidencyPlacement('Sinopsis de medicină.pdf', 'Esofagul', tree);
    expect(p.disciplineId).toBe('chir');
    expect(p.specialtyId).toBe('s-eso');
  });

  it('uses the book to pick the discipline for a chapter with no folder yet', () => {
    const p = resolveResidencyPlacement('Lawrence – Chirurgie generală.pdf', 'PANCREASUL', tree);
    expect(p).toEqual({ disciplineName: 'Chirurgie', specialtyName: 'Pancreasul', disciplineId: 'chir', specialtyId: null });
  });

  it('guesses from the chapter name when the book is generic, and names a missing discipline', () => {
    const surgical = resolveResidencyPlacement('Sinopsis de medicină.pdf', 'Ortopedie pediatrică', [f('root', 'Rezidențiat')]);
    expect(surgical.disciplineName).toBe('Chirurgie');
    expect(surgical.disciplineId).toBeNull();
    const medical = resolveResidencyPlacement('Sinopsis de medicină.pdf', 'Dermatologie', [f('root', 'Rezidențiat')]);
    expect(medical.disciplineName).toBe('Medicină internă');
  });

  it('files a whole-book pack under a specialty named after the book', () => {
    const p = resolveResidencyPlacement('Kumar și Clark – Medicină Clinică.pdf', null, tree);
    expect(p.disciplineId).toBe('med');
    expect(p.specialtyName).toBe('Kumar și Clark – Medicină Clinică');
    expect(p.specialtyId).toBeNull();
  });

  it('works when the Rezidențiat root does not exist yet', () => {
    const p = resolveResidencyPlacement('Lawrence – Chirurgie generală.pdf', 'Esofagul', []);
    expect(p).toEqual({ disciplineName: 'Chirurgie', specialtyName: 'Esofagul', disciplineId: null, specialtyId: null });
  });
});

describe('isResidencySource', () => {
  const lib = [f('r', 'Rezidențiat'), f('sub', 'Cursuri', 'r'), f('other', 'Altceva')];
  it('recognises sources under the Rezidențiat section, at any depth', () => {
    expect(isResidencySource({ folderId: 'r' }, lib)).toBe(true);
    expect(isResidencySource({ folderId: 'sub' }, lib)).toBe(true);
    expect(isResidencySource({ folderId: 'other' }, lib)).toBe(false);
    expect(isResidencySource({ folderId: null }, lib)).toBe(false);
  });
});

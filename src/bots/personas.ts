import { ROUTES, type Tile } from './venue';

export type PersonaKey = 'lyra' | 'nova' | 'orion';
export interface Persona { readonly key: PersonaKey; readonly name: string; readonly rank: number; readonly home: Tile; readonly patrol: readonly Tile[] }
const corners = ROUTES.patrol.slice(0, -1);
const profile = (key: PersonaKey, name: string, rank: number, offset: number): Persona => {
  const cycle = [...corners.slice(offset), ...corners.slice(0, offset)];
  return Object.freeze({ key, name, rank, home: cycle[0], patrol: [...cycle, cycle[0]] });
};
/** Fixed rotations of the already audited patrol: metadata cannot supply paths or names. */
export const PERSONAS: Readonly<Record<PersonaKey, Persona>> = Object.freeze({
  lyra: profile('lyra', 'Lyra [BOT]', 0, 0),
  nova: profile('nova', 'Nova [BOT]', 1, 2),
  orion: profile('orion', 'Orion [BOT]', 2, 4),
});
export const normalizedName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
export function personaByName(name: string | undefined): Persona | undefined {
  return name === undefined ? undefined : Object.values(PERSONAS).find(p => normalizedName(p.name) === normalizedName(name));
}
export function personaFromMetadata(metadata: unknown): Persona {
  if (!metadata || typeof metadata !== 'object' || !('persona' in metadata)) return PERSONAS.lyra;
  const key = (metadata as { persona: unknown }).persona;
  if (key !== 'lyra' && key !== 'nova' && key !== 'orion') throw Error('Invalid guide persona');
  return PERSONAS[key];
}
/** Only an anchored guide name plus a delimiter targets a specific guide. */
export function addressedCommand(text: string): { target?: PersonaKey; text: string } {
  const prefix = /^\s*(lyra|nova|orion)(?:\s*\[bot\])?\s*[,:]\s*/i.exec(text);
  return prefix ? { target: prefix[1].toLowerCase() as PersonaKey, text: text.slice(prefix[0].length) } : { text };
}

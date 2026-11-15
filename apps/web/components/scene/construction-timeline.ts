/** One reversible construction clock shared by the story, structure and equipment. */
export const CONSTRUCTION_PHASES = [
  { id: 'vision', start: 0, align: 'left' },
  { id: 'survey', start: 0.055, align: 'left' },
  { id: 'excavation', start: 0.12, align: 'left' },
  { id: 'foundation', start: 0.19, align: 'left' },
  { id: 'structure', start: 0.26, align: 'right' },
  { id: 'vertical', start: 0.4, align: 'left' },
  { id: 'services', start: 0.54, align: 'left' },
  { id: 'envelope', start: 0.64, align: 'right' },
  { id: 'finishing', start: 0.74, align: 'left' },
  { id: 'landscape', start: 0.84, align: 'left' },
  { id: 'handover', start: 0.92, align: 'right' },
  { id: 'investment', start: 0.97, align: 'left' },
] as const;

export function constructionPhase(progress: number) {
  let index = 0;
  for (let i = 1; i < CONSTRUCTION_PHASES.length; i++) {
    if (progress >= CONSTRUCTION_PHASES[i].start) index = i;
  }
  return CONSTRUCTION_PHASES[index];
}

// A complete column/beam cycle finishes before the next slab begins.
export const floorStructureStart = (index: number, wing = false) =>
  0.26 + index * 0.027 + (wing ? 0.009 : 0);
export const floorSlabEnd = (index: number, wing = false) =>
  floorStructureStart(index, wing) + 0.007;
export const floorStructureEnd = (index: number, wing = false) =>
  floorStructureStart(index, wing) + 0.024;
export const floorFacadeStart = (index: number, wing = false) =>
  0.64 + index * 0.01 + (wing ? 0.004 : 0);
export const floorFacadeEnd = (index: number, wing = false) =>
  floorFacadeStart(index, wing) + 0.028;
export const floorBalconyStart = (index: number, wing = false) =>
  0.73 + index * 0.007 + (wing ? 0.003 : 0);
export const floorBalconyEnd = (index: number, wing = false) =>
  floorBalconyStart(index, wing) + 0.022;

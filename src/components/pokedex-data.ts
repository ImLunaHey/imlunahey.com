export type PokeType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic'
  | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export type CaughtPokemon = {
  id: number;
  name: string;
  types: PokeType[];
  level?: number;
  nickname?: string;
  shiny?: boolean;
  caughtAt?: string;
  location?: string;
};

export type PokedexRun = {
  titleMatch: RegExp;
  gameName: string;
  region: string;
  regionalDexTotal: number;
  caught: CaughtPokemon[];
};

export const TYPE_COLORS: Record<PokeType, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850',
  electric: '#f8d030', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
};

/**
 * Fill in `caught` with real data to activate a run. Each run auto-registers
 * as a "Pokémon game" when a review title matches `titleMatch`; an empty
 * `caught` array means the panel stays hidden (see hasPokedex below).
 *
 * Shape per entry (see CaughtPokemon above): { id, name, types, level?,
 * nickname?, shiny?, caughtAt? (iso date), location? }. Sprites + regional
 * completion are derived automatically.
 */
export const POKEDEX_RUNS: PokedexRun[] = [
  {
    titleMatch: /fire\s*red|leaf\s*green/i,
    gameName: 'Pokémon FireRed / LeafGreen',
    region: 'Kanto',
    regionalDexTotal: 151,
    caught: [],
  },
  {
    titleMatch: /scarlet|violet/i,
    gameName: 'Pokémon Scarlet / Violet',
    region: 'Paldea',
    regionalDexTotal: 400,
    caught: [],
  },
  {
    titleMatch: /legends.*arceus|arceus/i,
    gameName: 'Pokémon Legends: Arceus',
    region: 'Hisui',
    regionalDexTotal: 242,
    caught: [],
  },
];

export function spriteUrl(id: number, shiny?: boolean): string {
  const kind = shiny ? 'shiny/' : '';
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${kind}${id}.png`;
}

export function artworkUrl(id: number, shiny?: boolean): string {
  const kind = shiny ? 'shiny/' : '';
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${kind}${id}.png`;
}

export function padDex(id: number): string {
  return `#${String(id).padStart(4, '0')}`;
}

export function findRun(title: string): PokedexRun | null {
  if (!/pok[eé]mon/i.test(title)) return null;
  for (const run of POKEDEX_RUNS) {
    if (run.titleMatch.test(title)) return run;
  }
  return null;
}

export function hasPokedex(title: string): boolean {
  const run = findRun(title);
  return run !== null && run.caught.length > 0;
}

export function findCaught(title: string, pokeId: number): { run: PokedexRun; poke: CaughtPokemon } | null {
  const run = findRun(title);
  if (!run) return null;
  const poke = run.caught.find((p) => p.id === pokeId);
  if (!poke) return null;
  return { run, poke };
}

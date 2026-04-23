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

export const POKEDEX_RUNS: PokedexRun[] = [
  {
    titleMatch: /fire\s*red|leaf\s*green/i,
    gameName: 'Pokémon FireRed / LeafGreen',
    region: 'Kanto',
    regionalDexTotal: 151,
    caught: [
      { id: 1, name: 'Bulbasaur', types: ['grass', 'poison'], level: 5, caughtAt: '2023-08-01', location: "Prof. Oak's Lab" },
      { id: 4, name: 'Charmander', types: ['fire'], level: 5, caughtAt: '2023-08-01', location: "Prof. Oak's Lab", nickname: 'Ember' },
      { id: 7, name: 'Squirtle', types: ['water'], level: 5, caughtAt: '2023-08-01', location: "Prof. Oak's Lab" },
      { id: 10, name: 'Caterpie', types: ['bug'], level: 3, caughtAt: '2023-08-02', location: 'Viridian Forest' },
      { id: 16, name: 'Pidgey', types: ['normal', 'flying'], level: 4, caughtAt: '2023-08-02', location: 'Route 1' },
      { id: 19, name: 'Rattata', types: ['normal'], level: 3, caughtAt: '2023-08-02', location: 'Route 1' },
      { id: 25, name: 'Pikachu', types: ['electric'], level: 6, caughtAt: '2023-08-03', location: 'Viridian Forest', nickname: 'Sparky' },
      { id: 41, name: 'Zubat', types: ['poison', 'flying'], level: 8, caughtAt: '2023-08-04', location: 'Mt. Moon' },
      { id: 74, name: 'Geodude', types: ['rock', 'ground'], level: 9, caughtAt: '2023-08-04', location: 'Mt. Moon' },
      { id: 63, name: 'Abra', types: ['psychic'], level: 10, caughtAt: '2023-08-05', location: 'Route 24' },
      { id: 54, name: 'Psyduck', types: ['water'], level: 15, caughtAt: '2023-08-07', location: 'Route 25' },
      { id: 129, name: 'Magikarp', types: ['water'], level: 5, caughtAt: '2023-08-08', location: 'Route 4' },
      { id: 92, name: 'Gastly', types: ['ghost', 'poison'], level: 18, caughtAt: '2023-08-10', location: 'Pokémon Tower' },
      { id: 58, name: 'Growlithe', types: ['fire'], level: 18, caughtAt: '2023-08-11', location: 'Route 7', shiny: true, nickname: 'Blaze' },
      { id: 143, name: 'Snorlax', types: ['normal'], level: 30, caughtAt: '2023-08-14', location: 'Route 12' },
      { id: 131, name: 'Lapras', types: ['water', 'ice'], level: 25, caughtAt: '2023-08-16', location: 'Silph Co.' },
      { id: 133, name: 'Eevee', types: ['normal'], level: 25, caughtAt: '2023-08-17', location: 'Celadon Mansion' },
      { id: 149, name: 'Dragonite', types: ['dragon', 'flying'], level: 55, caughtAt: '2023-08-22', location: 'Cerulean Cave' },
      { id: 150, name: 'Mewtwo', types: ['psychic'], level: 70, caughtAt: '2023-08-23', location: 'Cerulean Cave' },
      { id: 151, name: 'Mew', types: ['psychic'], level: 8, caughtAt: '2023-08-24', location: 'Faraway Island' },
    ],
  },
  {
    titleMatch: /scarlet|violet/i,
    gameName: 'Pokémon Scarlet',
    region: 'Paldea',
    regionalDexTotal: 400,
    caught: [
      { id: 906, name: 'Sprigatito', types: ['grass'], level: 5, caughtAt: '2024-05-10', location: 'Cabo Poco', nickname: 'Pesto' },
      { id: 909, name: 'Fuecoco', types: ['fire'], level: 8, caughtAt: '2024-05-11', location: 'South Province' },
      { id: 919, name: 'Lechonk', types: ['normal'], level: 4, caughtAt: '2024-05-10', location: 'South Province' },
      { id: 194, name: 'Wooper', types: ['poison', 'ground'], level: 10, caughtAt: '2024-05-12', location: 'South Province', shiny: true },
      { id: 25, name: 'Pikachu', types: ['electric'], level: 12, caughtAt: '2024-05-13', location: 'East Province', nickname: 'Zappy' },
      { id: 52, name: 'Meowth', types: ['normal'], level: 7, caughtAt: '2024-05-12', location: 'South Province' },
      { id: 950, name: 'Klawf', types: ['rock'], level: 20, caughtAt: '2024-05-15', location: 'Asado Desert' },
      { id: 128, name: 'Tauros', types: ['fighting'], level: 22, caughtAt: '2024-05-16', location: 'South Province' },
      { id: 944, name: 'Shroodle', types: ['poison', 'normal'], level: 14, caughtAt: '2024-05-14', location: 'West Province' },
      { id: 940, name: 'Wattrel', types: ['electric', 'flying'], level: 18, caughtAt: '2024-05-16', location: 'East Province' },
      { id: 931, name: 'Squawkabilly', types: ['normal', 'flying'], level: 11, caughtAt: '2024-05-13', location: 'South Province' },
      { id: 923, name: 'Pawmi', types: ['electric'], level: 6, caughtAt: '2024-05-11', location: 'South Province' },
      { id: 958, name: 'Tinkatink', types: ['fairy', 'steel'], level: 16, caughtAt: '2024-05-15', location: 'West Province', nickname: 'Hammer' },
      { id: 929, name: 'Maschiff', types: ['dark'], level: 19, caughtAt: '2024-05-17', location: 'Asado Desert' },
      { id: 935, name: 'Charcadet', types: ['fire'], level: 17, caughtAt: '2024-05-15', location: 'Asado Desert' },
      { id: 962, name: 'Bombirdier', types: ['flying', 'dark'], level: 23, caughtAt: '2024-05-18', location: 'Glaseado Mountain' },
      { id: 981, name: 'Frigibax', types: ['dragon', 'ice'], level: 31, caughtAt: '2024-05-22', location: 'Glaseado Mountain', nickname: 'Popsicle', shiny: true },
      { id: 984, name: 'Great Tusk', types: ['ground', 'fighting'], level: 60, caughtAt: '2024-06-02', location: 'Area Zero' },
      { id: 998, name: 'Baxcalibur', types: ['dragon', 'ice'], level: 60, caughtAt: '2024-06-04', location: 'Glaseado Mountain', nickname: 'Shogun' },
      { id: 1007, name: 'Koraidon', types: ['fighting', 'dragon'], level: 72, caughtAt: '2024-06-05', location: 'Area Zero' },
    ],
  },
  {
    titleMatch: /legends.*arceus|arceus/i,
    gameName: 'Pokémon Legends: Arceus',
    region: 'Hisui',
    regionalDexTotal: 242,
    caught: [
      { id: 722, name: 'Rowlet', types: ['grass', 'flying'], level: 5, caughtAt: '2023-02-14', location: 'Obsidian Fieldlands' },
      { id: 155, name: 'Cyndaquil', types: ['fire'], level: 5, caughtAt: '2023-02-14', location: 'Obsidian Fieldlands' },
      { id: 501, name: 'Oshawott', types: ['water'], level: 5, caughtAt: '2023-02-14', location: 'Obsidian Fieldlands' },
      { id: 399, name: 'Bidoof', types: ['normal'], level: 3, caughtAt: '2023-02-14', location: 'Obsidian Fieldlands', nickname: 'Chonk' },
      { id: 396, name: 'Starly', types: ['normal', 'flying'], level: 4, caughtAt: '2023-02-14', location: 'Obsidian Fieldlands' },
      { id: 66, name: 'Machop', types: ['fighting'], level: 12, caughtAt: '2023-02-17', location: 'Crimson Mirelands' },
      { id: 133, name: 'Eevee', types: ['normal'], level: 18, caughtAt: '2023-02-19', location: 'Obsidian Fieldlands', shiny: true, nickname: 'Lucky' },
      { id: 483, name: 'Dialga', types: ['steel', 'dragon'], level: 70, caughtAt: '2023-03-02', location: 'Spear Pillar' },
      { id: 484, name: 'Palkia', types: ['water', 'dragon'], level: 70, caughtAt: '2023-03-02', location: 'Spear Pillar' },
      { id: 493, name: 'Arceus', types: ['normal'], level: 100, caughtAt: '2023-03-10', location: 'Hall of Origin' },
    ],
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
  return findRun(title) !== null;
}

export function findCaught(title: string, pokeId: number): { run: PokedexRun; poke: CaughtPokemon } | null {
  const run = findRun(title);
  if (!run) return null;
  const poke = run.caught.find((p) => p.id === pokeId);
  if (!poke) return null;
  return { run, poke };
}

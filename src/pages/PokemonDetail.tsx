import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { getPopfeedGames } from '../server/popfeed';
import {
  TYPE_COLORS,
  artworkUrl,
  findCaught,
  padDex,
  spriteUrl,
  type PokeType,
} from '../components/pokedex-data';

type ApiStat = { base_stat: number; stat: { name: string } };
type ApiAbility = { ability: { name: string }; is_hidden: boolean };
type ApiType = { slot: number; type: { name: PokeType } };
type PokeApiResp = {
  id: number;
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  base_experience?: number;
  stats: ApiStat[];
  abilities: ApiAbility[];
  types: ApiType[];
  sprites: {
    front_default?: string;
    back_default?: string;
    front_shiny?: string;
    back_shiny?: string;
  };
};

type FlavorText = { flavor_text: string; language: { name: string }; version: { name: string } };
type Genus = { genus: string; language: { name: string } };
type PokeSpeciesResp = {
  flavor_text_entries: FlavorText[];
  genera: Genus[];
  habitat?: { name: string } | null;
  color?: { name: string };
  is_legendary?: boolean;
  is_mythical?: boolean;
  capture_rate?: number;
  base_happiness?: number;
  growth_rate?: { name: string };
};

const STAT_LABELS: Record<string, string> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'sp.atk',
  'special-defense': 'sp.def',
  speed: 'spe',
};

function cleanFlavor(text: string): string {
  return text.replace(/[\f­]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function PokemonDetail() {
  const params = useParams({ strict: false }) as { rkey?: string; pokeId?: string };
  const rkey = params.rkey ?? '';
  const pokeId = Number(params.pokeId ?? 0);

  const { data: games, isPending: gamesPending } = useQuery({
    queryKey: ['popfeed', 'games'],
    queryFn: () => getPopfeedGames(),
  });
  const { data: pokeData, isPending: pokePending } = useQuery({
    queryKey: ['pokeapi', 'pokemon', pokeId],
    queryFn: () => fetch(`https://pokeapi.co/api/v2/pokemon/${pokeId}`).then((r) => r.json() as Promise<PokeApiResp>),
    enabled: pokeId > 0,
    staleTime: 1000 * 60 * 60 * 24,
  });
  const { data: speciesData } = useQuery({
    queryKey: ['pokeapi', 'species', pokeId],
    queryFn: () => fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokeId}`).then((r) => r.json() as Promise<PokeSpeciesResp>),
    enabled: pokeId > 0,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const loading = gamesPending || pokePending;

  if (!loading && games) {
    const game = games.items.find((i) => i.rkey === rkey);
    if (!game) return <Navigate to={'/not-found' as never} replace />;
    const match = findCaught(game.title, pokeId);
    if (!match) return <Navigate to={'/not-found' as never} replace />;
  }

  const game = games?.items.find((i) => i.rkey === rkey);
  const match = game ? findCaught(game.title, pokeId) : null;
  const poke = match?.poke;
  const run = match?.run;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-pkmn">
        <div className="crumbs">
          <Link to={`/games/${rkey}` as never} className="t-accent">← back to {game?.title.toLowerCase() ?? 'game'}</Link>
        </div>

        {loading || !poke || !run ? (
          <DetailSkel />
        ) : (
          <DetailBody
            poke={poke}
            run={run}
            pokeData={pokeData}
            speciesData={speciesData}
            gameTitle={game?.title ?? ''}
          />
        )}

        <footer className="pkmn-footer">
          <span>src: <span className="t-accent">pokeapi.co</span> · sprites: pokeapi/sprites</span>
          <Link to={`/games/${rkey}` as never} className="t-accent">← back</Link>
        </footer>
      </main>
    </>
  );
}

function DetailBody({
  poke,
  run,
  pokeData,
  speciesData,
  gameTitle,
}: {
  poke: ReturnType<typeof findCaught> extends infer T ? (T extends { poke: infer P } ? P : never) : never;
  run: ReturnType<typeof findCaught> extends infer T ? (T extends { run: infer R } ? R : never) : never;
  pokeData?: PokeApiResp;
  speciesData?: PokeSpeciesResp;
  gameTitle: string;
}) {
  const [showShiny, setShowShiny] = useState<boolean>(Boolean(poke.shiny));
  const primary = TYPE_COLORS[poke.types[0]];
  const secondary = poke.types[1] ? TYPE_COLORS[poke.types[1]] : primary;

  const flavor = speciesData?.flavor_text_entries
    ?.filter((f) => f.language.name === 'en')
    ?.map((f) => cleanFlavor(f.flavor_text))
    ?.reduce<string[]>((acc, t) => (acc.includes(t) ? acc : [...acc, t]), [])
    ?.slice(0, 3) ?? [];

  const genus = speciesData?.genera?.find((g) => g.language.name === 'en')?.genus;

  const stats = pokeData?.stats ?? [];
  const totalStats = stats.reduce((s, x) => s + x.base_stat, 0);
  const maxStat = 255;

  return (
    <article className="pkmn" style={{ ['--t1' as string]: primary, ['--t2' as string]: secondary }}>
      <div className="pkmn-hero">
        <div className="pkmn-art-wrap">
          <div className="pkmn-dex-big">{padDex(poke.id)}</div>
          <img
            className={`pkmn-art ${showShiny ? 'is-shiny' : ''}`}
            src={artworkUrl(poke.id, showShiny)}
            alt={poke.name}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes('/shiny/')) img.src = artworkUrl(poke.id, false);
              else if (img.src.includes('official-artwork')) img.src = spriteUrl(poke.id, showShiny);
            }}
          />
          <div className="pkmn-art-ctrl">
            <button
              className={`toggle ${!showShiny ? 'on' : ''}`}
              onClick={() => setShowShiny(false)}
            >normal</button>
            <button
              className={`toggle shiny ${showShiny ? 'on' : ''}`}
              onClick={() => setShowShiny(true)}
            >★ shiny</button>
          </div>
        </div>

        <div className="pkmn-id">
          {poke.nickname ? (
            <>
              <h1 className="pkmn-name">{poke.nickname}</h1>
              <div className="pkmn-species">{poke.name.toLowerCase()}{genus ? ` · ${genus.toLowerCase()}` : ''}</div>
            </>
          ) : (
            <>
              <h1 className="pkmn-name">{poke.name.toLowerCase()}</h1>
              {genus ? <div className="pkmn-species">{genus.toLowerCase()}</div> : null}
            </>
          )}

          <div className="pkmn-types">
            {poke.types.map((t) => (
              <span key={t} className="pkmn-type" style={{ background: TYPE_COLORS[t] }}>{t}</span>
            ))}
          </div>

          {(speciesData?.is_legendary || speciesData?.is_mythical || poke.shiny) && (
            <div className="pkmn-badges">
              {speciesData?.is_legendary ? <span className="badge legendary">legendary</span> : null}
              {speciesData?.is_mythical ? <span className="badge mythical">mythical</span> : null}
              {poke.shiny ? <span className="badge shiny">★ shiny</span> : null}
            </div>
          )}

          <div className="pkmn-meta-grid">
            {pokeData ? <Meta label="height" value={`${(pokeData.height / 10).toFixed(1)} m`} /> : null}
            {pokeData ? <Meta label="weight" value={`${(pokeData.weight / 10).toFixed(1)} kg`} /> : null}
            {speciesData?.habitat ? <Meta label="habitat" value={speciesData.habitat.name.replace(/-/g, ' ')} /> : null}
            {speciesData?.color ? <Meta label="color" value={speciesData.color.name} /> : null}
            {speciesData?.capture_rate != null ? (
              <Meta label="catch rate" value={`${speciesData.capture_rate} / 255`} />
            ) : null}
            {speciesData?.growth_rate ? (
              <Meta label="growth" value={speciesData.growth_rate.name.replace(/-/g, ' ')} />
            ) : null}
          </div>
        </div>
      </div>

      <section className="pkmn-section caught-section">
        <div className="sect-hd">── caught in <span className="t-accent">{gameTitle.toLowerCase()}</span></div>
        <div className="caught-grid">
          {poke.level != null ? <CaughtItem label="level" value={`lv. ${poke.level}`} /> : null}
          {poke.location ? <CaughtItem label="location" value={poke.location} /> : null}
          {poke.caughtAt ? <CaughtItem label="date" value={poke.caughtAt} /> : null}
          <CaughtItem label="region" value={run.region} />
          {poke.nickname ? <CaughtItem label="nickname" value={`"${poke.nickname}"`} /> : null}
          {poke.shiny ? <CaughtItem label="rarity" value="★ shiny" shiny /> : null}
        </div>
      </section>

      {flavor.length > 0 ? (
        <section className="pkmn-section">
          <div className="sect-hd">── pokédex entry</div>
          <div className="flavor-stack">
            {flavor.map((t, i) => (
              <p key={i} className="flavor">"{t}"</p>
            ))}
          </div>
        </section>
      ) : null}

      {stats.length > 0 ? (
        <section className="pkmn-section">
          <div className="sect-hd">
            ── base stats <span className="sect-sub">total · <b>{totalStats}</b></span>
          </div>
          <div className="stats-stack">
            {stats.map((s) => (
              <div key={s.stat.name} className="stat-row">
                <div className="stat-lbl">{STAT_LABELS[s.stat.name] ?? s.stat.name}</div>
                <div className="stat-bar">
                  <div
                    className="stat-fill"
                    style={{
                      width: `${(s.base_stat / maxStat) * 100}%`,
                      background: statColor(s.base_stat),
                    }}
                  />
                </div>
                <div className="stat-num">{s.base_stat}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {pokeData?.abilities && pokeData.abilities.length > 0 ? (
        <section className="pkmn-section">
          <div className="sect-hd">── abilities</div>
          <div className="abilities">
            {pokeData.abilities.map((a) => (
              <span key={a.ability.name} className={`ability ${a.is_hidden ? 'hidden' : ''}`}>
                {a.ability.name.replace(/-/g, ' ')}
                {a.is_hidden ? <span className="hidden-tag">hidden</span> : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {pokeData?.sprites ? (
        <section className="pkmn-section">
          <div className="sect-hd">── sprites</div>
          <div className="sprite-row">
            <SpriteBox label="front" src={pokeData.sprites.front_default} />
            <SpriteBox label="back" src={pokeData.sprites.back_default} />
            <SpriteBox label="front ★" src={pokeData.sprites.front_shiny} shiny />
            <SpriteBox label="back ★" src={pokeData.sprites.back_shiny} shiny />
          </div>
        </section>
      ) : null}
    </article>
  );
}

function statColor(val: number): string {
  // red → yellow → green gradient based on value
  if (val < 60) return 'oklch(0.65 0.18 25)';
  if (val < 90) return 'oklch(0.78 0.17 75)';
  if (val < 120) return 'oklch(0.82 0.17 115)';
  return 'oklch(0.86 0.19 145)';
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-cell">
      <div className="meta-lbl">{label}</div>
      <div className="meta-val">{value}</div>
    </div>
  );
}

function CaughtItem({ label, value, shiny }: { label: string; value: string; shiny?: boolean }) {
  return (
    <div className={`caught-cell ${shiny ? 'shiny' : ''}`}>
      <div className="caught-lbl">{label}</div>
      <div className="caught-val">{value}</div>
    </div>
  );
}

function SpriteBox({ label, src, shiny }: { label: string; src?: string; shiny?: boolean }) {
  if (!src) return null;
  return (
    <div className={`sprite-box ${shiny ? 'shiny' : ''}`}>
      <img src={src} alt={label} className="sprite-img" />
      <div className="sprite-lbl">{label}</div>
    </div>
  );
}

function DetailSkel() {
  return (
    <article className="pkmn">
      <div className="pkmn-hero">
        <div className="pkmn-art-wrap">
          <div className="pkmn-art skel" style={{ width: 280, height: 280 }} />
        </div>
        <div className="pkmn-id">
          <div className="skel" style={{ width: '60%', height: 48, marginBottom: 10 }} />
          <div className="skel" style={{ width: '40%', height: 14, marginBottom: 16 }} />
          <div className="skel" style={{ width: '80%', height: 24 }} />
        </div>
      </div>
    </article>
  );
}

const CSS = `
  .shell-pkmn {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--sp-6);
    position: relative;
  }

  .crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-5);
    padding-top: var(--sp-4);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); text-decoration: none; }

  .pkmn {
    position: relative;
  }
  .pkmn::before {
    content: '';
    position: absolute;
    top: -40px; left: -200px; right: -200px;
    height: 400px;
    background: radial-gradient(ellipse at top,
      color-mix(in srgb, var(--t1) 15%, transparent) 0%,
      transparent 60%);
    pointer-events: none;
    z-index: -1;
  }

  .pkmn-hero {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: var(--sp-6);
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
    align-items: center;
  }

  .pkmn-art-wrap {
    position: relative;
    background:
      radial-gradient(circle at center,
        color-mix(in srgb, var(--t1) 25%, transparent) 0%,
        color-mix(in srgb, var(--t2) 15%, transparent) 40%,
        transparent 75%),
      var(--color-bg-panel);
    border: 1px solid var(--color-border);
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .pkmn-art-wrap::after {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(circle at 30% 30%,
        rgba(255, 255, 255, 0.05) 0%,
        transparent 50%);
    pointer-events: none;
  }
  .pkmn-dex-big {
    position: absolute;
    top: 12px; left: 14px;
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    color: var(--color-fg-ghost);
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .pkmn-art {
    width: 75%;
    height: 75%;
    object-fit: contain;
    filter: drop-shadow(0 8px 24px color-mix(in srgb, var(--t1) 50%, transparent));
    transition: transform 0.3s;
  }
  .pkmn-art.is-shiny {
    filter:
      drop-shadow(0 0 12px rgba(255, 215, 0, 0.4))
      drop-shadow(0 8px 24px color-mix(in srgb, var(--t1) 50%, transparent));
  }
  .pkmn-art-wrap:hover .pkmn-art { transform: scale(1.04); }

  .pkmn-art-ctrl {
    position: absolute;
    bottom: var(--sp-3);
    left: 50%;
    transform: translateX(-50%);
    display: flex; gap: 4px;
    background: var(--color-bg);
    padding: 3px;
    border: 1px solid var(--color-border);
  }
  .pkmn-art-ctrl .toggle {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 0;
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .pkmn-art-ctrl .toggle:hover { color: var(--color-fg); }
  .pkmn-art-ctrl .toggle.on { background: var(--color-accent); color: #000; }
  .pkmn-art-ctrl .toggle.shiny.on { background: #ffd700; color: #000; }

  .pkmn-id {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }
  .pkmn-name {
    font-family: var(--font-display);
    font-size: clamp(42px, 6vw, 72px);
    font-weight: 500;
    line-height: 0.95;
    color: var(--color-fg);
    letter-spacing: -0.03em;
    text-transform: lowercase;
    word-break: break-word;
  }
  .pkmn-species {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-faint);
  }

  .pkmn-types {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pkmn-type {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: #000;
    padding: 3px 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }

  .pkmn-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .badge {
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 2px 7px;
    border: 1px solid;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .badge.legendary { color: #f8d030; border-color: #f8d030; }
  .badge.mythical { color: #ee99ac; border-color: #ee99ac; }
  .badge.shiny { color: #ffd700; border-color: #ffd700; text-shadow: 0 0 6px rgba(255,215,0,0.4); }

  .pkmn-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--sp-2);
    margin-top: var(--sp-2);
    padding: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .meta-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }
  .meta-val {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
    text-transform: lowercase;
  }

  .pkmn-section {
    padding: var(--sp-5) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .pkmn-section:last-of-type { border-bottom: 0; }
  .sect-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }
  .sect-sub { margin-left: var(--sp-3); color: var(--color-fg-faint); }
  .sect-sub b { color: var(--color-accent); font-weight: 400; }

  .caught-section {
    padding: var(--sp-5);
    margin-top: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    border-bottom: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 3%, transparent);
  }
  .caught-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--sp-2);
  }
  .caught-cell {
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg);
  }
  .caught-cell.shiny {
    border-color: #ffd700;
    background: color-mix(in srgb, #ffd700 6%, var(--color-bg));
  }
  .caught-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    margin-bottom: 2px;
  }
  .caught-val {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
  }
  .caught-cell.shiny .caught-val { color: #ffd700; }

  .flavor-stack {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .flavor {
    font-size: var(--fs-md);
    line-height: 1.65;
    color: var(--color-fg-dim);
    padding-left: var(--sp-3);
    border-left: 2px solid var(--color-accent-faint);
    font-style: italic;
  }

  .stats-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .stat-row {
    display: grid;
    grid-template-columns: 60px 1fr 40px;
    gap: var(--sp-3);
    align-items: center;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .stat-lbl {
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }
  .stat-bar {
    height: 10px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
    position: relative;
  }
  .stat-fill {
    height: 100%;
    transition: width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
    box-shadow: 0 0 8px color-mix(in srgb, currentColor 40%, transparent);
  }
  .stat-num {
    color: var(--color-fg);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .abilities {
    display: flex;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .ability {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 5px 12px;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    text-transform: lowercase;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .ability.hidden {
    border-color: var(--color-accent-dim);
    color: var(--color-accent);
  }
  .hidden-tag {
    font-size: 9px;
    padding: 1px 5px;
    background: var(--color-accent);
    color: #000;
    letter-spacing: 0.05em;
  }

  .sprite-row {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .sprite-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--sp-2);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .sprite-box.shiny {
    border-color: color-mix(in srgb, #ffd700 35%, var(--color-border));
  }
  .sprite-img {
    width: 96px; height: 96px;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    object-fit: contain;
  }
  .sprite-lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }

  .pkmn-footer {
    display: flex;
    justify-content: space-between;
    padding: var(--sp-6) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 640px) {
    .pkmn-hero { grid-template-columns: 1fr; }
    .pkmn-art-wrap { max-width: 280px; margin: 0 auto; }
  }
  @media (max-width: 560px) {
    .shell-pkmn { padding: var(--sp-4); }
    .stat-row { grid-template-columns: 50px 1fr 36px; gap: var(--sp-2); }
  }
`;

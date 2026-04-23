import { createFileRoute } from '@tanstack/react-router';
import PokemonDetail from '../../../../pages/PokemonDetail';

export const Route = createFileRoute('/_main/pokedex/$rkey/$pokeId')({
  component: PokemonDetail,
});

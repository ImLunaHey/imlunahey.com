import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';

const LAT = 51.5072;
const LON = -0.1276;

const CODE_TEXT: Record<number, string> = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'foggy',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm',
  99: 'thunderstorm',
};

export type Weather = {
  tempC: number;
  code: string;
};

async function loadWeather(): Promise<Weather | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&temperature_unit=celsius`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    current_weather?: { temperature: number; weathercode: number };
  };
  if (!data.current_weather) return null;
  return {
    tempC: Math.round(data.current_weather.temperature * 10) / 10,
    code: CODE_TEXT[data.current_weather.weathercode] ?? 'unknown',
  };
}

export const getWeather = createServerFn({ method: 'GET' }).handler((): Promise<Weather | null> =>
  cached('weather:london', TTL.medium, loadWeather).catch(() => null),
);

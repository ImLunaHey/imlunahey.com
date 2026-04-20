import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';

export type GalleryKind = 'mj' | 'photo';

export type GalleryItem = {
  key: string;
  kind: GalleryKind;
  series?: string;
  prompt?: string;
  model?: string;
  seed?: number;
  createdAt: string;
  w: number;
  h: number;
  blurhash?: string;
};

export type GalleryManifest = {
  generatedAt: string;
  count: number;
  items: GalleryItem[];
};

export type GalleryData = {
  status: 'unconfigured' | 'empty' | 'error' | 'ready';
  publicUrl: string;
  items: GalleryItem[];
  generatedAt: string | null;
};

async function loadManifest(): Promise<GalleryData> {
  const publicUrl = process.env.R2_PUBLIC_URL ?? '';
  if (!publicUrl) {
    return { status: 'unconfigured', publicUrl: '', items: [], generatedAt: null };
  }
  const res = await fetch(`${publicUrl.replace(/\/$/, '')}/manifest.json`);
  if (res.status === 404) {
    return { status: 'empty', publicUrl, items: [], generatedAt: null };
  }
  if (!res.ok) {
    return { status: 'error', publicUrl, items: [], generatedAt: null };
  }
  const manifest = (await res.json()) as GalleryManifest;
  return {
    status: 'ready',
    publicUrl,
    items: manifest.items ?? [],
    generatedAt: manifest.generatedAt ?? null,
  };
}

export const getGallery = createServerFn({ method: 'GET' }).handler((): Promise<GalleryData> =>
  cached('gallery:manifest', TTL.medium, loadManifest).catch(() => ({
    status: 'error' as const,
    publicUrl: process.env.R2_PUBLIC_URL ?? '',
    items: [],
    generatedAt: null,
  })),
);

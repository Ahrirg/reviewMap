#!/usr/bin/env node
/**
 * Optional demo data. Never runs automatically.
 *
 *   npm run seed          a handful of hand-written Kaunas markers
 *   npm run seed 2000     the same, plus 2000 random markers for performance testing
 *
 * Markers are inserted directly through the service layer, so they go through
 * the same transaction and validation path as a real request. No media is
 * attached, because seeding cannot invent real photos or videos.
 */
import { getDb, ensureDirectories } from '../src/db/index.js';
import * as q from '../src/db/queries.js';
import { MAP_DEFAULTS } from '../src/config.js';
import { CATEGORY_IDS } from '../../shared/categories.js';

const SAMPLES = [
  {
    latitude: 54.8985, longitude: 23.9036, category: 'Vaizdas',
    reviews: [
      { userName: 'Jonas', text: 'Rotušės aikštė vakare atrodo nuostabiai. Verta užsukti.' },
      { userName: 'Gabija', text: 'Gražu, bet savaitgaliais labai daug žmonių.' },
    ],
  },
  {
    latitude: 54.8968, longitude: 23.8869, category: 'Maistas',
    reviews: [{ userName: 'Tomas', text: 'Labai geras maistas ir greitas aptarnavimas.' }],
  },
  {
    latitude: 54.9027, longitude: 23.9598, category: 'Vaizdas',
    reviews: [{ userName: 'Rūta', text: 'Panorama nuo kalno tikrai verta pasivaikščiojimo.' }],
  },
  {
    latitude: 54.8919, longitude: 23.9036, category: 'Toletai',
    reviews: [{ userName: 'Mantas', text: 'Švarus ir nemokamas. Retas derinys.' }],
  },
  {
    latitude: 54.9055, longitude: 23.9270, category: 'Kedes',
    reviews: [{ userName: 'Eglė', text: 'Patogūs suoliukai pavėsyje, gera vieta pailsėti.' }],
  },
  {
    latitude: 54.8874, longitude: 23.9284, category: 'Random',
    reviews: [{ userName: 'Domas', text: 'Įdomus grafitis ant sienos, verta nufotografuoti.' }],
  },
];

function seedSamples(db) {
  const run = db.transaction(() => {
    for (const sample of SAMPLES) {
      const marker = q.insertMarker(sample.latitude, sample.longitude, sample.category);
      for (const review of sample.reviews) {
        q.insertReview(marker.id, review.userName, review.text);
      }
    }
  });
  run();
  return SAMPLES.length;
}

function seedRandom(db, count) {
  const { center } = MAP_DEFAULTS;
  const names = ['Jonas', 'Rūta', 'Tomas', 'Gabija', 'Mantas', 'Eglė', 'Domas', 'Ieva'];
  const run = db.transaction(() => {
    for (let i = 0; i < count; i += 1) {
      const latitude = center.latitude + (Math.random() - 0.5) * 0.14;
      const longitude = center.longitude + (Math.random() - 0.5) * 0.26;
      const category = CATEGORY_IDS[Math.floor(Math.random() * CATEGORY_IDS.length)];
      const marker = q.insertMarker(latitude, longitude, category);
      if (Math.random() < 0.4) {
        const userName = names[Math.floor(Math.random() * names.length)];
        q.insertReview(marker.id, userName, `Demo atsiliepimas #${i + 1}.`);
      }
    }
  });
  run();
  return count;
}

const extra = Number(process.argv[2]) || 0;

ensureDirectories();
const db = getDb();

const sampleCount = seedSamples(db);
console.log(`Seeded ${sampleCount} sample markers around Kaunas.`);

if (extra > 0) {
  const n = seedRandom(db, extra);
  console.log(`Seeded ${n} additional random markers for performance testing.`);
}

const totals = q.counts();
console.log(`Database now holds ${totals.markers} markers and ${totals.reviews} reviews.`);
db.close();

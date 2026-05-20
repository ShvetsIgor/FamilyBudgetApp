import type { ItemEntry } from './types';

export const TRANSPORT_ITEMS: Record<string, ItemEntry> = {

  // ── Public transport ──────────────────────────────────────────────────────
  'автобус':          { categoryId: 'public_transport' },
  'метро':            { categoryId: 'public_transport' },
  'проезд':           { categoryId: 'public_transport' },
  'bus':              { categoryId: 'public_transport' },
  'metro':            { categoryId: 'public_transport' },
  'אוטובוס':          { categoryId: 'public_transport' },

  // ── Taxi ──────────────────────────────────────────────────────────────────
  'такси':            { categoryId: 'taxi' },
  'taxi':             { categoryId: 'taxi' },
  'מונית':            { categoryId: 'taxi' },

  // ── Train ─────────────────────────────────────────────────────────────────
  'поезд':            { categoryId: 'train' },
  'электричка':       { categoryId: 'train' },
  'train':            { categoryId: 'train' },
  'רכבת':             { categoryId: 'train' },

  // ── Bus pass ──────────────────────────────────────────────────────────────
  'проездной':        { categoryId: 'bus_pass' },
  'рав кав':          { categoryId: 'bus_pass' },
  'rav kav':          { categoryId: 'bus_pass' },
  'bus pass':         { categoryId: 'bus_pass' },
  'רב קו':            { categoryId: 'bus_pass' },

  // ── Fuel ──────────────────────────────────────────────────────────────────
  'бензин':           { categoryId: 'fuel' },
  'топливо':          { categoryId: 'fuel' },
  'дизель':           { categoryId: 'fuel' },
  'заправка':         { categoryId: 'fuel' },
  'fuel':             { categoryId: 'fuel' },
  'petrol':           { categoryId: 'fuel' },
  'diesel':           { categoryId: 'fuel' },
  'gas station':      { categoryId: 'fuel' },
  'בנזין':            { categoryId: 'fuel' },
  'דלק':              { categoryId: 'fuel' },

  // ── Parking ───────────────────────────────────────────────────────────────
  'парковка':         { categoryId: 'parking' },
  'parking':          { categoryId: 'parking' },
  'חניה':             { categoryId: 'parking' },

  // ── Car service / wash ────────────────────────────────────────────────────
  'шины':             { categoryId: 'car_service' },
  'резина':           { categoryId: 'car_service' },
  'tires':            { categoryId: 'car_service' },
  'мойка':            { categoryId: 'car_wash' },
  'car wash':         { categoryId: 'car_wash' },
};

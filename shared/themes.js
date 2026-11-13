// Shared between the editor and server-side validation so their options cannot drift.
export const THEMES = Object.freeze([
  { id: 'midnight-gold', label: 'Midnight Gold', description: 'Classic & premium', accent: '#f3b35e', color: '#14233f', secondary: '#43679a' },
  { id: 'violet-night', label: 'Violet Night', description: 'Dreamy & electric', accent: '#c1a5ff', color: '#211836', secondary: '#7257bd' },
  { id: 'sakura', label: 'Sakura', description: 'Soft & playful', accent: '#f4a7bf', color: '#301b30', secondary: '#bf678a' },
  { id: 'ocean-blue', label: 'Ocean Blue', description: 'Cool & cinematic', accent: '#65c8ff', color: '#09283d', secondary: '#287cab' },
  { id: 'emerald-noir', label: 'Emerald Noir', description: 'Deep & refined', accent: '#6bdfad', color: '#102c29', secondary: '#3c937a' },
  { id: 'crimson-flare', label: 'Crimson Flare', description: 'Bold & dramatic', accent: '#ff8587', color: '#361c27', secondary: '#b94b61' },
  { id: 'arctic-silver', label: 'Arctic Silver', description: 'Clean & modern', accent: '#b9d8ed', color: '#202d39', secondary: '#708ba1' },
  { id: 'sunset-ember', label: 'Sunset Ember', description: 'Warm & vibrant', accent: '#ffad70', color: '#35251f', secondary: '#c07150' },
]);

export const DEFAULT_APP_UI = Object.freeze({
  display_name: 'AnimePlex',
  tagline: 'Your next story starts here.',
  home_layout: 'cinematic',
  opening_screen: 'home',
  navigation_style: 'floating',
  animation_level: 'full',
  poster_style: 'portrait',
  background_url: '',
});

export const APP_UI_OPTIONS = Object.freeze({
  home_layout: ['cinematic', 'classic', 'compact'],
  opening_screen: ['home', 'sources', 'library', 'profile'],
  navigation_style: ['floating', 'classic'],
  animation_level: ['full', 'reduced', 'off'],
  poster_style: ['portrait', 'landscape'],
});

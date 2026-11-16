export const initialProjects = [
  { n: 'Chronicles of Kaito', st: 'Draft', pg: 14, of: 24 },
  { n: 'Neon Ronin', st: 'Published', pg: 32, of: 32 },
  { n: 'Hollow Tide', st: 'Draft', pg: 5, of: 20 },
];

export const characters = [
  { n: 'Kaito Ardent', role: 'Flame-weaver in the red hood', tr: 'Fierce, stubborn, protects his friends', ab: 'Ember magic' },
  { n: 'Nox Valen', role: 'Shadow duelist', tr: 'Cool, guarded, quietly loyal', ab: 'Void currents' },
  { n: 'Hana Mirei', role: 'Spirit-bond student', tr: 'Cheerful, fearless, team morale', ab: 'Charm sigils' },
  { n: 'Vesper Ito', role: 'Cyber songstress', tr: 'Calm, precise, hides her worries', ab: 'Resonance hacking' },
  { n: 'Pip', role: 'Scholar with a cat familiar', tr: 'Bookish, curious, observant', ab: 'Lorekeeping' },
  { n: 'Gorran', role: 'Fur-mantled brawler', tr: 'Bold, boastful, fiercely loyal', ab: 'Titan strength' },
  { n: 'Luma Starweaver', role: 'Apprentice witch', tr: 'Shy, dreamy, braver than she looks', ab: 'Star magic' },
  { n: 'Elias Quill', role: 'Archivist scholar', tr: 'Logical, dry-witted, loyal', ab: 'Lore recall' },
  { n: 'Ember Vale', role: 'Crimson scout', tr: 'Proud, quick, competitive', ab: 'Flame-step' },
  { n: 'Seraphine Noor', role: 'Court sorceress', tr: 'Elegant, calculating, secretive', ab: 'Moon sigils' },
];

export const relationships = [
  [0, 1, 'Rival', 7],
  [0, 2, 'Ally', 9],
  [0, 3, 'Partner', 8],
  [0, 4, 'Mentor', 6],
  [0, 5, 'Sworn brother', 8],
  [1, 3, 'Hunts', 5],
  [4, 5, 'Travel together', 4],
  [2, 6, 'Study partner', 6],
  [6, 7, 'Crossover link', 3],
  [7, 4, 'Teacher', 5],
  [8, 0, 'Rival', 6],
  [9, 1, 'Crossover link', 4],
  [3, 9, 'Ally', 5],
];

export const creators = [
  ['Vanta Ink', 'Noir', 4.8],
  ['Pixel Sage', 'Fantasy', 4.6],
  ['Orbit Kid', 'Sci-fi', 4.9],
  ['Rue Calloway', 'Horror', 4.5],
  ['Moth Lane', 'Fantasy', 4.7],
  ['Tarn & Co', 'Sci-fi', 4.4],
];

export const jobs = [
  ['Inker for fantasy graphic novel', 'Illustrator', '$800–1,200', 'Open', 'Senior'],
  ['Script editor, 12 issues', 'Editor', '$500–700', 'Open', 'Mid'],
  ['Colourist for noir mini-series', 'Illustrator', '$300–450', 'Busy', 'Junior'],
  ['Co-writer, sci-fi anthology', 'Writer', '$600–900', 'Open', 'Senior'],
];

export const storyText = `Chapter 3. Kaito reached the tower at dawn, sword drawn. Hana waited inside, still wounded from the ambush the night before.

"You came alone?" she asked.

Kaito nodded. Nox had already burned the bridge behind them three days ago, yet Kaito crossed it that morning.

He laughed and cheerfully mocked the dead.`;

export const gradients = [
  ['#2b1055', '#7597de'],
  ['#42275a', '#734b6d'],
  ['#0f2027', '#2c5364'],
  ['#4b134f', '#c94b4b'],
  ['#1e130c', '#9a8478'],
  ['#232526', '#6b6b83'],
];

export const icons = {
  burst: 'M12 1l2.5 6L20 3.5 18 10l5 2-5 2 2 6.5L14.5 17 12 23l-2.5-6L4 20.5 6 14l-5-2 5-2-2-6.5L9.5 7z',
  grid: 'M3 3h8v8H3zM13 3h8v5h-8zM13 11h8v10h-8zM3 14h8v7H3z',
  pen: 'M4 20l1-5L16 4l4 4L9 19z',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-5 4-7 8-7s8 2 8 7',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
  panel: 'M3 3h18v18H3zM3 12h18M12 3v9',
  bubble: 'M4 5h16v10h-8l-5 4v-4H4z',
  tag: 'M3 12V3h9l9 9-9 9z',
  rocket: 'M12 2c4 3 5 8 3 13H9C7 10 8 5 12 2zM9 15l-3 4 4-1M15 15l3 4-4-1',
};

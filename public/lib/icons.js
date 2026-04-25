/**
 * Custom SVG icon set for Jivatma — no emojis.
 * All icons are 24x24 stroke-based, inheriting `currentColor`.
 *
 * Use as: icon('home')  or  icon('home', { size: 20, stroke: 2.5 })
 */

const ICONS = {
  // Class types — the calm trio
  in_person: '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/>',
  online:    '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>',
  hybrid:    '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-7"/><rect x="13" y="14" width="9" height="7" rx="1.5"/><path d="M22 16l-3 1.5L22 19z"/>',

  // Nav primary
  classes: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  passes:  '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 12h20M6 16h2"/>',
  more:    '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',

  // Nav secondary
  home:    '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/>',
  history: '<path d="M3 3v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 9"/><path d="M12 7v5l3 2"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  lang:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  logout:  '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',

  // View-toggle (master admin)
  admin:   '<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/>',
  student: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>',

  // Brand mark — abstract lotus
  lotus: '<path d="M12 22c-5 0-9-3-9-7 0-1 1-2 2-2 0 3 3 5 7 5s7-2 7-5c1 0 2 1 2 2 0 4-4 7-9 7z"/><path d="M12 16c-3 0-5-2-5-5 0-2 2-5 5-9 3 4 5 7 5 9 0 3-2 5-5 5z"/>',

  // Status / actions
  check:   '<polyline points="20 6 9 17 4 12"/>',
  x:       '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  spots:   '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  alert:   '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12" y2="17"/>',
  arrow_right: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
};

/**
 * Render an SVG icon as a string.
 * @param {string} name
 * @param {{size?: number, stroke?: number, fill?: string, className?: string}} opts
 */
export function icon(name, opts = {}) {
  const inner = ICONS[name];
  if (!inner) return '';
  const { size = 24, stroke = 2, fill = 'none', className = '' } = opts;
  return `<svg class="icon ${className}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/**
 * Map a class_type string to its icon name.
 */
export function classTypeIcon(type) {
  return type === 'online' ? 'online' : type === 'hybrid' ? 'hybrid' : 'in_person';
}

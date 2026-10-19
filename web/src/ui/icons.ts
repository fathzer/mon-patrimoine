/**
 * Shared inline SVG icons, used by toolbar buttons and modal headers.
 * Colors follow the theme variables so the icons adapt with the CSS.
 */

/** Balance scale tilted to the right, with a red "%" under the higher pan. */
export const TAX_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 5.5 V19"/>
  <path d="M8 20 H16"/>
  <path d="M4.5 4 L19.5 8.5"/>
  <path d="M4.5 4 L1.8 9 M4.5 4 L7.2 9"/>
  <path d="M1.8 9 H7.2"/>
  <path d="M1.8 9 Q4.5 11.8 7.2 9"/>
  <path d="M19.5 8.5 L16.8 13.5 M19.5 8.5 L22.2 13.5"/>
  <path d="M16.8 13.5 H22.2"/>
  <path d="M16.8 13.5 Q19.5 16.3 22.2 13.5"/>
  <text x="6.3" y="16.5" text-anchor="middle" dominant-baseline="central" fill="var(--danger)" stroke="none" font-size="14" font-weight="800" font-family="Inter, sans-serif">%</text>
</svg>`;

/** Circled question mark. */
export const HELP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="9" stroke="var(--color-action)" stroke-width="2" fill="none"/>
  <text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="var(--color-action)" font-size="13" font-family="Inter, sans-serif">?</text>
</svg>`;

/** Closed padlock — shown on read-only historical points. */
export const LOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="4" y="11" width="16" height="10" rx="2"/>
  <path d="M8 11 V7 a4 4 0 0 1 8 0 v4"/>
</svg>`;

/** Open padlock — shown when a historical point is unlocked for editing. */
export const UNLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="4" y="11" width="16" height="10" rx="2"/>
  <path d="M8 11 V7 a4 4 0 0 1 7.8 -1.3"/>
</svg>`;

const BUBBLE_PATH = 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z';
/** The bubble's "..." — filled dots for the outline variant. */
const COMMENT_DOTS = '<circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none"/>';
/** The same dots as even-odd subpaths — genuine holes pierced through the
 *  filled variant, transparent whatever the backdrop. */
const COMMENT_DOT_HOLES = 'M7 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z M15 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z';

/**
 * Speech bubble — annotation/comment markers everywhere (panel button,
 * chart tooltip). The outline variant carries filled dots; the filled one
 * (a comment exists) pierces them through — the fill must not inherit the
 * stroke, which would paint the tiny holes shut, so the outer outline is
 * drawn by a second, fill-less path. `currentColor` driven.
 */
export function commentIcon(filled = false, size = 16): string {
  const body = filled
    ? `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="${BUBBLE_PATH} ${COMMENT_DOT_HOLES}"/><path fill="none" d="${BUBBLE_PATH}"/>`
    : `<path d="${BUBBLE_PATH}"/>${COMMENT_DOTS}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  ${body}
</svg>`;
}

/** Trash can — point/entry deletion in the date and year bars. */
export const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

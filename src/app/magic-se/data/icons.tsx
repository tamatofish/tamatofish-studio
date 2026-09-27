/* ==================== 图标 ==================== */
/* 所有图标共用同一套 stroke 属性，与页面主题色无关（用 currentColor 继承父级颜色） */

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const Icon = {
  logo: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M8 2l6 6-6 6-6-6z" /></svg>),
  chapters: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M3 3h10v10H3z" /><path d="M3 6.5h10" /></svg>),
  nodelib: (<svg viewBox="0 0 16 16" {...strokeProps}><rect x="2.5" y="2.5" width="4.5" height="4.5" /><rect x="9" y="2.5" width="4.5" height="4.5" /><rect x="2.5" y="9" width="4.5" height="4.5" /><rect x="9" y="9" width="4.5" height="4.5" /></svg>),
  templates: (<svg viewBox="0 0 16 16" {...strokeProps}><rect x="2.5" y="2.5" width="11" height="11" /><path d="M2.5 6.5h11" /><path d="M6.5 6.5v7" /></svg>),
  vars: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M2.5 8h11" /><path d="M8 2.5v11" /></svg>),
  video: (<svg viewBox="0 0 16 16" {...strokeProps}><rect x="2.5" y="3.5" width="11" height="9" /><path d="M6.5 6.5l4 1.5-4 1.5z" fill="currentColor" stroke="none" /></svg>),
  help: (<svg viewBox="0 0 16 16" {...strokeProps}><circle cx="8" cy="8" r="5.5" /><path d="M6.2 6.2a1.8 1.8 0 113 1.4c-.7.5-1.2.9-1.2 1.9" /><circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" /></svg>),
  keys: (<svg viewBox="0 0 16 16" {...strokeProps}><rect x="2" y="4.5" width="12" height="7" rx="1" /><path d="M4.5 7h1" /><path d="M7.5 7h1" /><path d="M10.5 7h1" /><path d="M4.5 9.5h7" /></svg>),
  gloss: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M3 3.5h10v9H3z" /><path d="M5.5 3.5v9" /><path d="M5.5 6h7.5" /><path d="M5.5 8.5h7.5" /><path d="M5.5 11h5" /></svg>),
  check: (<svg viewBox="0 0 16 16" {...strokeProps}><circle cx="8" cy="8" r="5.5" /><path d="M5.5 8l1.8 1.8L10.8 6" /></svg>),
  run: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M5.5 4l6.5 4-6.5 4z" /></svg>),
  fav: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M8 2.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11l-3.2 1.7.6-3.6L2.8 6.6l3.6-.5z" /></svg>),
  export: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M8 11V3" /><path d="M5 6l3-3 3 3" /><path d="M3 11v2h10v-2" /></svg>),
  import: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M8 3v8" /><path d="M5 8l3 3 3-3" /><path d="M3 11v2h10v-2" /></svg>),
  undo: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M4 7h6a3 3 0 010 6H6" /><path d="M4 7l2.5-2.5" /><path d="M4 7l2.5 2.5" /></svg>),
  redo: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M12 7H6a3 3 0 000 6h4" /><path d="M12 7l-2.5-2.5" /><path d="M12 7l-2.5 2.5" /></svg>),
  close: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M4 4l8 8" /><path d="M12 4l-8 8" /></svg>),
  minimize: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M4 8h8" /></svg>),
  ue5: (<svg viewBox="0 0 16 16" {...strokeProps}><rect x="2.5" y="3.5" width="11" height="9" rx="1" /><path d="M5.5 6.5h1.5v2a1 1 0 001 1h1" /><path d="M10.5 6.5h1.5v3" /></svg>),
  back: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M10 3L5 8l5 5" /></svg>),
  search: (<svg viewBox="0 0 16 16" {...strokeProps}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>),
  function: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M3 3h10v10H3z" /><path d="M6.5 6.5h3v4" /><path d="M6.5 9.5h3" /></svg>),
  macro: (<svg viewBox="0 0 16 16" {...strokeProps}><rect x="2.5" y="2.5" width="11" height="11" /><path d="M5 8h6" /><path d="M8 5v6" /></svg>),
  code: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M5.5 4L2.5 8l3 4" /><path d="M10.5 4l3 4-3 4" /><path d="M9 3l-2 10" /></svg>),
  variable: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M3 8h10" /><path d="M8 3v10" /><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" /></svg>),
  plus: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M8 3v10" /><path d="M3 8h10" /></svg>),
  edit: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M11 3l2 2-8 8H3v-2z" /></svg>),
  trash: (<svg viewBox="0 0 16 16" {...strokeProps}><path d="M4 5h8" /><path d="M6 5V3h4v2" /><path d="M5 5v8h6V5" /></svg>),
  target: (<svg viewBox="0 0 16 16" {...strokeProps}><circle cx="8" cy="8" r="4" /><path d="M8 1v2" /><path d="M8 13v2" /><path d="M1 8h2" /><path d="M13 8h2" /></svg>),
};

export type IconKey = keyof typeof Icon;
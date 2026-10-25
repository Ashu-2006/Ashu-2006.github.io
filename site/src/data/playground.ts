export type PlayKind = "motion" | "interface" | "poster" | "brand";

export const PLAY_KINDS: Record<PlayKind, string> = {
  motion: "Motion",
  interface: "Interface",
  poster: "Posters",
  brand: "Brand",
};

export type Play = {
  file: string;
  title: string;
  note: string;
  kind: PlayKind;
  year: string;
  tools: string[];
  /** What the piece was for: the one thing it was made to figure out */
  why: string;
};

export const PLAY: Play[] = [
  {
    file: "play/spatial",
    title: "Spatial projects",
    note: "A portfolio you walk through, in 3D.",
    kind: "motion",
    year: "2026",
    tools: ["Framer", "Three.js"],
    why: "Whether a portfolio can feel like a room. Depth helps browsing and hurts reading, so text stays flat on the frames.",
  },
  {
    file: "play/folder",
    title: "Folder",
    note: "A phrase book that opens like a folder.",
    kind: "interface",
    year: "2026",
    tools: ["Figma", "Smart animate"],
    why: "How much a container can say before it opens. The count on the tab does most of the work.",
  },
  {
    file: "play/chess",
    title: "Open Chess Tournament",
    note: "One red knight, a lot of black.",
    kind: "poster",
    year: "2025",
    tools: ["Photoshop", "Illustrator"],
    why: "How little a poster needs. One object, one colour, the date where the eye lands last.",
  },
  {
    file: "play/button-3d",
    title: "3D button",
    note: "A pressable that actually travels.",
    kind: "motion",
    year: "2026",
    tools: ["Framer"],
    why: "Press depth and timing. Under 120ms feels broken, over 250ms feels slow.",
  },
  {
    file: "play/holdout",
    title: "Spindle Sentinel",
    note: "A project card for a fault-detection model.",
    kind: "interface",
    year: "2026",
    tools: ["React", "CSS"],
    why: "Showing a signal before the explanation. The waveform is the headline, the text is the footnote.",
  },
  {
    file: "play/cube",
    title: "Made in Framer",
    note: "Building in public, as a cube.",
    kind: "motion",
    year: "2026",
    tools: ["Framer", "Spline"],
    why: "A title card that loops cleanly. The trick is the last frame matching the first.",
  },
  {
    file: "play/project-card",
    title: "Project card",
    note: "Hover, lift, reveal. Timed by hand.",
    kind: "motion",
    year: "2026",
    tools: ["Framer"],
    why: "Staggering three properties so a hover reads as one movement, not three.",
  },
  {
    file: "play/open-mic",
    title: "Open Mic",
    note: "Chrome microphone, purple and yellow type.",
    kind: "poster",
    year: "2025",
    tools: ["Blender", "Photoshop"],
    why: "Rendering a chrome object properly, then letting the type fight it for attention.",
  },
  {
    file: "play/folders",
    title: "Folders",
    note: "Stacked folders fanning on hover.",
    kind: "interface",
    year: "2026",
    tools: ["Figma"],
    why: "The same folder at three depths, so a stack reads as a stack.",
  },
  {
    file: "play/agent",
    title: "Agent diagram",
    note: "An agent conversation, explained in motion.",
    kind: "motion",
    year: "2026",
    tools: ["After Effects", "Figma"],
    why: "Explaining what an agent did, in the order it did it, in under eight seconds.",
  },
  {
    file: "play/mems",
    title: "MEMS workshop",
    note: "A chip, rendered as a poster.",
    kind: "poster",
    year: "2025",
    tools: ["Blender", "Illustrator"],
    why: "Making a technical workshop look like an event worth leaving the hostel for.",
  },
  {
    file: "play/uniphyte",
    title: "Uniphyte",
    note: "Wordmark over a blurred corridor.",
    kind: "brand",
    year: "2025",
    tools: ["Illustrator", "Photoshop"],
    why: "A wordmark that holds up over any photograph, sharp or not.",
  },
  {
    file: "play/orbita",
    title: "Orbita",
    note: "Event poster, framed in window light.",
    kind: "poster",
    year: "2025",
    tools: ["Photoshop"],
    why: "A poster that still works at thumbnail size on a phone, since that is where it was seen.",
  },
];

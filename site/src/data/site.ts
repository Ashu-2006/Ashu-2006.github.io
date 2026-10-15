export const SITE = {
  name: "Ashutosh Rana",
  role: "Product designer",
  url: "https://ashutoshdesigns.me",
  /* Placeholder until a public inbox is confirmed */
  email: "hello@ashutoshdesigns.me",
  location: "Jabalpur, India",
  timeZone: "Asia/Kolkata",
  availability: "Taking on one freelance project for November",
  description:
    "Ashutosh Rana, product designer. Design and frontend at ArmorIQ, lead product design at Ivish AI. Interfaces built for real data.",
};

export const SOCIALS = [
  { label: "X", handle: "@AshutoshDes", href: "https://x.com/AshutoshDes" },
  { label: "LinkedIn", handle: "ashutosh-rana04", href: "https://www.linkedin.com/in/ashutosh-rana04" },
  { label: "Behance", handle: "ashutoshrana04", href: "https://www.behance.net/ashutoshrana04" },
  { label: "GitHub", handle: "Ashu-2006", href: "https://github.com/Ashu-2006" },
] as const;

export const NAV = [
  { label: "Work", path: "work/" },
  { label: "Playground", path: "playground/" },
  { label: "About", path: "about/" },
  { label: "Contact", path: "#contact" },
] as const;

export type Role = {
  org: string;
  title: string;
  when: string;
  note: string;
  current?: boolean;
  /** Project slugs made in this role. The home index links them and its preview cycles through them */
  projects: string[];
};

export const EXPERIENCE: Role[] = [
  {
    org: "ArmorIQ",
    title: "Design and frontend",
    when: "Now",
    note: "Security for AI agents. The platform, its design system and the internal tools.",
    current: true,
    projects: ["armoriq-platform", "armoriq-design-system", "social-content-tool", "armortools"],
  },
  {
    org: "Ivish AI",
    title: "Lead product designer",
    when: "Now",
    note: "Multimodal translation across text, voice and video.",
    current: true,
    projects: ["verbx", "ivish-website"],
  },
  {
    org: "Summer of Bitcoin",
    title: "Designer track",
    when: "2026",
    note: "Redesigned Shopstr, a Nostr marketplace, and built the frontend.",
    projects: ["shopstr"],
  },
  {
    org: "Freelance",
    title: "Product design and build",
    when: "Ongoing",
    note: "Brand, web and product for founders and small teams.",
    projects: ["kuzara-green", "jobshapes", "atherna", "impressions-of-japan", "distil", "sri-krishna-sagar"],
  },
  {
    org: "Hackathons and side projects",
    title: "Whatever the weekend needs",
    when: "Since 2024",
    note: "Built against a deadline. One of them won an award.",
    projects: ["smile-share", "udte-bhawre", "dash"],
  },
];

export const EDUCATION = {
  org: "IIIT Jabalpur",
  title: "BTech, Design",
  when: "2024 - 2028",
  note: "Second year. Runner-up at Hackbyte 4.0, out of 120+ teams.",
};

export const PRINCIPLES = [
  {
    title: "Read the codebase first",
    body: "Before I open Figma I open the repo. The data shapes, the components that already exist and the API that answers slowly decide more of the interface than a moodboard does.",
  },
  {
    title: "Design every state",
    body: "Empty, loading, error, partial, the 400-row table and the name that does not fit. A screen that only works in the demo is a screen that breaks on Tuesday.",
  },
  {
    title: "Ship the system, not the screen",
    body: "One good page is easy. The tenth page staying consistent is the job, so the output is tokens, primitives and rules that the next person can follow without me.",
  },
] as const;

export const CAPABILITIES = {
  design: [
    "Product design",
    "Design systems and tokens",
    "Data-dense dashboards",
    "Onboarding flows",
    "AI product UX",
    "UX audits",
    "Landing pages",
  ],
  build: ["React and TypeScript", "HTML, CSS and motion", "Vite and Next.js", "Framer", "Figma, variables and libraries", "Cursor and v0"],
} as const;

export const FACTS = [
  { value: "2020", label: "Started learning design from YouTube, during lockdown" },
  { value: "2nd", label: "Place at Hackbyte 4.0, out of 120+ teams" },
  { value: "SoB '26", label: "Summer of Bitcoin, Designer track at Shopstr" },
] as const;

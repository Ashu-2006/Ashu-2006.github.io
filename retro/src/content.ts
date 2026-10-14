/**
 * The words and media come from the main site's content modules, read-only, so both sites stay in step.
 * Only the About copy below is duplicated, because the main site keeps it inline in a page template.
 */
export { PROJECTS, KINDS, bySlug, type Project, type Shot } from "../../hero/src/content/projects";
export { PLAY, PLAY_KINDS, type Play } from "../../hero/src/content/playground";
export { SITE, SOCIALS, EXPERIENCE, EDUCATION, PRINCIPLES, CAPABILITIES, FACTS } from "../../hero/src/content/site";
import media from "../../hero/src/content/media.json";

export type MediaInfo = { w: number; h: number; video?: boolean; schematic?: boolean };
export const MEDIA = media as Record<string, MediaInfo>;

export const INTRO =
  "Product designer. I read the codebase before I open Figma. Design and frontend at ArmorIQ, lead product design at Ivish AI. Interfaces built for real data, not the happy-path mockup.";

export const ABOUT = {
  title: "I design the interface, then I build it.",
  lead: "I'm Ashutosh, a product designer from Jabalpur, India. I taught myself design from YouTube during the 2020 lockdown, and I'm the first person in my family to choose it.",
  body: [
    "Most of my week goes to ArmorIQ, where I do design and frontend for a security platform for AI agents: the product, its design system and the internal tools. I also lead product design at Ivish AI, a translation company working across text, voice and video. This summer I was on Summer of Bitcoin's designer track, redesigning Shopstr.",
    "The habit that makes the difference is reading the codebase before I design. I want to know what the API returns, which components already exist and where the data runs out before a screen exists, not at handoff. Usually I build the interface myself.",
    "I'm in my second year of a BTech in Design at IIIT Jabalpur.",
  ],
};

export const LEDE = {
  work: "Products, design systems and internal tools for teams building with AI.",
  more: "Brand and web work for clients, and things built against a deadline.",
  play: "Smaller things, each made to learn one thing properly.",
};

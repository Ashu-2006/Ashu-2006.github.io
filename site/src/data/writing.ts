export type Post = {
  title: string;
  /** A line of the actual argument, quoted from the post, not a summary of it */
  note: string;
  /** Where it is published: "LinkedIn", "X", "Notes" */
  where: string;
  /** Publish date as shown, e.g. "25 Feb 2026" */
  date: string;
  /** Leave unset while the piece is still in draft; the row renders as "In draft" and does not link */
  href?: string;
};

/* Newest first. Published on LinkedIn; dates are LinkedIn's publish dates, not the old site's card dates. */
export const WRITING: Post[] = [
  {
    title: "The reading pattern almost everyone uses",
    note: "There's a reading behavior almost everyone on the internet uses (yes, even you), whether they realize it or not.",
    where: "LinkedIn",
    date: "25 Feb 2026",
    href: "https://www.linkedin.com/posts/ashutosh-rana04_theres-a-reading-behavior-almost-everyone-activity-7432507160342929408-RBdq",
  },
  {
    title: "Less features, better product",
    note: "It's way more important to remove things than to add things. Most products don't need more features. They need focus.",
    where: "LinkedIn",
    date: "19 Feb 2026",
    href: "https://www.linkedin.com/posts/ashutosh-rana04_pov-youre-building-a-product-and-keep-adding-share-7430314392128315392-p5ne",
  },
  {
    title: "Hidden features are basically unused features",
    note: "The problem wasn't that Google Maps lacked good functionality. The problem was that the interface never told me this interaction even existed.",
    where: "LinkedIn",
    date: "16 Feb 2026",
    href: "https://www.linkedin.com/posts/ashutosh-rana04_i-was-driving-the-other-day-using-google-share-7429265089129713664-oPWe",
  },
  {
    title: "Why most B2B software feels complex",
    note: "It's often not the features. It's the way linear flows hide real complexity.",
    where: "LinkedIn",
    date: "11 Feb 2026",
    href: "https://www.linkedin.com/posts/ashutosh-rana04_the-enterprise-fog-b2b-software-ux-breakdown-activity-7427331313281675264-TWkq",
  },
];

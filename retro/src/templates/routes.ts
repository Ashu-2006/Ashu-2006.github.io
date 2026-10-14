import { PROJECTS, SITE } from "../content";
import { caseStudy } from "./case";
import { crate } from "./crate";
import { den } from "./den";
import { encore } from "./encore";
import { hero } from "./hero";
import { notes } from "./notes";
import { tracks } from "./tracks";

export type Route = { kind: "home" } | { kind: "case"; slug: string } | { kind: "notfound" };

export type Rendered = { title: string; description: string; html: string };

export function match(pathname: string, base: string): Route {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "");
  const clean = rest.replace(/index\.html$/, "").replace(/\/+$/, "");
  if (clean === "") return { kind: "home" };
  const m = clean.match(/^work\/([a-z0-9-]+)$/);
  if (m && PROJECTS.some((p) => p.slug === m[1])) return { kind: "case", slug: m[1] };
  return { kind: "notfound" };
}

function notFound(base: string) {
  return `
<section class="nf" data-theme="chocolate" data-section="notfound" aria-labelledby="nf-title">
  <div class="nf__inner page-x">
    <h1 class="nf__title display" id="nf-title">This track skips.</h1>
    <p class="lede">The page moved or never existed. The record is still playing.</p>
    <a class="nf__home" href="${base}">Back to the start</a>
  </div>
</section>`;
}

export function render(route: Route, base: string): Rendered {
  if (route.kind === "case") {
    const p = PROJECTS.find((x) => x.slug === route.slug)!;
    return {
      title: `${p.name}, ${SITE.name}`,
      description: `${p.headline}. ${p.summary}`,
      html: caseStudy(base, p) + encore(base),
    };
  }
  if (route.kind === "notfound") {
    return { title: `Not found, ${SITE.name}`, description: SITE.description, html: notFound(base) + encore(base) };
  }
  return {
    title: `${SITE.name}, product designer`,
    description: SITE.description,
    html: hero(base) + tracks(base) + crate(base) + den(base) + notes(base) + encore(base),
  };
}

/** Every route as a static file, for the build */
export function prerender(base: string) {
  const routes: { path: string; route: Route }[] = [
    { path: "index.html", route: { kind: "home" } },
    ...PROJECTS.map((p) => ({ path: `work/${p.slug}/index.html`, route: { kind: "case", slug: p.slug } as Route })),
    { path: "404.html", route: { kind: "notfound" } },
  ];
  return routes.map(({ path, route }) => ({ path, ...render(route, base) }));
}

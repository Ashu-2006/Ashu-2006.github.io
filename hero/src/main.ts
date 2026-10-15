import "./style.css";
import "./pages.css";
import { mountChrome } from "./chrome";
import { mountHome } from "./home";
import { mountGallery } from "./gallery";
import { mountPond } from "./pond";

if (import.meta.env.DEV) {
  import("./agentation").then((m) => m.mountAgentation());
}

const page = document.body.dataset.page;

mountChrome();

if (page === "home") mountHome();

const gallery = document.querySelector<HTMLElement>("[data-gallery]");
if (gallery) mountGallery(gallery);
const pond = document.querySelector<HTMLElement>("[data-pond]");
if (pond) mountPond(pond);
if (page === "work") import("./archive").then((m) => m.mountArchive());
if (page === "playground") import("./playground").then((m) => m.mountPlayground());
if (page === "notfound") import("./scramble").then((m) => m.mountScrambles(document.querySelector(".nf")!));
if (document.querySelector("[data-peek-list]")) import("./peek").then((m) => m.mountPeek());

import { bangs as redirectBangs } from "virtual:kagi-bangs";
import type { Bang } from "./bang-store";

/** Built-ins hold only what redirects need until `loadBangDetails` adds their names and categories. */
export const bangs = redirectBangs as Bang[];

let details: Promise<void> | undefined;
export const loadBangDetails = () =>
  (details ??= import("virtual:kagi-bang-details").then(({ details }) => {
    bangs.forEach((b, i) => Object.assign(b, details[i]));
  }));

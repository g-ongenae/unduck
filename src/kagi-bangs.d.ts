declare module "virtual:kagi-bangs" {
  export const bangs: Omit<import("./bang-store").Bang, "s" | "c" | "sc">[];
}
declare module "virtual:kagi-bang-details" {
  /** Names and categories of the built-ins, in the same order as `virtual:kagi-bangs`. */
  export const details: Pick<import("./bang-store").Bang, "s" | "c" | "sc">[];
}

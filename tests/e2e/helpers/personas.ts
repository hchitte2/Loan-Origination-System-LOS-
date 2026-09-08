import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { DEMO_USERS } from "../../../src/db/demo-users";
import { homeRoute } from "../../../src/lib/roles";

/** The three login cards, from the seed, so specs never carry magic strings. */
export const PERSONAS = DEMO_USERS.filter((u) => u.card).map((u) => ({
  key: u.key,
  name: u.name,
  role: u.role,
  home: homeRoute(u.role),
}));

export type PersonaKey = (typeof PERSONAS)[number]["key"];

/** Enter through a login card and wait to land on that persona's home. */
export async function enterAs(page: Page, key: PersonaKey): Promise<void> {
  const persona = PERSONAS.find((p) => p.key === key);
  if (!persona) throw new Error(`No login card for ${key}`);
  await page.goto("/login");
  await page.getByRole("button", { name: `Enter as ${persona.name}` }).click();
  await expect(page).toHaveURL(persona.home);
}

import type { Role } from "@/lib/roles";

/**
 * The six seeded staff accounts (PLAN.md §2). Kept apart from the full fixture so the
 * login action and the tests can import them without the loan data.
 */
export type UserKey = "priya" | "alex" | "jordan" | "morgan" | "sam" | "riley";

export type DemoUser = {
  key: UserKey;
  id: string;
  name: string;
  email: string;
  role: Role;
  nmlsId?: string;
  phone?: string;
  /** Days before `now` the account was created. */
  createdDaysAgo: number;
  /** The login page shows a card for these three. */
  card: boolean;
};

export const DEMO_USERS: readonly DemoUser[] = [
  {
    key: "priya",
    id: "usr_priya",
    name: "Priya Nair",
    email: "priya@example.com",
    role: "superadmin",
    createdDaysAgo: 400,
    card: true,
  },
  {
    key: "alex",
    id: "usr_alex",
    name: "Alex Rivera",
    email: "alex@example.com",
    role: "loan_officer",
    nmlsId: "1234567",
    phone: "(512) 555-0134",
    createdDaysAgo: 380,
    card: true,
  },
  {
    key: "jordan",
    id: "usr_jordan",
    name: "Jordan Lee",
    email: "jordan@example.com",
    role: "loan_officer",
    nmlsId: "2345678",
    phone: "(512) 555-0177",
    createdDaysAgo: 300,
    card: false,
  },
  {
    key: "morgan",
    id: "usr_morgan",
    name: "Morgan Ellis",
    email: "morgan@example.com",
    role: "loan_officer",
    nmlsId: "3456789",
    phone: "(512) 555-0142",
    createdDaysAgo: 200,
    card: false,
  },
  {
    key: "sam",
    id: "usr_sam",
    name: "Sam Okafor",
    email: "sam@example.com",
    role: "processor",
    createdDaysAgo: 370,
    card: true,
  },
  {
    key: "riley",
    id: "usr_riley",
    name: "Riley Brooks",
    email: "riley@example.com",
    role: "processor",
    createdDaysAgo: 5,
    card: false,
  },
];

export const USER_ID: Record<UserKey, string> = Object.fromEntries(
  DEMO_USERS.map((u) => [u.key, u.id]),
) as Record<UserKey, string>;

export function demoUser(key: UserKey): DemoUser {
  const found = DEMO_USERS.find((u) => u.key === key);
  if (!found) throw new Error(`No demo user ${key}`);
  return found;
}

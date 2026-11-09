import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import type { Database, Queryable } from "./index";
import { DEFAULT_STAGES } from "@/lib/constants";
import { addDaysISO, latestWorkingDays, todayISO } from "@/lib/business/working-days";

// Deterministic ids make the demo data repeatable and easy to inspect.
const BUYER_B = "10000000-0000-4000-8000-000000000001";
const BUYER_C = "10000000-0000-4000-8000-000000000002";
const BUYER_D = "10000000-0000-4000-8000-000000000003";

const UNIT_1 = "20000000-0000-4000-8000-000000000001";
const UNIT_2 = "20000000-0000-4000-8000-000000000002";
const UNIT_3 = "20000000-0000-4000-8000-000000000003";

const SUB_PRINT = "30000000-0000-4000-8000-000000000001";
const SUB_WASH = "30000000-0000-4000-8000-000000000002";
const SUB_TRIMS = "30000000-0000-4000-8000-000000000003";

const ADMIN = "40000000-0000-4000-8000-000000000001";
const MD = "40000000-0000-4000-8000-000000000002";
const MERCH_1 = "40000000-0000-4000-8000-000000000003";
const MERCH_2 = "40000000-0000-4000-8000-000000000004";
const SUP_1 = "40000000-0000-4000-8000-000000000005";
const SUP_2 = "40000000-0000-4000-8000-000000000006";
const SUP_3 = "40000000-0000-4000-8000-000000000007";
const BUYER_USER_B = "40000000-0000-4000-8000-000000000008";
const BUYER_USER_C = "40000000-0000-4000-8000-000000000009";

const STAGE_IDS: Record<string, string> = {
  fabric_booking: "50000000-0000-4000-8000-000000000001",
  knitting: "50000000-0000-4000-8000-000000000002",
  dyeing: "50000000-0000-4000-8000-000000000003",
  cutting: "50000000-0000-4000-8000-000000000004",
  stitching: "50000000-0000-4000-8000-000000000005",
  printing: "50000000-0000-4000-8000-000000000006",
  washing: "50000000-0000-4000-8000-000000000007",
  finishing: "50000000-0000-4000-8000-000000000008",
  packing: "50000000-0000-4000-8000-000000000009",
  ex_factory: "50000000-0000-4000-8000-000000000010",
};

const TEMPLATE_FULL = "60000000-0000-4000-8000-000000000001";
const TEMPLATE_PRINT = "60000000-0000-4000-8000-000000000002";

interface UpdateSpec {
  date: string;
  quantity: number;
}

interface MilestoneSpec {
  stage: string;
  plannedOffset: number;
  active: boolean;
  updates: UpdateSpec[];
  supervisorId?: string;
  subcontractorId?: string;
}

interface OrderSpec {
  id: string;
  poNumber: string;
  buyerId: string;
  styleName: string;
  styleNumber: string;
  description: string;
  quantity: number;
  exFactoryOffset: number;
  priority: "low" | "normal" | "high" | "critical";
  unitId: string;
  merchandiserId: string;
  variants: { colour: string; size: string; quantity: number }[];
  milestones: MilestoneSpec[];
}

function completeUpdate(plannedDate: string, quantity: number, today: string): UpdateSpec {
  const candidate = addDaysISO(plannedDate, -1);
  return { date: candidate > today ? addDaysISO(today, -2) : candidate, quantity };
}

function recentUpdates(count: number, quantities: number[], today: string): UpdateSpec[] {
  const dates = latestWorkingDays(today, count);
  return dates.map((date, index) => ({
    date,
    quantity: quantities[index] ?? quantities[quantities.length - 1] ?? 0,
  }));
}

function buildOrderSpecs(today: string): OrderSpec[] {
  const day = (offset: number) => addDaysISO(today, offset);
  const stitchingQty = [800, 850, 900, 950, 800, 900, 850, 750];

  return [
    {
      id: "70000000-0000-4000-8000-000000000001",
      poNumber: "B-PO-88213",
      buyerId: BUYER_B,
      styleName: "Men's crew neck tee — navy",
      styleNumber: "ST-4412",
      description: "180 GSM combed cotton crew neck tee, navy, UK retail pack.",
      quantity: 12000,
      exFactoryOffset: 13,
      priority: "high",
      unitId: UNIT_1,
      merchandiserId: MERCH_1,
      variants: [
        { colour: "Navy", size: "S", quantity: 500 },
        { colour: "Navy", size: "M", quantity: 1000 },
        { colour: "Navy", size: "L", quantity: 1500 },
        { colour: "Navy", size: "XL", quantity: 1000 },
        { colour: "White", size: "S", quantity: 1000 },
        { colour: "White", size: "M", quantity: 1500 },
        { colour: "White", size: "L", quantity: 2000 },
        { colour: "White", size: "XL", quantity: 1500 },
        { colour: "Black", size: "S", quantity: 500 },
        { colour: "Black", size: "M", quantity: 500 },
        { colour: "Black", size: "L", quantity: 500 },
        { colour: "Black", size: "XL", quantity: 500 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -45,
          active: true,
          updates: [completeUpdate(day(-32), 12000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "knitting",
          plannedOffset: -38,
          active: true,
          updates: [completeUpdate(day(-25), 12000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "dyeing",
          plannedOffset: -30,
          active: true,
          updates: [completeUpdate(day(-17), 12000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "cutting",
          plannedOffset: -20,
          active: true,
          updates: [completeUpdate(day(-7), 12000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "stitching",
          plannedOffset: -7,
          active: true,
          updates: recentUpdates(8, stitchingQty, today),
          supervisorId: SUP_1,
        },
        { stage: "printing", plannedOffset: -10, active: false, updates: [] },
        { stage: "washing", plannedOffset: -8, active: false, updates: [] },
        {
          stage: "finishing",
          plannedOffset: -4,
          active: true,
          updates: [],
          supervisorId: SUP_1,
        },
        { stage: "packing", plannedOffset: -2, active: true, updates: [], supervisorId: SUP_1 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000002",
      poNumber: "B-PO-88240",
      buyerId: BUYER_B,
      styleName: "Men's polo — white",
      styleNumber: "ST-4489",
      description: "220 GSM pique polo with two-button placket, white.",
      quantity: 8000,
      exFactoryOffset: 5,
      priority: "critical",
      unitId: UNIT_1,
      merchandiserId: MERCH_1,
      variants: [
        { colour: "White", size: "S", quantity: 1500 },
        { colour: "White", size: "M", quantity: 2000 },
        { colour: "White", size: "L", quantity: 2500 },
        { colour: "White", size: "XL", quantity: 2000 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -40,
          active: true,
          updates: [completeUpdate(day(-35), 8000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "knitting",
          plannedOffset: -34,
          active: true,
          updates: [completeUpdate(day(-29), 8000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "dyeing",
          plannedOffset: -27,
          active: true,
          updates: [completeUpdate(day(-22), 8000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "cutting",
          plannedOffset: -18,
          active: true,
          updates: [completeUpdate(day(-13), 8000, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "stitching",
          plannedOffset: -12,
          active: true,
          updates: [completeUpdate(day(-7), 8000, today)],
          supervisorId: SUP_1,
        },
        { stage: "printing", plannedOffset: -8, active: false, updates: [] },
        { stage: "washing", plannedOffset: -6, active: false, updates: [] },
        {
          stage: "finishing",
          plannedOffset: -1,
          active: true,
          updates: recentUpdates(5, [550, 900, 1100, 1200, 1450], today),
          supervisorId: SUP_1,
        },
        { stage: "packing", plannedOffset: 0, active: true, updates: [], supervisorId: SUP_1 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000003",
      poNumber: "C-PO-0488",
      buyerId: BUYER_C,
      styleName: "Kids printed tee — yellow",
      styleNumber: "KD-1180",
      description: "160 GSM kids tee with water-based front print, yellow.",
      quantity: 10000,
      exFactoryOffset: 21,
      priority: "normal",
      unitId: UNIT_2,
      merchandiserId: MERCH_1,
      variants: [
        { colour: "Yellow", size: "2-3Y", quantity: 1500 },
        { colour: "Yellow", size: "4-5Y", quantity: 2000 },
        { colour: "Yellow", size: "6-7Y", quantity: 2500 },
        { colour: "Yellow", size: "8-9Y", quantity: 2200 },
        { colour: "Yellow", size: "10-11Y", quantity: 1800 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -45,
          active: true,
          updates: [completeUpdate(day(-24), 10000, today)],
          supervisorId: SUP_2,
        },
        {
          stage: "knitting",
          plannedOffset: -38,
          active: true,
          updates: [completeUpdate(day(-17), 10000, today)],
          supervisorId: SUP_2,
        },
        {
          stage: "dyeing",
          plannedOffset: -30,
          active: true,
          updates: [completeUpdate(day(-9), 10000, today)],
          supervisorId: SUP_2,
        },
        {
          stage: "cutting",
          plannedOffset: -22,
          active: true,
          updates: [completeUpdate(day(-1), 10000, today)],
          supervisorId: SUP_2,
        },
        {
          stage: "stitching",
          plannedOffset: -18,
          active: true,
          updates: [completeUpdate(day(3), 10000, today)],
          supervisorId: SUP_2,
        },
        {
          stage: "printing",
          plannedOffset: -7,
          active: true,
          updates: recentUpdates(4, [700, 750, 800, 850], today),
          supervisorId: SUP_2,
          subcontractorId: SUB_PRINT,
        },
        { stage: "washing", plannedOffset: -5, active: true, updates: [], supervisorId: SUP_2, subcontractorId: SUB_WASH },
        { stage: "finishing", plannedOffset: -3, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "packing", plannedOffset: -1, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000004",
      poNumber: "B-PO-88301",
      buyerId: BUYER_B,
      styleName: "Ladies fleece hoodie — black",
      styleNumber: "WM-2201",
      description: "320 GSM brushed fleece hoodie with kangaroo pocket.",
      quantity: 6000,
      exFactoryOffset: 9,
      priority: "high",
      unitId: UNIT_3,
      merchandiserId: MERCH_2,
      variants: [
        { colour: "Black", size: "S", quantity: 1000 },
        { colour: "Black", size: "M", quantity: 1500 },
        { colour: "Black", size: "L", quantity: 2000 },
        { colour: "Black", size: "XL", quantity: 1500 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -40,
          active: true,
          updates: [completeUpdate(day(-31), 6000, today)],
          supervisorId: SUP_3,
        },
        {
          stage: "knitting",
          plannedOffset: -30,
          active: true,
          updates: [completeUpdate(day(-21), 6000, today)],
          supervisorId: SUP_3,
        },
        {
          stage: "dyeing",
          plannedOffset: -20,
          active: true,
          updates: [completeUpdate(day(-11), 6000, today)],
          supervisorId: SUP_3,
        },
        {
          stage: "cutting",
          plannedOffset: -2,
          active: true,
          updates: recentUpdates(3, [1000, 1000, 1000], today),
          supervisorId: SUP_3,
        },
        { stage: "stitching", plannedOffset: -1, active: true, updates: [], supervisorId: SUP_3 },
        { stage: "finishing", plannedOffset: 0, active: true, updates: [], supervisorId: SUP_3 },
        { stage: "packing", plannedOffset: 0, active: true, updates: [], supervisorId: SUP_3 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000005",
      poNumber: "D-PO-1120",
      buyerId: BUYER_D,
      styleName: "Men's slim jogger — grey",
      styleNumber: "MN-7734",
      description: "Loopback cotton jogger with elastic cuff, heather grey.",
      quantity: 5000,
      exFactoryOffset: 28,
      priority: "normal",
      unitId: UNIT_2,
      merchandiserId: MERCH_2,
      variants: [
        { colour: "Grey", size: "S", quantity: 750 },
        { colour: "Grey", size: "M", quantity: 1500 },
        { colour: "Grey", size: "L", quantity: 1750 },
        { colour: "Grey", size: "XL", quantity: 1000 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -45,
          active: true,
          updates: [completeUpdate(day(-17), 5000, today)],
          supervisorId: SUP_2,
        },
        {
          stage: "knitting",
          plannedOffset: -18,
          active: true,
          updates: recentUpdates(3, [650, 700, 650], today),
          supervisorId: SUP_2,
        },
        { stage: "dyeing", plannedOffset: -10, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "cutting", plannedOffset: -4, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "stitching", plannedOffset: 0, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "finishing", plannedOffset: -2, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "packing", plannedOffset: -1, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000006",
      poNumber: "C-PO-0502",
      buyerId: BUYER_C,
      styleName: "Women's rib tank — white/black",
      styleNumber: "WM-2218",
      description: "Ribbed cotton tank top, two-colour pack for C (Germany).",
      quantity: 4500,
      exFactoryOffset: 2,
      priority: "critical",
      unitId: UNIT_3,
      merchandiserId: MERCH_2,
      variants: [
        { colour: "White", size: "S", quantity: 1000 },
        { colour: "White", size: "M", quantity: 1500 },
        { colour: "White", size: "L", quantity: 1000 },
        { colour: "Black", size: "L", quantity: 1000 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -30,
          active: true,
          updates: [completeUpdate(day(-22), 4500, today)],
          supervisorId: SUP_3,
        },
        {
          stage: "knitting",
          plannedOffset: -20,
          active: true,
          updates: [completeUpdate(day(-15), 4500, today)],
          supervisorId: SUP_3,
        },
        {
          stage: "dyeing",
          plannedOffset: -14,
          active: true,
          updates: [completeUpdate(day(-10), 4500, today)],
          supervisorId: SUP_3,
        },
        {
          stage: "cutting",
          plannedOffset: -8,
          active: true,
          updates: [completeUpdate(day(-4), 4500, today)],
          supervisorId: SUP_3,
        },
        {
          stage: "stitching",
          plannedOffset: -1,
          active: true,
          updates: recentUpdates(4, [600, 600, 650, 650], today),
          supervisorId: SUP_3,
        },
        { stage: "finishing", plannedOffset: 0, active: true, updates: [], supervisorId: SUP_3 },
        { stage: "packing", plannedOffset: 0, active: true, updates: [], supervisorId: SUP_3 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000007",
      poNumber: "B-PO-88315",
      buyerId: BUYER_B,
      styleName: "Kids sweatshirt — navy",
      styleNumber: "KD-1195",
      description: "280 GSM kids crew sweatshirt, navy, UK school range.",
      quantity: 3500,
      exFactoryOffset: -2,
      priority: "critical",
      unitId: UNIT_1,
      merchandiserId: MERCH_1,
      variants: [
        { colour: "Navy", size: "S", quantity: 750 },
        { colour: "Navy", size: "M", quantity: 1000 },
        { colour: "Navy", size: "L", quantity: 1000 },
        { colour: "Navy", size: "XL", quantity: 750 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -30,
          active: true,
          updates: [completeUpdate(day(-24), 3500, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "knitting",
          plannedOffset: -20,
          active: true,
          updates: [completeUpdate(day(-16), 3500, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "dyeing",
          plannedOffset: -14,
          active: true,
          updates: [completeUpdate(day(-10), 3500, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "cutting",
          plannedOffset: -8,
          active: true,
          updates: [completeUpdate(day(-5), 3500, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "stitching",
          plannedOffset: -4,
          active: true,
          updates: [completeUpdate(day(-3), 3500, today)],
          supervisorId: SUP_1,
        },
        {
          stage: "finishing",
          plannedOffset: -1,
          active: true,
          updates: recentUpdates(4, [600, 650, 600, 650], today),
          supervisorId: SUP_1,
        },
        { stage: "packing", plannedOffset: -1, active: true, updates: [], supervisorId: SUP_1 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
    {
      id: "70000000-0000-4000-8000-000000000008",
      poNumber: "D-PO-1131",
      buyerId: BUYER_D,
      styleName: "Men's woven shorts — khaki",
      styleNumber: "MN-7802",
      description: "Cotton twill shorts with drawcord, khaki.",
      quantity: 7000,
      exFactoryOffset: 45,
      priority: "normal",
      unitId: UNIT_2,
      merchandiserId: MERCH_2,
      variants: [
        { colour: "Khaki", size: "S", quantity: 1000 },
        { colour: "Khaki", size: "M", quantity: 1500 },
        { colour: "Khaki", size: "L", quantity: 2000 },
        { colour: "Khaki", size: "XL", quantity: 1500 },
        { colour: "Khaki", size: "XXL", quantity: 1000 },
      ],
      milestones: [
        {
          stage: "fabric_booking",
          plannedOffset: -40,
          active: true,
          updates: [completeUpdate(day(5), 7000, today)],
          supervisorId: SUP_2,
        },
        { stage: "knitting", plannedOffset: -32, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "dyeing", plannedOffset: -24, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "cutting", plannedOffset: -16, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "stitching", plannedOffset: -8, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "finishing", plannedOffset: -4, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "packing", plannedOffset: -2, active: true, updates: [], supervisorId: SUP_2 },
        { stage: "ex_factory", plannedOffset: 0, active: true, updates: [] },
      ],
    },
  ];
}

export async function seedDemoData(db: Database): Promise<void> {
  const existing = await db.query<{ count: number }>(
    "select count(*)::int as count from profiles",
  );
  if (Number(existing[0]?.count ?? 0) > 0) return;

  const today = todayISO("Asia/Kolkata");
  const localPasswords = {
    [ADMIN]: hashSync("Admin@12345", 10),
    [MD]: hashSync("Md@12345", 10),
    [MERCH_1]: hashSync("Merch@12345", 10),
    [MERCH_2]: hashSync("Merch2@12345", 10),
    [SUP_1]: hashSync("Super@12345", 10),
    [SUP_2]: hashSync("Super2@12345", 10),
    [SUP_3]: hashSync("Super3@12345", 10),
    [BUYER_USER_B]: hashSync("Buyer@12345", 10),
    [BUYER_USER_C]: hashSync("BuyerC@12345", 10),
  } as Record<string, string>;

  await db.transaction(async (tx) => {
    await insertReferenceData(tx);
    await insertProfiles(tx, db.mode === "embedded", localPasswords);
    await insertStages(tx);
    await insertTemplates(tx);

    const specs = buildOrderSpecs(today);
    const updateIdsByOrder = new Map<string, string[]>();

    for (const spec of specs) {
      const updateIds = await insertOrder(tx, spec, today);
      updateIdsByOrder.set(spec.id, updateIds);
    }

    await insertDemoExtras(tx, today, updateIdsByOrder);
  });

  console.info("[db] demo data seeded for business date", today);
}

async function insertReferenceData(tx: Queryable) {
  await tx.query(
    `insert into buyers (id, name, code, country, contact_person, contact_email) values
      ($1,'Company B','B','United Kingdom','James Whitfield','james@companyb.example'),
      ($2,'Company C','C','Germany','Lena Fischer','lena@companyc.example'),
      ($3,'Company D','D','Netherlands','Anouk van Dijk','buying@companyd.example')`,
    [BUYER_B, BUYER_C, BUYER_D],
  );

  await tx.query(
    `insert into production_units (id, name, code, location) values
      ($1,'Unit 1 — Kangeyam Road','U1','Tiruppur, Tamil Nadu'),
      ($2,'Unit 2 — Veerapandi','U2','Tiruppur, Tamil Nadu'),
      ($3,'Unit 3 — SIPCOT','U3','Perundurai, Tamil Nadu')`,
    [UNIT_1, UNIT_2, UNIT_3],
  );

  await tx.query(
    `insert into subcontractors (id, name, type, contact_person, phone) values
      ($1,'Sri Balaji Printing','printing','Mohan','+91 98765 40001'),
      ($2,'Ganga Wash Care','washing','Ravi','+91 98765 40002'),
      ($3,'Apex Trims','other','Selvi','+91 98765 40003')`,
    [SUB_PRINT, SUB_WASH, SUB_TRIMS],
  );
}

async function insertProfiles(
  tx: Queryable,
  embedded: boolean,
  passwords: Record<string, string>,
) {
  const profiles = [
    [ADMIN, "admin@company-a.test", "Arun Prakash", "super_admin", null, null],
    [MD, "md@company-a.test", "Meena Suresh", "managing_director", null, null],
    [MERCH_1, "merch@company-a.test", "Divya Kumar", "merchandiser", null, null],
    [MERCH_2, "merch2@company-a.test", "Rahul Menon", "merchandiser", null, null],
    [SUP_1, "supervisor@company-a.test", "Karthik Raja", "unit_supervisor", UNIT_1, null],
    [SUP_2, "supervisor2@company-a.test", "Senthil Murugan", "unit_supervisor", UNIT_2, null],
    [SUP_3, "supervisor3@company-a.test", "Priya Devi", "unit_supervisor", UNIT_3, null],
    [BUYER_USER_B, "buyer@company-b.test", "Oliver Smith", "buyer", null, BUYER_B],
    [BUYER_USER_C, "buyer.c@company-c.test", "Lena Fischer", "buyer", null, BUYER_C],
  ] as const;

  if (embedded) {
    for (const [id, email] of profiles) {
      await tx.query("insert into auth.users (id, email) values ($1,$2)", [id, email]);
    }
  }

  for (const [id, email, name, role, unitId, buyerId] of profiles) {
    await tx.query(
      `insert into profiles (id, email, full_name, role, unit_id, buyer_id, password_hash)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [id, email, name, role, unitId, buyerId, embedded ? passwords[id] : null],
    );
  }
}

async function insertStages(tx: Queryable) {
  for (const stage of DEFAULT_STAGES) {
    await tx.query(
      "insert into production_stages (id, name, code, sequence) values ($1,$2,$3,$4)",
      [STAGE_IDS[stage.code], stage.name, stage.code, stage.sequence],
    );
  }
}

async function insertTemplates(tx: Queryable) {
  const offsets: Record<string, number> = {
    fabric_booking: -45,
    knitting: -38,
    dyeing: -30,
    cutting: -22,
    stitching: -16,
    printing: -10,
    washing: -8,
    finishing: -5,
    packing: -2,
    ex_factory: 0,
  };

  await tx.query(
    `insert into tna_templates (id, name, description) values
      ($1,'Knitwear — Standard TNA','Full ten-stage knitwear plan with optional printing and washing.'),
      ($2,'Knitwear — Print & Wash','Plan for printed and garment-washed styles.')`,
    [TEMPLATE_FULL, TEMPLATE_PRINT],
  );

  const stageCodes = Object.keys(STAGE_IDS);
  for (const [templateId, codeList] of [
    [TEMPLATE_FULL, stageCodes],
    [TEMPLATE_PRINT, stageCodes],
  ] as const) {
    for (let index = 0; index < codeList.length; index += 1) {
      const code = codeList[index];
      await tx.query(
        `insert into tna_template_milestones
          (template_id, stage_id, sequence, offset_days, is_optional)
         values ($1,$2,$3,$4,$5)`,
        [
          templateId,
          STAGE_IDS[code],
          index + 1,
          offsets[code] ?? 0,
          code === "printing" || code === "washing",
        ],
      );
    }
  }
}

async function insertOrder(tx: Queryable, spec: OrderSpec, today: string): Promise<string[]> {
  const exFactory = addDaysISO(today, spec.exFactoryOffset);
  const received = addDaysISO(exFactory, -60);

  await tx.query(
    `insert into purchase_orders
      (id, po_number, buyer_id, buyer_reference, order_received_date, style_name, style_number,
       description, total_quantity, ex_factory_date, shipping_method, priority,
       merchandiser_id, primary_unit_id, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'sea',$11,$12,$13,$14)`,
    [
      spec.id,
      spec.poNumber,
      spec.buyerId,
      `${spec.buyerId.slice(-1)}-REF-${spec.poNumber.slice(-4)}`,
      received,
      spec.styleName,
      spec.styleNumber,
      spec.description,
      spec.quantity,
      exFactory,
      spec.priority,
      spec.merchandiserId,
      spec.unitId,
      spec.merchandiserId,
    ],
  );

  for (const variant of spec.variants) {
    await tx.query(
      "insert into order_variants (po_id, colour, size, quantity) values ($1,$2,$3,$4)",
      [spec.id, variant.colour, variant.size, variant.quantity],
    );
  }

  const updateIds: string[] = [];
  let sequence = 0;

  for (const milestone of spec.milestones) {
    sequence += 1;
    const plannedDate = addDaysISO(exFactory, milestone.plannedOffset);
    const cumulative = milestone.updates.reduce((sum, update) => sum + update.quantity, 0);
    const status =
      cumulative >= spec.quantity ? "completed" : cumulative > 0 ? "in_progress" : "pending";

    const inserted = await tx.query<{ id: string }>(
      `insert into order_milestones
        (po_id, stage_id, sequence, planned_date, target_quantity, status, is_active)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id`,
      [
        spec.id,
        STAGE_IDS[milestone.stage],
        sequence,
        plannedDate,
        spec.quantity,
        status,
        milestone.active,
      ],
    );
    const milestoneId = inserted[0].id;

    await tx.query(
      `insert into stage_assignments
        (milestone_id, unit_id, supervisor_id, subcontractor_id, assigned_by)
       values ($1,$2,$3,$4,$5)`,
      [
        milestoneId,
        spec.unitId,
        milestone.supervisorId ?? null,
        milestone.subcontractorId ?? null,
        spec.merchandiserId,
      ],
    );

    for (const update of milestone.updates) {
      if (update.date > today) continue;
      const updateId = randomUUID();
      await tx.query(
        `insert into production_updates
          (id, po_id, milestone_id, update_date, quantity, submitted_by, client_uuid, source)
         values ($1,$2,$3,$4,$5,$6,$7,'online')`,
        [
          updateId,
          spec.id,
          milestoneId,
          update.date,
          update.quantity,
          milestone.supervisorId ?? MERCH_1,
          randomUUID(),
        ],
      );
      updateIds.push(updateId);
    }
  }

  await tx.query(
    `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
     values ($1,$2,'order_created','purchase_order',$1,$3)`,
    [spec.id, spec.merchandiserId, JSON.stringify({ po_number: spec.poNumber, seeded: true })],
  );

  return updateIds;
}

async function insertDemoExtras(
  tx: Queryable,
  today: string,
  updateIdsByOrder: Map<string, string[]>,
) {
  const po1Updates = updateIdsByOrder.get("70000000-0000-4000-8000-000000000001") ?? [];
  const po2Updates = updateIdsByOrder.get("70000000-0000-4000-8000-000000000002") ?? [];
  const po3Updates = updateIdsByOrder.get("70000000-0000-4000-8000-000000000003") ?? [];
  const po7Updates = updateIdsByOrder.get("70000000-0000-4000-8000-000000000007") ?? [];

  // Production photographs (local demo assets; Cloudinary is used when configured).
  if (po1Updates.length > 0) {
    await tx.query(
      `insert into production_photos
        (po_id, update_id, url, public_id, caption, approved_for_buyer, approved_by, approved_at, uploaded_by, bytes)
       values ($1,$2,'/demo/stitching-floor.svg','local:demo-stitching','Stitching line 3 running the navy tee.',true,$3,now(),$4,48210)`,
      [
        "70000000-0000-4000-8000-000000000001",
        po1Updates[po1Updates.length - 1],
        MERCH_1,
        SUP_1,
      ],
    );
  }
  if (po2Updates.length > 0) {
    await tx.query(
      `insert into production_photos
        (po_id, update_id, url, public_id, caption, approved_for_buyer, uploaded_by, bytes)
       values ($1,$2,'/demo/finishing-check.svg','local:demo-finishing','Finishing inspection in progress; awaiting buyer approval.',false,$3,39110)`,
      [
        "70000000-0000-4000-8000-000000000002",
        po2Updates[po2Updates.length - 1],
        SUP_1,
      ],
    );
  }
  if (po3Updates.length > 0) {
    await tx.query(
      `insert into production_photos
        (po_id, update_id, url, public_id, caption, approved_for_buyer, approved_by, approved_at, uploaded_by, bytes)
       values ($1,$2,'/demo/printing-line.svg','local:demo-printing','First print run on the kids tee.',true,$3,now(),$4,55120)`,
      [
        "70000000-0000-4000-8000-000000000003",
        po3Updates[po3Updates.length - 1],
        MERCH_1,
        SUP_2,
      ],
    );
  }

  // Issues. The Tamil example is retained exactly as reported.
  const po1Issue = await tx.query<{ id: string }>(
    `insert into production_issues
      (po_id, milestone_id, update_id, description_tamil, description_english, category,
       ai_suggested_category, ai_explanation, ai_status, severity, status, reported_by)
     values ($1,
       (select id from order_milestones where po_id = $1 and stage_id = $2),
       $3,
       'தையல் மெஷின் பழுதாகிவிட்டது, அதனால் உற்பத்தி தாமதமாகிறது.',
       'The stitching machine has broken down, so production is delayed.',
       'Machine Breakdown','Machine Breakdown',
       'The stitching machine is out of service, which is slowing production.',
       'suggested','high','open',$4)
     returning id`,
    [
      "70000000-0000-4000-8000-000000000001",
      STAGE_IDS.stitching,
      po1Updates[po1Updates.length - 1] ?? null,
      SUP_1,
    ],
  );

  if (po1Issue[0]) {
    await tx.query(
      `insert into production_photos
        (po_id, issue_id, url, public_id, caption, approved_for_buyer, uploaded_by, bytes)
       values ($1,$2,'/demo/quality-check.svg','local:demo-issue','Machine fault near needle bed.',false,$3,28700)`,
      ["70000000-0000-4000-8000-000000000001", po1Issue[0].id, SUP_1],
    );
  }

  await tx.query(
    `insert into production_issues
      (po_id, milestone_id, update_id, description_tamil, description_english, category,
       ai_suggested_category, ai_explanation, ai_status, severity, status, reported_by)
     values ($1,
       (select id from order_milestones where po_id = $1 and stage_id = $2),
       $3,
       'பிரிண்டிங் யூனிட்டில் அச்சு தாமதமாகிறது, மின்சாரத் தடை காரணமாக.',
       'Printing is delayed at the printing unit because of a power interruption.',
       'Printing Delay','Printing Delay',
       'Printing output is delayed due to a power interruption at the unit.',
       'suggested','medium','in_progress',$4)`,
    [
      "70000000-0000-4000-8000-000000000003",
      STAGE_IDS.printing,
      po3Updates[po3Updates.length - 1] ?? null,
      SUP_2,
    ],
  );

  await tx.query(
    `insert into production_issues
      (po_id, milestone_id, update_id, description_english, category, severity, status,
       reported_by, resolved_by, resolved_at)
     values ($1,
       (select id from order_milestones where po_id = $1 and stage_id = $2),
       $3,
       'A small batch of navy sweatshirts showed uneven dye shading; the batch was re-cut.',
       'Quality Issue','medium','resolved',$4,$5,now())`,
    [
      "70000000-0000-4000-8000-000000000007",
      STAGE_IDS.finishing,
      po7Updates[po7Updates.length - 1] ?? null,
      SUP_1,
      MERCH_1,
    ],
  );

  // A confirmed buyer update, visible in the buyer portal.
  await tx.query(
    `insert into buyer_notifications
      (po_id, subject, message, status, approved_by, approved_at, created_by)
     values ($1,'Production update — B-PO-88240',
       'Finishing is in progress at Unit 1. We will share final inspection photographs before dispatch and are working to protect the ex-factory date.',
       'approved',$2,now(),$2)`,
    ["70000000-0000-4000-8000-000000000002", MERCH_1],
  );

  // Audited planned-date change.
  const finishing = await tx.query<{ id: string; planned_date: string }>(
    `select id, planned_date from order_milestones
      where po_id = $1 and stage_id = $2`,
    ["70000000-0000-4000-8000-000000000002", STAGE_IDS.finishing],
  );
  if (finishing[0]) {
    await tx.query(
      `insert into order_date_history
        (po_id, milestone_id, field_name, previous_date, new_date, reason, changed_by)
       values ($1,$2,'milestone_planned_date',$3,$4,$5,$6)`,
      [
        "70000000-0000-4000-8000-000000000002",
        finishing[0].id,
        addDaysISO(finishing[0].planned_date, -2),
        finishing[0].planned_date,
        "Washing subcontractor capacity constraint; finishing pulled forward with an additional line.",
        MERCH_1,
      ],
    );
  }

  await tx.query(
    `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
     values ($1,$2,'buyer_warning_confirmed','buyer_notification',null,$3)`,
    [
      "70000000-0000-4000-8000-000000000002",
      MERCH_1,
      JSON.stringify({ subject: "Production update — B-PO-88240", business_date: today }),
    ],
  );
}

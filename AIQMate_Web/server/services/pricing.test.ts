import { priceUsage, validateSlabs, PricingError, type PricingConfig } from "./pricing";

const EXAMPLE_SLABS = [
  { slabMin: 1, slabMax: 100, unitRate: "2.00", tierOrder: 1 },
  { slabMin: 101, slabMax: 500, unitRate: "1.75", tierOrder: 2 },
  { slabMin: 501, slabMax: 1000, unitRate: "1.50", tierOrder: 3 },
  { slabMin: 1001, slabMax: null, unitRate: "1.25", tierOrder: 4 },
];

const gradConfig: PricingConfig = { model: "GRADUATED", currency: "USD", slabs: EXAMPLE_SLABS };
const volConfig: PricingConfig = { model: "VOLUME", currency: "USD", slabs: EXAMPLE_SLABS };

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e: unknown) {
    console.error(`  FAIL  ${name}: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

function eq(actual: string, expected: string, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

console.log("--- A2 Test Vectors: Graduated ---");
test("Q=0",    () => eq(priceUsage(gradConfig, 0).subtotal, "0.00", "subtotal"));
test("Q=100",  () => eq(priceUsage(gradConfig, 100).subtotal, "200.00", "subtotal"));
test("Q=101",  () => eq(priceUsage(gradConfig, 101).subtotal, "201.75", "subtotal"));
test("Q=500",  () => eq(priceUsage(gradConfig, 500).subtotal, "900.00", "subtotal"));
test("Q=600",  () => eq(priceUsage(gradConfig, 600).subtotal, "1050.00", "subtotal"));
test("Q=1000", () => eq(priceUsage(gradConfig, 1000).subtotal, "1650.00", "subtotal"));
test("Q=1001", () => eq(priceUsage(gradConfig, 1001).subtotal, "1651.25", "subtotal"));

console.log("--- A2 Test Vectors: Volume ---");
test("Q=0",    () => eq(priceUsage(volConfig, 0).subtotal, "0.00", "subtotal"));
test("Q=100",  () => eq(priceUsage(volConfig, 100).subtotal, "200.00", "subtotal"));
test("Q=101",  () => eq(priceUsage(volConfig, 101).subtotal, "176.75", "subtotal"));
test("Q=500",  () => eq(priceUsage(volConfig, 500).subtotal, "875.00", "subtotal"));
test("Q=600",  () => eq(priceUsage(volConfig, 600).subtotal, "900.00", "subtotal"));
test("Q=1000", () => eq(priceUsage(volConfig, 1000).subtotal, "1500.00", "subtotal"));
test("Q=1001", () => eq(priceUsage(volConfig, 1001).subtotal, "1251.25", "subtotal"));

console.log("--- Slab Validation ---");
test("valid slabs pass", () => {
  const errs = validateSlabs(EXAMPLE_SLABS);
  if (errs.length > 0) throw new Error(`Expected 0 errors, got ${errs.length}: ${errs.map(e => e.message).join("; ")}`);
});

test("overlapping slabs rejected", () => {
  const bad = [
    { slabMin: 1, slabMax: 100, unitRate: "2.00", tierOrder: 1 },
    { slabMin: 50, slabMax: 200, unitRate: "1.50", tierOrder: 2 },
  ];
  const errs = validateSlabs(bad);
  if (errs.length === 0) throw new Error("Expected errors for overlapping slabs");
});

test("gapped slabs rejected", () => {
  const bad = [
    { slabMin: 1, slabMax: 100, unitRate: "2.00", tierOrder: 1 },
    { slabMin: 200, slabMax: 500, unitRate: "1.50", tierOrder: 2 },
  ];
  const errs = validateSlabs(bad);
  if (errs.length === 0) throw new Error("Expected errors for gapped slabs");
});

test("negative rate rejected", () => {
  const bad = [{ slabMin: 1, slabMax: null, unitRate: "-1.00", tierOrder: 1 }];
  const errs = validateSlabs(bad);
  if (errs.length === 0) throw new Error("Expected error for negative rate");
});

test("closed last slab with Q above: PRICING_COVERAGE_MISSING", () => {
  const closedConfig: PricingConfig = {
    model: "GRADUATED",
    currency: "USD",
    slabs: [
      { slabMin: 1, slabMax: 100, unitRate: "2.00", tierOrder: 1 },
      { slabMin: 101, slabMax: 500, unitRate: "1.50", tierOrder: 2 },
    ],
  };
  try {
    priceUsage(closedConfig, 501);
    throw new Error("Expected PRICING_COVERAGE_MISSING");
  } catch (e) {
    if (!(e instanceof PricingError) || e.code !== "PRICING_COVERAGE_MISSING") {
      throw new Error(`Expected PRICING_COVERAGE_MISSING, got ${e instanceof PricingError ? e.code : e}`);
    }
  }
});

test("no config: PRICING_CONFIGURATION_INVALID", () => {
  const badConfig: PricingConfig = { model: "GRADUATED", currency: "USD", slabs: [] };
  try {
    priceUsage(badConfig, 10);
    throw new Error("Expected PRICING_CONFIGURATION_INVALID");
  } catch (e) {
    if (!(e instanceof PricingError) || e.code !== "PRICING_CONFIGURATION_INVALID") {
      throw new Error(`Expected PRICING_CONFIGURATION_INVALID, got ${e instanceof PricingError ? e.code : e}`);
    }
  }
});

console.log("--- Done ---");

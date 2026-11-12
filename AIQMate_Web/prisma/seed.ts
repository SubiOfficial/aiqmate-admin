import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ---- Roles ----
  const superAdminRole = await prisma.role.upsert({
    where: { key: "SUPER_ADMIN" },
    update: {},
    create: { key: "SUPER_ADMIN", displayName: "Super Admin", description: "Platform administrator", isSystem: true },
  });
  const tenantAdminRole = await prisma.role.upsert({
    where: { key: "TENANT_ADMIN" },
    update: {},
    create: { key: "TENANT_ADMIN", displayName: "Tenant Admin", description: "Organisation administrator", isSystem: true },
  });
  const tenantUserRole = await prisma.role.upsert({
    where: { key: "TENANT_USER" },
    update: {},
    create: { key: "TENANT_USER", displayName: "Tenant User", description: "Standard tenant user", isSystem: true },
  });

  // ---- Permissions ----
  const perms = [
    { key: "tenants.manage", displayName: "Manage tenants", group: "platform" },
    { key: "pricing.manage", displayName: "Manage pricing", group: "platform" },
    { key: "pricing.view", displayName: "View pricing", group: "tenant" },
    { key: "billing.view", displayName: "View billing", group: "tenant" },
    { key: "invoices.view", displayName: "View invoices", group: "tenant" },
    { key: "payments.view", displayName: "View payments", group: "tenant" },
    { key: "users.manage", displayName: "Manage users", group: "tenant" },
    { key: "assets.manage", displayName: "Manage assets", group: "tenant" },
    { key: "procedures.execute", displayName: "Execute procedures", group: "tenant" },
    { key: "procedures.view", displayName: "View procedure usage", group: "tenant" },
    { key: "subscriptions.view", displayName: "View subscription", group: "tenant" },
  ];
  for (const p of perms) {
    await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
  }

  // Assign all permissions to TENANT_ADMIN
  const allPerms = await prisma.permission.findMany({ where: { group: "tenant" } });
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: tenantAdminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: tenantAdminRole.id, permissionId: p.id },
    });
  }
  // TENANT_USER gets view + execute
  const userPerms = await prisma.permission.findMany({ where: { key: { in: ["pricing.view", "billing.view", "procedures.execute", "procedures.view"] } } });
  for (const p of userPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: tenantUserRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: tenantUserRole.id, permissionId: p.id },
    });
  }

  // ---- Procedure categories ----
  const categories = [
    { key: "PROCEDURE", displayName: "Procedure" },
    { key: "ROUTINE", displayName: "Routine" },
    { key: "INSPECTION", displayName: "Inspection" },
    { key: "TASK", displayName: "Task" },
    { key: "GUIDE", displayName: "Guide" },
    { key: "BDA", displayName: "Breakdown analysis" },
    { key: "AUDIT", displayName: "Audit" },
  ];
  for (const c of categories) {
    await prisma.procedureCategory.upsert({ where: { key: c.key }, update: {}, create: c });
  }

  // ---- Dev Super Admin user ----
  const devAdmin = await prisma.user.upsert({
    where: { email: "dev-super-admin@dev.local" },
    update: {},
    create: { email: "dev-super-admin@dev.local", firstName: "Dev", lastName: "Super Admin", isSuperAdmin: true },
  });

  // ---- Tenants ----
  const demoFields = { orgId: "demo-org", orgCode: "DEMO-001", name: "Demo Organisation", industry: "Manufacturing", country: "United States", state: "California", city: "San Francisco", address: "100 Demo Street, Suite 200", postalCode: "94105", seatLimit: 50, seatsUsed: 10, activeUsers30d: 8, health: "OK", activatedAt: new Date("2026-01-01T00:00:00Z") };
  const demoOrg = await prisma.tenant.upsert({ where: { orgId: "demo-org" }, update: demoFields, create: demoFields });

  const acmeFields = { orgId: "acme-manufacturing", orgCode: "ACM-1001", name: "Acme Manufacturing", industry: "Automotive", country: "United States", state: "Michigan", city: "Detroit", address: "4500 Motor Ave, Building C", postalCode: "48201", website: "https://acme-mfg.example.com", seatLimit: 50, seatsUsed: 38, activeUsers30d: 32, lastActivityAt: new Date("2026-11-11T14:30:00Z"), health: "OK", activatedAt: new Date("2025-06-01T00:00:00Z") };
  const acme = await prisma.tenant.upsert({ where: { orgId: "acme-manufacturing" }, update: acmeFields, create: acmeFields });

  const gsFields = { orgId: "global-steel", orgCode: "GS-1002", name: "Global Steel Corp", industry: "Steel & Metals", country: "Germany", state: "Hamburg", city: "Hamburg", address: "Hafenstraße 42", postalCode: "20457", website: "https://globalsteel.example.com", seatLimit: 100, seatsUsed: 87, activeUsers30d: 64, lastActivityAt: new Date("2026-11-10T09:15:00Z"), health: "ATTENTION", activatedAt: new Date("2025-01-15T00:00:00Z") };
  const globalSteel = await prisma.tenant.upsert({ where: { orgId: "global-steel" }, update: gsFields, create: gsFields });

  const ppFields = { orgId: "precision-parts", orgCode: "PP-1003", name: "Precision Parts Ltd", industry: "Aerospace", country: "United Kingdom", state: "England", city: "Bristol", address: "12 Aero Park, Filton", postalCode: "BS34 7QH", website: "https://precisionparts.example.com", seatLimit: 25, seatsUsed: 12, activeUsers30d: 8, lastActivityAt: new Date("2026-11-09T16:45:00Z"), health: "OK", activatedAt: new Date("2026-03-01T00:00:00Z") };
  const precisionParts = await prisma.tenant.upsert({ where: { orgId: "precision-parts" }, update: ppFields, create: ppFields });

  const bfFields = { orgId: "bright-foods", orgCode: "BF-1004", name: "Bright Foods International", industry: "Food & Beverage", country: "India", state: "Maharashtra", city: "Mumbai", address: "Plot 7, MIDC Andheri East", postalCode: "400093", website: "https://brightfoods.example.com", seatLimit: 40, seatsUsed: 40, activeUsers30d: 35, lastActivityAt: new Date("2026-11-11T11:00:00Z"), health: "ATTENTION", activatedAt: new Date("2026-01-10T00:00:00Z") };
  const brightFoods = await prisma.tenant.upsert({ where: { orgId: "bright-foods" }, update: bfFields, create: bfFields });

  const neFields = { orgId: "nova-energy", orgCode: "NE-1005", name: "Nova Energy Solutions", industry: "Energy", country: "Australia", state: "New South Wales", city: "Sydney", address: "88 Harbour St, Level 5", postalCode: "2000", seatLimit: 15, seatsUsed: 4, activeUsers30d: 0, health: "ATTENTION", activatedAt: new Date("2026-11-01T00:00:00Z") };
  const novaEnergy = await prisma.tenant.upsert({ where: { orgId: "nova-energy" }, update: neFields, create: neFields });

  // ---- Contacts ----
  const contactData = [
    { tenantId: acme.id, name: "Sarah Chen", email: "sarah.chen@acme-mfg.example.com", phone: "+1-555-0101", role: "Primary", designation: "VP Operations", contactType: "PRIMARY", isPrimary: true },
    { tenantId: acme.id, name: "Mike Torres", email: "mike.torres@acme-mfg.example.com", phone: "+1-555-0102", role: "Technical", designation: "IT Director", contactType: "TECHNICAL", isPrimary: false },
    { tenantId: acme.id, name: "Rachel Kim", email: "rachel.kim@acme-mfg.example.com", phone: "+1-555-0103", role: "Billing", designation: "Finance Manager", contactType: "BILLING", isPrimary: false },
    { tenantId: globalSteel.id, name: "Hans Mueller", email: "h.mueller@globalsteel.example.com", phone: "+49-30-5550200", role: "Primary", designation: "Managing Director", contactType: "PRIMARY", isPrimary: true },
    { tenantId: globalSteel.id, name: "Lena Fischer", email: "l.fischer@globalsteel.example.com", phone: "+49-30-5550201", role: "Billing", designation: "Head of Finance", contactType: "BILLING", isPrimary: false },
    { tenantId: globalSteel.id, name: "Thomas Weber", email: "t.weber@globalsteel.example.com", phone: "+49-30-5550202", role: "Technical", designation: "Systems Engineer", contactType: "TECHNICAL", isPrimary: false },
    { tenantId: precisionParts.id, name: "James Wright", email: "j.wright@precisionparts.example.com", phone: "+44-20-5550300", role: "Primary", designation: "Operations Director", contactType: "PRIMARY", isPrimary: true },
    { tenantId: precisionParts.id, name: "Susan Hall", email: "s.hall@precisionparts.example.com", phone: "+44-20-5550301", role: "Billing", designation: "Accounts Manager", contactType: "BILLING", isPrimary: false },
    { tenantId: brightFoods.id, name: "Priya Sharma", email: "priya@brightfoods.example.com", phone: "+91-22-5550400", role: "Primary", designation: "CEO", contactType: "PRIMARY", isPrimary: true },
    { tenantId: brightFoods.id, name: "Raj Patel", email: "raj.patel@brightfoods.example.com", phone: "+91-22-5550401", role: "Technical", designation: "CTO", contactType: "TECHNICAL", isPrimary: false },
    { tenantId: brightFoods.id, name: "Meera Joshi", email: "meera.joshi@brightfoods.example.com", phone: "+91-22-5550402", role: "Billing", designation: "Finance Lead", contactType: "BILLING", isPrimary: false },
    { tenantId: novaEnergy.id, name: "Liam O'Brien", email: "liam@novaenergy.example.com", phone: "+61-2-5550500", role: "Primary", designation: "Founder & CEO", contactType: "PRIMARY", isPrimary: true },
  ];
  for (const c of contactData) {
    const existing = await prisma.contact.findFirst({ where: { tenantId: c.tenantId, email: c.email } });
    if (existing) {
      await prisma.contact.update({ where: { id: existing.id }, data: { designation: c.designation, contactType: c.contactType } });
    } else {
      await prisma.contact.create({ data: c });
    }
  }

  // ---- Subscriptions ----
  const subData: { tenantId: string; plan: string; status: string; startDate: Date; endDate: Date | null; trialEndsAt: Date | null; renewalDate: Date | null; billingCycle: string; monthlyRate: Prisma.Decimal; includedAllowance: number | null; autoRenew: boolean }[] = [
    { tenantId: acme.id, plan: "PROFESSIONAL", status: "ACTIVE", startDate: new Date("2025-06-01"), endDate: new Date("2027-05-31"), trialEndsAt: null, renewalDate: new Date("2027-05-31"), billingCycle: "ANNUAL", monthlyRate: new Prisma.Decimal("2500.00"), includedAllowance: 500, autoRenew: true },
    { tenantId: globalSteel.id, plan: "ENTERPRISE", status: "ACTIVE", startDate: new Date("2025-01-15"), endDate: new Date("2027-01-14"), trialEndsAt: null, renewalDate: new Date("2027-01-14"), billingCycle: "ANNUAL", monthlyRate: new Prisma.Decimal("5000.00"), includedAllowance: 1000, autoRenew: true },
    { tenantId: precisionParts.id, plan: "BASIC", status: "ACTIVE", startDate: new Date("2026-03-01"), endDate: new Date("2027-02-28"), trialEndsAt: null, renewalDate: new Date("2026-12-01"), billingCycle: "MONTHLY", monthlyRate: new Prisma.Decimal("800.00"), includedAllowance: 200, autoRenew: true },
    { tenantId: brightFoods.id, plan: "PROFESSIONAL", status: "ACTIVE", startDate: new Date("2026-01-10"), endDate: new Date("2027-01-09"), trialEndsAt: null, renewalDate: new Date("2027-01-10"), billingCycle: "QUARTERLY", monthlyRate: new Prisma.Decimal("2500.00"), includedAllowance: 300, autoRenew: true },
    { tenantId: novaEnergy.id, plan: "TRIAL", status: "TRIAL", startDate: new Date("2026-11-01"), endDate: null, trialEndsAt: new Date("2026-11-30"), renewalDate: null, billingCycle: "MONTHLY", monthlyRate: new Prisma.Decimal("0"), includedAllowance: 50, autoRenew: false },
  ];
  for (const s of subData) {
    const existing = await prisma.subscription.findUnique({ where: { tenantId: s.tenantId } });
    if (existing) {
      await prisma.subscription.update({ where: { tenantId: s.tenantId }, data: { endDate: s.endDate, renewalDate: s.renewalDate, includedAllowance: s.includedAllowance } });
    } else {
      await prisma.subscription.create({ data: s });
    }
  }

  // ---- Payments ----
  const paymentData: { tenantId: string; invoiceNumber: string; amount: Prisma.Decimal; currency: string; status: string; paymentMethod: string | null; billingPeriodStart: Date; billingPeriodEnd: Date; dueDate: Date; paidAt: Date | null; description: string; transactionId: string | null }[] = [
    { tenantId: acme.id, invoiceNumber: "INV-2026-001", amount: new Prisma.Decimal("30000.00"), currency: "USD", status: "PAID", paymentMethod: "Bank Transfer", billingPeriodStart: new Date("2026-06-01"), billingPeriodEnd: new Date("2027-05-31"), dueDate: new Date("2026-06-15"), paidAt: new Date("2026-06-10"), description: "Annual Professional plan renewal", transactionId: "TXN-ACM-20260610" },
    { tenantId: globalSteel.id, invoiceNumber: "INV-2026-002", amount: new Prisma.Decimal("60000.00"), currency: "USD", status: "PAID", paymentMethod: "Wire Transfer", billingPeriodStart: new Date("2026-01-15"), billingPeriodEnd: new Date("2027-01-14"), dueDate: new Date("2026-01-30"), paidAt: new Date("2026-01-28"), description: "Annual Enterprise plan renewal", transactionId: "TXN-GS-20260128" },
    { tenantId: precisionParts.id, invoiceNumber: "INV-2026-015", amount: new Prisma.Decimal("800.00"), currency: "USD", status: "PAID", paymentMethod: "Credit Card", billingPeriodStart: new Date("2026-11-01"), billingPeriodEnd: new Date("2026-11-30"), dueDate: new Date("2026-11-05"), paidAt: new Date("2026-11-03"), description: "Monthly Basic plan - November 2026", transactionId: "TXN-PP-20261103" },
    { tenantId: brightFoods.id, invoiceNumber: "INV-2026-008", amount: new Prisma.Decimal("7500.00"), currency: "USD", status: "PAID", paymentMethod: "Bank Transfer", billingPeriodStart: new Date("2026-10-10"), billingPeriodEnd: new Date("2027-01-09"), dueDate: new Date("2026-10-25"), paidAt: new Date("2026-10-22"), description: "Quarterly Professional plan - Q4 2026", transactionId: "TXN-BF-20261022" },
    { tenantId: novaEnergy.id, invoiceNumber: "INV-2026-020", amount: new Prisma.Decimal("800.00"), currency: "USD", status: "PENDING", paymentMethod: null, billingPeriodStart: new Date("2026-12-01"), billingPeriodEnd: new Date("2026-12-31"), dueDate: new Date("2026-12-05"), paidAt: null, description: "First month after trial - Basic plan", transactionId: null },
  ];
  for (const p of paymentData) {
    const existing = await prisma.payment.findFirst({ where: { invoiceNumber: p.invoiceNumber } });
    if (!existing) await prisma.payment.create({ data: p });
  }

  // ---- Users per tenant ----
  const tenantUsers: { email: string; firstName: string; lastName: string; tenantId: string; roleId: string; lastLoginAt: Date | null }[] = [
    // Acme Manufacturing users
    { email: "sarah.chen@acme-mfg.example.com", firstName: "Sarah", lastName: "Chen", tenantId: acme.id, roleId: tenantAdminRole.id, lastLoginAt: new Date("2026-11-11T14:30:00Z") },
    { email: "mike.torres@acme-mfg.example.com", firstName: "Mike", lastName: "Torres", tenantId: acme.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-10T09:00:00Z") },
    { email: "jane.smith@acme-mfg.example.com", firstName: "Jane", lastName: "Smith", tenantId: acme.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-11T08:15:00Z") },
    { email: "bob.johnson@acme-mfg.example.com", firstName: "Bob", lastName: "Johnson", tenantId: acme.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-09T16:22:00Z") },
    { email: "lisa.wang@acme-mfg.example.com", firstName: "Lisa", lastName: "Wang", tenantId: acme.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-11T11:45:00Z") },
    // Global Steel users
    { email: "h.mueller@globalsteel.example.com", firstName: "Hans", lastName: "Mueller", tenantId: globalSteel.id, roleId: tenantAdminRole.id, lastLoginAt: new Date("2026-11-10T09:15:00Z") },
    { email: "l.fischer@globalsteel.example.com", firstName: "Lena", lastName: "Fischer", tenantId: globalSteel.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-09T14:30:00Z") },
    { email: "t.weber@globalsteel.example.com", firstName: "Thomas", lastName: "Weber", tenantId: globalSteel.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-10T07:00:00Z") },
    { email: "k.bauer@globalsteel.example.com", firstName: "Klaus", lastName: "Bauer", tenantId: globalSteel.id, roleId: tenantUserRole.id, lastLoginAt: null },
    // Precision Parts users
    { email: "j.wright@precisionparts.example.com", firstName: "James", lastName: "Wright", tenantId: precisionParts.id, roleId: tenantAdminRole.id, lastLoginAt: new Date("2026-11-09T16:45:00Z") },
    { email: "e.clark@precisionparts.example.com", firstName: "Emma", lastName: "Clark", tenantId: precisionParts.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-08T10:20:00Z") },
    // Bright Foods users
    { email: "priya@brightfoods.example.com", firstName: "Priya", lastName: "Sharma", tenantId: brightFoods.id, roleId: tenantAdminRole.id, lastLoginAt: new Date("2026-11-11T11:00:00Z") },
    { email: "raj.patel@brightfoods.example.com", firstName: "Raj", lastName: "Patel", tenantId: brightFoods.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-11T09:30:00Z") },
    { email: "anita.gupta@brightfoods.example.com", firstName: "Anita", lastName: "Gupta", tenantId: brightFoods.id, roleId: tenantUserRole.id, lastLoginAt: new Date("2026-11-10T15:00:00Z") },
    // Nova Energy users
    { email: "liam@novaenergy.example.com", firstName: "Liam", lastName: "O'Brien", tenantId: novaEnergy.id, roleId: tenantAdminRole.id, lastLoginAt: new Date("2026-11-05T12:00:00Z") },
  ];
  for (const u of tenantUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { lastLoginAt: u.lastLoginAt },
      create: { email: u.email, firstName: u.firstName, lastName: u.lastName, lastLoginAt: u.lastLoginAt },
    });
    const mem = await prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId: u.tenantId, userId: user.id } } });
    if (!mem) await prisma.tenantMembership.create({ data: { tenantId: u.tenantId, userId: user.id, roleId: u.roleId } });
  }

  // ---- Demo tenant admin user + membership ----
  const demoTenantAdmin = await prisma.user.upsert({
    where: { email: "dev-org-admin@dev.local" },
    update: {},
    create: { email: "dev-org-admin@dev.local", firstName: "Dev", lastName: "Org Admin", isSuperAdmin: false },
  });
  const existingMembership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId: demoOrg.id, userId: demoTenantAdmin.id } },
  });
  if (!existingMembership) {
    await prisma.tenantMembership.create({
      data: { tenantId: demoOrg.id, userId: demoTenantAdmin.id, roleId: tenantAdminRole.id },
    });
  }

  // ---- Asset hierarchy levels ----
  const hierarchyData: { tenantId: string; levelKey: string; displayName: string; pluralName: string; levelOrder: number; isRootLevel: boolean }[] = [
    { tenantId: acme.id, levelKey: "plant", displayName: "Plant", pluralName: "Plants", levelOrder: 1, isRootLevel: true },
    { tenantId: acme.id, levelKey: "line", displayName: "Production Line", pluralName: "Production Lines", levelOrder: 2, isRootLevel: false },
    { tenantId: acme.id, levelKey: "station", displayName: "Work Station", pluralName: "Work Stations", levelOrder: 3, isRootLevel: false },
    { tenantId: acme.id, levelKey: "equipment", displayName: "Equipment", pluralName: "Equipment", levelOrder: 4, isRootLevel: false },
    { tenantId: globalSteel.id, levelKey: "facility", displayName: "Facility", pluralName: "Facilities", levelOrder: 1, isRootLevel: true },
    { tenantId: globalSteel.id, levelKey: "department", displayName: "Department", pluralName: "Departments", levelOrder: 2, isRootLevel: false },
    { tenantId: globalSteel.id, levelKey: "unit", displayName: "Unit", pluralName: "Units", levelOrder: 3, isRootLevel: false },
    { tenantId: precisionParts.id, levelKey: "site", displayName: "Site", pluralName: "Sites", levelOrder: 1, isRootLevel: true },
    { tenantId: precisionParts.id, levelKey: "workshop", displayName: "Workshop", pluralName: "Workshops", levelOrder: 2, isRootLevel: false },
    { tenantId: brightFoods.id, levelKey: "factory", displayName: "Factory", pluralName: "Factories", levelOrder: 1, isRootLevel: true },
    { tenantId: brightFoods.id, levelKey: "zone", displayName: "Zone", pluralName: "Zones", levelOrder: 2, isRootLevel: false },
    { tenantId: brightFoods.id, levelKey: "machine", displayName: "Machine", pluralName: "Machines", levelOrder: 3, isRootLevel: false },
  ];
  const hierarchyLevels: Record<string, string> = {};
  for (const h of hierarchyData) {
    const existing = await prisma.tenantAssetHierarchyLevel.findUnique({ where: { tenantId_levelKey: { tenantId: h.tenantId, levelKey: h.levelKey } } });
    const level = existing ?? await prisma.tenantAssetHierarchyLevel.create({ data: h });
    hierarchyLevels[`${h.tenantId}:${h.levelKey}`] = level.id;
  }

  // ---- Assets ----
  const assetData: { tenantId: string; hierarchyKey: string; assetCode: string; defaultName: string; parentCode?: string }[] = [
    { tenantId: acme.id, hierarchyKey: "plant", assetCode: "ACM-P01", defaultName: "Detroit Plant" },
    { tenantId: acme.id, hierarchyKey: "plant", assetCode: "ACM-P02", defaultName: "Austin Plant" },
    { tenantId: acme.id, hierarchyKey: "line", assetCode: "ACM-L01", defaultName: "Assembly Line A", parentCode: "ACM-P01" },
    { tenantId: acme.id, hierarchyKey: "line", assetCode: "ACM-L02", defaultName: "Assembly Line B", parentCode: "ACM-P01" },
    { tenantId: acme.id, hierarchyKey: "line", assetCode: "ACM-L03", defaultName: "Paint Line", parentCode: "ACM-P01" },
    { tenantId: acme.id, hierarchyKey: "station", assetCode: "ACM-S01", defaultName: "Weld Station 1", parentCode: "ACM-L01" },
    { tenantId: acme.id, hierarchyKey: "station", assetCode: "ACM-S02", defaultName: "Weld Station 2", parentCode: "ACM-L01" },
    { tenantId: acme.id, hierarchyKey: "equipment", assetCode: "ACM-E01", defaultName: "Robot Arm R-200", parentCode: "ACM-S01" },
    { tenantId: acme.id, hierarchyKey: "equipment", assetCode: "ACM-E02", defaultName: "Conveyor Belt CB-4", parentCode: "ACM-L02" },
    { tenantId: acme.id, hierarchyKey: "equipment", assetCode: "ACM-E03", defaultName: "Paint Sprayer PS-1", parentCode: "ACM-L03" },
    { tenantId: globalSteel.id, hierarchyKey: "facility", assetCode: "GS-F01", defaultName: "Hamburg Mill" },
    { tenantId: globalSteel.id, hierarchyKey: "facility", assetCode: "GS-F02", defaultName: "Berlin Processing" },
    { tenantId: globalSteel.id, hierarchyKey: "department", assetCode: "GS-D01", defaultName: "Hot Rolling", parentCode: "GS-F01" },
    { tenantId: globalSteel.id, hierarchyKey: "department", assetCode: "GS-D02", defaultName: "Cold Rolling", parentCode: "GS-F01" },
    { tenantId: globalSteel.id, hierarchyKey: "unit", assetCode: "GS-U01", defaultName: "Furnace Unit 1", parentCode: "GS-D01" },
    { tenantId: globalSteel.id, hierarchyKey: "unit", assetCode: "GS-U02", defaultName: "Roller Stand A", parentCode: "GS-D01" },
    { tenantId: precisionParts.id, hierarchyKey: "site", assetCode: "PP-S01", defaultName: "Bristol Site" },
    { tenantId: precisionParts.id, hierarchyKey: "workshop", assetCode: "PP-W01", defaultName: "CNC Workshop", parentCode: "PP-S01" },
    { tenantId: precisionParts.id, hierarchyKey: "workshop", assetCode: "PP-W02", defaultName: "Quality Lab", parentCode: "PP-S01" },
    { tenantId: brightFoods.id, hierarchyKey: "factory", assetCode: "BF-F01", defaultName: "Mumbai Factory" },
    { tenantId: brightFoods.id, hierarchyKey: "zone", assetCode: "BF-Z01", defaultName: "Processing Zone", parentCode: "BF-F01" },
    { tenantId: brightFoods.id, hierarchyKey: "zone", assetCode: "BF-Z02", defaultName: "Packaging Zone", parentCode: "BF-F01" },
    { tenantId: brightFoods.id, hierarchyKey: "machine", assetCode: "BF-M01", defaultName: "Mixer MX-100", parentCode: "BF-Z01" },
    { tenantId: brightFoods.id, hierarchyKey: "machine", assetCode: "BF-M02", defaultName: "Sealer SL-50", parentCode: "BF-Z02" },
  ];
  const assetIds: Record<string, string> = {};
  for (const a of assetData) {
    const levelId = hierarchyLevels[`${a.tenantId}:${a.hierarchyKey}`];
    const parentId = a.parentCode ? assetIds[`${a.tenantId}:${a.parentCode}`] ?? null : null;
    const existing = await prisma.asset.findUnique({ where: { tenantId_assetCode: { tenantId: a.tenantId, assetCode: a.assetCode } } });
    const asset = existing ?? await prisma.asset.create({ data: { tenantId: a.tenantId, hierarchyLevelId: levelId, assetCode: a.assetCode, defaultName: a.defaultName, parentAssetId: parentId } });
    assetIds[`${a.tenantId}:${a.assetCode}`] = asset.id;
  }

  // ---- Invoices ----
  const allCategories = await prisma.procedureCategory.findMany();
  const catByKey = Object.fromEntries(allCategories.map((c) => [c.key, c.id]));

  const invoiceData: { tenantId: string; invoiceNumber: string; billingPeriodStart: Date; billingPeriodEnd: Date; currency: string; subtotal: Prisma.Decimal; total: Prisma.Decimal; amountPaid: Prisma.Decimal; outstandingBalance: Prisma.Decimal; status: string; dueDate: Date; paidAt: Date | null; items: { description: string; pricingModel: string; quantity: number; unitRate: Prisma.Decimal; amount: Prisma.Decimal }[] }[] = [
    {
      tenantId: acme.id, invoiceNumber: "INV-2026-001", billingPeriodStart: new Date("2026-06-01"), billingPeriodEnd: new Date("2027-05-31"),
      currency: "USD", subtotal: new Prisma.Decimal("30000.00"), total: new Prisma.Decimal("30000.00"),
      amountPaid: new Prisma.Decimal("30000.00"), outstandingBalance: new Prisma.Decimal("0"), status: "PAID",
      dueDate: new Date("2026-06-15"), paidAt: new Date("2026-06-10"),
      items: [
        { description: "Professional Plan - Annual subscription", pricingModel: "FLAT_RATE", quantity: 12, unitRate: new Prisma.Decimal("2500.00"), amount: new Prisma.Decimal("30000.00") },
      ],
    },
    {
      tenantId: acme.id, invoiceNumber: "INV-2026-030", billingPeriodStart: new Date("2026-10-01"), billingPeriodEnd: new Date("2026-10-31"),
      currency: "USD", subtotal: new Prisma.Decimal("1250.00"), total: new Prisma.Decimal("1250.00"),
      amountPaid: new Prisma.Decimal("1250.00"), outstandingBalance: new Prisma.Decimal("0"), status: "PAID",
      dueDate: new Date("2026-11-15"), paidAt: new Date("2026-11-12"),
      items: [
        { description: "Procedure overage - October 2026", pricingModel: "TIERED", quantity: 250, unitRate: new Prisma.Decimal("5.00"), amount: new Prisma.Decimal("1250.00") },
      ],
    },
    {
      tenantId: globalSteel.id, invoiceNumber: "INV-2026-002", billingPeriodStart: new Date("2026-01-15"), billingPeriodEnd: new Date("2027-01-14"),
      currency: "USD", subtotal: new Prisma.Decimal("60000.00"), total: new Prisma.Decimal("60000.00"),
      amountPaid: new Prisma.Decimal("60000.00"), outstandingBalance: new Prisma.Decimal("0"), status: "PAID",
      dueDate: new Date("2026-01-30"), paidAt: new Date("2026-01-28"),
      items: [
        { description: "Enterprise Plan - Annual subscription", pricingModel: "FLAT_RATE", quantity: 12, unitRate: new Prisma.Decimal("5000.00"), amount: new Prisma.Decimal("60000.00") },
      ],
    },
    {
      tenantId: globalSteel.id, invoiceNumber: "INV-2026-031", billingPeriodStart: new Date("2026-09-01"), billingPeriodEnd: new Date("2026-09-30"),
      currency: "USD", subtotal: new Prisma.Decimal("3500.00"), total: new Prisma.Decimal("3500.00"),
      amountPaid: new Prisma.Decimal("0"), outstandingBalance: new Prisma.Decimal("3500.00"), status: "OVERDUE",
      dueDate: new Date("2026-10-15"), paidAt: null,
      items: [
        { description: "Procedure overage - September 2026", pricingModel: "TIERED", quantity: 500, unitRate: new Prisma.Decimal("4.50"), amount: new Prisma.Decimal("2250.00") },
        { description: "Additional seat pack (10 seats)", pricingModel: "FLAT_RATE", quantity: 10, unitRate: new Prisma.Decimal("125.00"), amount: new Prisma.Decimal("1250.00") },
      ],
    },
    {
      tenantId: precisionParts.id, invoiceNumber: "INV-2026-015", billingPeriodStart: new Date("2026-11-01"), billingPeriodEnd: new Date("2026-11-30"),
      currency: "USD", subtotal: new Prisma.Decimal("800.00"), total: new Prisma.Decimal("800.00"),
      amountPaid: new Prisma.Decimal("800.00"), outstandingBalance: new Prisma.Decimal("0"), status: "PAID",
      dueDate: new Date("2026-11-05"), paidAt: new Date("2026-11-03"),
      items: [
        { description: "Basic Plan - November 2026", pricingModel: "FLAT_RATE", quantity: 1, unitRate: new Prisma.Decimal("800.00"), amount: new Prisma.Decimal("800.00") },
      ],
    },
    {
      tenantId: precisionParts.id, invoiceNumber: "INV-2026-010", billingPeriodStart: new Date("2026-10-01"), billingPeriodEnd: new Date("2026-10-31"),
      currency: "USD", subtotal: new Prisma.Decimal("800.00"), total: new Prisma.Decimal("800.00"),
      amountPaid: new Prisma.Decimal("800.00"), outstandingBalance: new Prisma.Decimal("0"), status: "PAID",
      dueDate: new Date("2026-10-05"), paidAt: new Date("2026-10-04"),
      items: [
        { description: "Basic Plan - October 2026", pricingModel: "FLAT_RATE", quantity: 1, unitRate: new Prisma.Decimal("800.00"), amount: new Prisma.Decimal("800.00") },
      ],
    },
    {
      tenantId: brightFoods.id, invoiceNumber: "INV-2026-008", billingPeriodStart: new Date("2026-10-10"), billingPeriodEnd: new Date("2027-01-09"),
      currency: "USD", subtotal: new Prisma.Decimal("7500.00"), total: new Prisma.Decimal("7500.00"),
      amountPaid: new Prisma.Decimal("7500.00"), outstandingBalance: new Prisma.Decimal("0"), status: "PAID",
      dueDate: new Date("2026-10-25"), paidAt: new Date("2026-10-22"),
      items: [
        { description: "Professional Plan - Q4 2026", pricingModel: "FLAT_RATE", quantity: 3, unitRate: new Prisma.Decimal("2500.00"), amount: new Prisma.Decimal("7500.00") },
      ],
    },
    {
      tenantId: novaEnergy.id, invoiceNumber: "INV-2026-020", billingPeriodStart: new Date("2026-12-01"), billingPeriodEnd: new Date("2026-12-31"),
      currency: "USD", subtotal: new Prisma.Decimal("800.00"), total: new Prisma.Decimal("800.00"),
      amountPaid: new Prisma.Decimal("0"), outstandingBalance: new Prisma.Decimal("800.00"), status: "OPEN",
      dueDate: new Date("2026-12-05"), paidAt: null,
      items: [
        { description: "Basic Plan - First month after trial", pricingModel: "FLAT_RATE", quantity: 1, unitRate: new Prisma.Decimal("800.00"), amount: new Prisma.Decimal("800.00") },
      ],
    },
  ];
  for (const inv of invoiceData) {
    const existing = await prisma.invoice.findFirst({ where: { invoiceNumber: inv.invoiceNumber } });
    if (!existing) {
      const created = await prisma.invoice.create({
        data: {
          tenantId: inv.tenantId, invoiceNumber: inv.invoiceNumber, billingPeriodStart: inv.billingPeriodStart,
          billingPeriodEnd: inv.billingPeriodEnd, currency: inv.currency, subtotal: inv.subtotal, total: inv.total,
          amountPaid: inv.amountPaid, outstandingBalance: inv.outstandingBalance, status: inv.status,
          dueDate: inv.dueDate, paidAt: inv.paidAt,
        },
      });
      for (const item of inv.items) {
        await prisma.invoiceItem.create({
          data: { invoiceId: created.id, description: item.description, pricingModel: item.pricingModel, quantity: item.quantity, unitRate: item.unitRate, amount: item.amount },
        });
      }
      // Link payments to invoices
      const payment = await prisma.payment.findFirst({ where: { invoiceNumber: inv.invoiceNumber } });
      if (payment) {
        await prisma.payment.update({ where: { id: payment.id }, data: { invoiceId: created.id } });
      }
    }
  }

  // ---- Pricing configurations ----
  const pricingData: { tenantId: string; categoryKey: string | null; pricingModel: string; billingPeriod: string; currency: string; effectiveFrom: Date; effectiveTo: Date | null; status: string; tiers: { minimumQuantity: number; maximumQuantity: number | null; unitRate: Prisma.Decimal; tierOrder: number }[] }[] = [
    {
      tenantId: acme.id, categoryKey: null, pricingModel: "TIERED", billingPeriod: "MONTHLY", currency: "USD",
      effectiveFrom: new Date("2025-06-01"), effectiveTo: null, status: "ACTIVE",
      tiers: [
        { minimumQuantity: 0, maximumQuantity: 500, unitRate: new Prisma.Decimal("0"), tierOrder: 1 },
        { minimumQuantity: 501, maximumQuantity: 2000, unitRate: new Prisma.Decimal("5.00"), tierOrder: 2 },
        { minimumQuantity: 2001, maximumQuantity: null, unitRate: new Prisma.Decimal("3.50"), tierOrder: 3 },
      ],
    },
    {
      tenantId: globalSteel.id, categoryKey: null, pricingModel: "TIERED", billingPeriod: "MONTHLY", currency: "USD",
      effectiveFrom: new Date("2025-01-15"), effectiveTo: null, status: "ACTIVE",
      tiers: [
        { minimumQuantity: 0, maximumQuantity: 1000, unitRate: new Prisma.Decimal("0"), tierOrder: 1 },
        { minimumQuantity: 1001, maximumQuantity: 5000, unitRate: new Prisma.Decimal("4.50"), tierOrder: 2 },
        { minimumQuantity: 5001, maximumQuantity: null, unitRate: new Prisma.Decimal("3.00"), tierOrder: 3 },
      ],
    },
    {
      tenantId: precisionParts.id, categoryKey: null, pricingModel: "FLAT_RATE", billingPeriod: "MONTHLY", currency: "USD",
      effectiveFrom: new Date("2026-03-01"), effectiveTo: null, status: "ACTIVE",
      tiers: [
        { minimumQuantity: 0, maximumQuantity: null, unitRate: new Prisma.Decimal("800.00"), tierOrder: 1 },
      ],
    },
    {
      tenantId: brightFoods.id, categoryKey: null, pricingModel: "TIERED", billingPeriod: "QUARTERLY", currency: "USD",
      effectiveFrom: new Date("2026-01-10"), effectiveTo: null, status: "ACTIVE",
      tiers: [
        { minimumQuantity: 0, maximumQuantity: 300, unitRate: new Prisma.Decimal("0"), tierOrder: 1 },
        { minimumQuantity: 301, maximumQuantity: 1500, unitRate: new Prisma.Decimal("6.00"), tierOrder: 2 },
        { minimumQuantity: 1501, maximumQuantity: null, unitRate: new Prisma.Decimal("4.00"), tierOrder: 3 },
      ],
    },
  ];
  for (const pc of pricingData) {
    const existing = await prisma.tenantProcedurePricing.findFirst({ where: { tenantId: pc.tenantId, status: pc.status } });
    if (!existing) {
      const config = await prisma.tenantProcedurePricing.create({
        data: {
          tenantId: pc.tenantId, categoryId: pc.categoryKey ? catByKey[pc.categoryKey] : null, pricingModel: pc.pricingModel,
          billingPeriod: pc.billingPeriod, currency: pc.currency, effectiveFrom: pc.effectiveFrom,
          effectiveTo: pc.effectiveTo, status: pc.status,
        },
      });
      for (const t of pc.tiers) {
        await prisma.tenantProcedurePricingTier.create({
          data: { pricingConfigId: config.id, minimumQuantity: t.minimumQuantity, maximumQuantity: t.maximumQuantity, unitRate: t.unitRate, tierOrder: t.tierOrder },
        });
      }
    }
  }

  // ---- Procedure executions ----
  const execData: { tenantId: string; userEmail: string; categoryKey: string; status: string; isBillable: boolean; startedAt: Date; completedAt: Date | null; failedAt: Date | null }[] = [];
  const categoryKeys = ["PROCEDURE", "ROUTINE", "INSPECTION", "TASK", "BDA", "AUDIT"];
  const statuses = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "FAILED", "CANCELLED"];
  const tenantExecMap: { tenantId: string; userEmail: string; count: number }[] = [
    { tenantId: acme.id, userEmail: "jane.smith@acme-mfg.example.com", count: 40 },
    { tenantId: acme.id, userEmail: "bob.johnson@acme-mfg.example.com", count: 35 },
    { tenantId: acme.id, userEmail: "lisa.wang@acme-mfg.example.com", count: 28 },
    { tenantId: globalSteel.id, userEmail: "t.weber@globalsteel.example.com", count: 50 },
    { tenantId: globalSteel.id, userEmail: "l.fischer@globalsteel.example.com", count: 30 },
    { tenantId: precisionParts.id, userEmail: "e.clark@precisionparts.example.com", count: 15 },
    { tenantId: brightFoods.id, userEmail: "raj.patel@brightfoods.example.com", count: 25 },
    { tenantId: brightFoods.id, userEmail: "anita.gupta@brightfoods.example.com", count: 20 },
    { tenantId: novaEnergy.id, userEmail: "liam@novaenergy.example.com", count: 5 },
  ];
  for (const te of tenantExecMap) {
    for (let i = 0; i < te.count; i++) {
      const catKey = categoryKeys[i % categoryKeys.length];
      const status = statuses[i % statuses.length];
      const daysAgo = Math.floor(i * 1.5);
      const startDate = new Date(Date.now() - daysAgo * 86400000);
      execData.push({
        tenantId: te.tenantId, userEmail: te.userEmail, categoryKey: catKey,
        status, isBillable: status === "COMPLETED",
        startedAt: startDate,
        completedAt: status === "COMPLETED" ? new Date(startDate.getTime() + 3600000) : null,
        failedAt: status === "FAILED" ? new Date(startDate.getTime() + 1800000) : null,
      });
    }
  }
  const existingExecCount = await prisma.procedureExecution.count();
  if (existingExecCount === 0) {
    const allUsers = await prisma.user.findMany();
    const userByEmail = Object.fromEntries(allUsers.map((u) => [u.email, u.id]));
    for (let i = 0; i < execData.length; i++) {
      const e = execData[i];
      const userId = userByEmail[e.userEmail];
      if (!userId) continue;
      await prisma.procedureExecution.create({
        data: {
          tenantId: e.tenantId, userId, categoryId: catByKey[e.categoryKey],
          idempotencyKey: `seed-exec-${i}-${Date.now()}`,
          status: e.status, isBillable: e.isBillable,
          billingPeriod: `${e.startedAt.getFullYear()}-${String(e.startedAt.getMonth() + 1).padStart(2, "0")}`,
          startedAt: e.startedAt, completedAt: e.completedAt, failedAt: e.failedAt,
        },
      });
    }
  }

  // ---- Audit logs ----
  const auditData: { tenantId: string; action: string; entityType: string; entityId: string | null; reason: string | null; createdAt: Date }[] = [
    { tenantId: acme.id, action: "SUBSCRIPTION_CREATED", entityType: "subscription", entityId: null, reason: "Professional plan activated", createdAt: new Date("2025-06-01T10:00:00Z") },
    { tenantId: acme.id, action: "USER_ADDED", entityType: "membership", entityId: null, reason: "Initial onboarding", createdAt: new Date("2025-06-02T08:30:00Z") },
    { tenantId: acme.id, action: "PRICING_CONFIGURED", entityType: "pricing", entityId: null, reason: "Tiered pricing set up", createdAt: new Date("2025-06-03T14:00:00Z") },
    { tenantId: acme.id, action: "INVOICE_GENERATED", entityType: "invoice", entityId: null, reason: "Annual subscription invoice", createdAt: new Date("2026-06-01T00:05:00Z") },
    { tenantId: acme.id, action: "PAYMENT_RECEIVED", entityType: "payment", entityId: null, reason: "Bank Transfer - INV-2026-001", createdAt: new Date("2026-06-10T09:15:00Z") },
    { tenantId: acme.id, action: "INVOICE_GENERATED", entityType: "invoice", entityId: null, reason: "Procedure overage - October 2026", createdAt: new Date("2026-11-01T00:05:00Z") },
    { tenantId: acme.id, action: "PAYMENT_RECEIVED", entityType: "payment", entityId: null, reason: "Bank Transfer - INV-2026-030", createdAt: new Date("2026-11-12T10:00:00Z") },
    { tenantId: acme.id, action: "ASSET_CREATED", entityType: "asset", entityId: null, reason: "Detroit Plant added", createdAt: new Date("2025-06-05T11:00:00Z") },
    { tenantId: acme.id, action: "HIERARCHY_CONFIGURED", entityType: "hierarchy", entityId: null, reason: "4-level hierarchy set up", createdAt: new Date("2025-06-04T09:00:00Z") },
    { tenantId: globalSteel.id, action: "SUBSCRIPTION_CREATED", entityType: "subscription", entityId: null, reason: "Enterprise plan activated", createdAt: new Date("2025-01-15T08:00:00Z") },
    { tenantId: globalSteel.id, action: "USER_ADDED", entityType: "membership", entityId: null, reason: "Initial onboarding", createdAt: new Date("2025-01-16T09:00:00Z") },
    { tenantId: globalSteel.id, action: "PAYMENT_RECEIVED", entityType: "payment", entityId: null, reason: "Wire Transfer - INV-2026-002", createdAt: new Date("2026-01-28T11:00:00Z") },
    { tenantId: globalSteel.id, action: "INVOICE_GENERATED", entityType: "invoice", entityId: null, reason: "Procedure overage - September 2026", createdAt: new Date("2026-10-01T00:05:00Z") },
    { tenantId: globalSteel.id, action: "PAYMENT_OVERDUE", entityType: "invoice", entityId: null, reason: "INV-2026-031 past due date", createdAt: new Date("2026-10-16T00:00:00Z") },
    { tenantId: precisionParts.id, action: "SUBSCRIPTION_CREATED", entityType: "subscription", entityId: null, reason: "Basic plan activated", createdAt: new Date("2026-03-01T09:00:00Z") },
    { tenantId: precisionParts.id, action: "PAYMENT_RECEIVED", entityType: "payment", entityId: null, reason: "Credit Card - INV-2026-015", createdAt: new Date("2026-11-03T14:00:00Z") },
    { tenantId: brightFoods.id, action: "SUBSCRIPTION_CREATED", entityType: "subscription", entityId: null, reason: "Professional plan activated", createdAt: new Date("2026-01-10T10:00:00Z") },
    { tenantId: brightFoods.id, action: "SEAT_LIMIT_REACHED", entityType: "tenant", entityId: null, reason: "40 of 40 seats in use", createdAt: new Date("2026-09-15T08:00:00Z") },
    { tenantId: brightFoods.id, action: "PAYMENT_RECEIVED", entityType: "payment", entityId: null, reason: "Bank Transfer - INV-2026-008", createdAt: new Date("2026-10-22T16:00:00Z") },
    { tenantId: novaEnergy.id, action: "TRIAL_STARTED", entityType: "subscription", entityId: null, reason: "30-day trial activated", createdAt: new Date("2026-11-01T12:00:00Z") },
    { tenantId: novaEnergy.id, action: "USER_ADDED", entityType: "membership", entityId: null, reason: "Liam O'Brien signed up", createdAt: new Date("2026-11-01T12:05:00Z") },
  ];
  const existingAuditCount = await prisma.auditLog.count();
  if (existingAuditCount === 0) {
    for (const a of auditData) {
      await prisma.auditLog.create({ data: a });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    categories: await prisma.procedureCategory.count(),
    tenants: await prisma.tenant.count(),
    contacts: await prisma.contact.count(),
    subscriptions: await prisma.subscription.count(),
    payments: await prisma.payment.count(),
    invoices: await prisma.invoice.count(),
    invoiceItems: await prisma.invoiceItem.count(),
    assets: await prisma.asset.count(),
    hierarchyLevels: await prisma.tenantAssetHierarchyLevel.count(),
    pricingConfigs: await prisma.tenantProcedurePricing.count(),
    executions: await prisma.procedureExecution.count(),
    memberships: await prisma.tenantMembership.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log("Seeded:", JSON.stringify(counts));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void prisma.$disconnect());

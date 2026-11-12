// SPEC-036 routes (TanStack Router, code-based). Public pages sit at the root; everything behind
// sign-in sits under the `portal` layout (AuthGate + AppShell).

import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ConfigGate } from "@/components/ConfigGate";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { NoAccessPage } from "@/pages/NoAccessPage";
import { NotBuiltPage } from "@/pages/NotBuiltPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlatformPage } from "@/pages/PlatformPage";
import { ActivityTrailPage } from "@/pages/ActivityTrailPage";
import { CompanyContactsPage } from "@/pages/CompanyContactsPage";
import { MonitoringPage } from "@/pages/MonitoringPage";
import { ConfigurationPage } from "@/pages/ConfigurationPage";
import { ModulePage } from "@/pages/ModulePage";
import { TenantDetailPage } from "@/pages/TenantDetailPage";
import { TenantsPage } from "@/pages/TenantsPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { PricingPage } from "@/pages/PricingPage";
import { TenantPricingPage } from "@/pages/TenantPricingPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { SubscriptionPage } from "@/pages/SubscriptionPage";
import { SignInProblemPage } from "@/pages/SignInProblemPage";
import { SignedOutPage } from "@/pages/SignedOutPage";

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <ConfigGate>
      <Outlet />
    </ConfigGate>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });

const signInProblemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in-problem",
  validateSearch: (search: Record<string, unknown>): { code?: string } =>
    typeof search.code === "string" ? { code: search.code } : {},
  component: function SignInProblemRoute() {
    const { code } = signInProblemRoute.useSearch();
    return <SignInProblemPage code={code} />;
  },
});

const signedOutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/signed-out", component: SignedOutPage });

const noAccessRoute = createRoute({ getParentRoute: () => rootRoute, path: "/no-access", component: NoAccessPage });

const portalRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "portal",
  component: () => (
    <AuthGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGate>
  ),
});

const dashboardRoute = createRoute({ getParentRoute: () => portalRoute, path: "/dashboard", component: DashboardPage });

// ADR-012 §7: the Super Admin's home (platform administration, no customer data).
const platformRoute = createRoute({ getParentRoute: () => portalRoute, path: "/platform", component: PlatformPage });

// Configurable asset operational hierarchy.
const assetsRoute = createRoute({ getParentRoute: () => portalRoute, path: "/assets", component: AssetsPage });

// SPEC-038: the Super Admin's tenants, and the Org Admin's monitoring, trail and contacts.
const tenantsRoute = createRoute({ getParentRoute: () => portalRoute, path: "/tenants", component: TenantsPage });
const tenantDetailRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/tenants/$orgId",
  component: function TenantDetailRoute() {
    const { orgId } = tenantDetailRoute.useParams();
    return <TenantDetailPage orgId={orgId} />;
  },
});
const monitoringRoute = createRoute({ getParentRoute: () => portalRoute, path: "/monitoring", component: MonitoringPage });
const trailRoute = createRoute({ getParentRoute: () => portalRoute, path: "/activity-trail", component: ActivityTrailPage });
const contactsRoute = createRoute({ getParentRoute: () => portalRoute, path: "/company-contacts", component: CompanyContactsPage });

// SPEC-039: one page per Work module, named by the tenant, and the Org Admin's configuration.
const moduleRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/work/$module",
  component: function ModuleRoute() {
    const { module } = moduleRoute.useParams();
    return <ModulePage key={module} slug={module} />;
  },
});
const configurationRoute = createRoute({ getParentRoute: () => portalRoute, path: "/configuration", component: ConfigurationPage });

// Tenant-specific pricing management (Super Admin).
const pricingRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/pricing/$tenantOrgId",
  component: function PricingRoute() {
    const { tenantOrgId } = pricingRoute.useParams();
    return <PricingPage tenantOrgId={tenantOrgId} />;
  },
});
const tenantPricingRoute = createRoute({ getParentRoute: () => portalRoute, path: "/my-pricing", component: TenantPricingPage });

// Billing, invoices, payments, subscriptions.
const invoicesRoute = createRoute({ getParentRoute: () => portalRoute, path: "/invoices", component: InvoicesPage });
const invoiceDetailRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/invoices/$invoiceId",
  component: function InvoiceDetailRoute() {
    const { invoiceId } = invoiceDetailRoute.useParams();
    return <InvoiceDetailPage invoiceId={invoiceId} />;
  },
});
const paymentsRoute = createRoute({ getParentRoute: () => portalRoute, path: "/payments", component: PaymentsPage });
const subscriptionRoute = createRoute({ getParentRoute: () => portalRoute, path: "/subscription", component: SubscriptionPage });

const notBuiltRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/not-built/$section",
  component: function NotBuiltRoute() {
    const { section } = notBuiltRoute.useParams();
    return <NotBuiltPage section={section} />;
  },
});

// Unknown paths render inside the shell when signed in (the gate still applies).
const notFoundRoute = createRoute({ getParentRoute: () => portalRoute, path: "$", component: NotFoundPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signInProblemRoute,
  signedOutRoute,
  noAccessRoute,
  portalRoute.addChildren([
    dashboardRoute,
    platformRoute,
    assetsRoute,
    tenantsRoute,
    tenantDetailRoute,
    monitoringRoute,
    trailRoute,
    contactsRoute,
    moduleRoute,
    configurationRoute,
    pricingRoute,
    tenantPricingRoute,
    invoicesRoute,
    invoiceDetailRoute,
    paymentsRoute,
    subscriptionRoute,
    notBuiltRoute,
    notFoundRoute,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: "intent" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

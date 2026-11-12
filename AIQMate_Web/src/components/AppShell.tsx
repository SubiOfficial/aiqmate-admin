import {
  Alert24Regular,
  ArrowLeft24Regular,
  Navigation24Regular,
  QuestionCircle24Regular,
  Search20Regular,
  Settings24Regular,
  SignOut24Regular,
} from "@fluentui/react-icons";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/common";
import { useConfig } from "@/lib/api/config";
import { useOrgMetadata } from "@/lib/api/metadata";
import { ROLE_LABEL, primaryRole } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/sign-out";
import { useMediaQuery } from "@/lib/media";
import { navSections, type NavItem as NavItemType } from "@/lib/nav";
import { NAV_ICONS } from "./NavIcon";

function getPageTitle(pathname: string, items: NavItemType[]): string {
  const item = items.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return item?.label ?? "Dashboard";
}

function userInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "U").toUpperCase();
}

function UserBadge({ name, role, onSignOut }: { name: string; role?: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="user-badge" ref={ref}>
      <button className="user-badge__trigger" onClick={() => setOpen(!open)}>
        <span className="user-badge__avatar">{userInitials(name)}</span>
        <span className="user-badge__name">{name}</span>
      </button>

      {open && (
        <div className="user-badge__dropdown">
          <div className="user-badge__header">
            <span className="user-badge__avatar user-badge__avatar--lg">{userInitials(name)}</span>
            <div>
              <div className="user-badge__display-name">{name}</div>
              {role && <div className="user-badge__role">{role}</div>}
            </div>
          </div>
          <div className="user-badge__divider" />
          <button
            className="user-badge__action user-badge__action--danger"
            onClick={() => { setOpen(false); setConfirmOpen(true); }}
          >
            <SignOut24Regular />
            Sign out
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onSignOut}
        variant="warning"
        title="Sign out?"
        description="You will be returned to the login screen."
        confirmLabel="Sign out"
      />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const config = useConfig();
  const session = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const wide = useMediaQuery("(min-width: 900px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const metadata = useOrgMetadata(session.user.id, session.roles);
  const sections = navSections(session.roles, config.showUnbuilt, metadata.data);
  const items = sections.flatMap((sec) => sec.items);
  const selectedKey = items.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.key ?? "";
  const role = primaryRole(session.roles);
  const pageTitle = getPageTitle(pathname, items);
  const isRootPage = pathname === "/dashboard" || pathname === "/platform";

  useEffect(() => {
    if (wide) setSidebarOpen(false);
  }, [wide]);

  const handleNav = useCallback(
    (href: string) => {
      setSidebarOpen(false);
      void navigate({ to: href });
    },
    [navigate],
  );

  return (
    <div className="app">
      {/* Mobile overlay */}
      <div
        className={`sidebar__overlay${sidebarOpen ? " is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar${!wide && !sidebarOpen ? "" : ""}${!wide && sidebarOpen ? " is-open" : ""}`}
        style={!wide && !sidebarOpen ? { display: "none" } : undefined}
      >
        <div className="brand">
          <span className="brand__mark">A</span>
          <span className="brand__name">AiQMate</span>
        </div>

        <div className="nav__label">MENU</div>

        <nav style={{ flex: 1 }}>
          {sections.map((section) => (
            <Fragment key={section.id}>
              {section.title && section.id !== "top" && (
                <div className="nav__label">{section.title.toUpperCase()}</div>
              )}
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const isActive = selectedKey === item.key;
                return (
                  <button
                    key={item.key}
                    className={`nav__item${isActive ? " is-active" : ""}`}
                    onClick={() => handleNav(item.href)}
                  >
                    <span className="icon"><Icon /></span>
                    <span>{item.label}</span>
                    {!item.built && <span className="nav__badge">Soon</span>}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="nav__item" onClick={() => handleNav("/not-built/settings")}>
            <span className="icon"><Settings24Regular /></span>
            <span>Settings</span>
          </button>
          <button className="nav__item" onClick={() => handleNav("/not-built/help")}>
            <span className="icon"><QuestionCircle24Regular /></span>
            <span>Help &amp; support</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="app__main">
        <header className="topbar">
          {/* Hamburger (mobile) */}
          <button
            className="topbar__hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Navigation24Regular />
          </button>

          {/* Back button */}
          {!isRootPage && (
            <button
              className="topbar__back"
              onClick={() => window.history.back()}
              aria-label="Go back"
            >
              <ArrowLeft24Regular />
            </button>
          )}

          {/* Breadcrumbs */}
          <div className="crumbs">
            <span className="crumbs__item">AiQMate</span>
            <span className="crumbs__item">&gt;</span>
            <span className="crumbs__item"><b>{pageTitle}</b></span>
          </div>

          {/* Search */}
          <div className="search">
            <Search20Regular />
            <input type="search" placeholder="Search tenants, payments..." />
            <kbd>Ctrl K</kbd>
          </div>

          {/* Notification bell */}
          <button className="topbar__bell" aria-label="Notifications">
            <Alert24Regular />
            <span className="topbar__bell-dot" />
          </button>

          {/* User badge */}
          <UserBadge
            name={session.user.displayName}
            role={role ? ROLE_LABEL[role] : undefined}
            onSignOut={() => void signOut()}
          />
        </header>

        <div className="app__content">{children}</div>
      </div>
    </div>
  );
}

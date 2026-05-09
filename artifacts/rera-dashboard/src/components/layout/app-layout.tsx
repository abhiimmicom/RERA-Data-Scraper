import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, Users, MapPin } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50 font-semibold text-lg gap-3">
          <Building2 className="w-5 h-5 text-primary" />
          <span>RERA Directory</span>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-2">Delhi RERA</p>
          <Link href="/">
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                location === "/"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </div>
          </Link>
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              location.startsWith("/agents") && location !== "/"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/80"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Agents</span>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mt-4 mb-2">RECA Kolkata</p>
          <Link href="/reca-members">
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                location.startsWith("/reca-members")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Members</span>
            </div>
          </Link>
        </div>
        <div className="p-4 border-t border-sidebar-border/50 text-xs text-sidebar-foreground/50">
          Govt. of NCT of Delhi
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

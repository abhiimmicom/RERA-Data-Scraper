import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, Users, MapPin, Globe, List, User } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItem = (href: string, icon: ReactNode, label: string) => (
    <Link href={href}>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
          location === href || (href !== "/" && location.startsWith(href))
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`}
      >
        {icon}
        <span>{label}</span>
      </div>
    </Link>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50 font-semibold text-lg gap-3">
          <Building2 className="w-5 h-5 text-primary" />
          <span>RERA Directory</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-4 flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-2">Delhi RERA</p>
          {navItem("/", <LayoutDashboard className="w-4 h-4" />, "Dashboard")}
          <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.startsWith("/agents") && location !== "/" ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80"}`}>
            <Users className="w-4 h-4" />
            <span>Agents</span>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mt-4 mb-2">RECA Kolkata</p>
          {navItem("/reca-members", <MapPin className="w-4 h-4" />, "Members")}

          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mt-4 mb-2">Propertiezzzz</p>
          {navItem("/propz/scrape", <Globe className="w-4 h-4" />, "Scrape URLs")}
          {navItem("/propz/agents", <List className="w-4 h-4" />, "Agents")}

          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mt-4 mb-2">RiVirtual</p>
          {navItem("/rivirtual/scrape", <User className="w-4 h-4" />, "Scrape")}
          {navItem("/rivirtual/agents", <List className="w-4 h-4" />, "Agents")}
        </div>
        <div className="p-4 border-t border-sidebar-border/50 text-xs text-sidebar-foreground/50">
          Govt. of NCT of Delhi
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

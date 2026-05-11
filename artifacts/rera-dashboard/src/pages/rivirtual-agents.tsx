import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Database,
  Phone,
  Mail,
  MapPin,
  Building2,
  Tag,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format, parseISO } from "date-fns";

interface RivirtualAgent {
  id: number;
  slug: string | null;
  jobId: number | null;
  label: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  propertyType: string | null;
  photoUrl: string | null;
  remotePhotoUrl: string | null;
  detailUrl: string | null;
  city: string | null;
  scrapedAt: string;
}

interface RivirtualJob {
  id: number;
  label: string;
  agentsFound: number | null;
  status: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function AgentPhoto({
  agent,
  size = "sm",
}: {
  agent: RivirtualAgent;
  size?: "sm" | "lg";
}) {
  const [err, setErr] = useState(false);
  const initials = agent.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const cls =
    size === "lg"
      ? "w-24 h-24 rounded-full text-2xl font-bold"
      : "w-12 h-12 rounded-full text-sm font-semibold";

  if (!agent.photoUrl || err) {
    return (
      <div
        className={`${cls} bg-muted flex items-center justify-center text-muted-foreground`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={agent.photoUrl}
      alt={agent.name}
      className={`${cls} object-cover border border-border`}
      onError={() => setErr(true)}
    />
  );
}

function PropertyTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground text-sm">–</span>;
  const t = type.trim().toLowerCase();
  if (t.includes("commercial")) {
    return (
      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent text-xs">
        Commercial
      </Badge>
    );
  }
  if (t.includes("residential")) {
    return (
      <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-transparent text-xs">
        Residential
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      {type}
    </Badge>
  );
}

function AgentDetailPanel({
  agent,
  open,
  onClose,
}: {
  agent: RivirtualAgent | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {agent && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-4 pt-2">
                <AgentPhoto agent={agent} size="lg" />
                <div className="min-w-0">
                  <SheetTitle className="text-xl leading-tight">
                    {agent.name}
                  </SheetTitle>
                  {agent.city && (
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {agent.city}
                    </p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <Separator />

            <div className="py-5 space-y-5">
              {/* Contact */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contact
                </h3>
                {agent.phone ? (
                  <a
                    href={`tel:${agent.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
                  >
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {agent.phone}
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" /> No phone on record
                  </p>
                )}
                {agent.email ? (
                  <a
                    href={`mailto:${agent.email}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
                  >
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    {agent.email}
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" /> No email on record
                  </p>
                )}
              </section>

              <Separator />

              {/* Details */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Details
                </h3>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Property Type</p>
                    <PropertyTypeBadge type={agent.propertyType} />
                  </div>

                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">City</p>
                    <p className="font-medium">{agent.city || "–"}</p>
                  </div>

                  <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="font-medium">{agent.label || "–"}</p>
                  </div>

                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Scraped</p>
                    <p className="font-medium">
                      {format(parseISO(agent.scrapedAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </div>
              </section>

              {agent.slug && (
                <>
                  <Separator />
                  <section className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Identifier
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground break-all">
                      {agent.slug}
                    </p>
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function RivirtualAgents() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<RivirtualAgent | null>(null);
  const limit = 50;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [selectedJob]);

  const { data: jobsData } = useQuery({
    queryKey: ["rivirtual-jobs"],
    queryFn: () => apiFetch<{ jobs: RivirtualJob[] }>("/api/rivirtual/jobs"),
  });

  const jobs = jobsData?.jobs ?? [];

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (selectedJob !== "all") params.set("jobId", selectedJob);

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["rivirtual-agents", debouncedSearch, selectedJob, page],
    queryFn: () =>
      apiFetch<{
        agents: RivirtualAgent[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/api/rivirtual/agents?${params.toString()}`),
  });

  const agents = agentsData?.agents ?? [];
  const total = agentsData?.total ?? 0;
  const totalPages = agentsData?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">RiVirtual Agents</h1>
        <p className="text-muted-foreground mt-1">
          Realtors scraped from rivirtual.in with locally stored profile photos.
        </p>
      </div>

      <Card className="shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Realtor Registry</h2>
            {total > 0 && (
              <Badge variant="secondary" className="font-normal">
                {total} agents
              </Badge>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.label} ({j.agentsFound ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search name, city, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14 pl-4 text-xs uppercase tracking-wider text-muted-foreground">
                    Photo
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Contact
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    Property Type
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    City
                  </TableHead>
                  <TableHead className="pr-4 text-xs uppercase tracking-wider text-muted-foreground">
                    Source
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-4">
                        <Skeleton className="w-12 h-12 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Database className="w-10 h-10 text-muted/40" />
                        <p className="font-medium text-foreground">No agents found</p>
                        <p className="text-sm">
                          {debouncedSearch || selectedJob !== "all"
                            ? "Try different filters."
                            : "Add a scrape job to start fetching realtors."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow
                      key={agent.id}
                      className="align-middle cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedAgent(agent)}
                    >
                      <TableCell className="pl-4 py-3">
                        <AgentPhoto agent={agent} />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-semibold text-foreground">
                          {agent.name}
                        </div>
                        {agent.city && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {agent.city}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {agent.phone || agent.email ? (
                          <div className="flex flex-col gap-0.5">
                            {agent.phone && (
                              <span className="font-medium text-foreground">
                                {agent.phone}
                              </span>
                            )}
                            {agent.email && (
                              <span
                                className="text-xs text-primary truncate max-w-[180px]"
                                title={agent.email}
                              >
                                {agent.email}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <PropertyTypeBadge type={agent.propertyType} />
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {agent.city || "–"}
                      </TableCell>
                      <TableCell className="pr-4 py-3">
                        {agent.label ? (
                          <Badge
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {agent.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(page - 1) * limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(page * limit, total)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{total}</span> agents
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AgentDetailPanel
        agent={selectedAgent}
        open={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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

interface PropzAgent {
  id: number;
  jobId: number | null;
  label: string | null;
  name: string;
  reraId: string | null;
  designation: string | null;
  photoUrl: string | null;
  mobile: string | null;
  email: string | null;
  whatsapp: string | null;
  detailUrl: string | null;
  bio: string | null;
  scrapedAt: string;
}

interface PropzJob {
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

export default function PropzAgents() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [page, setPage] = useState(1);
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
    queryKey: ["propz-jobs"],
    queryFn: () => apiFetch<{ jobs: PropzJob[] }>("/api/propz/jobs"),
  });

  const jobs = jobsData?.jobs ?? [];

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (selectedJob !== "all") params.set("jobId", selectedJob);

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["propz-agents", debouncedSearch, selectedJob, page],
    queryFn: () =>
      apiFetch<{
        agents: PropzAgent[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/api/propz/agents?${params.toString()}`),
  });

  const agents = agentsData?.agents ?? [];
  const total = agentsData?.total ?? 0;
  const totalPages = agentsData?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Propertiezzzz Agents</h1>
        <p className="text-muted-foreground mt-1">
          RERA-registered agents scraped from propertiezzzz.com — with photos, contact details, and bio.
        </p>
      </div>

      <Card className="shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Agent Registry</h2>
            {total > 0 && (
              <Badge variant="secondary" className="font-normal">{total} agents</Badge>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="h-9 w-full sm:w-48">
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
                placeholder="Search name, RERA ID, mobile…"
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
                  <TableHead className="w-14 pl-4 text-xs uppercase tracking-wider text-muted-foreground">Photo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Name / RERA ID</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Designation</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Source</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Bio</TableHead>
                  <TableHead className="pr-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-4"><Skeleton className="w-12 h-12 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Database className="w-10 h-10 text-muted/40" />
                        <p className="font-medium text-foreground">No agents found</p>
                        <p className="text-sm">
                          {debouncedSearch || selectedJob !== "all"
                            ? "Try different filters."
                            : "Add a scrape URL to start fetching agents."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.id} className="align-top">
                      <TableCell className="pl-4 py-3">
                        {agent.photoUrl ? (
                          <img
                            src={agent.photoUrl}
                            alt={agent.name}
                            className="w-12 h-12 rounded-full object-cover border border-border"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = document.createElement("div");
                                fallback.className =
                                  "w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-semibold";
                                fallback.textContent = agent.name.charAt(0).toUpperCase();
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-semibold text-foreground leading-tight">{agent.name}</div>
                        {agent.reraId && (
                          <div className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            {agent.reraId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {agent.designation || "–"}
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {agent.mobile || agent.email ? (
                          <div className="flex flex-col gap-0.5">
                            {agent.mobile && (
                              <a
                                href={`tel:${agent.mobile.replace(/\s/g, "")}`}
                                className="font-medium text-foreground hover:text-primary"
                              >
                                {agent.mobile}
                              </a>
                            )}
                            {agent.email && (
                              <a
                                href={`mailto:${agent.email}`}
                                className="text-xs text-primary hover:underline truncate max-w-[180px]"
                                title={agent.email}
                              >
                                {agent.email}
                              </a>
                            )}
                            {agent.whatsapp && (
                              <a
                                href={`https://wa.me/${agent.whatsapp.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                              >
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {agent.label ? (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {agent.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground max-w-[240px]">
                        {agent.bio ? (
                          <p className="line-clamp-3" title={agent.bio}>{agent.bio}</p>
                        ) : (
                          "–"
                        )}
                      </TableCell>
                      <TableCell className="pr-4 py-3 text-right">
                        {agent.detailUrl && (
                          <a
                            href={agent.detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
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
              <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span>{" "}
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
    </div>
  );
}

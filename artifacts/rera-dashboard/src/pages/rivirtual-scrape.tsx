import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RivirtualJob {
  id: number;
  url: string;
  label: string;
  status: string;
  maxPages: number | null;
  totalPages: number | null;
  pagesScraped: number | null;
  agentsFound: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function StatusBadge({ job }: { job: RivirtualJob }) {
  if (job.status === "done") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent gap-1">
        <CheckCircle2 className="w-3 h-3" /> Done
      </Badge>
    );
  }
  if (job.status === "failed") {
    return (
      <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent gap-1">
        <XCircle className="w-3 h-3" /> Failed
      </Badge>
    );
  }
  if (job.status === "cancelled") {
    return (
      <Badge variant="secondary" className="gap-1 text-muted-foreground">
        <XCircle className="w-3 h-3" /> Cancelled
      </Badge>
    );
  }
  if (job.status === "running") {
    const pageText =
      job.totalPages && job.pagesScraped !== null
        ? ` (page ${job.pagesScraped}/${job.totalPages})`
        : "";
    return (
      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Running{pageText}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="w-3 h-3" /> Pending
    </Badge>
  );
}

export default function RivirtualScrape() {
  const [url, setUrl] = useState("https://rivirtual.in/find-realtors");
  const [label, setLabel] = useState("All India");
  const [maxPages, setMaxPages] = useState("");
  const [allPages, setAllPages] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hasActive = (jobs: RivirtualJob[]) =>
    jobs.some((j) => j.status === "running" || j.status === "pending");

  const { data, isLoading } = useQuery({
    queryKey: ["rivirtual-jobs"],
    queryFn: () => apiFetch<{ jobs: RivirtualJob[] }>("/api/rivirtual/jobs"),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      return hasActive(jobs) ? 2000 : false;
    },
  });

  const jobs = data?.jobs ?? [];

  const effectiveMaxPages = allPages ? 0 : parseInt(maxPages) || 50;

  const estAgents = allPages ? 3648 * 8 : effectiveMaxPages * 8;
  const estHours = allPages
    ? ((3648 * 8 * 1.2) / 3600).toFixed(0)
    : ((effectiveMaxPages * 8 * 1.2) / 3600).toFixed(1);

  const createJob = useMutation({
    mutationFn: () =>
      apiFetch<RivirtualJob>("/api/rivirtual/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          label: label.trim(),
          maxPages: allPages ? 0 : effectiveMaxPages,
        }),
      }),
    onSuccess: () => {
      toast({
        title: "Scrape job queued",
        description: allPages
          ? `Fetching all pages for ${label} (est. ~${estHours}h)`
          : `Fetching up to ${effectiveMaxPages} pages for ${label}`,
      });
      setLabel("");
      void queryClient.invalidateQueries({ queryKey: ["rivirtual-jobs"] });
    },
    onError: (err) => {
      toast({
        title: "Failed to create job",
        description: String(err),
        variant: "destructive",
      });
    },
  });

  const cancelJob = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/rivirtual/jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rivirtual-jobs"] });
    },
  });

  const deleteJob = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/rivirtual/jobs/${id}?withAgents=true`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rivirtual-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["rivirtual-agents"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !label.trim()) return;
    createJob.mutate();
  };

  const totalAgents = jobs.reduce((s, j) => s + (j.agentsFound ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">RiVirtual — Scrape</h1>
        <p className="text-muted-foreground mt-1">
          Queue realtor listing pages from rivirtual.in. Each page visits individual profiles and downloads photos locally.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-3xl font-bold">{jobs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agents Fetched</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-3xl font-bold">{totalAgents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-3xl font-bold text-blue-600">
              {jobs.filter((j) => j.status === "running" || j.status === "pending").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Scrape Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  placeholder="e.g. Mumbai, All India"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="url">Listing URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allPages"
                  checked={allPages}
                  onCheckedChange={(v) => setAllPages(v === true)}
                />
                <Label htmlFor="allPages" className="cursor-pointer font-normal">
                  Scrape all pages (site has 3,648 pages · ~29,000 agents)
                </Label>
              </div>
              {!allPages && (
                <div className="space-y-1.5 w-52">
                  <Label htmlFor="maxPages">Max pages</Label>
                  <Input
                    id="maxPages"
                    type="number"
                    min={1}
                    max={3648}
                    placeholder="e.g. 50"
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  ~8 agents/page · each agent's profile fetched individually ·{" "}
                  <span className="font-medium">
                    est. ~{estAgents.toLocaleString()} agents, ~{estHours}h
                  </span>
                </p>
                <Button
                  type="submit"
                  disabled={createJob.isPending || !url.trim() || !label.trim()}
                  className="gap-2 ml-auto"
                >
                  {createJob.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  Start Scrape
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-base">Job Queue</h2>
          {hasActive(jobs) && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Auto-refreshing
            </span>
          )}
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-xs uppercase tracking-wider text-muted-foreground">Label</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">URL</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Pages</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Agents</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Created</TableHead>
                <TableHead className="pr-5 text-right text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="w-10 h-10 text-muted/40" />
                      <p className="font-medium text-foreground">No jobs yet</p>
                      <p className="text-sm">Add a listing URL above to start scraping.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="pl-5 font-medium">{job.label}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                        title={job.url}
                      >
                        {job.url.replace(/^https?:\/\//, "")}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <StatusBadge job={job} />
                      {job.error && (
                        <p
                          className="text-xs text-destructive mt-1 max-w-[200px] truncate"
                          title={job.error}
                        >
                          {job.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.pagesScraped ?? 0}/{job.totalPages ?? job.maxPages ?? "?"}
                    </TableCell>
                    <TableCell className="font-medium">{job.agentsFound ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(job.createdAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {job.status === "running" || job.status === "pending" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Stop scraper"
                          className="text-amber-600 hover:text-amber-700 h-8 w-8 p-0"
                          onClick={() => cancelJob.mutate(job.id)}
                          disabled={cancelJob.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete job and its agents"
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          onClick={() => deleteJob.mutate(job.id)}
                          disabled={deleteJob.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

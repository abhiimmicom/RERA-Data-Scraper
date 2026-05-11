import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
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

interface PropzJob {
  id: number;
  url: string;
  label: string;
  status: string;
  totalPages: number | null;
  pagesScraped: number | null;
  agentsFound: number | null;
  fetchDetails: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function StatusBadge({ job }: { job: PropzJob }) {
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
  if (job.status === "running") {
    const pageText =
      job.totalPages && job.pagesScraped !== null
        ? ` (${job.pagesScraped}/${job.totalPages})`
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

export default function PropzScrape() {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [fetchDetails, setFetchDetails] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hasRunning = (jobs: PropzJob[]) =>
    jobs.some((j) => j.status === "running" || j.status === "pending");

  const { data, isLoading } = useQuery({
    queryKey: ["propz-jobs"],
    queryFn: () => apiFetch<{ jobs: PropzJob[] }>("/api/propz/jobs"),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      return hasRunning(jobs) ? 2000 : false;
    },
  });

  const jobs = data?.jobs ?? [];

  const createJob = useMutation({
    mutationFn: () =>
      apiFetch<PropzJob>("/api/propz/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), label: label.trim(), fetchDetails }),
      }),
    onSuccess: () => {
      toast({ title: "Scrape job queued", description: `Fetching agents from ${label}` });
      setUrl("");
      setLabel("");
      setFetchDetails(false);
      void queryClient.invalidateQueries({ queryKey: ["propz-jobs"] });
    },
    onError: (err) => {
      toast({ title: "Failed to create job", description: String(err), variant: "destructive" });
    },
  });

  const deleteJob = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/propz/jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["propz-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["propz-agents"] });
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
        <h1 className="text-3xl font-bold tracking-tight">Scrape URLs</h1>
        <p className="text-muted-foreground mt-1">
          Queue listing pages from propertiezzzz.com to fetch RERA-registered agent data.
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
            <Plus className="w-4 h-4" /> Add Scrape URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="label">State / Label</Label>
                <Input
                  id="label"
                  placeholder="e.g. Uttar Pradesh"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="url">Listing URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://propertiezzzz.com/agents-2/rera-registered-real-estate-agents-in-uttar-pradesh/"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fetchDetails"
                  checked={fetchDetails}
                  onCheckedChange={(v) => setFetchDetails(v === true)}
                />
                <Label htmlFor="fetchDetails" className="text-sm font-normal cursor-pointer">
                  Also fetch agent detail pages (bio text) — slower
                </Label>
              </div>
              <Button
                type="submit"
                disabled={createJob.isPending || !url.trim() || !label.trim()}
                className="gap-2"
              >
                {createJob.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                Start Scrape
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-base">Job Queue</h2>
          {hasRunning(jobs) && (
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
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Agents</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Details</TableHead>
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
                      <Globe className="w-10 h-10 text-muted/40" />
                      <p className="font-medium text-foreground">No jobs yet</p>
                      <p className="text-sm">Add a listing URL above to start scraping.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="pl-5 font-medium">{job.label}</TableCell>
                    <TableCell className="max-w-[240px]">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                        title={job.url}
                      >
                        {job.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <StatusBadge job={job} />
                      {job.error && (
                        <p className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={job.error}>
                          {job.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{job.agentsFound ?? 0}</TableCell>
                    <TableCell>
                      {job.fetchDetails ? (
                        <Badge variant="secondary" className="text-xs">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(job.createdAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        onClick={() => deleteJob.mutate(job.id)}
                        disabled={job.status === "running" || deleteJob.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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

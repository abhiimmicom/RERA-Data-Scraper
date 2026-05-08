import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  useListAgents, 
  useGetAgentStats, 
  useTriggerScrape, 
  useGetScraperStatus,
  getListAgentsQueryKey,
  getGetAgentStatsQueryKey,
  getGetScraperStatusQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Building2, 
  Search, 
  Users, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Database,
  ArrowUpRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Home() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [agentType, setAgentType] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetAgentStats();
  const { data: scraperStatus } = useGetScraperStatus({
    query: {
      refetchInterval: 5000,
    }
  });

  const { data: agentsData, isLoading: agentsLoading } = useListAgents({
    search: debouncedSearch || undefined,
    agentType: agentType && agentType !== "all" ? agentType : undefined,
    page,
    limit,
  });

  const triggerScrape = useTriggerScrape();

  const handleScrape = () => {
    triggerScrape.mutate(
      { params: { maxPages: 2 } },
      {
        onSuccess: (data) => {
          toast({
            title: data.success ? "Scrape Initiated" : "Scrape Failed",
            description: data.message,
            variant: data.success ? "default" : "destructive",
          });
          queryClient.invalidateQueries({ queryKey: getGetScraperStatusQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: "Failed to start scraper",
            variant: "destructive",
          });
        }
      }
    );
  };

  const isScraping = scraperStatus?.isRunning || triggerScrape.isPending;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Agents Registry</h1>
          <p className="text-muted-foreground mt-1">
            Browse and verify RERA-registered real estate agents in Delhi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground text-right mr-2">
            <div>Last updated</div>
            <div className="font-medium text-foreground">
              {stats?.lastScrapedAt ? format(parseISO(stats.lastScrapedAt), "MMM d, yyyy HH:mm") : "Never"}
            </div>
          </div>
          <Button 
            onClick={handleScrape} 
            disabled={isScraping}
            className="gap-2 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isScraping ? 'animate-spin' : ''}`} />
            {isScraping ? "Syncing..." : "Sync Database"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-muted">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Total Registered</p>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="text-3xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-20" /> : stats?.total?.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Active Individuals</p>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-20" /> : stats?.individuals?.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Active Companies</p>
              <Building2 className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-20" /> : stats?.companies?.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Active Status</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-500">
              {statsLoading ? <Skeleton className="h-8 w-20" /> : stats?.active?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.expired ? `${stats.expired.toLocaleString()} expired` : "0 expired"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <CardTitle className="text-lg font-semibold">Registry Database</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agent name or reg no..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    // simple debounce implementation for the visual, real debounce usually requires a hook
                    setTimeout(() => setDebouncedSearch(e.target.value), 500);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setDebouncedSearch(search);
                      setPage(1);
                    }
                  }}
                />
              </div>
              <div className="w-full sm:w-48">
                <Select
                  value={agentType}
                  onValueChange={(val) => {
                    setAgentType(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Company - Other Than Individual">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20 pl-6 text-xs uppercase tracking-wider text-muted-foreground">S.No</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Agent Name</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Type</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Reg No.</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Valid Until</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="w-20 pr-6 text-right text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                      <TableCell className="pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : agentsData?.agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Database className="h-12 w-12 mb-4 text-muted/50" />
                        <p className="text-lg font-medium text-foreground">No agents found</p>
                        <p className="text-sm mb-4">Try adjusting your filters or sync the database.</p>
                        <Button variant="outline" onClick={handleScrape} disabled={isScraping}>
                          Sync Database
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  agentsData?.agents.map((agent) => {
                    // Check if expired based on validUntil
                    const isExpired = agent.validUntil && (() => {
                      try {
                        // Date is usually DD/MM/YYYY, need to parse carefully or just check if it's in the past
                        // Simple check for now, ideally would parse correctly
                        const parts = agent.validUntil.split('/');
                        if (parts.length === 3) {
                          const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                          return date < new Date();
                        }
                        return false;
                      } catch (e) {
                        return false;
                      }
                    })();

                    return (
                      <TableRow key={agent.id} className="group">
                        <TableCell className="pl-6 font-medium text-muted-foreground">{agent.serialNumber || "-"}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground line-clamp-1">{agent.name}</div>
                          {agent.personName && agent.agentType.includes('Company') && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{agent.personName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-secondary/50 hover:bg-secondary/50 font-normal">
                            {agent.agentType.includes('Individual') && !agent.agentType.includes('Other') ? 'Individual' : 'Company'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{agent.registrationNo || "-"}</TableCell>
                        <TableCell className="text-sm">{agent.validUntil || "-"}</TableCell>
                        <TableCell>
                          {isExpired ? (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20 font-medium">
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent hover:bg-emerald-500/20 font-medium">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Link href={`/agents/${agent.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-primary hover:text-primary">
                              <span>View</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {agentsData && agentsData.totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * limit, agentsData.total)}</span> of <span className="font-medium text-foreground">{agentsData.total}</span> agents
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || agentsLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous Page</span>
              </Button>
              <div className="text-sm font-medium px-2">
                Page {page} of {agentsData.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(agentsData.totalPages, p + 1))}
                disabled={page === agentsData.totalPages || agentsLoading}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next Page</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

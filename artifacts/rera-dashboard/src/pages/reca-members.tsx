import { useState, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import {
  useListRecaMembers,
  useTriggerRecaScrape,
  useGetRecaScrapeStatus,
  getListRecaMembersQueryKey,
  getGetRecaScrapeStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  MapPin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecaMembers() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: membersData, isLoading: membersLoading } = useListRecaMembers({
    search: debouncedSearch || undefined,
    page,
    limit,
  });

  const { data: statusData } = useGetRecaScrapeStatus({
    query: { refetchInterval: 3000 },
  });

  const { mutate: triggerScrape, isPending: isScraping } = useTriggerRecaScrape({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: data.success ? "Sync complete" : "Sync failed",
          description: data.message,
          variant: data.success ? "default" : "destructive",
        });
        void queryClient.invalidateQueries({ queryKey: getListRecaMembersQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetRecaScrapeStatusQueryKey() });
      },
      onError: () => {
        toast({ title: "Sync failed", variant: "destructive" });
      },
    },
  });

  const handleScrape = () => triggerScrape({});

  const totalMembers = statusData?.totalMembers ?? membersData?.total ?? 0;
  const lastScrapedAt = statusData?.lastRunAt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RECA Kolkata Members</h1>
          <p className="text-muted-foreground mt-1">
            Realtors &amp; Estate Consultants Association of Kolkata — Individual members.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {lastScrapedAt && (
            <p className="text-sm text-muted-foreground text-right">
              Last synced{" "}
              <span className="font-medium text-foreground">
                {format(parseISO(lastScrapedAt), "MMM d, yyyy HH:mm")}
              </span>
            </p>
          )}
          <Button onClick={handleScrape} disabled={isScraping} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isScraping ? "animate-spin" : ""}`} />
            {isScraping ? "Syncing…" : "Sync Members"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="w-4 h-4" /> Total Members
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-3xl font-bold">{totalMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Source
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-sm font-medium">recakol.com</p>
            <p className="text-xs text-muted-foreground">individual.php</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h2 className="font-semibold text-base">Member Registry</h2>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Search name, company, mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14 pl-4 text-xs uppercase tracking-wider text-muted-foreground">Photo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Name / Age</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Company</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Membership ID</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">RERA / HIRA / GST</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">City</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Core Competence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-4"><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : membersData?.members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Database className="h-12 w-12 mb-4 text-muted/50" />
                        <p className="text-lg font-medium text-foreground">No members found</p>
                        <p className="text-sm mb-4">
                          {debouncedSearch ? "Try a different search." : "Sync the database to fetch members."}
                        </p>
                        {!debouncedSearch && (
                          <Button variant="outline" onClick={handleScrape} disabled={isScraping}>
                            Sync Members
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  membersData?.members.map((member) => {
                    const competencies = [
                      member.coreCompetence1,
                      member.coreCompetence2,
                      member.coreCompetence3,
                      member.coreCompetence4,
                    ].filter(Boolean);

                    const regNumbers = [
                      member.reraNo ? `RERA: ${member.reraNo}` : null,
                      member.hiraNo ? `HIRA: ${member.hiraNo}` : null,
                      member.gstNo ? `GST: ${member.gstNo}` : null,
                    ].filter(Boolean);

                    return (
                      <TableRow key={member.id} className="group align-top">
                        <TableCell className="pl-4 py-3">
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.name}
                              className="w-10 h-10 rounded-full object-cover border border-border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-semibold">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="font-semibold text-foreground leading-tight">{member.name}</div>
                          {member.age && (
                            <div className="text-xs text-muted-foreground mt-0.5">Age {member.age}</div>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground max-w-[180px]">
                          {member.companyName || <span className="text-muted-foreground">–</span>}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                            {member.membershipId || "–"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {member.mobileNo || member.altMobileNo || member.landline || member.email ? (
                            <div className="flex flex-col gap-0.5">
                              {member.mobileNo && (
                                <span className="font-medium text-foreground">{member.mobileNo}</span>
                              )}
                              {member.altMobileNo && (
                                <span className="text-xs text-muted-foreground">{member.altMobileNo}</span>
                              )}
                              {member.landline && (
                                <span className="text-xs text-muted-foreground">{member.landline}</span>
                              )}
                              {member.email && (
                                <a
                                  href={`mailto:${member.email}`}
                                  className="text-xs text-primary hover:underline truncate max-w-[160px]"
                                  title={member.email}
                                >
                                  {member.email}
                                </a>
                              )}
                              {member.website && (
                                <a
                                  href={member.website.startsWith("http") ? member.website : `https://${member.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline truncate max-w-[160px]"
                                  title={member.website}
                                >
                                  {member.website}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          {regNumbers.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {regNumbers.map((r, i) => (
                                <span key={i} className="text-muted-foreground">{r}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground">
                          {member.city || <span className="text-muted-foreground">–</span>}
                        </TableCell>
                        <TableCell className="py-3">
                          {competencies.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {competencies.map((c, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {membersData && membersData.totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-medium text-foreground">
                {Math.min(page * limit, membersData.total)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{membersData.total}</span> members
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || membersLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous</span>
              </Button>
              <div className="text-sm font-medium px-2">
                Page {page} of {membersData.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(membersData.totalPages, p + 1))}
                disabled={page === membersData.totalPages || membersLoading}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

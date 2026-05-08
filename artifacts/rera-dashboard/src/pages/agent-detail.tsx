import { useRoute, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { useGetAgent, getGetAgentQueryKey } from "@workspace/api-client-react";
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  Hash, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  FileText, 
  Clock,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function AgentDetail() {
  const [, params] = useRoute("/agents/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: agent, isLoading, isError } = useGetAgent(id, {
    query: {
      enabled: !!id,
      queryKey: getGetAgentQueryKey(id),
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !agent) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <Link href="/">
          <Button variant="ghost" className="w-fit pl-0 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Registry
          </Button>
        </Link>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold text-foreground">Agent Not Found</h2>
            <p className="text-muted-foreground mt-2">The agent record you're looking for does not exist or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompany = agent.agentType.includes('Company') || agent.agentType.includes('Other Than Individual');
  
  const isExpired = agent.validUntil && (() => {
    try {
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
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <Link href="/">
        <Button variant="ghost" className="w-fit pl-0 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Registry
        </Button>
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono bg-background">
            S.No: {agent.serialNumber || "-"}
          </Badge>
          {isExpired ? (
            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent font-medium gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Registration Expired
            </Badge>
          ) : (
            <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent font-medium gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Active Registration
            </Badge>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mt-2">
          {agent.name}
        </h1>
        {agent.agentType && (
          <p className="text-lg text-muted-foreground flex items-center gap-2">
            {isCompany ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
            {agent.agentType}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {/* Main Details */}
        <Card className="md:col-span-2 shadow-sm border-muted overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-muted pb-4">
            <CardTitle className="text-lg">Registration Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <dl className="divide-y divide-muted">
              <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Registration No.
                </dt>
                <dd className="text-sm sm:col-span-2 font-mono font-semibold text-foreground">
                  {agent.registrationNo || "-"}
                </dd>
              </div>
              <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Valid Until
                </dt>
                <dd className={`text-sm sm:col-span-2 font-medium ${isExpired ? 'text-destructive' : 'text-foreground'}`}>
                  {agent.validUntil || "-"}
                </dd>
              </div>
              
              {isCompany && agent.personName && (
                <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" /> Contact Person
                  </dt>
                  <dd className="text-sm sm:col-span-2 text-foreground">
                    <span className="font-medium">{agent.personName}</span>
                    {agent.designation && <span className="text-muted-foreground ml-2">({agent.designation})</span>}
                  </dd>
                </div>
              )}
              
              <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Registered Address
                </dt>
                <dd className="text-sm sm:col-span-2 text-foreground leading-relaxed">
                  {agent.registeredAddress || "-"}
                </dd>
              </div>

              {agent.certificateUrl && (
                <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 bg-muted/5">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Certificate
                  </dt>
                  <dd className="text-sm sm:col-span-2">
                    <a 
                      href={agent.certificateUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                    >
                      View Registration Certificate
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Contact & Meta */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-muted">
            <CardHeader className="bg-muted/10 border-b border-muted pb-4">
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Phone Number</p>
                  <p className="text-sm font-medium text-foreground">{agent.phoneNumber || "Not provided"}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Email Address</p>
                  {agent.emailId ? (
                    <a href={`mailto:${agent.emailId}`} className="text-sm font-medium text-primary hover:underline break-all">
                      {agent.emailId}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-foreground">Not provided</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted bg-slate-50 dark:bg-slate-900/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">System Record</p>
                  <p className="text-xs text-foreground mb-2">
                    Last synced: <span className="font-medium">{format(parseISO(agent.scrapedAt), "MMM d, yyyy HH:mm")}</span>
                  </p>
                  {agent.renewalCount !== null && agent.renewalCount > 0 && (
                    <Badge variant="outline" className="bg-background">
                      Renewed {agent.renewalCount} time(s)
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

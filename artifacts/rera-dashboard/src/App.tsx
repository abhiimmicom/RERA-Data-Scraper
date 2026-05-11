import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";
import Home from "@/pages/home";
import AgentDetail from "@/pages/agent-detail";
import RecaMembers from "@/pages/reca-members";
import PropzScrape from "@/pages/propz-scrape";
import PropzAgents from "@/pages/propz-agents";
import RivirtualScrape from "@/pages/rivirtual-scrape";
import RivirtualAgents from "@/pages/rivirtual-agents";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/agents/:id" component={AgentDetail} />
        <Route path="/reca-members" component={RecaMembers} />
        <Route path="/propz/scrape" component={PropzScrape} />
        <Route path="/propz/agents" component={PropzAgents} />
        <Route path="/rivirtual/scrape" component={RivirtualScrape} />
        <Route path="/rivirtual/agents" component={RivirtualAgents} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

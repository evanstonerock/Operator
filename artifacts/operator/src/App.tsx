import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import EndOfDayReview from "@/pages/EndOfDayReview";
import PreDayPlan from "@/pages/PreDayPlan";
import PreWeekPlan from "@/pages/PreWeekPlan";
import History from "@/pages/History";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={EndOfDayReview} />
        <Route path="/pre-day" component={PreDayPlan} />
        <Route path="/pre-week" component={PreWeekPlan} />
        <Route path="/history" component={History} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

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

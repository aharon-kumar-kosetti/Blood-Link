import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import HospitalDashboard from "@/pages/HospitalDashboard";
import CompleteProfile from "@/pages/CompleteProfile";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  const needsProfileCompletion = !user?.bloodGroup || !user?.name || !user?.location;

  if (needsProfileCompletion && user?.role !== "hospital") {
    return (
      <Switch>
        <Route path="/" component={CompleteProfile} />
        <Route path="/complete-profile" component={CompleteProfile} />
        <Route component={CompleteProfile} />
      </Switch>
    );
  }

  if (user?.role === "hospital") {
    return (
      <Switch>
        <Route path="/" component={HospitalDashboard} />
        <Route path="/hospital" component={HospitalDashboard} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/hospital" component={HospitalDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

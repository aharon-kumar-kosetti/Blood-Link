import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DonorCard } from "@/components/DonorCard";
import { RequestCard } from "@/components/RequestCard";
import { BloodGroupBadge } from "@/components/BloodGroupBadge";
import { AvailabilityBadge } from "@/components/StatusBadge";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";
import { StatsCard } from "@/components/StatsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Droplets, 
  LogOut, 
  Search, 
  Plus, 
  Inbox, 
  Send,
  History,
  MapPin,
  Phone,
  Calendar,
  Heart,
  Users,
  AlertCircle
} from "lucide-react";
import type { User, BloodRequest, BloodGroup } from "@shared/schema";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function ProfileCard({ user, onToggleAvailability, isUpdating }: {
  user: User;
  onToggleAvailability: (available: boolean) => void;
  isUpdating: boolean;
}) {
  const displayName = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <Avatar className="h-20 w-20 border-2 border-primary/20">
            <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" data-testid="text-user-name">
                  {displayName}
                </h2>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {user.bloodGroup && (
                    <BloodGroupBadge bloodGroup={user.bloodGroup} size="md" />
                  )}
                  <AvailabilityBadge available={user.availabilityStatus || false} />
                </div>
              </div>

              {user.canDonate && (
                <AvailabilityToggle
                  available={user.availabilityStatus || false}
                  onToggle={onToggleAvailability}
                  disabled={isUpdating}
                  size="lg"
                />
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              {user.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user.location}</span>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Droplets className="h-4 w-4 shrink-0" />
                <span>{user.donationCount || 0} donations</span>
              </div>
              {user.lastDonationDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Last: {new Date(user.lastDonationDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DonorSearch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);

  const { data: donors, isLoading } = useQuery<User[]>({
    queryKey: ["/api/donors", bloodGroupFilter, locationFilter, showOnlyAvailable],
  });

  const createRequestMutation = useMutation({
    mutationFn: async (donorId: string) => {
      const donor = donors?.find(d => d.id === donorId);
      if (!donor || !user) return;
      
      await apiRequest("POST", "/api/requests", {
        bloodGroup: donor.bloodGroup,
        location: user.location || donor.location || "",
        priority: "normal",
        unitsNeeded: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Request Created",
        description: "Your blood request has been submitted.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create request.", variant: "destructive" });
    },
  });

  const filteredDonors = donors?.filter((donor) => {
    if (donor.id === user?.id) return false;
    if (bloodGroupFilter !== "all" && donor.bloodGroup !== bloodGroupFilter) return false;
    if (locationFilter && !donor.location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (showOnlyAvailable && !donor.availabilityStatus) return false;
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Donors
          </CardTitle>
          <CardDescription>Find available blood donors in your area</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="blood-group-filter">Blood Group</Label>
              <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
                <SelectTrigger id="blood-group-filter" data-testid="select-blood-group-filter">
                  <SelectValue placeholder="All blood groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Blood Groups</SelectItem>
                  {BLOOD_GROUPS.map((group) => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Input
                id="location-filter"
                placeholder="Search by location..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                data-testid="input-location-filter"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant={showOnlyAvailable ? "default" : "outline"}
                onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                className="w-full"
                data-testid="button-toggle-available"
              >
                {showOnlyAvailable ? "Showing Available Only" : "Show All"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDonors.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No donors found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search filters or check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDonors.map((donor) => (
            <DonorCard
              key={donor.id}
              donor={donor}
              onRequestBlood={(donorId) => createRequestMutation.mutate(donorId)}
              showActions={user?.id !== donor.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MyRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    bloodGroup: "" as BloodGroup | "",
    location: "",
    priority: "normal" as "normal" | "emergency",
    unitsNeeded: 1,
    notes: "",
  });

  const { data: myRequests, isLoading: loadingMyRequests } = useQuery<BloodRequest[]>({
    queryKey: ["/api/requests/my"],
  });

  const { data: incomingRequests, isLoading: loadingIncoming } = useQuery<BloodRequest[]>({
    queryKey: ["/api/requests/incoming"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/requests", newRequest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setIsCreateDialogOpen(false);
      setNewRequest({ bloodGroup: "", location: "", priority: "normal", unitsNeeded: 1, notes: "" });
      toast({ title: "Success", description: "Blood request created successfully." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create request.", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PATCH", `/api/requests/${requestId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "Accepted", description: "You have accepted the blood request." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to accept request.", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PATCH", `/api/requests/${requestId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "Cancelled", description: "Request has been cancelled." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to cancel request.", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PATCH", `/api/requests/${requestId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Completed", description: "Donation marked as completed. Thank you!" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to complete request.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Blood Requests</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-request">
              <Plus className="h-4 w-4 mr-2" />
              Create Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Blood Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="request-blood-group">Blood Group Required *</Label>
                <Select
                  value={newRequest.bloodGroup}
                  onValueChange={(value) => setNewRequest({ ...newRequest, bloodGroup: value as BloodGroup })}
                >
                  <SelectTrigger id="request-blood-group" data-testid="select-request-blood-group">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-location">Location *</Label>
                <Input
                  id="request-location"
                  placeholder="Hospital or city name"
                  value={newRequest.location}
                  onChange={(e) => setNewRequest({ ...newRequest, location: e.target.value })}
                  data-testid="input-request-location"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="request-priority">Priority</Label>
                  <Select
                    value={newRequest.priority}
                    onValueChange={(value) => setNewRequest({ ...newRequest, priority: value as "normal" | "emergency" })}
                  >
                    <SelectTrigger id="request-priority" data-testid="select-request-priority">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-units">Units Needed</Label>
                  <Input
                    id="request-units"
                    type="number"
                    min={1}
                    max={10}
                    value={newRequest.unitsNeeded}
                    onChange={(e) => setNewRequest({ ...newRequest, unitsNeeded: parseInt(e.target.value) || 1 })}
                    data-testid="input-request-units"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-notes">Additional Notes</Label>
                <Textarea
                  id="request-notes"
                  placeholder="Any additional information..."
                  value={newRequest.notes}
                  onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
                  data-testid="textarea-request-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newRequest.bloodGroup || !newRequest.location || createMutation.isPending}
                data-testid="button-submit-request"
              >
                {createMutation.isPending ? "Creating..." : "Create Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="outgoing" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="outgoing" className="gap-2" data-testid="tab-outgoing">
            <Send className="h-4 w-4" />
            My Requests
          </TabsTrigger>
          <TabsTrigger value="incoming" className="gap-2" data-testid="tab-incoming">
            <Inbox className="h-4 w-4" />
            Incoming
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outgoing" className="mt-6">
          {loadingMyRequests ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-24 mb-3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !myRequests?.length ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No requests yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a blood request to find available donors.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-request">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Request
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {myRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  currentUserId={user?.id}
                  variant="outgoing"
                  onCancel={(id) => cancelMutation.mutate(id)}
                  onComplete={(id) => completeMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="incoming" className="mt-6">
          {loadingIncoming ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-24 mb-3" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !incomingRequests?.length ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No incoming requests</h3>
                <p className="text-muted-foreground">
                  {user?.availabilityStatus 
                    ? "You'll see blood requests matching your profile here."
                    : "Turn on your availability to receive blood requests."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {incomingRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  currentUserId={user?.id}
                  variant="incoming"
                  onAccept={(id) => acceptMutation.mutate(id)}
                  onReject={(id) => cancelMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DonationHistory() {
  const { user } = useAuth();

  const { data: completedDonations, isLoading } = useQuery<BloodRequest[]>({
    queryKey: ["/api/requests/completed"],
  });

  const donationCount = user?.donationCount || 0;
  const lastDonation = user?.lastDonationDate 
    ? new Date(user.lastDonationDate).toLocaleDateString() 
    : "No donations yet";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Donations"
          value={donationCount}
          icon={Droplets}
          description="Your lifetime contribution"
        />
        <StatsCard
          title="Last Donation"
          value={lastDonation}
          icon={Calendar}
          description="Keep up the great work!"
        />
        <StatsCard
          title="Lives Impacted"
          value={donationCount * 3}
          icon={Heart}
          description="Each donation saves up to 3 lives"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Donation History
          </CardTitle>
          <CardDescription>Your completed blood donations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : !completedDonations?.length ? (
            <div className="text-center py-12">
              <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No donations recorded</h3>
              <p className="text-muted-foreground">
                Your completed donations will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedDonations.map((donation) => (
                <div
                  key={donation.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                >
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Droplets className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BloodGroupBadge bloodGroup={donation.bloodGroup} size="sm" />
                      <span className="text-sm text-muted-foreground">
                        {donation.location}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {donation.createdAt && new Date(donation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "Please log in to continue.",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [user, isLoading, toast]);

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (availabilityStatus: boolean) => {
      await apiRequest("PATCH", "/api/users/me", { availabilityStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update availability.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Droplets className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (user.role === "hospital") {
    window.location.href = "/hospital";
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Droplets className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">BloodLink</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" asChild data-testid="button-logout">
                <a href="/api/logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <ProfileCard
          user={user}
          onToggleAvailability={(available) => updateAvailabilityMutation.mutate(available)}
          isUpdating={updateAvailabilityMutation.isPending}
        />

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
            <TabsTrigger value="search" className="gap-2" data-testid="tab-search">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Find Donors</span>
              <span className="sm:hidden">Search</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2" data-testid="tab-requests">
              <Inbox className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            <DonorSearch />
          </TabsContent>

          <TabsContent value="requests">
            <MyRequests />
          </TabsContent>

          <TabsContent value="history">
            <DonationHistory />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

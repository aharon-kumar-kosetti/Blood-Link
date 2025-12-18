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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BloodGroupBadge } from "@/components/BloodGroupBadge";
import { AvailabilityBadge, StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { BloodInventoryCard } from "@/components/BloodInventoryCard";
import { StatsCard } from "@/components/StatsCard";
import { RequestCard } from "@/components/RequestCard";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from "@/components/ui/sidebar";
import { 
  Droplets, 
  LogOut, 
  Users, 
  Warehouse,
  AlertTriangle,
  Plus,
  Search,
  UserPlus,
  Activity,
  ClipboardList,
  Heart,
  TrendingUp
} from "lucide-react";
import type { User, BloodRequest, HospitalBloodStock, BloodGroup } from "@shared/schema";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function HospitalHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <Droplets className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold hidden sm:inline">Hospital Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild data-testid="button-hospital-logout">
            <a href="/api/logout">
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function DashboardOverview() {
  const { data: stats } = useQuery<{
    totalDonors: number;
    availableDonors: number;
    pendingRequests: number;
    completedDonations: number;
  }>({
    queryKey: ["/api/hospital/stats"],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Donors"
          value={stats?.totalDonors || 0}
          icon={Users}
          description="Registered in system"
        />
        <StatsCard
          title="Available Now"
          value={stats?.availableDonors || 0}
          icon={Activity}
          description="Ready to donate"
        />
        <StatsCard
          title="Pending Requests"
          value={stats?.pendingRequests || 0}
          icon={ClipboardList}
          description="Awaiting donors"
        />
        <StatsCard
          title="Completed Donations"
          value={stats?.completedDonations || 0}
          icon={Heart}
          description="This month"
        />
      </div>
    </div>
  );
}

function UserManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    age: 18,
    bloodGroup: "" as BloodGroup | "",
    phone: "",
    location: "",
    canDonate: true,
    email: "",
  });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/hospital/users"],
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/hospital/users", newUser);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/stats"] });
      setIsCreateDialogOpen(false);
      setNewUser({ name: "", age: 18, bloodGroup: "", phone: "", location: "", canDonate: true, email: "" });
      toast({ title: "Success", description: "User created successfully." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create user.", variant: "destructive" });
    },
  });

  const filteredUsers = users?.filter((user) => {
    if (user.role === "hospital") return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = (user.name || `${user.firstName} ${user.lastName}`).toLowerCase();
      if (!name.includes(query) && !user.location?.toLowerCase().includes(query)) return false;
    }
    if (bloodGroupFilter !== "all" && user.bloodGroup !== bloodGroupFilter) return false;
    if (availabilityFilter === "available" && !user.availabilityStatus) return false;
    if (availabilityFilter === "unavailable" && user.availabilityStatus) return false;
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Full Name *</Label>
                <Input
                  id="user-name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="John Doe"
                  data-testid="input-new-user-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-age">Age *</Label>
                  <Input
                    id="user-age"
                    type="number"
                    min={18}
                    max={65}
                    value={newUser.age}
                    onChange={(e) => setNewUser({ ...newUser, age: parseInt(e.target.value) || 18 })}
                    data-testid="input-new-user-age"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-blood-group">Blood Group *</Label>
                  <Select
                    value={newUser.bloodGroup}
                    onValueChange={(value) => setNewUser({ ...newUser, bloodGroup: value as BloodGroup })}
                  >
                    <SelectTrigger id="user-blood-group" data-testid="select-new-user-blood-group">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-phone">Phone Number</Label>
                <Input
                  id="user-phone"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  data-testid="input-new-user-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-location">Location *</Label>
                <Input
                  id="user-location"
                  value={newUser.location}
                  onChange={(e) => setNewUser({ ...newUser, location: e.target.value })}
                  placeholder="City, State"
                  data-testid="input-new-user-location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email">Email (Optional)</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="john@example.com"
                  data-testid="input-new-user-email"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createUserMutation.mutate()}
                disabled={!newUser.name || !newUser.bloodGroup || !newUser.location || createUserMutation.isPending}
                data-testid="button-submit-new-user"
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-user-search"
              />
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
                <SelectTrigger data-testid="select-user-blood-filter">
                  <SelectValue placeholder="All" />
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
              <Label>Availability</Label>
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger data-testid="select-user-availability-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="available">Available Only</SelectItem>
                  <SelectItem value="unavailable">Unavailable Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search filters or add a new user.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Donations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">
                        {user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {user.bloodGroup && <BloodGroupBadge bloodGroup={user.bloodGroup} size="sm" />}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.location || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.phone || "-"}
                      </TableCell>
                      <TableCell>
                        <AvailabilityBadge available={user.availabilityStatus || false} />
                      </TableCell>
                      <TableCell className="text-center">
                        {user.donationCount || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BloodInventory() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: inventory, isLoading } = useQuery<HospitalBloodStock[]>({
    queryKey: ["/api/hospital/inventory"],
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async ({ bloodGroup, delta }: { bloodGroup: BloodGroup; delta: number }) => {
      await apiRequest("PATCH", "/api/hospital/inventory", { bloodGroup, delta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/inventory"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to update inventory.", variant: "destructive" });
    },
  });

  const getUnitsForBloodGroup = (bloodGroup: BloodGroup): number => {
    const stock = inventory?.find((item) => item.bloodGroup === bloodGroup);
    return stock?.unitsAvailable || 0;
  };

  const lowStockCount = BLOOD_GROUPS.filter((bg) => getUnitsForBloodGroup(bg) < 5).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Blood Inventory</h1>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{lowStockCount} blood type(s) low on stock</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {BLOOD_GROUPS.map((bg) => (
            <Card key={bg}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-3" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {BLOOD_GROUPS.map((bloodGroup) => (
            <BloodInventoryCard
              key={bloodGroup}
              bloodGroup={bloodGroup}
              units={getUnitsForBloodGroup(bloodGroup)}
              onAdd={() => updateInventoryMutation.mutate({ bloodGroup, delta: 1 })}
              onRemove={() => updateInventoryMutation.mutate({ bloodGroup, delta: -1 })}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Inventory Summary
          </CardTitle>
          <CardDescription>Current stock levels across all blood types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {inventory?.reduce((sum, item) => sum + (item.unitsAvailable || 0), 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Total Units</p>
            </div>
            <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {BLOOD_GROUPS.filter((bg) => getUnitsForBloodGroup(bg) >= 10).length}
              </p>
              <p className="text-sm text-muted-foreground">Well Stocked</p>
            </div>
            <div className="text-center p-4 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {BLOOD_GROUPS.filter((bg) => {
                  const units = getUnitsForBloodGroup(bg);
                  return units > 0 && units < 5;
                }).length}
              </p>
              <p className="text-sm text-muted-foreground">Low Stock</p>
            </div>
            <div className="text-center p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {BLOOD_GROUPS.filter((bg) => getUnitsForBloodGroup(bg) === 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RequestManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    bloodGroup: "" as BloodGroup | "",
    location: "",
    priority: "emergency" as "normal" | "emergency",
    unitsNeeded: 1,
    notes: "",
  });

  const { data: allRequests, isLoading } = useQuery<BloodRequest[]>({
    queryKey: ["/api/hospital/requests"],
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/requests", newRequest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/requests"] });
      setIsCreateDialogOpen(false);
      setNewRequest({ bloodGroup: "", location: "", priority: "emergency", unitsNeeded: 1, notes: "" });
      toast({ title: "Emergency Request Created", description: "Matching donors will be notified." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to create request.", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PATCH", `/api/requests/${requestId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/stats"] });
      toast({ title: "Completed", description: "Donation marked as completed." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to complete request.", variant: "destructive" });
    },
  });

  const pendingRequests = allRequests?.filter((r) => r.status === "pending" || r.status === "accepted") || [];
  const emergencyRequests = pendingRequests.filter((r) => r.priority === "emergency");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Request Management</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" data-testid="button-emergency-request">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Emergency Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Create Emergency Blood Request
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="emergency-blood-group">Blood Group Required *</Label>
                <Select
                  value={newRequest.bloodGroup}
                  onValueChange={(value) => setNewRequest({ ...newRequest, bloodGroup: value as BloodGroup })}
                >
                  <SelectTrigger id="emergency-blood-group" data-testid="select-emergency-blood-group">
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
                <Label htmlFor="emergency-location">Hospital/Location *</Label>
                <Input
                  id="emergency-location"
                  value={newRequest.location}
                  onChange={(e) => setNewRequest({ ...newRequest, location: e.target.value })}
                  placeholder="Hospital name and address"
                  data-testid="input-emergency-location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergency-units">Units Needed *</Label>
                <Input
                  id="emergency-units"
                  type="number"
                  min={1}
                  max={20}
                  value={newRequest.unitsNeeded}
                  onChange={(e) => setNewRequest({ ...newRequest, unitsNeeded: parseInt(e.target.value) || 1 })}
                  data-testid="input-emergency-units"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergency-notes">Additional Notes</Label>
                <Textarea
                  id="emergency-notes"
                  value={newRequest.notes}
                  onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
                  placeholder="Patient details, urgency level, contact information..."
                  data-testid="textarea-emergency-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => createRequestMutation.mutate()}
                disabled={!newRequest.bloodGroup || !newRequest.location || createRequestMutation.isPending}
                data-testid="button-submit-emergency"
              >
                {createRequestMutation.isPending ? "Creating..." : "Create Emergency Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {emergencyRequests.length > 0 && (
        <Card className="border-red-500/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
              Active Emergency Requests ({emergencyRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {emergencyRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                variant="hospital"
                onComplete={(id) => completeMutation.mutate(id)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Pending Requests</CardTitle>
          <CardDescription>Manage and track blood requests</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
              <p className="text-muted-foreground">
                All blood requests have been fulfilled.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.filter((r) => r.priority !== "emergency").map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  variant="hospital"
                  onComplete={(id) => completeMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HospitalDashboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "Please log in to access the hospital dashboard.",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [user, isLoading, toast]);

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

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  const menuItems = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "User Management", icon: Users },
    { id: "inventory", label: "Blood Inventory", icon: Warehouse },
    { id: "requests", label: "Requests", icon: ClipboardList },
  ];

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Droplets className="h-8 w-8 text-primary" />
              <span className="font-bold text-lg">BloodLink</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setActiveSection(item.id)}
                        isActive={activeSection === item.id}
                        data-testid={`nav-${item.id}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <HospitalHeader />
          <main className="flex-1 overflow-auto p-6">
            {activeSection === "overview" && <DashboardOverview />}
            {activeSection === "users" && <UserManagement />}
            {activeSection === "inventory" && <BloodInventory />}
            {activeSection === "requests" && <RequestManagement />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

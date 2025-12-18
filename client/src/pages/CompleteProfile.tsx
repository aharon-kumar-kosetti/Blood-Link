import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Droplets, ArrowRight, Heart } from "lucide-react";
import type { BloodGroup } from "@shared/schema";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function CompleteProfile() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    age: 18,
    bloodGroup: "" as BloodGroup | "",
    phone: "",
    location: "",
    canDonate: true,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "",
        age: user.age || 18,
        bloodGroup: user.bloodGroup || "",
        phone: user.phone || "",
        location: user.location || "",
        canDonate: user.canDonate ?? true,
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/users/me", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile Updated", description: "Your profile is now complete!" });
      window.location.href = "/";
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [user, isLoading]);

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

  const isFormValid = formData.name && formData.bloodGroup && formData.location && formData.age >= 18;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Droplets className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">BloodLink</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
              <CardDescription>
                Help us match you with blood donors or receivers in your area
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full Name *</Label>
                <Input
                  id="profile-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  data-testid="input-profile-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-age">Age *</Label>
                  <Input
                    id="profile-age"
                    type="number"
                    min={18}
                    max={65}
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 18 })}
                    data-testid="input-profile-age"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-blood-group">Blood Group *</Label>
                  <Select
                    value={formData.bloodGroup}
                    onValueChange={(value) => setFormData({ ...formData, bloodGroup: value as BloodGroup })}
                  >
                    <SelectTrigger id="profile-blood-group" data-testid="select-profile-blood-group">
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
                <Label htmlFor="profile-phone">Phone Number</Label>
                <Input
                  id="profile-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  data-testid="input-profile-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-location">Location (City) *</Label>
                <Input
                  id="profile-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., New York, NY"
                  data-testid="input-profile-location"
                />
              </div>

              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox
                  id="can-donate"
                  checked={formData.canDonate}
                  onCheckedChange={(checked) => setFormData({ ...formData, canDonate: !!checked })}
                  data-testid="checkbox-can-donate"
                />
                <div>
                  <Label htmlFor="can-donate" className="cursor-pointer font-medium">
                    I am eligible to donate blood
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    You must be at least 18 years old and in good health
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => updateProfileMutation.mutate()}
                disabled={!isFormValid || updateProfileMutation.isPending}
                data-testid="button-complete-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Complete Profile"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { type BloodGroup } from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile update
  app.patch("/api/users/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, age, bloodGroup, phone, location, canDonate, availabilityStatus } = req.body;
      
      const user = await storage.updateUser(userId, {
        name,
        age,
        bloodGroup,
        phone,
        location,
        canDonate,
        availabilityStatus,
      });
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Get donors with filters
  app.get("/api/donors", isAuthenticated, async (req: any, res) => {
    try {
      const { bloodGroup, location, available } = req.query;
      const donors = await storage.getDonors({
        bloodGroup: bloodGroup as string,
        location: location as string,
        available: available === "true",
      });
      res.json(donors);
    } catch (error) {
      console.error("Error fetching donors:", error);
      res.status(500).json({ message: "Failed to fetch donors" });
    }
  });

  // Blood Request Routes
  app.post("/api/requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bloodGroup, location, priority, unitsNeeded, notes } = req.body;
      
      if (!bloodGroup || !location) {
        return res.status(400).json({ message: "Blood group and location are required" });
      }

      const request = await storage.createBloodRequest({
        requestedById: userId,
        bloodGroup,
        location,
        priority: priority || "normal",
        unitsNeeded: unitsNeeded || 1,
        notes,
      });
      
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating blood request:", error);
      res.status(500).json({ message: "Failed to create blood request" });
    }
  });

  // Get user's own requests
  app.get("/api/requests/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  // Get incoming requests for donor
  app.get("/api/requests/incoming", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.bloodGroup || !user?.availabilityStatus) {
        return res.json([]);
      }
      
      const requests = await storage.getIncomingRequests(userId, user.bloodGroup);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching incoming requests:", error);
      res.status(500).json({ message: "Failed to fetch incoming requests" });
    }
  });

  // Get completed donations
  app.get("/api/requests/completed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const donations = await storage.getCompletedDonations(userId);
      res.json(donations);
    } catch (error) {
      console.error("Error fetching completed donations:", error);
      res.status(500).json({ message: "Failed to fetch completed donations" });
    }
  });

  // Accept a blood request
  app.patch("/api/requests/:id/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const request = await storage.acceptRequest(id, userId);
      if (!request) {
        return res.status(404).json({ message: "Request not found or already accepted" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error accepting request:", error);
      res.status(500).json({ message: "Failed to accept request" });
    }
  });

  // Cancel a blood request
  app.patch("/api/requests/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const request = await storage.cancelRequest(id);
      
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error cancelling request:", error);
      res.status(500).json({ message: "Failed to cancel request" });
    }
  });

  // Complete a blood request
  app.patch("/api/requests/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const request = await storage.completeRequest(id);
      
      if (!request) {
        return res.status(404).json({ message: "Request not found or not in accepted state" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error completing request:", error);
      res.status(500).json({ message: "Failed to complete request" });
    }
  });

  // Hospital Routes
  
  // Get hospital stats
  app.get("/api/hospital/stats", isAuthenticated, async (req: any, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get all users (hospital admin)
  app.get("/api/hospital/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== "hospital") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create user by hospital
  app.post("/api/hospital/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      
      if (adminUser?.role !== "hospital") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { name, age, bloodGroup, phone, location, canDonate, email } = req.body;
      
      if (!name || !bloodGroup || !location) {
        return res.status(400).json({ message: "Name, blood group, and location are required" });
      }

      const newUser = await storage.createUserByHospital({
        name,
        age,
        bloodGroup,
        phone,
        location,
        canDonate: canDonate ?? true,
        email,
      });
      
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Get all requests (hospital admin)
  app.get("/api/hospital/requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== "hospital") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const requests = await storage.getAllRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  // Get hospital inventory
  app.get("/api/hospital/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== "hospital") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.initializeInventory(userId);
      const inventory = await storage.getHospitalInventory(userId);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // Update hospital inventory
  app.patch("/api/hospital/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== "hospital") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { bloodGroup, delta } = req.body;
      
      if (!bloodGroup || typeof delta !== "number") {
        return res.status(400).json({ message: "Blood group and delta are required" });
      }
      
      const updated = await storage.updateInventory(userId, bloodGroup as BloodGroup, delta);
      res.json(updated);
    } catch (error) {
      console.error("Error updating inventory:", error);
      res.status(500).json({ message: "Failed to update inventory" });
    }
  });

  return httpServer;
}

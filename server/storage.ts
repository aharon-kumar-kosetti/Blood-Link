import {
  users,
  bloodRequests,
  hospitalBloodStock,
  type User,
  type UpsertUser,
  type BloodRequest,
  type InsertBloodRequest,
  type HospitalBloodStock,
  type BloodGroup,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Extended user operations
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  getDonors(filters?: { bloodGroup?: string; location?: string; available?: boolean }): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  createUserByHospital(data: Partial<UpsertUser>): Promise<User>;
  
  // Blood request operations
  createBloodRequest(data: InsertBloodRequest): Promise<BloodRequest>;
  getBloodRequest(id: string): Promise<BloodRequest | undefined>;
  getBloodRequestWithRelations(id: string): Promise<BloodRequest & { requester?: User; matchedDonor?: User } | undefined>;
  getRequestsByUser(userId: string): Promise<BloodRequest[]>;
  getIncomingRequests(userId: string, bloodGroup: BloodGroup): Promise<BloodRequest[]>;
  getCompletedDonations(userId: string): Promise<BloodRequest[]>;
  getAllRequests(): Promise<BloodRequest[]>;
  updateBloodRequest(id: string, data: Partial<BloodRequest>): Promise<BloodRequest | undefined>;
  acceptRequest(requestId: string, donorId: string): Promise<BloodRequest | undefined>;
  completeRequest(requestId: string): Promise<BloodRequest | undefined>;
  cancelRequest(requestId: string): Promise<BloodRequest | undefined>;
  
  // Hospital blood stock operations
  getHospitalInventory(hospitalId: string): Promise<HospitalBloodStock[]>;
  updateInventory(hospitalId: string, bloodGroup: BloodGroup, delta: number): Promise<HospitalBloodStock>;
  initializeInventory(hospitalId: string): Promise<void>;
  
  // Stats
  getStats(): Promise<{
    totalDonors: number;
    availableDonors: number;
    pendingRequests: number;
    completedDonations: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getDonors(filters?: { bloodGroup?: string; location?: string; available?: boolean }): Promise<User[]> {
    let query = db.select().from(users).where(eq(users.role, "user"));
    
    const conditions: any[] = [eq(users.role, "user"), eq(users.canDonate, true)];
    
    if (filters?.bloodGroup && filters.bloodGroup !== "all") {
      conditions.push(eq(users.bloodGroup, filters.bloodGroup as BloodGroup));
    }
    
    if (filters?.available) {
      conditions.push(eq(users.availabilityStatus, true));
    }
    
    const result = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.availabilityStatus), desc(users.donationCount));
    
    if (filters?.location) {
      return result.filter((u) => 
        u.location?.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }
    
    return result;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUserByHospital(data: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...data,
        createdByHospital: true,
        role: "user",
      } as UpsertUser)
      .returning();
    return user;
  }

  // Blood request operations
  async createBloodRequest(data: InsertBloodRequest): Promise<BloodRequest> {
    const [request] = await db
      .insert(bloodRequests)
      .values(data)
      .returning();
    return request;
  }

  async getBloodRequest(id: string): Promise<BloodRequest | undefined> {
    const [request] = await db
      .select()
      .from(bloodRequests)
      .where(eq(bloodRequests.id, id));
    return request;
  }

  async getBloodRequestWithRelations(id: string): Promise<BloodRequest & { requester?: User; matchedDonor?: User } | undefined> {
    const [request] = await db
      .select()
      .from(bloodRequests)
      .where(eq(bloodRequests.id, id));
    
    if (!request) return undefined;
    
    const requester = request.requestedById 
      ? await this.getUser(request.requestedById) 
      : undefined;
    const matchedDonor = request.matchedDonorId 
      ? await this.getUser(request.matchedDonorId) 
      : undefined;
    
    return { ...request, requester, matchedDonor };
  }

  async getRequestsByUser(userId: string): Promise<BloodRequest[]> {
    const requests = await db
      .select()
      .from(bloodRequests)
      .where(eq(bloodRequests.requestedById, userId))
      .orderBy(desc(bloodRequests.createdAt));
    
    const result = [];
    for (const request of requests) {
      const requester = await this.getUser(request.requestedById);
      const matchedDonor = request.matchedDonorId 
        ? await this.getUser(request.matchedDonorId) 
        : undefined;
      result.push({ ...request, requester, matchedDonor });
    }
    return result;
  }

  async getIncomingRequests(userId: string, bloodGroup: BloodGroup): Promise<BloodRequest[]> {
    const requests = await db
      .select()
      .from(bloodRequests)
      .where(
        and(
          eq(bloodRequests.bloodGroup, bloodGroup),
          eq(bloodRequests.status, "pending")
        )
      )
      .orderBy(desc(bloodRequests.priority), desc(bloodRequests.createdAt));
    
    const result = [];
    for (const request of requests) {
      if (request.requestedById === userId) continue;
      const requester = await this.getUser(request.requestedById);
      result.push({ ...request, requester });
    }
    return result;
  }

  async getCompletedDonations(userId: string): Promise<BloodRequest[]> {
    return db
      .select()
      .from(bloodRequests)
      .where(
        and(
          eq(bloodRequests.matchedDonorId, userId),
          eq(bloodRequests.status, "completed")
        )
      )
      .orderBy(desc(bloodRequests.updatedAt));
  }

  async getAllRequests(): Promise<BloodRequest[]> {
    const requests = await db
      .select()
      .from(bloodRequests)
      .orderBy(desc(bloodRequests.priority), desc(bloodRequests.createdAt));
    
    const result = [];
    for (const request of requests) {
      const requester = await this.getUser(request.requestedById);
      const matchedDonor = request.matchedDonorId 
        ? await this.getUser(request.matchedDonorId) 
        : undefined;
      result.push({ ...request, requester, matchedDonor });
    }
    return result;
  }

  async updateBloodRequest(id: string, data: Partial<BloodRequest>): Promise<BloodRequest | undefined> {
    const [request] = await db
      .update(bloodRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bloodRequests.id, id))
      .returning();
    return request;
  }

  async acceptRequest(requestId: string, donorId: string): Promise<BloodRequest | undefined> {
    const [request] = await db
      .update(bloodRequests)
      .set({
        matchedDonorId: donorId,
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bloodRequests.id, requestId),
          eq(bloodRequests.status, "pending")
        )
      )
      .returning();
    return request;
  }

  async completeRequest(requestId: string): Promise<BloodRequest | undefined> {
    const request = await this.getBloodRequest(requestId);
    if (!request || request.status !== "accepted") return undefined;

    const [updatedRequest] = await db
      .update(bloodRequests)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(bloodRequests.id, requestId))
      .returning();

    if (updatedRequest && request.matchedDonorId) {
      await db
        .update(users)
        .set({
          donationCount: sql`${users.donationCount} + 1`,
          lastDonationDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.matchedDonorId));
    }

    return updatedRequest;
  }

  async cancelRequest(requestId: string): Promise<BloodRequest | undefined> {
    const [request] = await db
      .update(bloodRequests)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(bloodRequests.id, requestId))
      .returning();
    return request;
  }

  // Hospital blood stock operations
  async getHospitalInventory(hospitalId: string): Promise<HospitalBloodStock[]> {
    return db
      .select()
      .from(hospitalBloodStock)
      .where(eq(hospitalBloodStock.hospitalId, hospitalId));
  }

  async updateInventory(hospitalId: string, bloodGroup: BloodGroup, delta: number): Promise<HospitalBloodStock> {
    const existing = await db
      .select()
      .from(hospitalBloodStock)
      .where(
        and(
          eq(hospitalBloodStock.hospitalId, hospitalId),
          eq(hospitalBloodStock.bloodGroup, bloodGroup)
        )
      );

    if (existing.length > 0) {
      const newUnits = Math.max(0, (existing[0].unitsAvailable || 0) + delta);
      const [updated] = await db
        .update(hospitalBloodStock)
        .set({
          unitsAvailable: newUnits,
          lastUpdated: new Date(),
        })
        .where(eq(hospitalBloodStock.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(hospitalBloodStock)
        .values({
          hospitalId,
          bloodGroup,
          unitsAvailable: Math.max(0, delta),
        })
        .returning();
      return created;
    }
  }

  async initializeInventory(hospitalId: string): Promise<void> {
    const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
    
    for (const bloodGroup of bloodGroups) {
      const existing = await db
        .select()
        .from(hospitalBloodStock)
        .where(
          and(
            eq(hospitalBloodStock.hospitalId, hospitalId),
            eq(hospitalBloodStock.bloodGroup, bloodGroup)
          )
        );
      
      if (existing.length === 0) {
        await db.insert(hospitalBloodStock).values({
          hospitalId,
          bloodGroup,
          unitsAvailable: 0,
        });
      }
    }
  }

  // Stats
  async getStats(): Promise<{
    totalDonors: number;
    availableDonors: number;
    pendingRequests: number;
    completedDonations: number;
  }> {
    const allUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "user"), eq(users.canDonate, true)));
    
    const availableUsers = allUsers.filter((u) => u.availabilityStatus);
    
    const pendingReqs = await db
      .select()
      .from(bloodRequests)
      .where(
        or(
          eq(bloodRequests.status, "pending"),
          eq(bloodRequests.status, "accepted")
        )
      );
    
    const completedReqs = await db
      .select()
      .from(bloodRequests)
      .where(eq(bloodRequests.status, "completed"));

    return {
      totalDonors: allUsers.length,
      availableDonors: availableUsers.length,
      pendingRequests: pendingReqs.length,
      completedDonations: completedReqs.length,
    };
  }
}

export const storage = new DatabaseStorage();

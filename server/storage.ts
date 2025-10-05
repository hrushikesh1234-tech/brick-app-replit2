import { db } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  profiles,
  userAddresses,
  sellers,
  sellerPincodes,
  products,
  orders,
  orderStateHistory,
  payments,
  type Profile,
  type InsertProfile,
  type UserAddress,
  type InsertUserAddress,
  type Seller,
  type InsertSeller,
  type SellerPincode,
  type InsertSellerPincode,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type OrderStateHistory,
  type InsertOrderStateHistory,
  type Payment,
  type InsertPayment,
} from "@shared/schema";

export interface IStorage {
  // Profile operations
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByPhone(phone: string): Promise<Profile | undefined>;
  createProfile(data: InsertProfile & { passwordHash: string }): Promise<Profile>;
  updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined>;

  // User address operations
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  createUserAddress(data: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(id: string, data: Partial<InsertUserAddress>): Promise<UserAddress | undefined>;
  deleteUserAddress(id: string): Promise<void>;

  // Seller operations
  getSeller(id: string): Promise<Seller | undefined>;
  getSellerByUserId(userId: string): Promise<Seller | undefined>;
  getAllSellers(): Promise<Seller[]>;
  createSeller(data: InsertSeller): Promise<Seller>;
  updateSeller(id: string, data: Partial<InsertSeller>): Promise<Seller | undefined>;

  // Seller pincode operations
  getSellerPincodes(sellerId: string): Promise<SellerPincode[]>;
  createSellerPincode(data: InsertSellerPincode): Promise<SellerPincode>;
  deleteSellerPincode(id: string): Promise<void>;

  // Product operations
  getProduct(id: string): Promise<Product | undefined>;
  getProductsBySeller(sellerId: string): Promise<Product[]>;
  getAllActiveProducts(): Promise<Product[]>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;

  // Order operations
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  getOrdersBySeller(sellerId: string): Promise<Order[]>;
  getOrdersByStatus(statuses: string[]): Promise<Order[]>;
  createOrder(data: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;

  // Order state history operations
  getOrderStateHistory(orderId: string): Promise<OrderStateHistory[]>;
  createOrderStateHistory(data: InsertOrderStateHistory): Promise<OrderStateHistory>;

  // Payment operations
  getPaymentsByOrder(orderId: string): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Profile operations
  async getProfile(id: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile || undefined;
  }

  async getProfileByPhone(phone: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.phone, phone));
    return profile || undefined;
  }

  async createProfile(data: InsertProfile & { passwordHash: string }): Promise<Profile> {
    const [profile] = await db.insert(profiles).values(data).returning();
    return profile;
  }

  async updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [profile] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    return profile || undefined;
  }

  // User address operations
  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    return await db.select().from(userAddresses).where(eq(userAddresses.userId, userId));
  }

  async createUserAddress(data: InsertUserAddress): Promise<UserAddress> {
    const [address] = await db.insert(userAddresses).values(data).returning();
    return address;
  }

  async updateUserAddress(id: string, data: Partial<InsertUserAddress>): Promise<UserAddress | undefined> {
    const [address] = await db
      .update(userAddresses)
      .set(data)
      .where(eq(userAddresses.id, id))
      .returning();
    return address || undefined;
  }

  async deleteUserAddress(id: string): Promise<void> {
    await db.delete(userAddresses).where(eq(userAddresses.id, id));
  }

  // Seller operations
  async getSeller(id: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, id));
    return seller || undefined;
  }

  async getSellerByUserId(userId: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers).where(eq(sellers.userId, userId));
    return seller || undefined;
  }

  async getAllSellers(): Promise<Seller[]> {
    return await db.select().from(sellers).where(eq(sellers.status, "active"));
  }

  async createSeller(data: InsertSeller): Promise<Seller> {
    const [seller] = await db.insert(sellers).values(data).returning();
    return seller;
  }

  async updateSeller(id: string, data: Partial<InsertSeller>): Promise<Seller | undefined> {
    const [seller] = await db
      .update(sellers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sellers.id, id))
      .returning();
    return seller || undefined;
  }

  // Seller pincode operations
  async getSellerPincodes(sellerId: string): Promise<SellerPincode[]> {
    return await db.select().from(sellerPincodes).where(eq(sellerPincodes.sellerId, sellerId));
  }

  async createSellerPincode(data: InsertSellerPincode): Promise<SellerPincode> {
    const [pincode] = await db.insert(sellerPincodes).values(data).returning();
    return pincode;
  }

  async deleteSellerPincode(id: string): Promise<void> {
    await db.delete(sellerPincodes).where(eq(sellerPincodes.id, id));
  }

  // Product operations
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductsBySeller(sellerId: string): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.sellerId, sellerId))
      .orderBy(desc(products.createdAt));
  }

  async getAllActiveProducts(): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt));
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Order operations
  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersBySeller(sellerId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByStatus(statuses: string[]): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(inArray(orders.status, statuses as any))
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(data: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(data).returning();
    return order;
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  // Order state history operations
  async getOrderStateHistory(orderId: string): Promise<OrderStateHistory[]> {
    return await db
      .select()
      .from(orderStateHistory)
      .where(eq(orderStateHistory.orderId, orderId))
      .orderBy(desc(orderStateHistory.createdAt));
  }

  async createOrderStateHistory(data: InsertOrderStateHistory): Promise<OrderStateHistory> {
    const [history] = await db.insert(orderStateHistory).values(data).returning();
    return history;
  }

  // Payment operations
  async getPaymentsByOrder(orderId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.orderId, orderId));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(data).returning();
    return payment;
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return payment || undefined;
  }
}

export const storage = new DatabaseStorage();

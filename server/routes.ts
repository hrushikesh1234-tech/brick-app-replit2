import { Router, Response } from "express";
import { storage } from "./storage";
import { authMiddleware, requireRole, AuthRequest, hashPassword, comparePassword, generateToken, sanitizeProfile } from "./auth";
import {
  insertProfileSchema,
  insertUserAddressSchema,
  insertSellerSchema,
  insertProductSchema,
  insertOrderSchema,
  insertOrderStateHistorySchema,
} from "@shared/schema";

const router = Router();

// Auth routes
router.post("/api/auth/signup", async (req, res: Response) => {
  try {
    const { email, password, name, phone, role, shopName } = req.body;

    // Check if user already exists
    const existingUser = await storage.getProfileByPhone(phone);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this phone number" });
    }

    // Hash password and create profile
    const passwordHash = await hashPassword(password);
    const profileId = crypto.randomUUID();
    
    const profile = await storage.createProfile({
      id: profileId,
      phone,
      name,
      email: email || null,
      role: role || "customer",
      passwordHash,
    });
    
    // If seller, create seller profile
    if (role === "seller" && shopName) {
      await storage.createSeller({
        userId: profile.id,
        shopName,
        status: "active",
      });
    }

    const token = generateToken(profile.id, profile.role);
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ user: sanitizeProfile(profile), token });
  } catch (error: any) {
    console.error("Signup error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/auth/signin", async (req, res: Response) => {
  try {
    const { phone, password } = req.body;

    const profile = await storage.getProfileByPhone(phone);
    if (!profile) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, profile.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = generateToken(profile.id, profile.role);
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: sanitizeProfile(profile), token });
  } catch (error: any) {
    console.error("Signin error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/auth/signout", (req, res: Response) => {
  res.clearCookie("auth_token");
  res.json({ message: "Signed out successfully" });
});

router.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const profile = await storage.getProfile(req.userId!);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, profile.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash and update new password
    const newPasswordHash = await hashPassword(newPassword);
    await storage.updateProfile(req.userId!, { passwordHash: newPasswordHash } as any);

    res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    console.error("Password change error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/auth/session", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await storage.getProfile(req.userId!);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({ user: sanitizeProfile(profile) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Profile routes
router.get("/api/profiles/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await storage.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(sanitizeProfile(profile));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/profiles/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId !== req.params.id) {
      return res.status(403).json({ error: "Cannot update other user's profile" });
    }
    // Strip password hash from update to prevent unauthorized changes
    const { passwordHash, ...allowedUpdates } = req.body;
    const profile = await storage.updateProfile(req.params.id, allowedUpdates);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(sanitizeProfile(profile));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User address routes
router.get("/api/addresses", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await storage.getUserAddresses(req.userId!);
    res.json(addresses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/addresses", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = insertUserAddressSchema.parse({ ...req.body, userId: req.userId });
    const address = await storage.createUserAddress(data);
    res.json(address);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/addresses/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const address = await storage.updateUserAddress(req.params.id, req.body);
    res.json(address);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/addresses/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteUserAddress(req.params.id);
    res.json({ message: "Address deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seller routes
router.get("/api/sellers", async (req, res: Response) => {
  try {
    const sellers = await storage.getAllSellers();
    res.json(sellers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/sellers/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const seller = await storage.getSellerByUserId(req.userId!);
    res.json(seller);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/sellers", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = insertSellerSchema.parse({ ...req.body, userId: req.userId });
    const seller = await storage.createSeller(data);
    res.json(seller);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/sellers/:id", authMiddleware, requireRole("seller", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const seller = await storage.updateSeller(req.params.id, req.body);
    res.json(seller);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Product routes
router.get("/api/products", async (req, res: Response) => {
  try {
    const products = await storage.getAllActiveProducts();
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/products/:id", async (req, res: Response) => {
  try {
    const product = await storage.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/products/seller/:sellerId", async (req, res: Response) => {
  try {
    const products = await storage.getProductsBySeller(req.params.sellerId);
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/products", authMiddleware, requireRole("seller", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const seller = await storage.getSellerByUserId(req.userId!);
    if (!seller) {
      return res.status(403).json({ error: "Not a seller" });
    }
    const data = insertProductSchema.parse({ ...req.body, sellerId: seller.id });
    const product = await storage.createProduct(data);
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/products/:id", authMiddleware, requireRole("seller", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const product = await storage.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/products/:id", authMiddleware, requireRole("seller", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteProduct(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Order routes
router.get("/api/orders", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let orders;
    if (req.userRole === "customer") {
      orders = await storage.getOrdersByCustomer(req.userId!);
    } else if (req.userRole === "seller") {
      const seller = await storage.getSellerByUserId(req.userId!);
      if (!seller) {
        return res.status(403).json({ error: "Not a seller" });
      }
      orders = await storage.getOrdersBySeller(seller.id);
    } else if (req.userRole === "admin") {
      const { status } = req.query;
      if (status && typeof status === "string") {
        orders = await storage.getOrdersByStatus(status.split(","));
      } else {
        orders = await storage.getOrdersByStatus([
          "pending_verification",
          "seller_contacted",
          "seller_accepted",
          "buyer_contacted"
        ]);
      }
    }
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/orders/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/orders", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = insertOrderSchema.parse({ ...req.body, customerId: req.userId });
    const order = await storage.createOrder(data);
    
    // Create initial order state history
    await storage.createOrderStateHistory({
      orderId: order.id,
      status: order.status,
      changedBy: req.userId!,
    });
    
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/orders/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    const updatedOrder = await storage.updateOrder(req.params.id, req.body);
    
    // Create order state history if status changed
    if (req.body.status && req.body.status !== order.status) {
      await storage.createOrderStateHistory({
        orderId: order.id,
        status: req.body.status,
        changedBy: req.userId!,
        note: req.body.note,
      });
    }
    
    res.json(updatedOrder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/orders/:id/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const history = await storage.getOrderStateHistory(req.params.id);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Payment routes
router.get("/api/payments/:orderId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const payments = await storage.getPaymentsByOrder(req.params.orderId);
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

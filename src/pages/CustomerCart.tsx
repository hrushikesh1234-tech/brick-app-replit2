import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Trash2, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface CartItem {
  id: string;
  title: string;
  price: number;
  unit: string;
  quantity: number;
  seller_id: string;
}

export default function CustomerCart() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    pinCode: "",
  });

  useEffect(() => {
    loadCartItems();
  }, []);

  const loadCartItems = async () => {
    const saved = localStorage.getItem("cart");
    if (!saved) return;

    const productIds: string[] = JSON.parse(saved);
    const countMap: Record<string, number> = {};
    productIds.forEach((id) => {
      countMap[id] = (countMap[id] || 0) + 1;
    });

    const uniqueIds = Object.keys(countMap);
    if (uniqueIds.length === 0) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("id", uniqueIds);

    if (data && !error) {
      const items: CartItem[] = data.map((product) => ({
        id: product.id,
        title: product.title,
        price: product.price,
        unit: product.unit,
        quantity: countMap[product.id],
        seller_id: product.seller_id,
      }));
      setCartItems(items);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    const newItems = cartItems.map((item) =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    );
    setCartItems(newItems);

    // Update localStorage
    const newCart: string[] = [];
    newItems.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        newCart.push(item.id);
      }
    });
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const removeItem = (id: string) => {
    const newItems = cartItems.filter((item) => item.id !== id);
    setCartItems(newItems);

    const newCart: string[] = [];
    newItems.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        newCart.push(item.id);
      }
    });
    localStorage.setItem("cart", JSON.stringify(newCart));
    toast({ title: "Item removed from cart" });
  };

  const handleCheckout = async () => {
    if (!address.line1 || !address.city || !address.state || !address.pinCode) {
      toast({
        title: "Incomplete address",
        description: "Please fill in all required address fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Group items by seller
      const sellerGroups: Record<string, CartItem[]> = {};
      cartItems.forEach((item) => {
        if (!sellerGroups[item.seller_id]) {
          sellerGroups[item.seller_id] = [];
        }
        sellerGroups[item.seller_id].push(item);
      });

      // Create order for each seller
      for (const sellerId of Object.keys(sellerGroups)) {
        const items = sellerGroups[sellerId];
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const deliveryCharges = 50;
        const total = subtotal + deliveryCharges;
        const prepaymentAmount = paymentMethod === "cod" ? total * 0.2 : null;

        const orderData = {
          customer_id: user.id,
          seller_id: sellerId,
          items: items.map((item) => ({
            product_id: item.id,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            unit: item.unit,
          })),
          subtotal,
          delivery_charges: deliveryCharges,
          total,
          payment_method: paymentMethod,
          payment_status: "pending" as const,
          prepayment_amount: prepaymentAmount,
          status: "pending_verification" as const,
          delivery_address: address,
        };

        const { error } = await supabase.from("orders").insert([orderData]);

        if (error) throw error;
      }

      localStorage.removeItem("cart");
      toast({
        title: "Order placed!",
        description: "Your order is being verified by our team",
      });
      navigate("/customer/orders");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryCharges = 50;
  const total = subtotal + deliveryCharges;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shop
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>

        {cartItems.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">Your cart is empty</p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          ₹{item.price} per {item.unit}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            -
                          </Button>
                          <span className="w-12 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            +
                          </Button>
                        </div>
                        <div className="font-semibold w-24 text-right">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-semibold">Delivery Address</h3>
                  <div className="grid gap-4">
                    <div>
                      <Label>Address Line 1 *</Label>
                      <Input
                        value={address.line1}
                        onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                        placeholder="Street address"
                      />
                    </div>
                    <div>
                      <Label>Address Line 2</Label>
                      <Input
                        value={address.line2}
                        onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                        placeholder="Apartment, suite, etc."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>City *</Label>
                        <Input
                          value={address.city}
                          onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>State *</Label>
                        <Input
                          value={address.state}
                          onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>PIN Code *</Label>
                      <Input
                        value={address.pinCode}
                        onChange={(e) => setAddress({ ...address, pinCode: e.target.value })}
                        placeholder="110001"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="sticky top-4">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold text-lg">Order Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery</span>
                      <span>₹{deliveryCharges.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span>₹{total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="online" id="online" />
                        <Label htmlFor="online">Pay Online (Full Amount)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cod" id="cod" />
                        <Label htmlFor="cod">Cash on Delivery (20% Prepay)</Label>
                      </div>
                    </RadioGroup>
                    {paymentMethod === "cod" && (
                      <p className="text-sm text-muted-foreground">
                        You'll need to pay ₹{(total * 0.2).toFixed(2)} (20%) upfront
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full bg-gradient-primary hover:bg-gradient-primary-hover"
                    onClick={handleCheckout}
                    disabled={loading}
                  >
                    {loading ? "Processing..." : "Place Order"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

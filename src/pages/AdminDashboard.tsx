import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, LogOut, Phone, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Order {
  id: string;
  customer_id: string;
  seller_id: string;
  items: any;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  delivery_address: any;
  created_at: string;
  contact_attempts: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [action, setAction] = useState<"seller_accept" | "seller_reject" | "buyer_confirm" | "buyer_reject" | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const fetchPendingOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["pending_verification", "seller_contacted", "seller_accepted", "buyer_contacted"])
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
  };

  const handleContactSeller = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "seller_contacted",
        contact_attempts: orders.find(o => o.id === orderId)!.contact_attempts + 1,
      })
      .eq("id", orderId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Seller contacted status updated" });
      fetchPendingOrders();
    }
  };

  const handleSellerResponse = async (accepted: boolean) => {
    if (!selectedOrder) return;

    const { error } = await supabase
      .from("orders")
      .update({
        status: accepted ? "seller_accepted" : "seller_rejected",
        seller_response: note,
        reject_reason: accepted ? null : note,
      })
      .eq("id", selectedOrder.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Success",
        description: `Seller ${accepted ? "accepted" : "rejected"} the order`,
      });
      setActionDialogOpen(false);
      setNote("");
      fetchPendingOrders();
    }
  };

  const handleContactBuyer = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "buyer_contacted",
        contact_attempts: orders.find(o => o.id === orderId)!.contact_attempts + 1,
      })
      .eq("id", orderId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Buyer contacted status updated" });
      fetchPendingOrders();
    }
  };

  const handleBuyerResponse = async (confirmed: boolean) => {
    if (!selectedOrder) return;

    const { error } = await supabase
      .from("orders")
      .update({
        status: confirmed ? "confirmed" : "buyer_rejected",
        buyer_response: note,
        reject_reason: confirmed ? null : note,
      })
      .eq("id", selectedOrder.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Success",
        description: `Order ${confirmed ? "confirmed" : "cancelled"}`,
      });
      setActionDialogOpen(false);
      setNote("");
      fetchPendingOrders();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const openActionDialog = (order: Order, actionType: typeof action) => {
    setSelectedOrder(order);
    setAction(actionType);
    setActionDialogOpen(true);
  };

  const formatStatus = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Order Verification Queue</h2>

        {orders.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">No pending orders</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                    <Badge>{formatStatus(order.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Placed on {new Date(order.created_at).toLocaleString()}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Order Details</h4>
                      <div className="space-y-1 text-sm">
                        <div>Total: ₹{order.total.toFixed(2)}</div>
                        <div>Payment: {order.payment_method.toUpperCase()}</div>
                        <div>Payment Status: {order.payment_status.replace(/_/g, " ")}</div>
                        <div>Contact Attempts: {order.contact_attempts}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Items</h4>
                      <div className="space-y-1 text-sm">
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx}>
                            {item.title} × {item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {order.status === "pending_verification" && (
                        <Button
                          size="sm"
                          onClick={() => handleContactSeller(order.id)}
                          className="gap-2"
                        >
                          <Phone className="h-4 w-4" />
                          Contact Seller
                        </Button>
                      )}
                      {order.status === "seller_contacted" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openActionDialog(order, "seller_accept")}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Seller Accepted
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openActionDialog(order, "seller_reject")}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Seller Rejected
                          </Button>
                        </>
                      )}
                      {order.status === "seller_accepted" && (
                        <Button
                          size="sm"
                          onClick={() => handleContactBuyer(order.id)}
                          className="gap-2"
                        >
                          <Phone className="h-4 w-4" />
                          Contact Buyer
                        </Button>
                      )}
                      {order.status === "buyer_contacted" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openActionDialog(order, "buyer_confirm")}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Buyer Confirmed
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openActionDialog(order, "buyer_reject")}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Buyer Cancelled
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "seller_accept" && "Confirm Seller Acceptance"}
              {action === "seller_reject" && "Confirm Seller Rejection"}
              {action === "buyer_confirm" && "Confirm Buyer Order"}
              {action === "buyer_reject" && "Cancel Order"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Note / Reason</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any relevant notes..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActionDialogOpen(false);
                  setNote("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (action === "seller_accept") handleSellerResponse(true);
                  if (action === "seller_reject") handleSellerResponse(false);
                  if (action === "buyer_confirm") handleBuyerResponse(true);
                  if (action === "buyer_reject") handleBuyerResponse(false);
                }}
                className="flex-1"
              >
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

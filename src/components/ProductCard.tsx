import { Package } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    category: string;
    price: number;
    unit: string;
    stock: number;
    images: string[];
    delivery_estimate: string;
  };
  onAddToCart?: (productId: string) => void;
  onViewDetails?: (productId: string) => void;
}

export const ProductCard = ({ product, onAddToCart, onViewDetails }: ProductCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-elevated transition-all duration-300 group">
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
        <Badge className="absolute top-2 right-2 bg-gradient-primary">
          {product.category}
        </Badge>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-lg line-clamp-1">{product.title}</h3>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            ₹{product.price.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">per {product.unit}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Stock: {product.stock}</span>
          <span className="text-muted-foreground">{product.delivery_estimate}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        {onViewDetails && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onViewDetails(product.id)}
          >
            View Details
          </Button>
        )}
        {onAddToCart && (
          <Button
            className="flex-1 bg-gradient-primary hover:bg-gradient-primary-hover"
            onClick={() => onAddToCart(product.id)}
            disabled={product.stock === 0}
          >
            {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

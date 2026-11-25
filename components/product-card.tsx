import Image from "next/image";
import Link from "next/link";
import { type ProductCard as Card, formatPrice } from "@/lib/catalog";

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  return (
    <Link href={`/products/${product.slug}`} className="group grid gap-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-white">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain transition-transform group-hover:scale-[1.03]"
          />
        ) : null}
      </div>
      <div className="grid gap-0.5 text-sm">
        <span className="font-medium group-hover:underline">{product.name}</span>
        <span className="text-muted-foreground">{product.shopName}</span>
        <span>{formatPrice(product.priceCents, product.currency)}</span>
      </div>
    </Link>
  );
}

import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Car,
  Gift,
  Heart,
  Home,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Utensils,
  Wallet,
  Fuel,
  Star,
  Bus,
  Baby,
  BookOpen,
  Coffee,
  Gamepad2,
  PawPrint,
  Plane,
  Shirt,
  Smartphone,
  Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet,
  home: Home,
  heart: Heart,
  car: Car,
  'shopping-cart': ShoppingCart,
  shoppingcart: ShoppingCart,
  'shopping-basket': ShoppingBasket,
  shoppingbasket: ShoppingBasket,
  basket: ShoppingBasket,
  briefcase: Briefcase,
  gift: Gift,
  tag: Tag,
  utensils: Utensils,
  fuel: Fuel,
  star: Star,
  bus: Bus,
  baby: Baby,
  book: BookOpen,
  coffee: Coffee,
  game: Gamepad2,
  paw: PawPrint,
  plane: Plane,
  shirt: Shirt,
  phone: Smartphone,
  zap: Zap,
};

export function resolveCategoryIcon(icon?: string | null): LucideIcon {
  if (!icon) return Tag;
  const key = icon.trim().toLowerCase().replace(/_/g, '-');
  return ICON_MAP[key] ?? ICON_MAP[key.replace(/-/g, '')] ?? Tag;
}

export function CategoryIconBadge({
  icon,
  color,
  size = 18,
  className,
}: {
  icon?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const Icon = resolveCategoryIcon(icon);
  const tint = color || 'var(--action-primary)';

  return (
    <span
      className={className ? `category-icon-badge ${className}` : 'category-icon-badge'}
      style={{
        background: `color-mix(in srgb, ${tint} 16%, transparent)`,
        color: tint,
      }}
      aria-hidden
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color,color] duration-150 ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 min-h-11 select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-bone text-ink hover:bg-bone/90",
        secondary: "border border-line bg-ink-2 text-bone hover:bg-ink-3",
        ghost: "text-mute hover:text-bone hover:bg-ink-2",
        allow: "bg-allow text-ink hover:opacity-90",
        deny: "bg-deny text-bone hover:opacity-90",
      },
      size: {
        default: "rounded-md px-4 text-sm",
        lg: "rounded-lg px-5 text-base",
        sm: "min-h-10 rounded-md px-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

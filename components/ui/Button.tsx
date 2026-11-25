import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "success" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-medical-blue text-white hover:bg-medical-blue-dark focus-visible:ring-medical-blue",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-medical-blue",
  outline:
    "bg-transparent text-medical-blue border border-medical-blue hover:bg-medical-blue-light focus-visible:ring-medical-blue",
  success:
    "bg-soft-green text-white hover:bg-soft-green-dark focus-visible:ring-soft-green",
  danger: "bg-red text-white hover:bg-red-dark focus-visible:ring-red",
  ghost:
    "bg-transparent text-medical-blue hover:bg-medical-blue-light focus-visible:ring-medical-blue",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

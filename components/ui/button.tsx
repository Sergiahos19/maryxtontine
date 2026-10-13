type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const variantMap: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:border-accent",
  ghost: "text-accent hover:bg-accent-soft",
  danger: "border border-bad/30 text-bad hover:bg-bad-soft",
};

const sizeMap: Record<Size, string> = {
  md: "min-h-12 px-5 text-[0.95rem]",
  sm: "min-h-10 px-3.5 text-sm",
};

export function buttonClass({ variant = "primary", size = "md", block = false }: { variant?: Variant; size?: Size; block?: boolean } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variantMap[variant]} ${sizeMap[size]} ${block ? "w-full" : ""}`;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
};

export function Button({ variant, size, block, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} {...props} className={`${buttonClass({ variant, size, block })} ${className}`} />;
}

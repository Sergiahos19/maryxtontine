type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
};

const variantMap = {
  primary: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
  secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
  ghost: "bg-transparent text-cyan-200 hover:bg-slate-800/80",
};

export function Button({ children, variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-out ${variantMap[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

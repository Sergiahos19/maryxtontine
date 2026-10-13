type AvatarProps = {
  src?: string | null;
  firstName: string;
  lastName?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeMap = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export function Avatar({ src, firstName, lastName = "", size = "md", className = "" }: AvatarProps) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-display font-semibold text-accent ${sizeMap[size]} ${className}`}>
      {src ? (
        // Photos servies par l’API (authentifiée) : next/image n’apporte rien ici.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}

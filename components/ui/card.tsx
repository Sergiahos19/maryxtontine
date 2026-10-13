type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return <div className={`card-surface rounded-2xl border border-white/10 p-5 ${className}`}>{children}</div>;
}

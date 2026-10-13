type PanelProps = {
  children: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
};

export function Panel({ children, title, description, action, className = "", id }: PanelProps) {
  return (
    <section id={id} className={`card p-5 sm:p-6 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

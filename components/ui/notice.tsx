type NoticeProps = {
  tone: "error" | "success" | "warning" | "info";
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

const toneMap = {
  error: "border-bad/25 bg-bad-soft text-bad",
  success: "border-ok/25 bg-ok-soft text-ok",
  warning: "border-warn/25 bg-warn-soft text-warn",
  info: "border-accent/25 bg-accent-soft text-ink",
};

export function Notice({ tone, children, action, className = "" }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${toneMap[tone]} ${className}`}
    >
      <div>{children}</div>
      {action}
    </div>
  );
}

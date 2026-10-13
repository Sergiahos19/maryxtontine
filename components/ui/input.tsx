"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> & {
  label: string;
  hint?: string;
  value?: string;
};

export function Input({ label, hint, type = "text", value, className = "", ...props }: InputProps) {
  const id = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && passwordVisible ? "text" : type}
          defaultValue={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`field ${isPassword ? "pr-12" : ""}`}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-1 inline-flex w-11 items-center justify-center rounded-full text-muted hover:text-ink"
            aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {hint ? <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

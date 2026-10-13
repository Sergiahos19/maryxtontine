"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type InputProps = {
  label: string;
  type?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
};

export function Input({ label, type = "text", name, placeholder, value, required = false }: InputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="block space-y-2 text-sm text-slate-300">
      <span>{label}</span>
      <span className="relative block">
        <input
          type={isPassword && passwordVisible ? "text" : type}
          name={name}
          defaultValue={value}
          required={required}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none ${isPassword ? "pr-12" : ""}`}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-3 inline-flex items-center text-slate-400 hover:text-cyan-200"
            aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </span>
    </label>
  );
}

"use client";

import { Camera, Trash2, UserRound } from "lucide-react";
import { useId, useRef, useState } from "react";

const OUTPUT_SIZE = 320;

/** Recadre au carré et compresse en JPEG dans le navigateur : environ 20 à 40 Ko par photo. */
async function resizeToDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

type AvatarPickerProps = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  initials?: string;
  disabled?: boolean;
  label?: string;
};

export function AvatarPicker({ value, onChange, initials = "", disabled = false, label = "Photo de profil" }: AvatarPickerProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choisissez une image (JPEG, PNG…).");
      return;
    }
    setError("");
    try {
      onChange(await resizeToDataUrl(file));
    } catch {
      setError("Cette image n’a pas pu être lue. Essayez une autre photo.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-line-strong bg-surface-2 text-muted hover:border-accent disabled:opacity-60"
        aria-label={value ? "Changer la photo de profil" : "Ajouter une photo de profil"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : initials ? (
          <span className="font-display text-xl font-semibold text-accent">{initials}</span>
        ) : (
          <UserRound className="mx-auto h-8 w-8" />
        )}
        <span className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-ink ring-2 ring-surface">
          <Camera className="h-3.5 w-3.5" />
        </span>
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted">Facultative. Visible par les membres de la tontine.</p>
        {value ? (
          <button type="button" onClick={() => onChange(null)} disabled={disabled} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-bad hover:underline">
            <Trash2 className="h-3.5 w-3.5" /> Retirer la photo
          </button>
        ) : null}
        {error ? <p role="alert" className="mt-1.5 text-xs text-bad">{error}</p> : null}
      </div>
      <input ref={input} id={id} type="file" accept="image/*" className="sr-only" onChange={(event) => void onFile(event)} tabIndex={-1} />
    </div>
  );
}

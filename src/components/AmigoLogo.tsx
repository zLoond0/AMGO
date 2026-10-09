import React from "react";
import Image from "next/image";

export function AmigoLogo({ className = "w-24 h-auto" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center select-none ${className}`}>
      <Image
        src="/logo-luis-amigo.png"
        alt="Universidad Católica Luis Amigó"
        width={110}
        height={110}
        priority
        className="object-contain w-auto h-auto max-h-24"
      />
    </div>
  );
}

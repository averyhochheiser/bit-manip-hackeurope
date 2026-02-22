"use client";

import { useRef, useState, type ReactNode, type CSSProperties } from "react";

export function CursorTilt({
  children,
  className = "",
  intensity = 4,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  function handleMouseMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(800px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) translateY(${-y * 2}px) translateX(${x * 2}px)`,
      transition: "transform 0.15s ease-out",
    });
  }

  function handleMouseLeave() {
    setStyle({
      transform: "perspective(800px) rotateY(0deg) rotateX(0deg)",
      transition: "transform 0.4s ease-out",
    });
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

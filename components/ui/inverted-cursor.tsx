"use client";


import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

export function CustomCursor() {
    const [mounted, setMounted] = useState(false);

    // Use springs for smooth following
    const cursorX = useSpring(-100, { stiffness: 600, damping: 40 });
    const cursorY = useSpring(-100, { stiffness: 600, damping: 40 });

    useEffect(() => {
        setMounted(true);

        const moveCursor = (e: MouseEvent) => {
            // Offset by half width/height (16px) to center the 32x32 circle on cursor tip
            cursorX.set(e.clientX - 16);
            cursorY.set(e.clientY - 16);
        };

        window.addEventListener("mousemove", moveCursor);
        return () => window.removeEventListener("mousemove", moveCursor);
    }, [cursorX, cursorY]);

    if (!mounted) return null;

    return (
        <motion.div
            className="pointer-events-none fixed left-0 top-0 z-[2147483647] h-8 w-8 rounded-full bg-white mix-blend-difference"
            style={{
                x: cursorX,
                y: cursorY,
                // Ensure it's accelerated and painted
                willChange: "transform",
                backfaceVisibility: "hidden"
            }}
        />
    );
}

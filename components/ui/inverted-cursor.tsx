"use client";


import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

export function CustomCursor({ size = "h-14 w-14" }: { size?: string }) {
    const [mounted, setMounted] = useState(false);

    // Use springs for smooth following
    const cursorX = useSpring(-100, { stiffness: 600, damping: 40 });
    const cursorY = useSpring(-100, { stiffness: 600, damping: 40 });

    useEffect(() => {
        setMounted(true);

        const moveCursor = (e: MouseEvent) => {
            // Center the cursor
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
        };

        window.addEventListener("mousemove", moveCursor);
        return () => window.removeEventListener("mousemove", moveCursor);
    }, [cursorX, cursorY]);

    if (!mounted) return null;

    return (
        <motion.div
            className={`pointer-events-none fixed left-0 top-0 z-[2147483647] rounded-full bg-white mix-blend-difference ${size}`}
            style={{
                x: cursorX,
                y: cursorY,
                translateX: "-50%",
                translateY: "-50%",
                // Ensure it's accelerated and painted
                willChange: "transform",
                backfaceVisibility: "hidden"
            }}
        />
    );
}

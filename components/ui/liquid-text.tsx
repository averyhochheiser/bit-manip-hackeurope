"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiquidTextProps {
    text: string;
    className?: string;
}

const wordVariants = {
    hidden: { y: "100%", opacity: 0 },
    visible: {
        y: "0%",
        opacity: 1,
        transition: {
            ease: [0.16, 1, 0.3, 1] as const, // Custom liquid bezier
            duration: 0.8
        }
    }
};

const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.04,
            delayChildren: 0.1
        }
    }
};

export function LiquidText({ text, className }: LiquidTextProps) {
    const reducedMotion = useReducedMotion();
    // Split by spaces to animate per-word instead of per-letter for better performance and multi-line wrapping
    const words = text.split(" ");

    if (reducedMotion) {
        return <span className={className}>{text}</span>;
    }

    return (
        <motion.div
            className={cn("inline-flex flex-wrap gap-x-[0.25em]", className)}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
        >
            {words.map((word, index) => (
                <span key={index} className="inline-block overflow-hidden align-top">
                    <motion.span
                        variants={wordVariants}
                        className="inline-block"
                        style={{ transformOrigin: "bottom left" }}
                    >
                        {word}
                    </motion.span>
                </span>
            ))}
        </motion.div>
    );
}

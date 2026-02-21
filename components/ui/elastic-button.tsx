"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface ElasticButtonProps extends HTMLMotionProps<"button"> {
    children: React.ReactNode;
}

export const ElasticButton = React.forwardRef<HTMLButtonElement, ElasticButtonProps>(
    ({ children, className, ...props }, ref) => {
        return (
            <motion.button
                ref={ref}
                className={cn("inline-flex items-center justify-center", className)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{
                    type: "spring",
                    stiffness: 150,
                    damping: 20,
                    mass: 1.2,
                }}
                {...props}
            >
                {children}
            </motion.button>
        );
    }
);
ElasticButton.displayName = "ElasticButton";

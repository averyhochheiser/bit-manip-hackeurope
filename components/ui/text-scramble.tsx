"use client";

import { useEffect, useState, useRef } from "react";
import { useReducedMotion, useInView } from "framer-motion";

const GLYPHS = "αβγδεζθλμπσφψ∑∏∫∂√∞≈≠±×÷∆01{}[]<>~#";

function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

export function useTextScramble(
    initial: string,
    target: string,
    opts: { holdMs?: number; scrambleMs?: number; startDelay?: number; trigger?: boolean } = {}
) {
    const { holdMs = 800, scrambleMs = 1200, startDelay = 500, trigger = true } = opts;
    const [text, setText] = useState(initial);
    const reduced = useReducedMotion();

    useEffect(() => {
        if (!trigger) return;

        if (reduced) {
            const t = setTimeout(() => setText(target), startDelay + holdMs);
            return () => clearTimeout(t);
        }

        let cancelled = false;

        (async () => {
            await sleep(startDelay);
            if (cancelled) return;

            setText(initial);
            await sleep(holdMs);
            if (cancelled) return;

            const frameDur = 30;
            const frames = Math.ceil(scrambleMs / frameDur);
            const maxLen = Math.max(initial.length, target.length);

            for (let f = 0; f <= frames; f++) {
                if (cancelled) return;
                const progress = f / frames;
                const currentLen = Math.round(
                    initial.length + (target.length - initial.length) * progress
                );

                let out = "";
                for (let i = 0; i < currentLen; i++) {
                    const resolveAt = 0.25 + (i / maxLen) * 0.7;
                    if (progress >= resolveAt && i < target.length) {
                        out += target[i];
                    } else {
                        out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
                    }
                }
                setText(out);
                await sleep(frameDur);
            }
            setText(target);
        })();

        return () => {
            cancelled = true;
        };
    }, [initial, target, holdMs, scrambleMs, startDelay, reduced, trigger]);

    return text;
}

export function TextScramble({
    initial,
    target,
    className,
    holdMs,
    scrambleMs,
    startDelay,
}: {
    initial: string;
    target: string;
    className?: string;
    holdMs?: number;
    scrambleMs?: number;
    startDelay?: number;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, { once: true, amount: "some" });

    const text = useTextScramble(initial, target, {
        holdMs,
        scrambleMs,
        startDelay,
        trigger: isInView,
    });

    return (
        <span ref={ref} className={className}>
            {text}
        </span>
    );
}

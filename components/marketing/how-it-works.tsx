"use client";

import { motion } from "framer-motion";
import {
    GitPullRequest,
    BarChart3,
    AlertTriangle,
    Leaf,
    ArrowRight,
} from "lucide-react";

const steps = [
    {
        icon: GitPullRequest,
        number: "01",
        title: "Open a Pull Request",
        description:
            "Push ML training code changes to any connected repository. The Carbon Gate action triggers automatically.",
        accent: "from-sage/20 to-sage/5",
        iconColor: "text-sage",
        borderColor: "border-sage/20",
    },
    {
        icon: BarChart3,
        number: "02",
        title: "Calculate Emissions",
        description:
            "Real-time grid data, dynamic PUE modeling, and GPU thermal profiling produce physics-grade CO₂ estimates.",
        accent: "from-crusoe/20 to-crusoe/5",
        iconColor: "text-crusoe",
        borderColor: "border-crusoe/20",
    },
    {
        icon: AlertTriangle,
        number: "03",
        title: "Enforce & Report",
        description:
            "A detailed PR comment shows emissions, Crusoe alternatives, and budget impact. High-emission PRs are blocked.",
        accent: "from-mauve/20 to-mauve/5",
        iconColor: "text-[#c09ab0]",
        borderColor: "border-mauve/20",
    },
    {
        icon: Leaf,
        number: "04",
        title: "AI Auto-Patch",
        description:
            "Crusoe's LLM analyses your code and auto-commits efficiency patches — reducing emissions before training begins.",
        accent: "from-sage/20 to-sage/5",
        iconColor: "text-sage",
        borderColor: "border-sage/20",
    },
];

const container = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.12 },
    },
};

const stepItem = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.55, ease: "easeOut" },
    },
};

export function HowItWorks() {
    return (
        <section className="relative py-20 sm:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <p className="text-xs uppercase tracking-[0.2em] text-crusoe/70">
                        How it works
                    </p>
                    <h2 className="mt-3 font-display text-3xl font-bold text-floral sm:text-4xl lg:text-5xl">
                        From push to patch in 60 seconds
                    </h2>
                    <p className="mt-4 max-w-xl text-base text-floral/50">
                        Carbon Gate integrates directly into your GitHub workflow — no infrastructure changes, no CLI tools, no additional CI jobs.
                    </p>
                </motion.div>

                <motion.div
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
                    variants={container}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                >
                    {steps.map((step, i) => (
                        <motion.div key={step.number} variants={stepItem} className="group relative">
                            <div
                                className={`relative h-full overflow-hidden rounded-2xl border ${step.borderColor} bg-gradient-to-b ${step.accent} p-6 transition-all duration-300 hover:scale-[1.02] hover:border-floral/20`}
                            >
                                {/* Step number */}
                                <span className="font-monoData text-xs text-floral/25">
                                    {step.number}
                                </span>

                                {/* Icon */}
                                <div className={`mt-4 ${step.iconColor}`}>
                                    <step.icon size={28} strokeWidth={1.5} />
                                </div>

                                {/* Content */}
                                <h3 className="mt-4 text-lg font-semibold text-floral">
                                    {step.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-floral/55">
                                    {step.description}
                                </p>

                                {/* Connector arrow (hidden on last item) */}
                                {i < steps.length - 1 && (
                                    <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-gate-bg p-1 xl:block">
                                        <ArrowRight size={12} className="text-floral/20" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Code snippet preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="mt-10 overflow-hidden rounded-2xl border border-floral/[0.08] bg-[#1a1e24]"
                >
                    <div className="flex items-center gap-2 border-b border-floral/[0.06] px-4 py-3">
                        <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                        <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                        <div className="h-3 w-3 rounded-full bg-[#28c840]" />
                        <span className="ml-2 font-monoData text-[11px] text-floral/30">
                            .github/workflows/carbon-gate.yml
                        </span>
                    </div>
                    <pre className="overflow-x-auto p-5 font-monoData text-[13px] leading-relaxed">
                        <code>
                            <span className="text-sage/70">name</span>
                            <span className="text-floral/40">: </span>
                            <span className="text-crusoe">Carbon Gate Check</span>
                            {"\n\n"}
                            <span className="text-sage/70">on</span>
                            <span className="text-floral/40">:</span>
                            {"\n"}
                            {"  "}
                            <span className="text-sage/70">pull_request</span>
                            <span className="text-floral/40">:</span>
                            {"\n"}
                            {"    "}
                            <span className="text-sage/70">types</span>
                            <span className="text-floral/40">: [</span>
                            <span className="text-crusoe">opened</span>
                            <span className="text-floral/40">, </span>
                            <span className="text-crusoe">synchronize</span>
                            <span className="text-floral/40">]</span>
                            {"\n\n"}
                            <span className="text-sage/70">jobs</span>
                            <span className="text-floral/40">:</span>
                            {"\n"}
                            {"  "}
                            <span className="text-sage/70">carbon-gate</span>
                            <span className="text-floral/40">:</span>
                            {"\n"}
                            {"    "}
                            <span className="text-sage/70">uses</span>
                            <span className="text-floral/40">: </span>
                            <span className="text-crusoe">
                                averyhochheiser/bit-manip-hackeurope@main
                            </span>
                            {"\n"}
                            {"    "}
                            <span className="text-sage/70">with</span>
                            <span className="text-floral/40">:</span>
                            {"\n"}
                            {"      "}
                            <span className="text-sage/70">github-token</span>
                            <span className="text-floral/40">: </span>
                            <span className="text-[#c09ab0]">
                                {"${{ secrets.GITHUB_TOKEN }}"}
                            </span>
                            {"\n"}
                            {"      "}
                            <span className="text-sage/70">crusoe-api-key</span>
                            <span className="text-floral/40">: </span>
                            <span className="text-[#c09ab0]">
                                {"${{ secrets.CRUSOE_API_KEY }}"}
                            </span>
                            {"\n"}
                            {"      "}
                            <span className="text-floral/25">
                                {"# ← That's it. 5 lines of YAML."}
                            </span>
                        </code>
                    </pre>
                </motion.div>
            </div>
        </section>
    );
}

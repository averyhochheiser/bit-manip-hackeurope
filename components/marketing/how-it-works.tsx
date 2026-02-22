"use client";

import { motion } from "framer-motion";
import { TextScramble } from "@/components/ui/text-scramble";
import {
  GitPullRequest,
  BarChart3,
  AlertTriangle,
  Leaf,
} from "lucide-react";

const steps = [
  {
    icon: GitPullRequest,
    number: "01",
    title: "Open a Pull Request",
    description:
      "Push ML training code changes to any connected repository. The Carbon Gate action triggers automatically.",
    accent: "text-stoneware-turquoise",
    border: "border-stoneware-turquoise/20",
  },
  {
    icon: BarChart3,
    number: "02",
    title: "Calculate Emissions",
    description:
      "Real-time grid data, dynamic PUE modeling, and GPU thermal profiling produce physics-grade CO₂ estimates.",
    accent: "text-stoneware-green",
    border: "border-stoneware-green/20",
  },
  {
    icon: AlertTriangle,
    number: "03",
    title: "Enforce & Report",
    description:
      "A detailed PR comment shows emissions, Crusoe alternatives, and budget impact. High-emission PRs are blocked.",
    accent: "text-stoneware-pink",
    border: "border-stoneware-pink/20",
  },
  {
    icon: Leaf,
    number: "04",
    title: "AI Auto-Patch",
    description:
      "Crusoe's LLM analyses your code and auto-commits efficiency patches — reducing emissions before training begins.",
    accent: "text-stoneware-bordeaux",
    border: "border-stoneware-bordeaux/20",
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
    transition: { duration: 0.55, ease: "easeOut" as any },
  },
};

export function HowItWorks() {
  return (
    <section className="w-full border-b-[0.5px] border-white/[0.05] bg-transparent py-20 px-6 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mb-20"
        >
          <p className="text-[10px] uppercase tracking-widest text-floral/50">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-normal tracking-tight text-floral sm:text-4xl lg:text-5xl">
            <TextScramble
              initial="Δt → 0 · CI/CD ∘ gate"
              target="From push to patch in 60 seconds"
              holdMs={600}
              scrambleMs={1400}
              startDelay={200}
            />
          </h2>
          <p className="mt-4 max-w-xl text-sm font-light text-floral/60">
            Carbon Gate integrates directly into your GitHub workflow — no infrastructure changes, no CLI tools, no additional CI jobs.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-[0.5px] bg-white/[0.04] md:grid-cols-2 xl:grid-cols-4"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {steps.map((step) => (
            <motion.div key={step.number} variants={stepItem}>
              <div className={`flex h-full flex-col bg-[#16191d] border-t-[1.5px] ${step.border} p-6 lg:p-8`}>
                <span className={`font-mono text-[10px] tracking-widest ${step.accent}`}>
                  {step.number}
                </span>

                <div className={`mt-6 ${step.accent}`}>
                  <step.icon size={24} strokeWidth={1} />
                </div>

                <h3 className="mt-6 text-base font-normal text-floral">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm font-light leading-relaxed text-floral/60">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-12 overflow-hidden border-[0.5px] border-white/[0.06]"
        >
          <div className="flex items-center gap-2 border-b-[0.5px] border-white/[0.06] bg-[#16191d] px-4 py-3">
            <span className="font-mono text-[10px] tracking-widest text-floral/50">
              .github/workflows/carbon-gate.yml
            </span>
          </div>
          <pre className="overflow-x-auto bg-[#16191d] p-5 font-mono text-[13px] leading-relaxed">
            <code>
              <span className="text-stoneware-green">name</span>
              <span className="text-floral/40">: </span>
              <span className="text-floral">Carbon Gate Check</span>
              {"\n\n"}
              <span className="text-stoneware-green">on</span>
              <span className="text-floral/40">:</span>
              {"\n"}
              {"  "}
              <span className="text-stoneware-green">pull_request</span>
              <span className="text-floral/40">:</span>
              {"\n"}
              {"    "}
              <span className="text-stoneware-green">types</span>
              <span className="text-floral/40">: [</span>
              <span className="text-floral">opened</span>
              <span className="text-floral/40">, </span>
              <span className="text-floral">synchronize</span>
              <span className="text-floral/40">]</span>
              {"\n\n"}
              <span className="text-stoneware-green">jobs</span>
              <span className="text-floral/40">:</span>
              {"\n"}
              {"  "}
              <span className="text-stoneware-green">carbon-gate</span>
              <span className="text-floral/40">:</span>
              {"\n"}
              {"    "}
              <span className="text-stoneware-green">uses</span>
              <span className="text-floral/40">: </span>
              <span className="text-floral">
                averyhochheiser/bit-manip-hackeurope@main
              </span>
              {"\n"}
              {"    "}
              <span className="text-stoneware-green">with</span>
              <span className="text-floral/40">:</span>
              {"\n"}
              {"      "}
              <span className="text-stoneware-green">github-token</span>
              <span className="text-floral/40">: </span>
              <span className="text-stoneware-turquoise">
                {"${{ secrets.GITHUB_TOKEN }}"}
              </span>
              {"\n"}
              {"      "}
              <span className="text-stoneware-green">crusoe-api-key</span>
              <span className="text-floral/40">: </span>
              <span className="text-stoneware-turquoise">
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

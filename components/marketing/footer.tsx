import Link from "next/link";
import { Leaf, Github, ExternalLink } from "lucide-react";

export function Footer() {
    return (
        <footer className="relative border-t border-floral/[0.06] bg-[#1c2026]">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                    {/* Brand */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2">
                            <Leaf size={16} className="text-sage" />
                            <p className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-floral/70">
                                Carbon Gate
                            </p>
                        </div>
                        <p className="mt-3 max-w-md text-sm leading-relaxed text-floral/40">
                            CI/CD carbon enforcement for ML teams. Estimate, enforce, and reduce
                            your organisation&apos;s training emissions — powered by physics-grade
                            models and Crusoe&apos;s clean energy infrastructure.
                        </p>
                        <p className="mt-4 font-monoData text-[10px] text-floral/20">
                            Built for HackEurope 2026 · Crusoe Sustainability Track
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floral/40">
                            Product
                        </p>
                        <ul className="mt-3 space-y-2">
                            <li>
                                <Link
                                    href="/dashboard"
                                    className="text-sm text-floral/50 transition hover:text-floral/80"
                                >
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="/leaderboard"
                                    className="text-sm text-floral/50 transition hover:text-floral/80"
                                >
                                    Leaderboard
                                </a>
                            </li>
                            <li>
                                <Link
                                    href="/settings"
                                    className="text-sm text-floral/50 transition hover:text-floral/80"
                                >
                                    Settings
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/averyhochheiser/bit-manip-hackeurope"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-floral/50 transition hover:text-floral/80"
                                >
                                    <Github size={12} />
                                    GitHub
                                    <ExternalLink size={10} />
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Tech */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floral/40">
                            Built with
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-floral/50">
                            <li>Next.js + Vercel</li>
                            <li>Crusoe Cloud (Inference)</li>
                            <li>Electricity Maps API</li>
                            <li>Stripe Billing</li>
                            <li>Supabase</li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-floral/[0.06] pt-6">
                    <p className="text-xs text-floral/25">
                        © 2026 Carbon Gate · MIT License
                    </p>
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/20 bg-sage/[0.06] px-3 py-1 text-[10px] font-medium text-sage/70">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage" />
                            Gate Active
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}

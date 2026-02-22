import Link from "next/link";
import { Github } from "lucide-react";

export function Footer() {
    return (
        <footer className="relative border-t-[0.5px] border-[#FFF8F0]/[0.06] bg-[#1c2026]">
            <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-12">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
                    <div className="md:col-span-2">
                        <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-[#FFF8F0]/70">
                            Carbon Gate
                        </p>
                        <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-[#FFF8F0]/40">
                            CI/CD carbon enforcement for ML teams. Estimate, enforce, and reduce
                            your organisation&apos;s training emissions — powered by physics-grade
                            models and Crusoe&apos;s clean energy infrastructure.
                        </p>
                        <p className="mt-5 font-mono text-[10px] tracking-widest text-[#FFF8F0]/20">
                            Built for HackEurope 2026 · Crusoe Sustainability Track
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/40">
                            Product
                        </p>
                        <ul className="mt-4 space-y-3">
                            <li>
                                <Link href="/dashboard" className="text-sm font-light text-[#FFF8F0]/50 transition hover:text-stoneware-turquoise">
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <a href="/leaderboard" className="text-sm font-light text-[#FFF8F0]/50 transition hover:text-stoneware-green">
                                    Leaderboard
                                </a>
                            </li>
                            <li>
                                <Link href="/settings" className="text-sm font-light text-[#FFF8F0]/50 transition hover:text-stoneware-pink">
                                    Settings
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/averyhochheiser/bit-manip-hackeurope"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm font-light text-[#FFF8F0]/50 transition hover:text-[#FFF8F0]"
                                >
                                    <Github size={12} />
                                    GitHub
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/40">
                            Built with
                        </p>
                        <ul className="mt-4 space-y-3 text-sm font-light text-[#FFF8F0]/40">
                            <li>Next.js + Vercel</li>
                            <li className="text-stoneware-turquoise/60">Crusoe Cloud (Inference)</li>
                            <li>Electricity Maps API</li>
                            <li className="text-stoneware-pink/60">Stripe Billing</li>
                            <li>Supabase</li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t-[0.5px] border-[#FFF8F0]/[0.06] pt-6">
                    <p className="font-mono text-[10px] tracking-widest text-[#FFF8F0]/20">
                        © 2026 Carbon Gate · MIT License
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stoneware-green" />
                        <span className="font-mono text-[10px] tracking-widest text-stoneware-green/60">
                            Gate Active
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}

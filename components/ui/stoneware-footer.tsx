import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function StonewareFooter() {
    return (
        <footer className="grid grid-cols-1 border-t border-canvas/10 lg:grid-cols-12 bg-ink pb-24 lg:pb-0">
            {/* Col 1: About */}
            <div className="relative flex flex-col justify-between border-b-[0.5px] border-canvas/10 p-6 lg:col-span-5 lg:border-b-0 lg:border-r-[0.5px] lg:p-12">
                <p className="absolute left-6 top-6 text-xs uppercase tracking-widest text-canvas/50 lg:left-12 lg:top-12">
                    About
                </p>
                <div className="mt-20 text-sm font-sans font-normal leading-loose text-canvas lowercase">
                    we are building carbon accountability directly into ci/cd pipelines, mapping hardware emissions to engineering processes using physics rather than estimates.
                </div>
                <div className="mt-32 text-xs tracking-widest uppercase text-canvas/30">
                    © {new Date().getFullYear()} Carbon Gate
                </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="relative flex flex-col border-b-[0.5px] border-canvas/10 p-6 lg:col-span-4 lg:border-b-0 lg:border-r-[0.5px] lg:p-12">
                <p className="absolute left-6 top-6 text-xs uppercase tracking-widest text-canvas/50 lg:left-12 lg:top-12">
                    Index
                </p>
                <nav className="mt-20 flex flex-col gap-10 text-sm font-sans font-medium text-canvas uppercase tracking-widest">
                    <a href="#" className="hover:text-canvas/50 transition-colors">Accountability</a>
                    <a href="#" className="hover:text-canvas/50 transition-colors">Physics</a>
                    <a href="#" className="hover:text-canvas/50 transition-colors">Stripe Integration</a>
                    <a href="#" className="hover:text-canvas/50 transition-colors">Documentation</a>
                </nav>
            </div>

            {/* Col 3: Contact */}
            <div className="relative flex flex-col justify-between p-6 lg:col-span-3 lg:p-12">
                <p className="absolute left-6 top-6 text-xs uppercase tracking-widest text-canvas/50 lg:left-12 lg:top-12">
                    Contact
                </p>
                <div className="mt-20 lg:mt-auto">
                    <a
                        href="#"
                        className="inline-flex items-center gap-2 border border-canvas/30 px-8 py-5 text-xs uppercase tracking-widest text-canvas transition-colors hover:bg-canvas hover:text-ink"
                    >
                        Inquire
                        <ArrowUpRight size={16} strokeWidth={1} />
                    </a>
                </div>
            </div>
        </footer>
    );
}

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function StonewareFooter() {
    return (
        <footer className="grid grid-cols-1 border-b-[0.5px] border-border-subtle lg:grid-cols-12 bg-canvas pb-24 lg:pb-0">
            {/* Col 1: About */}
            <div className="relative flex flex-col justify-between border-b-[0.5px] border-border-subtle p-6 lg:col-span-5 lg:border-b-0 lg:border-r-[0.5px] lg:p-12">
                <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-12 lg:top-12">
                    About
                </p>
                <div className="mt-16 text-sm font-light leading-relaxed text-ink lowercase">
                    we are building carbon accountability directly into ci/cd pipelines, mapping hardware emissions to engineering processes using physics rather than estimates.
                </div>
                <div className="mt-24 text-[10px] tracking-widest uppercase text-ink-faint">
                    © {new Date().getFullYear()} Carbon Gate
                </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="relative flex flex-col border-b-[0.5px] border-border-subtle p-6 lg:col-span-4 lg:border-b-0 lg:border-r-[0.5px] lg:p-12">
                <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-12 lg:top-12">
                    Index
                </p>
                <nav className="mt-16 flex flex-col gap-4 text-sm font-light text-ink">
                    <a href="#" className="hover:text-ink-muted transition-colors">accountability</a>
                    <a href="#" className="hover:text-ink-muted transition-colors">physics</a>
                    <a href="#" className="hover:text-ink-muted transition-colors">stripe integration</a>
                    <a href="#" className="hover:text-ink-muted transition-colors">documentation</a>
                </nav>
            </div>

            {/* Col 3: Contact */}
            <div className="relative flex flex-col justify-between p-6 lg:col-span-3 lg:p-12">
                <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-12 lg:top-12">
                    Contact
                </p>
                <div className="mt-16 lg:mt-auto">
                    <a
                        href="#"
                        className="inline-flex items-center gap-2 border-[0.5px] border-stoneware-bordeaux px-6 py-4 text-[10px] uppercase tracking-widest text-stoneware-bordeaux transition-colors hover:bg-stoneware-bordeaux hover:text-canvas"
                    >
                        Inquire
                        <ArrowUpRight size={14} strokeWidth={1} />
                    </a>
                </div>
            </div>
        </footer>
    );
}

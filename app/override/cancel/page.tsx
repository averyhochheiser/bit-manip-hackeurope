/**
 * /override/cancel
 *
 * Shown when the user cancels out of the Stripe checkout flow.
 */

export default function OverrideCancelPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#23282E] px-4">
      <div className="max-w-md w-full bg-[#2A3038] rounded-2xl shadow-panel p-8 space-y-6 text-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-mauve/20 mx-auto">
          <svg
            className="w-8 h-8 text-mauve"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Payment cancelled</h1>
          <p className="text-gray-400 text-sm">
            No charge was made. Your carbon gate override was not activated.
          </p>
        </div>

        <div className="bg-[#1e2329] rounded-xl p-4 text-sm text-gray-400 space-y-2 text-left">
          <p className="font-medium text-gray-300">What are your options?</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              Reduce emissions by applying the{" "}
              <span className="font-mono text-crusoe">/apply-crusoe-patch</span> suggestion.
            </li>
            <li>Ask a repo admin to apply a free admin override.</li>
            <li>Click the override link in the PR comment again when ready to pay.</li>
          </ul>
        </div>

        <p className="text-xs text-gray-600">
          The override checkout link in your PR comment remains valid for 24 hours.
        </p>
      </div>
    </main>
  );
}

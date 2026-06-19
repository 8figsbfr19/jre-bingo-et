import { BottomNav } from '../components/BottomNav'

export function Wallet() {
  return (
    <div className="min-h-screen bg-[#0d0923] pb-24">
      <div className="bg-[#1a1035] border-b border-purple-900/40 px-4 py-4 flex items-center justify-between">
        <h1 className="text-white font-black text-xl">Wallet</h1>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Main balance */}
        <div className="bg-[#1a1035] rounded-2xl p-5 border border-purple-900/40">
          <div className="text-purple-400 text-xs mb-1">Main Balance</div>
          <div className="text-white text-3xl font-black">0 ETB</div>
          <div className="mt-3 flex gap-3">
            <div className="flex-1 bg-[#0d0923] rounded-xl p-3 border border-purple-900/30">
              <div className="text-purple-500 text-xs">Bonus Balance</div>
              <div className="text-amber-400 font-bold">0</div>
            </div>
            <div className="flex-1 bg-[#0d0923] rounded-xl p-3 border border-purple-900/30">
              <div className="text-purple-500 text-xs">Coins</div>
              <div className="text-amber-400 font-bold">0</div>
            </div>
          </div>
        </div>

        {/* Coming soon */}
        <div className="bg-[#1a1035] rounded-2xl p-6 border border-purple-900/40 text-center">
          <div className="text-4xl mb-3">💳</div>
          <div className="text-white font-bold text-lg mb-1">Payments Coming Soon</div>
          <p className="text-purple-400 text-sm">
            Real money deposits and withdrawals will be available in V2.
            All games in V1 are free practice.
          </p>
        </div>

        <div className="bg-[#1a1035] rounded-2xl border border-purple-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-purple-900/40">
            <span className="text-white font-semibold text-sm">Recent Transactions</span>
          </div>
          <div className="px-4 py-8 text-center text-purple-600 text-sm">No recent transactions</div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

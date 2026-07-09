import { SCENARIOS } from '../data/scenarios';

interface Props {
  onSelect: (scenarioId: string) => void;
}

export default function ScenarioSelect({ onSelect }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <h1 className="text-4xl font-bold text-center mb-2" style={{ fontFamily: 'Georgia, serif', color: '#c9a84c' }}>
          Table Battles
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: '#9a8c7e' }}>
          2nd Edition · by Amabel Holland
        </p>

        <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: '#e8e0d0' }}>
          Select a Scenario
        </h2>

        <div className="grid gap-3">
          {SCENARIOS.map((s) => {
            const verified = ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08'].includes(s.id);
            return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="w-full text-left rounded-lg p-4 border transition-all hover:scale-[1.01]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderColor: verified ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.1)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = verified ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.borderColor = verified ? 'rgba(201,168,76,0.6)' : 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = verified ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.1)';
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="text-xs font-mono font-bold mt-0.5 shrink-0 px-2 py-0.5 rounded"
                  style={{ background: 'rgba(201,168,76,0.2)', color: '#c9a84c' }}
                >
                  {s.scenarioNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base" style={{ color: '#e8e0d0' }}>
                      {s.name}
                    </span>
                    {verified
                      ? <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(80,160,80,0.2)', color: '#7cc47c', border: '1px solid rgba(80,160,80,0.35)' }}>Available</span>
                      : <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(180,120,40,0.2)', color: '#c49050', border: '1px solid rgba(180,120,40,0.35)' }}>In Progress · may be buggy</span>
                    }
                  </div>
                  <div className="text-xs mb-1" style={{ color: '#9a8c7e' }}>
                    {s.date} · {s.firstPlayer.factionName} vs {s.secondPlayer.factionName}
                  </div>
                  <div className="text-sm leading-snug" style={{ color: '#b8a898' }}>
                    {s.description}
                  </div>
                </div>
              </div>
            </button>
            );
          })}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#6b5d52' }}>
          Pass-and-play · No AI · Board flips perspective after each Roll Phase
        </p>
      </div>
    </div>
  );
}

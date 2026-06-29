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
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="w-full text-left rounded-lg p-4 border transition-all hover:scale-[1.01]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(201,168,76,0.3)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.1)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.6)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.3)';
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
                  <div className="font-semibold text-base" style={{ color: '#e8e0d0' }}>
                    {s.name}
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
          ))}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#6b5d52' }}>
          Pass-and-play · No AI · Board flips perspective after each Roll Phase
        </p>
      </div>
    </div>
  );
}

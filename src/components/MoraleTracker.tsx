interface Props {
  morale: number;
  factionName: string;
  isBottom: boolean;
}

export default function MoraleTracker({ morale, factionName, isBottom }: Props) {
  const cubes = Array.from({ length: Math.max(0, morale) });

  return (
    <div className={`flex items-center gap-2 ${isBottom ? '' : 'flex-row-reverse'}`}>
      <span className="text-xs font-semibold" style={{ color: '#9a8c7e' }}>
        {factionName}
      </span>
      <div className="flex gap-1 flex-wrap">
        {cubes.map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-sm"
            style={{ background: '#c9a84c', border: '1px solid rgba(201,168,76,0.5)' }}
            title="Morale Cube"
          />
        ))}
        {morale === 0 && (
          <span className="text-xs font-bold" style={{ color: '#e05c5c' }}>0</span>
        )}
      </div>
      <span className="text-xs" style={{ color: '#6b5d52' }}>Morale</span>
    </div>
  );
}

import { useState } from 'react';

const SECTIONS = [
  {
    title: 'Goal',
    content: [
      'Reduce your opponent\'s Morale to zero. Each side starts with a set number of Morale Cubes. When a formation is Routed, your opponent loses Morale Cubes equal to that formation\'s current strength. Starred formations (★) cost 2 cubes.',
    ],
  },
  {
    title: 'Turn Order',
    content: [
      '1. Action Phase — The active player takes one action from a formation that has dice on it, then may face a reaction from the opponent. Or the player may pass.',
      '2. Roll Phase — The active player rolls their available dice (up to 6 total, minus any already on formations), assigns them to formations, then ends the phase.',
      '3. The other player becomes active and repeats.',
    ],
  },
  {
    title: 'Roll Phase',
    content: [
      'Select dice from your pool and assign them to a formation\'s Dice Area. You may assign dice to only one formation per Wing per roll phase.',
      'Dice stay on a formation until an action is taken from it — they carry over into the next turn if unused.',
      'Unassigned dice are discarded when you End Roll Phase.',
    ],
  },
  {
    title: 'Action Phase',
    content: [
      'You may take one action from a formation that has dice on it and meets the action\'s Requirement.',
      'Taking an action clears the dice from that formation.',
      'If you have dice on a formation but do NOT meet the requirement, you may take a Null Action to clear the dice and proceed.',
      'If you cannot or do not wish to act, press Pass.',
    ],
  },
  {
    title: 'Dice Areas',
    content: [
      'Values (e.g. 5/6) — Assign any die showing one of the listed numbers. Multiple dice may be placed over multiple turns.',
      'Values in brackets, e.g. (5) — As above, but only one die ever.',
      'Doubles — Assign exactly 2 matching dice at once.',
      'Triples — Assign exactly 3 matching dice at once.',
      'Straight-N — Assign exactly N consecutive dice at once (e.g. 3-4-5-6 for Straight-4).',
      'Any — Any die value. Assign one or more at a time.',
    ],
  },
  {
    title: 'Action Requirements',
    content: [
      'Some actions require a specific pattern among the dice on the card:',
      'Pair — At least two dice showing the same value.',
      'Two Pairs — Two different pairs.',
      'Triplet — Three dice showing the same value.',
      'Two Triplets — Two different triplets.',
      'Full House — A triplet and a pair.',
      'Five Dice — At least five dice on the card.',
      'No requirement — Any dice (or cubes) on the card will do.',
    ],
  },
  {
    title: 'Reactions',
    content: [
      'After an Attack, the defender may react with a Screen, Counterattack, or Absorb — if they have the dice on the relevant formation and meet its requirement.',
      'Screen — Cancels the attack entirely.',
      'Counterattack — Hits the attacker back.',
      'Absorb — A friendly formation takes the hits instead of the target.',
      'Mandatory reactions must be taken if available. Reactions marked (optional) may be declined.',
      'Taking a reaction skips your own Action Phase next turn.',
    ],
  },
  {
    title: 'Special Formations',
    content: [
      'Special formations (shown with Roman numeral strength: I, II, III) use cubes instead of unit blocks.',
      'Place a valid set of dice on the formation to add 1 cube. The dice are consumed.',
      'Each action spends 1 cube.',
      'Special formations cannot be Routed in the normal sense — losing all cubes ends their effectiveness but does not cost your opponent Morale.',
    ],
  },
  {
    title: 'Routing',
    content: [
      'A formation is Routed when it loses its last unit.',
      'The owner loses Morale Cubes equal to the formation\'s remaining strength at rout. Starred formations (★) cost double.',
      'A Routed formation is removed from play.',
    ],
  },
  {
    title: 'Wings',
    content: [
      'Each formation belongs to a Wing (Red, Pink, Blue, Dark Blue). You may only assign dice to one formation per Wing per roll phase.',
      'This means that even if multiple formations in a Wing need dice, you must choose one per turn.',
    ],
  },
  {
    title: 'Reserves & Retirement',
    content: [
      'Some formations start In Reserve and only enter play when a specified condition is met (usually when another formation is Routed or Retired).',
      'Retired formations leave play voluntarily at the end of a turn — they do not cost Morale.',
    ],
  },
];

export default function PlayerAid() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-9 h-9 rounded-full font-bold text-base flex items-center justify-center transition-all"
        style={{
          background: 'rgba(201,168,76,0.2)',
          border: '1px solid rgba(201,168,76,0.5)',
          color: '#c9a84c',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.35)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.2)'; }}
        title="Player Aid"
      >
        ?
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="rounded-xl w-full max-w-2xl flex flex-col"
            style={{
              background: '#1a1510',
              border: '1px solid rgba(201,168,76,0.35)',
              maxHeight: '85vh',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div>
                <span className="font-bold text-base" style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}>
                  Table Battles — Player Aid
                </span>
                <span className="ml-2 text-xs" style={{ color: '#6b5d52' }}>2nd Edition · Amabel Holland</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-lg font-bold leading-none px-2 py-0.5 rounded transition-all"
                style={{ color: '#9a8c7e' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#e8e0d0'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9a8c7e'; }}
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <div
                    className="text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: '#c9a84c' }}
                  >
                    {section.title}
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.content.map((line, i) => (
                      <p key={i} className="text-xs leading-relaxed" style={{ color: '#b8a898' }}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-xs text-center mt-2" style={{ color: '#4a3d34' }}>
                This aid covers the core rules. Always defer to the full rulebook for edge cases.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

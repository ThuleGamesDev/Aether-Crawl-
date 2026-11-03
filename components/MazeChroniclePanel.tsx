import { getEnemyDefinition } from '../data/enemies';
import { getFloorGuardianDefinition } from '../data/mazeContent';
import { getMazeLaw } from '../data/mazeLaws';
import { getMazeLawSynergy } from '../data/lawSynergies';
import type { ActiveMazeLaw, MazeChronicle } from '../types';

export default function MazeChroniclePanel({ chronicle, activeLaws }: { chronicle: MazeChronicle; activeLaws: ActiveMazeLaw[] }) {
  const events = [...chronicle.events].reverse();
  return <div className="fps-chronicle-panel">
    <section className="fps-chronicle-section">
      <h3>Active Laws</h3>
      {activeLaws.length
        ? <ul className="fps-chronicle-laws">{[...activeLaws].sort((a, b) => a.acquiredOrder - b.acquiredOrder).map(active => {
          const law = getMazeLaw(active.lawId);
          return <li key={active.lawId}><strong>{active.lawId.replace(/_/g, ' ')}</strong><span>{law?.whatChanges ?? 'This Law shapes a future floor.'}</span></li>;
        })}</ul>
        : <p className="fps-muted">No Guardian Law has been woven yet.</p>}
    </section>
    <section className="fps-chronicle-section">
      <h3>Run Record</h3>
      {events.length
        ? <ol className="fps-chronicle-events">{events.map(event => <li key={event.id}>
          <span className="fps-chronicle-floor">FLOOR {event.floor}</span>
          <strong>{eventTitle(event)}</strong>
          <span>{eventDetail(event)}</span>
        </li>)}</ol>
        : <p className="fps-muted">Choices and discoveries will appear after they become part of this run.</p>}
    </section>
    <p className="fps-chronicle-note">The Chronicle records this expedition only. Hidden rooms and enemy families appear after discovery.</p>
  </div>;
}

function eventTitle(event: MazeChronicle['events'][number]): string {
  switch (event.kind) {
    case 'LAW_CHOSEN': return 'Guardian Law woven · ' + lawName(event.lawId);
    case 'LAW_MANIFESTED': return 'Law manifested · ' + lawName(event.lawId);
    case 'SYNERGY_MANIFESTED': return 'Law synergy discovered · ' + (getMazeLawSynergy(event.synergyId)?.title ?? event.synergyId);
    case 'THREAD_WOVEN': return event.action === 'REVEAL_PASSAGE' ? 'Passage revealed' : 'Passage sealed';
    case 'ROOM_FAMILY_DISCOVERED': return 'Room discovered · ' + roomName(event.familyId);
    case 'ENEMY_FAMILY_DISCOVERED': return 'Enemy discovered · ' + enemyName(event.familyId, event.floor);
  }
}

function eventDetail(event: MazeChronicle['events'][number]): string {
  switch (event.kind) {
    case 'LAW_CHOSEN': return event.replacedLawId
      ? `${lawName(event.replacedLawId)} was released from the active pattern.`
      : 'This choice will shape a future floor.';
    case 'LAW_MANIFESTED': return getMazeLaw(event.lawId)?.whatChanges ?? 'The Law altered this floor.';
    case 'SYNERGY_MANIFESTED': return getMazeLawSynergy(event.synergyId)?.description ?? 'Two Laws changed the same chamber.';
    case 'THREAD_WOVEN': return `${event.junctionId} · ${event.chargeCost} Thread Charge${event.chargeCost === 1 ? '' : 's'}${event.healthCost ? ` · ${event.healthCost} HP` : ''}.`;
    case 'ROOM_FAMILY_DISCOVERED': return 'Added to the discovered room families.';
    case 'ENEMY_FAMILY_DISCOVERED': return 'Added to the discovered enemy families.';
  }
}

function lawName(lawId: string): string {
  return lawId.replace(/_/g, ' ');
}

function roomName(roomType: string): string {
  return roomType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function enemyName(enemyId: string, floor: number): string {
  return getEnemyDefinition(enemyId)?.fpsName ?? getFloorGuardianDefinition(floor).name;
}

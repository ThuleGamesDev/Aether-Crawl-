import { audioService } from '../services/audioService';
import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { TileType, type FloorState, type Player, type Enemy, type Position, type ActiveRoomEvent } from '../types';
import { consumeFloorPreparation, finishFloorEncounter, resolveRoom, roomDecision, roomInteraction, visitFloor } from '../services/dungeonGameplay';
export function useDungeonGameplay({ playerRef, setPlayer, setMap, setDecorations, onLog, onEncounter, onDefeat }: {
  playerRef: MutableRefObject<Player>; setPlayer: Dispatch<SetStateAction<Player>>; setMap: Dispatch<SetStateAction<number[][]>>; setDecorations: Dispatch<SetStateAction<number[][]>>;
  onLog: (text: string) => void; onEncounter: (enemies: Enemy[]) => void; onDefeat: () => void;
}) {
  const floorRef = useRef<FloorState | null>(null);
  const [floor, setFloor] = useState<FloorState | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [hazard, setHazard] = useState<ActiveRoomEvent | null>(null);
  const commit = (next: FloorState) => { floorRef.current = next; setFloor(next); };
  const applyPlayer = (p: Player) => { playerRef.current = p; setPlayer(p); };
  const reset = (next: FloorState, pos?: Position, explored?: boolean[][]) => { commit(pos && explored ? visitFloor(next, pos, explored).floor : next); setDecisionId(null); setHazard(null); };
  const interact = (map: number[][], transform: Player['transform']): boolean => {
    const current = floorRef.current; if (!current || !transform) return false;
    const room = roomInteraction(current, map, transform); if (!room) return false;
    if (room.type === 'SECRET' && !room.discovered && room.gate && map[room.gate.y][room.gate.x] === TileType.SECRET) {
      const result = resolveRoom(current, playerRef.current, map, room.id, 'reveal'); commit(result.floor); setMap(result.map); result.logs.forEach(onLog); audioService.playItemGet(); return true;
    }
    setDecisionId(room.id); return true;
  };
  const choose = (map: number[][], id: string, choice: string) => {
    const current = floorRef.current; if (!current) return;
    const result = resolveRoom(current, playerRef.current, map, id, choice);
    result.logs.forEach(onLog); if (!result.accepted) return;
    // Commit the claim before dispatching state, feedback or combat to prevent same-frame duplicate clicks.
    commit(result.floor); applyPlayer(result.player);
    const claimed = result.floor.rooms.find(r => r.id === id);
    if (claimed?.resolved) setDecorations(old => old.map((row, y) => row.map((value, x) => x === claimed.anchor.x && y === claimed.anchor.y ? 0 : value))); if (result.map !== map) setMap(result.map); setDecisionId(null);
    if (result.hazard) setHazard(result.hazard);
    if (!result.player.party.some(c => c.stats.hp > 0)) { setHazard(null); onDefeat(); return; }
    if (result.encounter) onEncounter(result.encounter);
  };
  const visit = (pos: Position, explored: boolean[][], map: number[][]) => {
    const current = floorRef.current; if (!current) return;
    const result = visitFloor(current, pos, explored); if (result.floor !== current) commit(result.floor); result.logs.forEach(onLog);
    if (result.encounterRoom) choose(map, result.encounterRoom, 'fight');
  };
  const prepareEncounter = () => {
    if (!floorRef.current) return playerRef.current;
    const result = consumeFloorPreparation(floorRef.current, playerRef.current); commit(result.floor); applyPlayer(result.player); return result.player;
  };
  const finishEncounter = (victory: boolean, bossVictory = false): boolean => {
    if (!floorRef.current) return false;
    const result = finishFloorEncounter(floorRef.current, playerRef.current, victory, bossVictory); commit(result.floor); applyPlayer(result.player); result.logs.forEach(onLog); return result.elite;
  };
  const room = floor?.rooms.find(r => r.id === decisionId);
  return { floor, floorRef, reset, interact, visit, choose, prepareEncounter, finishEncounter, room, hazard, close: () => { setDecisionId(null); setHazard(null); }, blocking: Boolean(decisionId || hazard), decision: room && floor ? (map: number[][]) => roomDecision(floor, room, playerRef.current, map) : null };
}

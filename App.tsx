
import React, { useState, useEffect, useRef } from 'react';
import { generateDungeon } from './services/dungeonGenerator';
import { audioService } from './services/audioService';
import { generateLoot, XP_THRESHOLD, getLeaderboard, saveHighScore, saveGame, loadGame, hasSaveGame, createBoss, createEnemyEncounter, CRAFTING_RECIPES } from './services/gameLogic';
import { getBiomeIdForLevel, getLevelAssetPaths } from './data/assetRegistry';
import { getExplorationNarrative } from './data/narratives';
import { normalizePlayerWeaponVisuals } from './data/weaponVisuals';
import { TEXT, LanguageType } from './data/translations';
import { preloadAssets } from './services/assetLoader';
import { generatePerksForCharacter } from './services/progression';
import { calculatePlayerAttack, calculateSkillPower, createStatusEffect, damageEnemies, resolveStatusTurn, upsertStatusEffect } from './services/combat';
import { activateEnemyPhases, planEnemyIntents, resolveEnemyIntent, settleDefeatedEnemyTheft } from './services/enemyAI';
import Viewport from './components/Viewport';
import Controls from './components/Controls';
import Log from './components/Log';
import Minimap from './components/Minimap';
import MobileControls from './components/MobileControls';
import { Player, PlayerTransform, Character, TileType, GamePhase, LogEntry, BiomeId, Enemy, CombatMenu, VFXEvent, VFXType, Item, HighScore, Perk, ClassType, StatusType, Skill } from './types';
import { CLASSES, MAP_SIZE, MASTER_SKILL_POOL } from './constants';
import { DEFAULT_MOUSE_SENSITIVITY, MovementInput, angleToDirection, getLookInteraction, getTileCell, hasEnteredNewTile, moveFirstPerson, normalizeAngle, normalizePlayerTransform } from './services/firstPerson';

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 md:p-6 animate-fadeIn">
        <div className="bg-gray-950/95 border border-amber-100/25 rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90dvh]">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-lg shrink-0">
                <h2 className="text-xl font-bold text-yellow-500 font-serif tracking-wider">{title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white font-bold px-2">✕</button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                {children}
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
  const [map, setMap] = useState<number[][]>([]);
  const [decorations, setDecorations] = useState<number[][]>([]);
  const [explored, setExplored] = useState<boolean[][]>([]);
  const [clearedTiles, setClearedTiles] = useState<Set<string>>(new Set());
  const [player, setPlayer] = useState<Player>({
    pos: { x: 1, y: 1 },
    dir: 'E',
    transform: { x: 1.5, y: 1.5, angle: 0 },
    party: [],
    inventory: [],
    scrap: 0
  });
  const [isMoving, setIsMoving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [currentInteraction, setCurrentInteraction] = useState<ReturnType<typeof getLookInteraction>>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [fallbackLookActive, setFallbackLookActive] = useState(false);
  const [mouseSensitivity, setMouseSensitivity] = useState(DEFAULT_MOUSE_SENSITIVITY);
  
  // Settings State
  const [language, setLanguage] = useState<LanguageType>('EN');
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);

  // Selection State
  const [selectedClasses, setSelectedClasses] = useState<ClassType[]>([]);

  const [phase, setPhase] = useState<GamePhase>('MENU');
  const [prevPhase, setPrevPhase] = useState<GamePhase>('MENU');
  const [combatMenu, setCombatMenu] = useState<CombatMenu>('MAIN');
  const [biomeId, setBiomeId] = useState<BiomeId>('dungeon');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [vfx, setVfx] = useState<VFXEvent | null>(null);
  const [dungeonLevel, setDungeonLevel] = useState(1);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [canContinue, setCanContinue] = useState(false);
  
  // Party Combat State
  const [activeCharIndex, setActiveCharIndex] = useState(0);

  // Leaderboard State
  const [playerName, setPlayerName] = useState('');
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  // Level Up State
  const [levelUpOptions, setLevelUpOptions] = useState<Perk[]>([]);
  const [levelUpQueue, setLevelUpQueue] = useState<number[]>([]); 
  
  // Level Transition Refs
  const pendingLevelChangeRef = useRef(false);
  
  // Boss State
  const [levelBossDefeated, setLevelBossDefeated] = useState(false);

  // UI State for Menu
  const [viewCharIndex, setViewCharIndex] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null); // For Skill Detail View
  
  const enemiesRef = useRef<Enemy[]>([]);
  const playerRef = useRef<Player>(player);
  const transformRef = useRef<PlayerTransform>({ x: 1.5, y: 1.5, angle: 0 });
  const keyboardInputRef = useRef<MovementInput>({ forward: 0, strafe: 0, turn: 0 });
  const touchInputRef = useRef<Pick<MovementInput, 'forward' | 'strafe'>>({ forward: 0, strafe: 0 });
  const pressedKeysRef = useRef(new Set<string>());
  const lastProcessedCellRef = useRef<{ x: number; y: number } | null>(null);
  const lastInteractionKeyRef = useRef('');
  const encounterPendingRef = useRef(false);
  const walkingDistanceRef = useRef(0);
  const stepCounterRef = useRef(0);
  const movingRef = useRef(false);

  useEffect(() => {
    playerRef.current = { ...player, transform: transformRef.current };
  }, [player]);

  useEffect(() => {
    let active = true;
    preloadAssets(getLevelAssetPaths(1))
      .then(() => { if (active) setAssetsLoaded(true); })
      .catch(error => {
        console.error(error);
        if (active) setAssetLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setCanContinue(hasSaveGame());
    const storedLang = localStorage.getItem('aether_lang') as LanguageType;
    if (storedLang && TEXT[storedLang]) setLanguage(storedLang);
    const storedMusic = localStorage.getItem('aether_music');
    if (storedMusic !== null) {
        const enabled = storedMusic === 'true';
        setMusicOn(enabled);
        audioService.setMusicEnabled(enabled);
    }
    const storedSfx = localStorage.getItem('aether_sfx');
    if (storedSfx !== null) {
        const enabled = storedSfx === 'true';
        setSfxOn(enabled);
        audioService.setSfxEnabled(enabled);
    }
    const storedSensitivity = Number(localStorage.getItem('aether_mouse_sensitivity'));
    if (Number.isFinite(storedSensitivity) && storedSensitivity >= 0.001 && storedSensitivity <= 0.006) {
        setMouseSensitivity(storedSensitivity);
    }
  }, []);
  
  useEffect(() => {
    if (phase === 'MENU') {
        setCanContinue(hasSaveGame());
    }
  }, [phase]);

  useEffect(() => {
      enemiesRef.current = enemies;
  }, [enemies]);

  const toggleLanguage = () => {
      const langs = Object.keys(TEXT) as LanguageType[];
      const currentIndex = langs.indexOf(language);
      const nextIndex = (currentIndex + 1) % langs.length;
      const newLang = langs[nextIndex];
      setLanguage(newLang);
      localStorage.setItem('aether_lang', newLang);
  };

  const toggleMusic = () => {
      const newVal = !musicOn;
      setMusicOn(newVal);
      audioService.setMusicEnabled(newVal);
      localStorage.setItem('aether_music', String(newVal));
  };

  const toggleSfx = () => {
      const newVal = !sfxOn;
      setSfxOn(newVal);
      audioService.setSfxEnabled(newVal);
      localStorage.setItem('aether_sfx', String(newVal));
  };

  const handleQuitApp = () => {
      window.location.reload(); 
  };
  
  const handleReturnToMenu = () => {
      setMapOpen(false);
      setPrevPhase('MENU');
      setPhase('MENU');
  };

  const T = TEXT[language];

  const openModal = (newPhase: GamePhase) => {
      if (phase === 'GAME_OVER' || phase === 'INIT' || phase === 'LEVEL_UP' || phase === 'CLASS_SELECT') return;
      if (phase !== newPhase) {
          if (phase === 'EXPLORE' || phase === 'COMBAT') {
              setPrevPhase(phase);
          } 
          setPhase(newPhase);
      }
  };

  const closeModal = () => {
      setPhase(prevPhase);
      setSelectedSkill(null);
  };

  const applyMouseLook = (deltaX: number) => {
      if (!Number.isFinite(deltaX) || phase !== 'EXPLORE') return;
      const transform = { ...transformRef.current, angle: normalizeAngle(transformRef.current.angle + deltaX * mouseSensitivity) };
      transformRef.current = transform;
      playerRef.current = { ...playerRef.current, transform };
  };

  const requestPointerLock = (canvas: HTMLCanvasElement) => {
      if (typeof canvas.requestPointerLock !== 'function') {
          setFallbackLookActive(true);
          return;
      }
      try {
          const result = canvas.requestPointerLock() as void | Promise<void>;
          if (result && typeof result.catch === 'function') {
              result.catch(() => setFallbackLookActive(true));
          }
      } catch {
          setFallbackLookActive(true);
      }
  };

  const setTouchMovement = (input: Pick<MovementInput, 'forward' | 'strafe'>) => {
      touchInputRef.current = input;
  };

  const triggerVfx = (type: VFXType, targetId?: string) => {
      setVfx({ type, id: Date.now(), targetId });
  };

  const updateExplored = (pos: {x:number, y:number}, currentExplored: boolean[][]) => {
      if (!currentExplored.length) return [];
      const newExplored = currentExplored.map(row => [...row]);
      for (let y = pos.y - 1; y <= pos.y + 1; y++) {
          for (let x = pos.x - 1; x <= pos.x + 1; x++) {
              if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
                  newExplored[y][x] = true;
              }
          }
      }
      return newExplored;
  };

  const generateLevel = async (level: number) => {
      setPhase('INIT');
      setAssetsLoaded(false);
      setAssetLoadError(null);
      const nextBiome = getBiomeIdForLevel(level);
      try {
          await preloadAssets(getLevelAssetPaths(level));
      } catch (error) {
          console.error(error);
          setAssetLoadError(error instanceof Error ? error.message : String(error));
          return;
      }

      setDungeonLevel(level);
      setBiomeId(nextBiome);
      setLevelBossDefeated(false);
      pendingLevelChangeRef.current = false;
      setClearedTiles(new Set()); // Reset cleared tiles for new level
      
      const { map: newMap, decorations: newDecorations } = generateDungeon(nextBiome);
      setMap(newMap);
      setDecorations(newDecorations);

      let sx = 1, sy = 1;
      if (newMap[sy][sx] !== TileType.EMPTY) {
          for(let y=1; y<MAP_SIZE; y++) for(let x=1; x<MAP_SIZE; x++) if(newMap[y][x] === TileType.EMPTY) { sx=x; sy=y; break;}
      }
      const nextTransform = { x: sx + 0.5, y: sy + 0.5, angle: transformRef.current.angle };
      transformRef.current = nextTransform;
      lastProcessedCellRef.current = { x: sx, y: sy };
      encounterPendingRef.current = false;
      setPlayer(p => ({ ...p, pos: { x: sx, y: sy }, dir: angleToDirection(nextTransform.angle), transform: nextTransform }));
      
      let initExplored = Array(MAP_SIZE).fill(false).map(() => Array(MAP_SIZE).fill(false));
      initExplored = updateExplored({x: sx, y: sy}, initExplored);
      setExplored(initExplored);

      setPhase('EXPLORE');
      setAssetsLoaded(true);
      addLog(`Entered Dungeon Level ${level}.`, 'story');
  };

  // --- MENU HANDLERS ---
  const handleNewGame = () => {
      setPhase('CLASS_SELECT');
      setSelectedClasses([]);
      audioService.startMusic();
  };

  const handleClassSelect = (classType: ClassType) => {
      if (selectedClasses.includes(classType)) {
          setSelectedClasses(prev => prev.filter(c => c !== classType));
      } else {
          if (selectedClasses.length < 3) {
              setSelectedClasses(prev => [...prev, classType]);
          }
      }
  };

  const handleStartAdventure = () => {
      if (selectedClasses.length !== 3) return;
      const newParty: Character[] = selectedClasses.map((cKey, i) => {
          const template = CLASSES[cKey];
          const inv = [...template.startItems];
          let equip = { weapon: null as Item|null, armor: null as Item|null, offhand: null as Item|null, accessory: null as Item|null };
          const wIdx = inv.findIndex(it => it.type === 'WEAPON');
          if(wIdx>-1) { equip.weapon = inv[wIdx]; inv.splice(wIdx,1); }
          const sIdx = inv.findIndex(it => it.type === 'SHIELD');
          if(sIdx>-1) { equip.offhand = inv[sIdx]; inv.splice(sIdx,1); }
          return {
              id: `char_${i}_${Date.now()}`, name: template.name, classType: cKey, stats: { ...template.stats },
              equipment: equip, skills: [...template.startSkills], statusEffects: [], isDefending: false
          };
      });
      const sharedItems: Item[] = [
          { id: 'potion_hp_start', name: 'Health Potion', type: 'POTION', value: 30, description: 'Restores HP', icon: '🍷', quantity: 3 },
          { id: 'potion_mp_start', name: 'Mana Potion', type: 'POTION', value: 30, description: 'Restores MP', icon: '🧪', quantity: 2 }
      ];
      const startTransform = { x: 1.5, y: 1.5, angle: 0 };
      transformRef.current = startTransform;
      lastProcessedCellRef.current = { x: 1, y: 1 };
      encounterPendingRef.current = false;
      stepCounterRef.current = 0;
      keyboardInputRef.current = { forward: 0, strafe: 0, turn: 0 };
      touchInputRef.current = { forward: 0, strafe: 0 };
      setPlayer({ pos: { x: 1, y: 1 }, dir: 'E', transform: startTransform, party: newParty, inventory: sharedItems, scrap: 0 });
      setLogs([]);
      setEnemies([]);
      generateLevel(1);
  };

  const handleContinue = async () => {
      const saved = loadGame();
      if (!saved) return;
      
      setPhase('INIT'); // Show loading screen
      setAssetsLoaded(false);
      setAssetLoadError(null);
      try {
          await preloadAssets(getLevelAssetPaths(saved.dungeonLevel));
      } catch (error) {
          console.error(error);
          setAssetLoadError(error instanceof Error ? error.message : String(error));
          return;
      }

      const restoredPlayer = normalizePlayerWeaponVisuals(saved.player);
      const restoredTransform = normalizePlayerTransform(restoredPlayer.transform, restoredPlayer.pos, restoredPlayer.dir);
      transformRef.current = restoredTransform;
      lastProcessedCellRef.current = getTileCell(restoredTransform);
      encounterPendingRef.current = false;
      keyboardInputRef.current = { forward: 0, strafe: 0, turn: 0 };
      touchInputRef.current = { forward: 0, strafe: 0 };
      setPlayer({ ...restoredPlayer, pos: getTileCell(restoredTransform), transform: restoredTransform });
      setMap(saved.map);
      setDecorations(saved.decorations);
      setExplored(saved.explored);
      setDungeonLevel(saved.dungeonLevel);
      setBiomeId(getBiomeIdForLevel(saved.dungeonLevel));
      setLogs(saved.logs);
      setLevelBossDefeated(saved.levelBossDefeated || false);
      setClearedTiles(new Set(saved.clearedTiles ?? []));
      setMapOpen(false);
      lastInteractionKeyRef.current = '';
      setCurrentInteraction(null);
      
      setPhase('EXPLORE');
      setAssetsLoaded(true);
      addLog("Game Loaded.", 'info');
      audioService.startMusic();
  };

  const handleSaveGame = () => {
      const saved = saveGame({
          player: { ...playerRef.current, transform: transformRef.current }, map, decorations, explored, dungeonLevel, logs, date: Date.now(), 
          levelBossDefeated, 
          clearedTiles: Array.from(clearedTiles) 
      });
      if (!saved) {
          addLog('Save failed. Browser storage may be full or unavailable.', 'info');
          return;
      }
      setCanContinue(true);
      addLog("Game Saved.", 'loot');
      audioService.playItemGet();
  };

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), text, type }]);
  };

  const commitEnemies = (nextEnemies: Enemy[], syncScrapRefund = true): { enemies: Enemy[]; refundedScrap: number } => {
      const phaseUpdate = activateEnemyPhases(nextEnemies);
      phaseUpdate.logs.forEach(line => addLog(line, 'combat'));
      const newlyPhasedNecromancer = phaseUpdate.logs.length
          ? phaseUpdate.enemies.find(enemy => enemy.definitionId === 'the_necromancer' && enemy.phase === 2)
          : undefined;
      if (newlyPhasedNecromancer) triggerVfx('DARK', newlyPhasedNecromancer.id);
      const theft = settleDefeatedEnemyTheft(phaseUpdate.enemies);
      const committed = theft.enemies;
      const refundedScrap = theft.refundedScrap;
      theft.logs.forEach(line => addLog(line, 'loot'));
      enemiesRef.current = committed;
      setEnemies(committed);
      if (selectedEnemyId && !committed.some(enemy => enemy.id === selectedEnemyId && enemy.hp > 0)) {
          setSelectedEnemyId(committed.find(enemy => enemy.hp > 0)?.id ?? null);
      }
      if (syncScrapRefund && refundedScrap > 0) {
          playerRef.current = { ...playerRef.current, scrap: playerRef.current.scrap + refundedScrap };
          setPlayer(player => ({ ...player, scrap: player.scrap + refundedScrap }));
      }
      return { enemies: committed, refundedScrap };
  };

  const addToInventory = (item: Item) => {
      setPlayer(p => {
          const newInv = [...p.inventory];
          const existing = newInv.find(i => i.name === item.name);
          if (existing) {
              existing.quantity += item.quantity;
          } else {
              newInv.push(item);
          }
          return { ...p, inventory: newInv };
      });
  };

  const handleCraft = (recipeId: string) => {
      const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
      if (!recipe) return;
      
      if (player.scrap < recipe.cost) {
          addLog("Not enough scrap!", 'info');
          return;
      }
      
      setPlayer(p => ({ ...p, scrap: p.scrap - recipe.cost }));
      audioService.playItemGet();
      
      if (recipe.id.startsWith('gamble')) {
          const loot = generateLoot(dungeonLevel, true); // Gamble gives better items (boss loot pool)
          if (loot) {
              addToInventory(loot);
              addLog(`Crafted ${loot.name}!`, 'loot');
          } else {
              // Fallback if loot gen fails (should be rare for boss pool)
              addToInventory({ id: `scrap_junk_${Date.now()}`, name: "Useless Junk", type: 'ACCESSORY', value: 0, description: "Better luck next time.", icon: "💩", quantity: 1 });
              addLog("Crafting failed... you got junk.", 'info');
          }
      } else if (recipe.type === 'POTION') {
          // Hardcoded potions
           if (recipe.id === 'potion_hp') addToInventory({ id: `potion_hp_${Date.now()}`, name: 'Health Potion', description: 'Restores 30 HP', type: 'POTION', value: 30, icon: '🍷', quantity: 1 });
           if (recipe.id === 'potion_mp') addToInventory({ id: `potion_mp_${Date.now()}`, name: 'Mana Potion', description: 'Restores 30 MP', type: 'POTION', value: 30, icon: '🧪', quantity: 1 });
           addLog(`Crafted ${recipe.name}.`, 'loot');
      }
  };

  // --- STATUS EFFECTS ---
  const applyStatus = (target: Character | Enemy, type: StatusType, duration: number, val: number, isPlayer: boolean) => {
      if (!isPlayer && type === 'STUN' && 'isBoss' in target && target.isBoss && Math.random() < (target.stunResistance ?? 0.5)) {
          addLog(`${target.name} resists the stun.`, 'combat');
          return;
      }
      const newEffect = createStatusEffect(type, duration, val);

      if (isPlayer) {
          setPlayer(p => {
              const newParty = p.party.map(c => {
                  if (c.id === target.id) {
                      return { ...c, statusEffects: upsertStatusEffect(c.statusEffects, newEffect) };
                  }
                  return c;
              });
              return { ...p, party: newParty };
          });
      } else {
          const updatedEnemies = enemiesRef.current.map(e => e.id === target.id
              ? { ...e, statusEffects: upsertStatusEffect(e.statusEffects || [], newEffect) }
              : e);
          commitEnemies(updatedEnemies);
      }
      addLog(`${target.name} gained ${type}!`, 'combat');
  };

  const processStatusEffects = (character: Character): boolean => {
      const result = resolveStatusTurn(character.stats.hp, character.stats.maxHp, character.statusEffects);

      result.ticks.forEach(({ type, value }) => {
          if (type === 'POISON') { addLog(`${character.name} takes ${value} poison dmg.`, 'combat'); triggerVfx('POISON', character.id); }
          if (type === 'BURN') { addLog(`${character.name} burns for ${value}.`, 'combat'); triggerVfx('FIREBALL', character.id); }
          if (type === 'REGEN') { addLog(`${character.name} regenerates ${value}.`, 'combat'); triggerVfx('HEAL', character.id); }
      });

      setPlayer(p => ({
          ...p,
          party: p.party.map(c => c.id === character.id
              ? { ...c, stats: { ...c.stats, hp: result.hp }, statusEffects: result.statusEffects }
              : c),
      }));
      return result.defeated;
  };


  // --- LEVEL UP ---
  const triggerLevelUp = (currentParty?: Character[]) => {
      const partyToCheck = currentParty || player.party;
      const levelingIndices: number[] = [];
      
      const newParty = partyToCheck.map((c, i) => {
           if (c.stats.hp <= 0) return c; 
           const threshold = XP_THRESHOLD(c.stats.level);
           if (c.stats.xp < threshold) return c; 
           levelingIndices.push(i);
           return {
               ...c,
               stats: {
                   ...c.stats, level: c.stats.level + 1, maxHp: c.stats.maxHp + 15, hp: c.stats.hp + 15, 
                   maxMp: c.stats.maxMp + 5, mp: c.stats.mp + 5, str: c.stats.str + 1, dex: c.stats.dex + 1,
                   int: c.stats.int + 1, xp: c.stats.xp - threshold
               }
           };
      });

      if (levelingIndices.length > 0) {
          setPlayer(p => ({ ...p, party: newParty }));
          setLevelUpQueue(levelingIndices);
          const firstChar = newParty[levelingIndices[0]];
          setLevelUpOptions(generatePerksForCharacter(firstChar));
          setPhase('LEVEL_UP');
          audioService.playLevelUp();
      } else {
          if (pendingLevelChangeRef.current) { generateLevel(dungeonLevel + 1); } else { setPhase('EXPLORE'); }
      }
  };

  const handlePerkSelect = (perk: Perk) => {
      const charIndex = levelUpQueue[0];
      if (perk.id === 'heal_self') {
          setPlayer(p => {
              const np = [...p.party];
              np[charIndex] = { ...np[charIndex], stats: { ...np[charIndex].stats, hp: np[charIndex].stats.maxHp, mp: np[charIndex].stats.maxMp } };
              return { ...p, party: np };
          });
      } else if (perk.type === 'UPGRADE') {
          setPlayer(p => {
              const np = [...p.party];
              const char = { ...np[charIndex] };
              char.skills = char.skills.map(s => s.id === perk.skillId ? { ...s, level: s.level + 1 } : s);
              np[charIndex] = char;
              addLog(`${char.name} upgraded ${perk.skillId}!`, 'levelup');
              return { ...p, party: np };
          });
      } else {
          const skill = MASTER_SKILL_POOL.find(s => s.id === perk.skillId);
          if (skill) {
             setPlayer(p => {
                 const np = [...p.party];
                 np[charIndex] = { ...np[charIndex], skills: [...np[charIndex].skills, skill] };
                 addLog(`${np[charIndex].name} learned ${skill.name}!`, 'levelup');
                 return { ...p, party: np };
             });
          }
      }
      const newQueue = levelUpQueue.slice(1);
      setLevelUpQueue(newQueue);
      if (newQueue.length > 0) {
          const nextChar = player.party[newQueue[0]];
          setLevelUpOptions(generatePerksForCharacter(nextChar));
      } else {
          if (pendingLevelChangeRef.current) { generateLevel(dungeonLevel + 1); } else { setPhase('EXPLORE'); }
      }
  };


  // --- COMBAT SYSTEM ---

  const startCombat = (isBoss = false) => {
      // CLEAR OLD ENEMIES TO PREVENT DOUBLE SPAWNS
      setEnemies([]);
      enemiesRef.current = [];
      setSelectedEnemyId(null);
      
      setPhase('COMBAT');
      setCombatMenu('MAIN');
      setIsPlayerTurn(false);
      setActiveCharIndex(0);
      if (isBoss) { addLog("BOSS BATTLE INITIATED!", 'combat'); audioService.stopMusic(); } else { addLog("Enemies approaching!", 'combat'); }
      audioService.playBump();
      
      const encounter: Enemy[] = isBoss
          ? [createBoss(dungeonLevel, dungeonLevel % 5 === 0)]
          : createEnemyEncounter(dungeonLevel);
      const newEnemies = planEnemyIntents(encounter, playerRef.current.scrap);
      setEnemies(newEnemies);
      enemiesRef.current = newEnemies; 
      setSelectedEnemyId(newEnemies[0].id);
      setTimeout(() => startPlayerTurn(0), 420);
  };

  const startPlayerTurn = (charIndex: number) => {
      const currentEnemies = enemiesRef.current; 
      if (currentEnemies.length > 0 && currentEnemies.every(e => e.hp <= 0)) { endCombat(true); return; }
      if (charIndex >= player.party.length) { enemyTurn(); return; }
      const character = player.party[charIndex];
      if (character.stats.hp <= 0) { startPlayerTurn(charIndex + 1); return; }
      const isStunned = character.statusEffects.some(e => e.type === 'STUN');
      const died = processStatusEffects(character);
      if (died) { startPlayerTurn(charIndex + 1); return; }
      if (isStunned) {
          addLog(`${character.name} is stunned!`, 'combat');
          setTimeout(() => startPlayerTurn(charIndex + 1), 350);
          return;
      }
      setActiveCharIndex(charIndex);
      setIsPlayerTurn(true);
      setCombatMenu('MAIN');
      setPlayer(p => {
          const np = [...p.party];
          np[charIndex].isDefending = false;
          return { ...p, party: np };
      });
  };

  const enemyTurn = async () => {
      const activeEnemyIds = enemiesRef.current.filter(enemy => enemy.hp > 0).map(enemy => enemy.id);
      if (activeEnemyIds.length === 0) { endCombat(true); return; }
      setIsPlayerTurn(false);

      for (const enemyId of activeEnemyIds) {
          const enemy = enemiesRef.current.find(candidate => candidate.id === enemyId);
          if (!enemy || enemy.hp <= 0) continue;
          await new Promise(r => setTimeout(r, 330));

          const currentPlayer = playerRef.current;
          if (!currentPlayer.party.some(character => character.stats.hp > 0)) {
              endCombat(false);
              return;
          }
          const previousParty = currentPlayer.party;
          const resolution = resolveEnemyIntent(enemyId, enemiesRef.current, previousParty, currentPlayer.scrap);
          const committed = commitEnemies(resolution.enemies, false);
          const nextPlayer = {
              ...currentPlayer,
              party: resolution.party,
              scrap: resolution.scrap + committed.refundedScrap,
          };
          playerRef.current = nextPlayer;
          setPlayer(nextPlayer);

          resolution.logs.forEach(line => addLog(line, 'combat'));
          resolution.vfx.forEach(effect => triggerVfx(effect.type, effect.targetId));
          if (resolution.acted && resolution.vfx.some(effect => effect.type === 'DAMAGE')) audioService.playAttack();
          resolution.party.forEach(character => {
              const previous = previousParty.find(candidate => candidate.id === character.id);
              if (previous && previous.stats.hp > 0 && character.stats.hp <= 0) addLog(`${character.name} collapsed!`, 'combat');
          });

          if (!resolution.party.some(character => character.stats.hp > 0)) {
              endCombat(false);
              return;
          }
      }

      const remainingEnemies = enemiesRef.current.filter(enemy => enemy.hp > 0);
      if (!remainingEnemies.length) { endCombat(true); return; }
      commitEnemies(planEnemyIntents(enemiesRef.current, playerRef.current.scrap));
      startPlayerTurn(0);
  };

  const endCombat = (victory: boolean) => {
       encounterPendingRef.current = false;
       if (victory) {
           addLog("Victory!", 'combat');
           let totalXp = 0;
           enemiesRef.current.forEach(e => totalXp += e.xpReward);
           // USE PLAYER REF TO ENSURE WE HAVE LATEST STATE (e.g. dmg taken in last turn)
           const latestParty = playerRef.current.party;
           
           const xpPerChar = Math.floor(totalXp / latestParty.filter(c => c.stats.hp > 0).length) || 0;
           
           // CALCULATE NEW STATE IMMEDIATELY TO PASS TO LEVEL UP
           const newPartyState = latestParty.map(c => c.stats.hp > 0 ? { ...c, stats: { ...c.stats, xp: c.stats.xp + xpPerChar } } : c);

           setPlayer(p => ({ ...p, party: newPartyState }));
           
           // Mark current tile as cleared to prevent respawn
           const tileKey = `${playerRef.current.pos.x},${playerRef.current.pos.y}`;
           setClearedTiles(prev => new Set(prev).add(tileKey));
           
           addLog(`Party gained ${xpPerChar} XP each.`, 'loot');
           enemiesRef.current.forEach(e => {
               if (e.isSummoned || e.xpReward <= 0) return;
               const loot = generateLoot(dungeonLevel, e.isBoss);
               if (loot) { addToInventory(loot); addLog(`Found ${loot.name}!`, 'loot'); }
           });
           const boss = enemiesRef.current.find(e => e.isBoss);
           if (boss) {
               setLevelBossDefeated(true);
               pendingLevelChangeRef.current = true;
               if (dungeonLevel % 5 === 0) { addLog(`The ${boss.name} is defeated! The way down is open.`, 'story'); } 
               else { addLog(`The dungeon guardian falls. The exit is clear.`, 'story'); }
           }
           setEnemies([]);
           enemiesRef.current = [];
           
           // TRIGGER LEVEL UP WITH NEW STATE
           triggerLevelUp(newPartyState);
           audioService.startMusic();
       } else {
           setPhase('GAME_OVER');
           audioService.stopMusic();
       }
  };

  // --- ACTIONS ---

  const handleInteract = () => {
      if (phase !== 'EXPLORE') return;
      const target = getLookInteraction(map, decorations, transformRef.current);
      if (!target) return;

      if (target.kind === 'door') {
          setMap(previous => {
              const next = previous.map(row => [...row]);
              if (next[target.y]?.[target.x] === TileType.DOOR) next[target.y][target.x] = TileType.EMPTY;
              return next;
          });
          addLog('You open the door.', 'story');
          audioService.playBump();
      } else if (target.kind === 'exit') {
          if (!levelBossDefeated && !encounterPendingRef.current) {
              encounterPendingRef.current = true;
              addLog('A powerful foe guards the exit!', 'story');
              startCombat(true);
          } else {
              generateLevel(dungeonLevel + 1);
          }
      } else {
          const decorationType = decorations[target.y]?.[target.x] ?? target.decorationType;
          if (decorationType <= 1) return;
          setDecorations(previous => {
              const next = previous.map(row => [...row]);
              if (next[target.y]) next[target.y][target.x] = 0;
              return next;
          });
          audioService.playItemGet();
          const scrapAmount = Math.floor(Math.random() * 5) + 2;
          playerRef.current = { ...playerRef.current, scrap: playerRef.current.scrap + scrapAmount };
          setPlayer(previous => ({ ...previous, scrap: previous.scrap + scrapAmount }));

          let message = 'You search the remains.';
          if (decorationType === 2) message = 'You break open a barrel.';
          if (decorationType === 3) message = 'You open a crate.';
          if (decorationType === 4) message = 'You search the bones.';
          addLog(message + ' Found ' + scrapAmount + ' scrap.', 'loot');

          const roll = Math.random();
          if (roll < 0.02) {
              const loot = generateLoot(dungeonLevel, true);
              if (loot) {
                  addToInventory(loot);
                  addLog('JACKPOT! Found ' + loot.name + '!', 'loot');
                  triggerVfx('HEAL');
              }
          } else if (roll < 0.22) {
              const loot = generateLoot(dungeonLevel, false);
              if (loot) {
                  addToInventory(loot);
                  addLog('Hidden inside: ' + loot.name + '!', 'loot');
              }
          }
      }
      lastInteractionKeyRef.current = '';
      setCurrentInteraction(null);
  };

  const handleTileEntered = (x: number, y: number) => {
      const tile = map[y]?.[x];
      if (tile === TileType.EXIT) {
          if (!levelBossDefeated && !encounterPendingRef.current) {
              encounterPendingRef.current = true;
              addLog('A powerful foe guards the exit!', 'story');
              startCombat(true);
          } else {
              generateLevel(dungeonLevel + 1);
          }
          return;
      }

      stepCounterRef.current += 1;
      const neighbors = [map[y]?.[x + 1], map[y]?.[x - 1], map[y + 1]?.[x], map[y - 1]?.[x]];
      const decoration = decorations[y]?.[x] ?? 0;
      let interestScore = 0;
      if (neighbors.includes(TileType.DOOR)) interestScore += 3;
      if (decoration === 1) interestScore += 2;

      if (Math.random() < 0.05 + interestScore * 0.1) {
          addLog(getExplorationNarrative(
              dungeonLevel,
              neighbors.includes(TileType.DOOR),
              decoration === 1,
              stepCounterRef.current,
          ), 'story');
      }

      const tileKey = x + ',' + y;
      if (!encounterPendingRef.current && !levelBossDefeated && !clearedTiles.has(tileKey) && Math.random() < 0.05) {
          encounterPendingRef.current = true;
          startCombat();
      }
  };

  const handleAction = (action: string) => {
      if (phase === 'EXPLORE') {
          if (action === 'inventory') { setViewCharIndex(0); openModal('INVENTORY'); }
          if (action === 'skills') { setViewCharIndex(0); openModal('SKILLS'); }
          if (action === 'stats') { setViewCharIndex(0); openModal('STATS'); }
          if (action === 'craft') { openModal('CRAFTING'); }
          if (action === 'map') { setMapOpen(true); }
      }
      
      if (phase === 'COMBAT') {
          if (!isPlayerTurn) return;
          if (action === 'attack') {
             const target = enemiesRef.current.find(e => e.id === selectedEnemyId && e.hp > 0) || enemiesRef.current.find(e => e.hp > 0);
             if (!target) return;
             
             const char = player.party[activeCharIndex];
             const { damage: dmg, critical: isCrit } = calculatePlayerAttack(char);
             const newEnemies = damageEnemies(enemiesRef.current, target.id, dmg);
             commitEnemies(newEnemies);

             addLog(`${char.name} attacks ${target.name} for ${dmg}${isCrit ? ' (CRIT!)' : ''}.`, 'combat');
             triggerVfx(isCrit ? 'CRITICAL' : 'ATTACK', target.id);
             audioService.playAttack();
             
             if (newEnemies.find(enemy => enemy.id === target.id)?.hp === 0) {
                 addLog(`${target.name} died!`, 'combat');
                 triggerVfx('ENEMY_DEATH', target.id);
                 
                 // Auto-Target Next Enemy
                 const nextTarget = newEnemies.find(e => e.hp > 0 && e.id !== target.id);
                 if (nextTarget) setSelectedEnemyId(nextTarget.id);
                 else setSelectedEnemyId(null);
             }
             startPlayerTurn(activeCharIndex + 1);
          }
          if (action === 'defend') {
              setPlayer(p => { const np = [...p.party]; np[activeCharIndex].isDefending = true; return { ...p, party: np }; });
              addLog(`${player.party[activeCharIndex].name} defends.`, 'combat');
              audioService.playDefend();
              startPlayerTurn(activeCharIndex + 1);
          }
          if (action === 'skill') { setCombatMenu('SKILLS'); }
          if (action === 'item') { setCombatMenu('ITEMS'); }
          if (action === 'run') {
              if (Math.random() > 0.5 && !enemiesRef.current.some(e => e.isBoss)) {
                  addLog("Escaped safely!", 'combat');
                  endCombat(false);
                  setPhase('EXPLORE');
                  audioService.startMusic();
              } else {
                  addLog("Couldn't escape!", 'combat');
                  startPlayerTurn(activeCharIndex + 1);
              }
          }
      }
  };

  const handleSubAction = (type: 'skill' | 'item', id: string) => {
      const char = player.party[activeCharIndex];
      const targetEnemy = enemiesRef.current.find(e => e.id === selectedEnemyId && e.hp > 0) || enemiesRef.current.find(e => e.hp > 0);
      
      if (type === 'skill') {
          const skill = char.skills.find(s => s.id === id);
          if (!skill) return;
          if (char.stats.mp < skill.cost && skill.id !== 'soul_pact') { addLog("Not enough MP!", 'combat'); return; }
          
          if (skill.id === 'soul_pact') {
              // Custom Logic for Soul Pact (HP -> MP)
              const hpCost = 20;
              if (char.stats.hp <= hpCost) { addLog("Not enough HP!", 'combat'); return; }
               setPlayer(p => { 
                   const np = [...p.party]; 
                   np[activeCharIndex].stats.hp -= hpCost; 
                   np[activeCharIndex].stats.mp = Math.min(np[activeCharIndex].stats.maxMp, np[activeCharIndex].stats.mp + 40); 
                   return { ...p, party: np }; 
               });
               addLog(`${char.name} trades life for power.`, 'combat');
               triggerVfx('DARK', char.id);
               startPlayerTurn(activeCharIndex + 1);
               return;
          } else if (skill.id === 'sacrifice') {
               const hpCost = 15;
               if (char.stats.hp <= hpCost) { addLog("Too weak to sacrifice!", 'combat'); return; }
               setPlayer(p => { const np = [...p.party]; np[activeCharIndex].stats.hp -= hpCost; return { ...p, party: np }; });
          } else {
               setPlayer(p => { const np = [...p.party]; np[activeCharIndex].stats.mp -= skill.cost; return { ...p, party: np }; });
          }

          const power = calculateSkillPower(char, skill);

          if (skill.type === 'HEAL' || skill.type === 'BUFF') {
               let targetAlly = char;
               if (skill.targetType === 'ALLY') {
                   const sorted = [...player.party].sort((a,b) => (a.stats.hp/a.stats.maxHp) - (b.stats.hp/b.stats.maxHp));
                   targetAlly = sorted[0];
               }
               if (skill.type === 'HEAL') {
                   setPlayer(p => { const np = p.party.map(c => c.id === targetAlly.id ? { ...c, stats: { ...c.stats, hp: Math.min(c.stats.maxHp, c.stats.hp + power) } } : c); return { ...p, party: np }; });
                   addLog(`${char.name} heals ${targetAlly.name} for ${power}.`, 'combat');
                   triggerVfx('HEAL', targetAlly.id);
                   audioService.playHeal();
               } 
               else if (skill.type === 'BUFF' && skill.effect) {
                   applyStatus(targetAlly, skill.effect.type, skill.effect.duration, skill.effect.val, true);
                   triggerVfx('BUFF', targetAlly.id);
               }
          } else if (skill.type === 'DRAIN') {
              if (targetEnemy) {
                   const newEnemies = damageEnemies(enemiesRef.current, targetEnemy.id, power);
                   commitEnemies(newEnemies);
                   // Heal Self
                   const healAmt = Math.floor(power * 0.8);
                   setPlayer(p => { const np = [...p.party]; np[activeCharIndex].stats.hp = Math.min(np[activeCharIndex].stats.maxHp, np[activeCharIndex].stats.hp + healAmt); return { ...p, party: np }; });
                   addLog(`${char.name} drains ${power} life from ${targetEnemy.name}.`, 'combat');
                   triggerVfx('DARK', targetEnemy.id);
                   triggerVfx('HEAL', char.id);
                   
                   if (targetEnemy && newEnemies.find(e => e.id === targetEnemy.id && e.hp <= 0)) {
                       const nextTarget = newEnemies.find(e => e.hp > 0 && e.id !== targetEnemy.id);
                       if (nextTarget) setSelectedEnemyId(nextTarget.id); else setSelectedEnemyId(null);
                   }
              }
          } else {
              if (targetEnemy) {
                   const newEnemies = damageEnemies(enemiesRef.current, targetEnemy.id, power, skill.targetType === 'MULTI');
                   commitEnemies(newEnemies);
                   addLog(`${char.name} casts ${skill.name} for ${power} dmg!`, 'combat');
                   triggerVfx(skill.vfxType, targetEnemy.id);
                   audioService.playAttack();
                   if (skill.effect) {
                       const chance = Math.random();
                       if (chance < (skill.effect.chance || 1)) {
                           const t = skill.targetType === 'MULTI' ? enemiesRef.current : [targetEnemy];
                           t.forEach(e => { if (e.hp > 0) applyStatus(e, skill.effect!.type, skill.effect!.duration, skill.effect!.val, false); });
                       }
                   }
                   
                   // Check death for sub-action
                   if (skill.targetType === 'SINGLE' && targetEnemy && newEnemies.find(e => e.id === targetEnemy.id && e.hp <= 0)) {
                       const nextTarget = newEnemies.find(e => e.hp > 0 && e.id !== targetEnemy.id);
                       if (nextTarget) setSelectedEnemyId(nextTarget.id);
                       else setSelectedEnemyId(null);
                   }
              }
          }
      } else {
          const item = player.inventory.find(i => i.id === id);
          if (!item) return;
          if (item.quantity > 0) {
               if (item.type === 'POTION') {
                   setPlayer(p => {
                       const np = [...p.party];
                       if (item.id.includes('hp')) np[activeCharIndex].stats.hp = Math.min(np[activeCharIndex].stats.maxHp, np[activeCharIndex].stats.hp + item.value);
                       if (item.id.includes('mp')) np[activeCharIndex].stats.mp = Math.min(np[activeCharIndex].stats.maxMp, np[activeCharIndex].stats.mp + item.value);
                       const nInv = [...p.inventory];
                       const idx = nInv.findIndex(i => i.id === id);
                       if(idx > -1) { nInv[idx].quantity--; if(nInv[idx].quantity <= 0) nInv.splice(idx, 1); }
                       return { ...p, party: np, inventory: nInv };
                   });
                   addLog(`${char.name} used ${item.name}.`, 'combat');
                   triggerVfx('HEAL', char.id);
                   audioService.playHeal();
               }
          }
      }
      startPlayerTurn(activeCharIndex + 1);
  };
  
  const handleEquip = (itemId: string, charIndex: number) => {
      setPlayer(p => {
          const inv = [...p.inventory];
          const itemIdx = inv.findIndex(i => i.id === itemId);
          if (itemIdx === -1) return p;
          const item = inv[itemIdx];
          const char = p.party[charIndex];
          const newChar = { ...char, equipment: { ...char.equipment } };
          let oldItem: Item | null = null;
          if (item.type === 'WEAPON') { oldItem = newChar.equipment.weapon; newChar.equipment.weapon = { ...item, isEquipped: true }; } 
          else if (item.type === 'ARMOR') { oldItem = newChar.equipment.armor; newChar.equipment.armor = { ...item, isEquipped: true }; } 
          else if (item.type === 'SHIELD') { oldItem = newChar.equipment.offhand; newChar.equipment.offhand = { ...item, isEquipped: true }; } 
          else if (item.type === 'ACCESSORY') {
              oldItem = newChar.equipment.accessory; newChar.equipment.accessory = { ...item, isEquipped: true };
              if (item.statBonus) {
                   const val = item.value;
                   if (item.statBonus === 'STR') newChar.stats.str += val; if (item.statBonus === 'DEX') newChar.stats.dex += val;
                   if (item.statBonus === 'INT') newChar.stats.int += val; if (item.statBonus === 'HP') newChar.stats.maxHp += val;
                   if (item.statBonus === 'MP') newChar.stats.maxMp += val;
              }
          }
          if (oldItem) {
              if (oldItem.type === 'ACCESSORY' && oldItem.statBonus) {
                   const val = oldItem.value;
                   if (oldItem.statBonus === 'STR') newChar.stats.str -= val; if (oldItem.statBonus === 'DEX') newChar.stats.dex -= val;
                   if (oldItem.statBonus === 'INT') newChar.stats.int -= val; if (oldItem.statBonus === 'HP') newChar.stats.maxHp -= val;
                   if (oldItem.statBonus === 'MP') newChar.stats.maxMp -= val;
              }
              const existing = inv.find(i => i.id === oldItem!.id);
              if (existing) existing.quantity++; else inv.push({ ...oldItem, isEquipped: false });
          }
          inv[itemIdx].quantity--; if (inv[itemIdx].quantity <= 0) inv.splice(itemIdx, 1);
          const newParty = [...p.party]; newParty[charIndex] = newChar;
          return { ...p, party: newParty, inventory: inv };
      });
      audioService.playItemGet();
  };

  const handleScrap = (itemId: string) => {
      setPlayer(p => {
          const inv = [...p.inventory];
          const idx = inv.findIndex(i => i.id === itemId);
          if (idx === -1) return p;
          inv[idx].quantity--; if (inv[idx].quantity <= 0) inv.splice(idx, 1);
          return { ...p, inventory: inv, scrap: p.scrap + 10 };
      });
  };

  // --- RENDER HELPERS ---
  const renderClassSelect = () => (
      <div className="flex flex-col items-center gap-4 h-full">
          <h2 className="text-xl text-yellow-500 font-bold mb-4">{T.ASSEMBLE} ({selectedClasses.length}/3)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto flex-1 w-full px-2">
              {Object.keys(CLASSES).map((key) => {
                  const cKey = key as ClassType; const cls = CLASSES[cKey]; const isSelected = selectedClasses.includes(cKey);
                  return (
                      <button key={key} onClick={() => handleClassSelect(cKey)} className={`p-3 border rounded text-left transition-all ${isSelected ? 'bg-yellow-900 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-gray-800 border-gray-600 hover:bg-gray-700'}`}>
                          <div className="font-bold text-sm mb-1">{cls.name}</div>
                          <div className="text-[10px] text-gray-400">{cls.description}</div>
                      </button>
                  );
              })}
          </div>
          <button onClick={handleStartAdventure} disabled={selectedClasses.length !== 3} className="mt-4 bg-green-700 text-white font-bold py-3 px-8 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 border-b-4 border-green-900 active:border-b-0 active:translate-y-1 w-full md:w-auto">{T.START_ADVENTURE}</button>
      </div>
  );


  useEffect(() => {
      const syncPointerLock = () => {
          const locked = Boolean(document.pointerLockElement?.hasAttribute('data-aether-viewport'));
          setIsPointerLocked(locked);
          if (locked) setFallbackLookActive(false);
      };
      document.addEventListener('pointerlockchange', syncPointerLock);
      return () => document.removeEventListener('pointerlockchange', syncPointerLock);
  }, []);

  useEffect(() => {
      if (phase === 'EXPLORE' && !mapOpen) return;
      if (document.pointerLockElement && typeof document.exitPointerLock === 'function') document.exitPointerLock();
      setFallbackLookActive(false);
      pressedKeysRef.current.clear();
      keyboardInputRef.current = { forward: 0, strafe: 0, turn: 0 };
      touchInputRef.current = { forward: 0, strafe: 0 };
      if (movingRef.current) {
          movingRef.current = false;
          setIsMoving(false);
      }
  }, [phase, mapOpen]);

  useEffect(() => {
      const onMouseMove = (event: MouseEvent) => {
          if (phase === 'EXPLORE' && document.pointerLockElement) applyMouseLook(event.movementX);
      };
      document.addEventListener('mousemove', onMouseMove);
      return () => document.removeEventListener('mousemove', onMouseMove);
  }, [phase, mouseSensitivity]);

  useEffect(() => {
      const isTextEntry = (target: EventTarget | null) => {
          const element = target as HTMLElement | null;
          return Boolean(element?.closest?.('input, textarea, select, [contenteditable="true"]'));
      };
      const refreshKeyboardInput = () => {
          const keys = pressedKeysRef.current;
          keyboardInputRef.current = {
              forward: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
              strafe: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
              turn: Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')),
          };
      };
      const onKeyDown = (event: KeyboardEvent) => {
          if (isTextEntry(event.target)) return;
          const code = event.code;

          if (code === 'Escape') {
              event.preventDefault();
              if (mapOpen) setMapOpen(false);
              else if (['INVENTORY', 'SKILLS', 'STATS', 'CRAFTING'].includes(phase)) closeModal();
              else if (phase === 'OPTIONS' && (prevPhase === 'EXPLORE' || prevPhase === 'COMBAT')) closeModal();
              else if (document.pointerLockElement && typeof document.exitPointerLock === 'function') document.exitPointerLock();
              else if (fallbackLookActive) setFallbackLookActive(false);
              else if (phase === 'EXPLORE' || phase === 'COMBAT') openModal('OPTIONS');
              return;
          }
          if (code === 'Tab' && phase === 'EXPLORE') {
              event.preventDefault();
              setMapOpen(value => !value);
              return;
          }
          if (mapOpen) return;

          if (code === 'KeyI' && phase === 'INVENTORY') { event.preventDefault(); closeModal(); return; }
          if (phase === 'EXPLORE') {
              if (code === 'KeyE') { event.preventDefault(); handleInteract(); return; }
              if (code === 'KeyI') { event.preventDefault(); handleAction('inventory'); return; }
              if (code === 'KeyC' || code === 'KeyK') { event.preventDefault(); handleAction('stats'); return; }
          }

          if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code) && phase === 'EXPLORE') {
              event.preventDefault();
              pressedKeysRef.current.add(code);
              refreshKeyboardInput();
          }
      };
      const onKeyUp = (event: KeyboardEvent) => {
          if (pressedKeysRef.current.delete(event.code)) refreshKeyboardInput();
      };
      const clearKeys = () => {
          pressedKeysRef.current.clear();
          keyboardInputRef.current = { forward: 0, strafe: 0, turn: 0 };
          touchInputRef.current = { forward: 0, strafe: 0 };
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clearKeys);
      return () => {
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('keyup', onKeyUp);
          window.removeEventListener('blur', clearKeys);
      };
  }, [phase, mapOpen, prevPhase, fallbackLookActive, handleInteract, handleAction, closeModal, openModal]);

  useEffect(() => {
      if (phase !== 'EXPLORE' || mapOpen || !map.length) return;
      let frame = 0;
      let previousTime = 0;
      let interactionTimer = 0;
      let previousCell = lastProcessedCellRef.current ?? getTileCell(transformRef.current);
      lastProcessedCellRef.current = previousCell;

      const tick = (time: number) => {
          const delta = previousTime ? Math.min(0.05, Math.max(0, (time - previousTime) / 1000)) : 0;
          previousTime = time;

          const keyboard = keyboardInputRef.current;
          const touch = touchInputRef.current;
          const input: MovementInput = {
              forward: Math.max(-1, Math.min(1, keyboard.forward + touch.forward)),
              strafe: Math.max(-1, Math.min(1, keyboard.strafe + touch.strafe)),
              turn: keyboard.turn,
          };
          const result = moveFirstPerson(map, transformRef.current, input, delta);
          const nextTransform = result.transform;
          transformRef.current = nextTransform;
          playerRef.current = { ...playerRef.current, transform: nextTransform };

          const moving = result.distance > 0.0001;
          if (moving !== movingRef.current) {
              movingRef.current = moving;
              setIsMoving(moving);
          }
          if (moving) {
              walkingDistanceRef.current += result.distance;
              while (walkingDistanceRef.current >= 0.9) {
                  walkingDistanceRef.current -= 0.9;
                  audioService.playStep();
              }
          }

          const cell = getTileCell(nextTransform);
          if (hasEnteredNewTile(previousCell, cell) && map[cell.y]?.[cell.x] !== undefined) {
              previousCell = cell;
              lastProcessedCellRef.current = cell;
              const updatedPlayer = {
                  ...playerRef.current,
                  pos: cell,
                  dir: angleToDirection(nextTransform.angle),
                  transform: nextTransform,
              };
              playerRef.current = updatedPlayer;
              setPlayer(previous => ({ ...previous, pos: cell, dir: updatedPlayer.dir, transform: nextTransform }));
              setExplored(previous => updateExplored(cell, previous));
              handleTileEntered(cell.x, cell.y);
          }

          interactionTimer += delta;
          if (interactionTimer >= 0.1) {
              interactionTimer = 0;
              const target = getLookInteraction(map, decorations, nextTransform);
              const targetKey = target ? target.kind + ':' + target.x + ',' + target.y : '';
              if (targetKey !== lastInteractionKeyRef.current) {
                  lastInteractionKeyRef.current = targetKey;
                  setCurrentInteraction(target);
              }
          }
          frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
  }, [phase, map, mapOpen, decorations, levelBossDefeated, dungeonLevel, clearedTiles]);

  const handleFallbackLook = (deltaX: number) => applyMouseLook(deltaX);
  const endFallbackLook = () => setFallbackLookActive(false);
  const updateMouseSensitivity = (value: number) => {
      const next = Math.max(0.001, Math.min(0.006, value));
      setMouseSensitivity(next);
      localStorage.setItem('aether_mouse_sensitivity', String(next));
  };

  if (!assetsLoaded) {
    return (
      <div className="w-full h-screen bg-zinc-950 text-gray-200 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl text-amber-400 font-bold mb-4">AETHER CRAWL</h1>
        {assetLoadError
          ? <><p className="text-red-300 mb-3">A required local game asset could not be loaded.</p><code className="max-w-2xl break-all text-xs text-red-200">{assetLoadError}</code></>
          : <><p className="text-sm text-gray-300">Loading local game assets…</p><div className="mt-4 h-2 w-56 overflow-hidden rounded bg-gray-800"><div className="h-full w-1/2 animate-pulse bg-amber-500" /></div></>}
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 p-0 text-gray-200 select-none">
      {phase === 'MENU' && (
        <div className="flex flex-col gap-6 items-center animate-fadeIn max-w-md w-full">
            <h1 className="text-4xl md:text-6xl font-bold text-yellow-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] text-center tracking-tighter">AETHER<br/>CRAWL</h1>
            <div className="flex flex-col gap-3 w-full">
                {canContinue && <button onClick={handleContinue} className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded border-b-4 border-blue-900 active:border-b-0 active:translate-y-1">{T.CONTINUE}</button>}
                <button onClick={handleNewGame} className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded border-b-4 border-red-900 active:border-b-0 active:translate-y-1">{T.NEW_GAME}</button>
                <button onClick={() => { setPrevPhase('MENU'); setPhase('OPTIONS'); }} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded border-b-4 border-gray-900 active:border-b-0 active:translate-y-1">{T.OPTIONS}</button>
                <button onClick={handleQuitApp} className="bg-zinc-800 hover:bg-zinc-700 text-gray-400 font-bold py-3 rounded border-b-4 border-black active:border-b-0 active:translate-y-1">{T.EXIT}</button>
            </div>
            <div className="text-xs text-gray-500 mt-8">v1.4.0 - Retro Dungeon Crawler</div>
        </div>
      )}

      {/* Options */}
      {phase === 'OPTIONS' && (
          <div className="relative z-40 bg-gray-900/95 p-6 rounded-xl border border-gray-500/50 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold text-yellow-500 mb-6 text-center">{T.OPTIONS}</h2>
              <div className="space-y-4">
                  <div className="flex justify-between items-center"><span>{T.MUSIC}</span><button onClick={toggleMusic} className={`w-12 h-6 rounded-full relative transition-colors ${musicOn ? 'bg-green-600' : 'bg-gray-600'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${musicOn ? 'translate-x-6' : ''}`}></div></button></div>
                  <div className="flex justify-between items-center"><span>{T.SFX}</span><button onClick={toggleSfx} className={`w-12 h-6 rounded-full relative transition-colors ${sfxOn ? 'bg-green-600' : 'bg-gray-600'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${sfxOn ? 'translate-x-6' : ''}`}></div></button></div>
                  <label className="flex flex-col gap-2 text-sm"><span className="flex justify-between"><span>Mouse sensitivity</span><span className="text-amber-300">{mouseSensitivity.toFixed(4)}</span></span><input aria-label="Mouse sensitivity" type="range" min="0.001" max="0.006" step="0.0001" value={mouseSensitivity} onChange={event => updateMouseSensitivity(Number(event.target.value))} className="w-full accent-amber-400" /></label>
                  <div className="flex justify-between items-center"><span>{T.LANGUAGE}</span><button onClick={toggleLanguage} className="bg-gray-700 px-3 py-1 rounded border border-gray-500">{language}</button></div>
              </div>
              <button onClick={() => (prevPhase === 'EXPLORE' || prevPhase === 'COMBAT') ? closeModal() : setPhase('MENU')} className="mt-8 w-full bg-gray-700 py-2 rounded font-bold hover:bg-gray-600">{T.MENU}</button>
          </div>
      )}
      {phase === 'CLASS_SELECT' && (<div className="w-full max-w-4xl h-[80vh] bg-gray-900 border-2 border-gray-700 rounded-lg p-4">{renderClassSelect()}</div>)}
      {phase === 'INIT' && (<div className="relative z-10 text-center animate-pulse"><h2 className="text-2xl text-yellow-500 font-bold mb-2">{T.GENERATING}</h2><div className="w-64 h-4 bg-gray-800 rounded-full overflow-hidden mx-auto border border-gray-600"><div className="h-full bg-yellow-500 animate-[width_2s_ease-in-out_infinite] w-full origin-left"></div></div></div>)}
      {phase === 'GAME_OVER' && (
          <div className="text-center">
               <h1 className="text-5xl text-red-600 font-bold mb-4 glitch-effect">{T.DEFEAT}</h1>
               <p className="text-gray-400 mb-8">The dungeon claimed another soul.</p>
               {!scoreSubmitted ? (<div className="bg-gray-800 p-4 rounded border border-gray-600 inline-block"><input type="text" maxLength={10} placeholder="Enter Name" className="bg-black border border-gray-500 px-2 py-1 text-white mb-2 block w-full" value={playerName} onChange={e => setPlayerName(e.target.value.toUpperCase())}/><button onClick={() => { saveHighScore({ name: playerName || 'UNKNOWN', class: player.party.map(c => c.classType[0]).join('/'), dungeonLevel, charLevel: Math.floor(player.party.reduce((a,b)=>a+b.stats.level,0)/3), xp: player.party.reduce((a,b)=>a+b.stats.xp,0), date: new Date().toLocaleDateString() }); setScoreSubmitted(true); setHighScores(getLeaderboard()); }} className="bg-yellow-700 w-full py-1 text-sm font-bold hover:bg-yellow-600">{T.SUBMIT}</button></div>) : (<div className="bg-gray-900 p-4 rounded border border-gray-700 max-w-sm mx-auto text-left max-h-60 overflow-y-auto"><h3 className="text-yellow-500 text-xs mb-2 border-b border-gray-700 pb-1">LEADERBOARD</h3>{highScores.map((s, i) => (<div key={i} className="flex justify-between text-[10px] mb-1"><span>{i+1}. {s.name} ({s.class})</span><span>L{s.dungeonLevel}</span></div>))}</div>)}
               <button onClick={handleReturnToMenu} className="mt-8 block mx-auto bg-gray-700 px-6 py-2 rounded border border-gray-500 hover:bg-gray-600">{T.EXIT_TO_MENU}</button>
          </div>
      )}

      {isGameplayVisible && (
        <div className="absolute inset-0 z-0 overflow-hidden bg-black">
          <Viewport
            map={map}
            decorations={decorations}
            transformRef={transformRef}
            biomeId={biomeId}
            enemies={enemies}
            selectedEnemyId={selectedEnemyId}
            onSelectEnemy={setSelectedEnemyId}
            phase={phase}
            vfx={vfx}
            player={player}
            activeCharIndex={activeCharIndex}
            isMoving={isMoving}
            fallbackLookActive={fallbackLookActive}
            onRequestPointerLock={requestPointerLock}
            onFallbackLook={handleFallbackLook}
            onFallbackLookEnd={endFallbackLook}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 md:p-4">
            <div className="pointer-events-auto rounded-lg border border-white/10 bg-black/55 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
              <div className="font-bold tracking-wide text-amber-300">FLOOR {dungeonLevel}</div>
              <div className="mt-0.5 text-[10px] text-white/65">SCRAP {player.scrap}</div>
            </div>
            <div className="pointer-events-auto flex gap-2">
              <button onClick={handleSaveGame} className="rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-[10px] font-bold text-white/80 backdrop-blur-md hover:bg-black/75">SAVE</button>
              <button onClick={() => phase === 'EXPLORE' || phase === 'COMBAT' ? openModal('OPTIONS') : null} className="rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-[10px] font-bold text-white/80 backdrop-blur-md hover:bg-black/75">MENU</button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-3 top-16 z-10 flex max-w-[44vw] flex-col gap-1 md:left-4 md:top-20 md:max-w-[270px]">
            {player.party.map((character) => {
              const hpPercent = character.stats.maxHp > 0 ? Math.max(0, Math.min(100, (character.stats.hp / character.stats.maxHp) * 100)) : 0;
              return (
                <div key={character.id} className="rounded-md border border-white/10 bg-black/50 px-2 py-1.5 shadow-md backdrop-blur-md">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] md:text-xs">
                    <span className="truncate font-bold text-white/90">{character.name}</span>
                    <span className="shrink-0 font-mono text-white/70">{character.stats.hp}/{character.stats.maxHp}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded bg-white/15">
                    <div className={"h-full " + (hpPercent > 50 ? 'bg-emerald-400' : hpPercent > 25 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: hpPercent + '%' }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[8px] text-white/45">
                    <span>MP {character.stats.mp}/{character.stats.maxMp}</span>
                    <span className="flex gap-1 text-xs">{character.statusEffects.map(effect => <span key={effect.id} title={effect.type}>{effect.icon}</span>)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="absolute right-3 top-16 z-10 md:right-4 md:top-20">
            <Minimap map={map} explored={explored} transformRef={transformRef} size={124} />
            <button onClick={() => setMapOpen(true)} className="mt-1 w-full rounded border border-white/15 bg-black/55 py-1 text-[9px] font-bold text-white/70 backdrop-blur-md">TAB · MAP</button>
          </div>

          {gameplayPhase === 'COMBAT' && selectedEnemyId && (() => {
            const target = enemies.find(enemy => enemy.id === selectedEnemyId);
            if (!target || target.hp <= 0) return null;
            const hpPercent = Math.max(0, Math.min(100, (target.hp / target.maxHp) * 100));
            return (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-[min(420px,48vw)] -translate-x-1/2 rounded-lg border border-red-300/30 bg-black/70 p-2 text-center shadow-lg backdrop-blur-md">
                <div className="text-xs font-bold uppercase tracking-wide text-amber-300">
                  {target.name}{target.definitionId === 'the_necromancer' && target.phase === 2 ? ' · PHASE II' : ''}
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-white/15">
                  <div className={"h-full transition-all " + (hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: hpPercent + '%' }} />
                </div>
                <div className="mt-1 flex items-center justify-center gap-2 text-[9px] text-white/80">
                  <span>{target.hp}/{target.maxHp} HP</span>
                  {(target.guard ?? 0) > 0 && <span className="text-cyan-200">GUARD {target.guard}</span>}
                  {target.intent && <span>{target.intent.icon} {target.intent.shortLabel}</span>}
                  {target.intent?.minDamage !== undefined && target.intent?.maxDamage !== undefined && <span>{target.intent.minDamage}–{target.intent.maxDamage}</span>}
                </div>
              </div>
            );
          })()}

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className={"relative block h-4 w-4 rounded-full border " + (currentInteraction ? 'border-amber-200/90 bg-amber-200/20' : 'border-white/40')}>
              <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/75" />
            </span>
            {gameplayPhase === 'EXPLORE' && currentInteraction && (
              <span className="mt-3 rounded-full border border-amber-200/30 bg-black/75 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100 shadow-lg">
                E · {currentInteraction.kind === 'door' ? 'Open door' : currentInteraction.kind === 'exit' ? (levelBossDefeated ? 'Descend' : 'Challenge guardian') : 'Search'}
              </span>
            )}
          </div>

          {gameplayPhase === 'EXPLORE' && !isPointerLocked && !fallbackLookActive && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-black/45 px-3 py-1.5 text-[10px] text-white/60 backdrop-blur-sm lg:block">
              Click the view to capture the mouse · WASD to move · E to interact
            </div>
          )}
          {gameplayPhase === 'EXPLORE' && isPointerLocked && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-[9px] text-white/45 lg:block">
              ESC unlocks mouse · I inventory · TAB map
            </div>
          )}

          {logs.length > 0 && (
            <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden max-w-[360px] flex-col gap-1 rounded-lg border border-white/10 bg-black/45 p-2 text-[10px] text-white/65 backdrop-blur-sm lg:flex">
              {logs.slice(-2).map(entry => <div key={entry.id} className="truncate">{entry.text}</div>)}
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-black/60 p-2 shadow-xl backdrop-blur-md lg:flex">
            {gameplayPhase === 'EXPLORE' ? (
              <>
                <button onClick={() => handleAction('inventory')} className="hud-button">I · BAG</button>
                <button onClick={() => handleAction('skills')} className="hud-button">SKILLS</button>
                <button onClick={() => handleAction('stats')} className="hud-button">C · PARTY</button>
                <button onClick={() => handleAction('craft')} className="hud-button">CRAFT</button>
                <button onClick={() => setMapOpen(true)} className="hud-button">TAB · MAP</button>
                <button onClick={handleInteract} className="hud-button hud-button-accent">E · USE</button>
                <button onClick={handleReturnToMenu} className="hud-button">EXIT</button>
              </>
            ) : (
              <div className="w-[min(520px,55vw)]">
                <Controls onAction={handleAction} phase="COMBAT" combatMenu={combatMenu} activeCharacter={player.party[activeCharIndex] ?? null} inventory={player.inventory} onSubAction={handleSubAction} onBack={() => setCombatMenu('MAIN')} isPlayerTurn={isPlayerTurn} />
              </div>
            )}
          </div>

          {(phase === 'EXPLORE' || phase === 'COMBAT') && (
            <MobileControls
              phase={phase}
              combatMenu={combatMenu}
              activeCharacter={player.party[activeCharIndex] ?? null}
              inventory={player.inventory}
              isPlayerTurn={isPlayerTurn}
              onMoveInput={setTouchMovement}
              onLook={applyMouseLook}
              onInteract={handleInteract}
              onAction={handleAction}
              onSubAction={handleSubAction}
              onBack={() => setCombatMenu('MAIN')}
            />
          )}
        </div>
      )}

      {mapOpen && isGameplayVisible && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-2xl border border-amber-100/25 bg-slate-950/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold tracking-wide text-amber-200">DUNGEON MAP</h2>
                <p className="mt-1 text-[10px] text-white/45">Explored passages and your current facing</p>
              </div>
              <button onClick={() => setMapOpen(false)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:bg-white/10">CLOSE · TAB</button>
            </div>
            <div className="flex justify-center overflow-auto">
              <Minimap map={map} explored={explored} transformRef={transformRef} size={Math.min(480, Math.max(240, Math.floor(Math.min(window.innerWidth * 0.72, window.innerHeight * 0.66))))} />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {phase === 'INVENTORY' && (<Modal title={T.INVENTORY} onClose={closeModal}><div className="flex flex-col h-full"><div className="flex border-b border-gray-700 mb-2">{player.party.map((char, i) => (<button key={char.id} onClick={() => setViewCharIndex(i)} className={`flex-1 py-2 text-xs font-bold ${viewCharIndex === i ? 'bg-gray-700 text-yellow-500 border-t-2 border-yellow-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{char.name}</button>))}</div><div className="flex-1 overflow-y-auto mb-4"><h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Equipped</h3><div className="grid grid-cols-2 gap-2 mb-4">{['weapon', 'offhand', 'armor', 'accessory'].map(slot => { const item = (player.party[viewCharIndex].equipment as any)[slot]; return (<div key={slot} className="bg-black p-2 rounded border border-gray-700 flex items-center gap-2"><div className="w-8 h-8 bg-gray-900 flex items-center justify-center text-xl">{item ? item.icon : '◌'}</div><div className="flex-1 min-w-0"><div className="text-[10px] text-gray-500 uppercase">{slot}</div><div className="text-xs truncate text-white">{item ? item.name : 'Empty'}</div></div></div>); })}</div><h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Bag</h3><div className="space-y-1">{player.inventory.map(item => (<div key={item.id} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700"><div className="flex items-center gap-2 overflow-hidden"><span className="text-lg">{item.icon}</span><div className="flex flex-col"><span className="text-sm font-bold">{item.name}</span><span className="text-[10px] text-gray-400">{item.description}</span></div></div><div className="flex items-center gap-2 shrink-0"><span className="text-xs text-gray-400">x{item.quantity}</span>{(item.type === 'WEAPON' || item.type === 'ARMOR' || item.type === 'SHIELD' || item.type === 'ACCESSORY') && (<button onClick={() => handleEquip(item.id, viewCharIndex)} className="px-2 py-1 bg-blue-700 text-[10px] rounded hover:bg-blue-600">{T.EQUIP}</button>)}<button onClick={() => handleScrap(item.id)} className="px-2 py-1 bg-red-900 text-[10px] rounded hover:bg-red-800">{T.SCRAP}</button></div></div>))}{player.inventory.length === 0 && <p className="text-center text-gray-500 text-xs py-4">Inventory is empty.</p>}</div></div></div></Modal>)}
      {phase === 'SKILLS' && (
          <Modal title={T.SKILLS} onClose={closeModal}>
            {selectedSkill ? (
                <div className="flex flex-col gap-4 p-2">
                    <div className="bg-gray-800 p-4 rounded border border-gray-700">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-yellow-500">{selectedSkill.name}</h3>
                                <span className="text-xs text-purple-300 font-bold uppercase tracking-wide">{selectedSkill.type} • Lv.{selectedSkill.level}</span>
                            </div>
                            <div className="text-blue-400 font-mono text-lg font-bold">{selectedSkill.cost} MP</div>
                        </div>
                        <p className="text-gray-300 text-sm mb-4 leading-relaxed italic border-l-2 border-gray-600 pl-3">{selectedSkill.description}</p>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                             <div className="bg-gray-900 p-2 rounded">
                                 <span className="text-gray-500 block uppercase mb-1">Base Power</span>
                                 <span className="text-white font-bold text-lg">{selectedSkill.basePower}</span>
                             </div>
                             <div className="bg-gray-900 p-2 rounded">
                                 <span className="text-gray-500 block uppercase mb-1">Scaling</span>
                                 <span className="text-green-400 font-bold text-lg">+{selectedSkill.scaling}x {selectedSkill.scalingStat}</span>
                             </div>
                             <div className="bg-gray-900 p-2 rounded">
                                 <span className="text-gray-500 block uppercase mb-1">Target</span>
                                 <span className="text-white font-bold">{selectedSkill.targetType}</span>
                             </div>
                             {selectedSkill.effect && (
                                 <div className="bg-gray-900 p-2 rounded">
                                     <span className="text-gray-500 block uppercase mb-1">Effect</span>
                                     <span className="text-yellow-400 font-bold">{selectedSkill.effect.type} ({selectedSkill.effect.duration}t)</span>
                                 </div>
                             )}
                        </div>
                    </div>
                    <button onClick={() => setSelectedSkill(null)} className="bg-gray-700 py-3 rounded text-white font-bold hover:bg-gray-600 border border-gray-500">BACK TO LIST</button>
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="flex border-b border-gray-700 mb-2">
                        {player.party.map((char, i) => (
                            <button key={char.id} onClick={() => setViewCharIndex(i)} className={`flex-1 py-2 text-xs font-bold ${viewCharIndex === i ? 'bg-gray-700 text-yellow-500 border-t-2 border-yellow-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{char.name}</button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {player.party[viewCharIndex].skills.map(skill => (
                            <button key={skill.id} onClick={() => setSelectedSkill(skill)} className="w-full bg-gray-800 p-3 rounded border border-gray-700 flex justify-between items-center hover:bg-gray-700 hover:border-gray-500 transition-all text-left group">
                                <div>
                                    <div className="font-bold text-sm text-purple-300 group-hover:text-purple-200">{skill.name} <span className="text-xs text-gray-500">Lv.{skill.level}</span></div>
                                    <div className="text-xs text-gray-400">{skill.description}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-blue-400 font-bold text-xs">{skill.cost} MP</div>
                                    <div className="text-[10px] text-gray-500">{skill.type}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </Modal>
      )}
      {phase === 'CRAFTING' && (
          <Modal title="CRAFTING" onClose={closeModal}>
              <div className="text-center mb-4 text-xs text-gray-400">Available Scrap: <span className="text-yellow-500 font-bold text-lg block">{player.scrap}</span></div>
              <div className="space-y-2">
                  {CRAFTING_RECIPES.map(recipe => (
                      <button 
                        key={recipe.id} 
                        onClick={() => handleCraft(recipe.id)} 
                        disabled={player.scrap < recipe.cost}
                        className="w-full bg-gray-800 p-3 rounded border border-gray-700 flex justify-between items-center hover:bg-gray-700 hover:border-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                          <div className="text-left">
                              <div className="font-bold text-sm text-amber-200">{recipe.name}</div>
                              <div className="text-[10px] text-gray-500">{recipe.desc}</div>
                          </div>
                          <div className="text-right">
                              <div className={`font-bold text-sm ${player.scrap >= recipe.cost ? 'text-white' : 'text-red-500'}`}>{recipe.cost} ⚙</div>
                          </div>
                      </button>
                  ))}
              </div>
          </Modal>
      )}
      {phase === 'LEVEL_UP' && (<Modal title={T.LEVEL_UP} onClose={() => {}}><div className="text-center mb-4"><h3 className="text-lg text-white">Choose a Perk for <span className="text-yellow-500 font-bold">{player.party[levelUpQueue[0]]?.name}</span></h3></div><div className="grid gap-3">{levelUpOptions.map((perk, i) => (<button key={i} onClick={() => handlePerkSelect(perk)} className="bg-gray-800 hover:bg-gray-700 p-4 rounded border border-gray-600 hover:border-yellow-500 text-left transition-all group"><div className="font-bold text-yellow-400 group-hover:text-yellow-300">{perk.title}</div><div className="text-sm text-gray-400">{perk.description}</div></button>))}</div></Modal>)}
    </div>
  );
};

export default App;

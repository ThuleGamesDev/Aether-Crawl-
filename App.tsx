
import React, { useState, useEffect, useRef } from 'react';
import { generateDungeon } from './services/dungeonGenerator';
import { audioService } from './services/audioService';
import { generateLoot, XP_THRESHOLD, getLeaderboard, saveHighScore, saveGame, loadGame, hasSaveGame, createBoss, createRandomEnemy, CRAFTING_RECIPES } from './services/gameLogic';
import { getBiomeIdForLevel } from './data/assetRegistry';
import { getExplorationNarrative } from './data/narratives';
import { normalizePlayerWeaponVisuals } from './data/weaponVisuals';
import { TEXT, LanguageType } from './data/translations';
import { preloadAssets } from './services/assetLoader';
import { generatePerksForCharacter } from './services/progression';
import { calculateEnemyAttack, calculatePlayerAttack, calculateSkillPower, damageEnemies } from './services/combat';
import Viewport from './components/Viewport';
import Controls from './components/Controls';
import Log from './components/Log';
import Minimap from './components/Minimap';
import { Player, Character, TileType, GamePhase, LogEntry, BiomeId, Enemy, CombatMenu, VFXEvent, VFXType, Item, HighScore, Perk, ClassType, StatusEffect, StatusType, Direction, Skill } from './types';
import { CLASSES, MAP_SIZE, MASTER_SKILL_POOL } from './constants';

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
        <div className="bg-gray-900 border-2 border-gray-600 rounded-lg w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
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
    party: [],
    inventory: [],
    scrap: 0
  });
  // Prev Pos for Interpolation
  const [prevPos, setPrevPos] = useState<{x:number, y:number}|undefined>(undefined);
  const [isMoving, setIsMoving] = useState(false);
  const [stepCounter, setStepCounter] = useState(0);
  
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
  const playerRef = useRef<Player>(player); // Ref to track latest player state during closures

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    let active = true;
    preloadAssets()
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

  const generateLevel = (level: number) => {
      setPhase('INIT');
      setDungeonLevel(level);
      const nextBiome = getBiomeIdForLevel(level);
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
      setPlayer(p => ({ ...p, pos: { x: sx, y: sy } }));
      setPrevPos({ x: sx, y: sy }); // Reset prev pos
      
      let initExplored = Array(MAP_SIZE).fill(false).map(() => Array(MAP_SIZE).fill(false));
      initExplored = updateExplored({x: sx, y: sy}, initExplored);
      setExplored(initExplored);

      setPhase('EXPLORE');
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
      setPlayer({ pos: { x: 1, y: 1 }, dir: 'E', party: newParty, inventory: sharedItems, scrap: 0 });
      setLogs([]);
      setEnemies([]);
      generateLevel(1);
  };

  const handleContinue = () => {
      const saved = loadGame();
      if (!saved) return;
      
      setPhase('INIT'); // Show loading screen

      setPlayer(normalizePlayerWeaponVisuals(saved.player));
      setPrevPos(saved.player.pos);
      setMap(saved.map);
      setDecorations(saved.decorations);
      setExplored(saved.explored);
      setDungeonLevel(saved.dungeonLevel);
      setBiomeId(getBiomeIdForLevel(saved.dungeonLevel));
      setLogs(saved.logs);
      setLevelBossDefeated(saved.levelBossDefeated || false);
      if (saved.clearedTiles) setClearedTiles(new Set(saved.clearedTiles));
      
      setPhase('EXPLORE');
      addLog("Game Loaded.", 'info');
      audioService.startMusic();
  };

  const handleSaveGame = () => {
      saveGame({ 
          player, map, decorations, explored, dungeonLevel, logs, date: Date.now(), 
          levelBossDefeated, 
          clearedTiles: Array.from(clearedTiles) 
      });
      setCanContinue(true);
      addLog("Game Saved.", 'loot');
      audioService.playItemGet();
  };

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), text, type }]);
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
      const id = `status_${Date.now()}_${Math.random()}`;
      const iconMap: Record<StatusType, string> = { 'POISON': '🤢', 'BURN': '🔥', 'REGEN': '💖', 'SHIELD': '🛡️', 'STRENGTH': '💪', 'WEAKNESS': '😓', 'STUN': '💫' };
      const newEffect: StatusEffect = { id, type, name: type, duration, value: val, icon: iconMap[type] };

      if (isPlayer) {
          setPlayer(p => {
              const newParty = p.party.map(c => {
                  if (c.id === target.id) {
                      return { ...c, statusEffects: [...c.statusEffects, newEffect] };
                  }
                  return c;
              });
              return { ...p, party: newParty };
          });
      } else {
          setEnemies(prev => prev.map(e => {
              if (e.id === target.id) {
                  return { ...e, statusEffects: [...(e.statusEffects || []), newEffect] };
              }
              return e;
          }));
      }
      addLog(`${target.name} gained ${type}!`, 'combat');
  };

  const processStatusEffects = (character: Character | Enemy, isPlayer: boolean): boolean => {
      let hpChange = 0;
      let newEffects: StatusEffect[] = [];

      const currentEffects = isPlayer ? (character as Character).statusEffects : (character as Enemy).statusEffects || [];

      currentEffects.forEach(eff => {
          if (eff.type === 'POISON') { hpChange -= eff.value; addLog(`${character.name} takes ${eff.value} poison dmg.`, 'combat'); triggerVfx('POISON', character.id); }
          if (eff.type === 'BURN') { hpChange -= eff.value; addLog(`${character.name} burns for ${eff.value}.`, 'combat'); triggerVfx('FIREBALL', character.id); }
          if (eff.type === 'REGEN') { hpChange += eff.value; addLog(`${character.name} regenerates ${eff.value}.`, 'combat'); triggerVfx('HEAL', character.id); }
          if (eff.type === 'STUN') { addLog(`${character.name} is stunned!`, 'combat'); }
          if (eff.duration > 1) { newEffects.push({ ...eff, duration: eff.duration - 1 }); }
      });

      if (hpChange !== 0) {
          if (isPlayer) {
              setPlayer(p => {
                  const newParty = p.party.map(c => {
                      if (c.id === character.id) {
                          const nHp = Math.min(c.stats.maxHp, Math.max(0, c.stats.hp + hpChange));
                          return { ...c, stats: { ...c.stats, hp: nHp }, statusEffects: newEffects };
                      }
                      return c;
                  });
                  return { ...p, party: newParty };
              });
              if ((character as Character).stats.hp + hpChange <= 0) return true;
          } else {
              const newEnemies = enemiesRef.current.map(e => {
                  if (e.id === character.id) {
                      const nHp = Math.max(0, e.hp + hpChange);
                      return { ...e, hp: nHp, statusEffects: newEffects };
                  }
                  return e;
              });
              setEnemies(newEnemies);
              enemiesRef.current = newEnemies;
              if ((character as Enemy).hp + hpChange <= 0) return true;
          }
      } else {
          if (isPlayer) {
               setPlayer(p => ({ ...p, party: p.party.map(c => c.id === character.id ? { ...c, statusEffects: newEffects } : c) }));
          } else {
               const newEnemies = enemiesRef.current.map(e => e.id === character.id ? { ...e, statusEffects: newEffects } : e);
               setEnemies(newEnemies);
               enemiesRef.current = newEnemies;
          }
      }
      return false; 
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
      
      const newEnemies: Enemy[] = isBoss
          ? [createBoss(dungeonLevel, dungeonLevel % 5 === 0)]
          : Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => createRandomEnemy(dungeonLevel));
      setEnemies(newEnemies);
      enemiesRef.current = newEnemies; 
      setSelectedEnemyId(newEnemies[0].id);
      setTimeout(() => startPlayerTurn(0), 1000);
  };

  const startPlayerTurn = (charIndex: number) => {
      const currentEnemies = enemiesRef.current; 
      if (currentEnemies.length > 0 && currentEnemies.every(e => e.hp <= 0)) { endCombat(true); return; }
      if (charIndex >= player.party.length) { enemyTurn(); return; }
      const character = player.party[charIndex];
      if (character.stats.hp <= 0) { startPlayerTurn(charIndex + 1); return; }
      const died = processStatusEffects(character, true);
      if (died) { startPlayerTurn(charIndex + 1); return; }
      const isStunned = character.statusEffects.some(e => e.type === 'STUN');
      if (isStunned) {
          addLog(`${character.name} is stunned!`, 'combat');
          setTimeout(() => startPlayerTurn(charIndex + 1), 1000);
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
      const currentEnemies = enemiesRef.current;
      const activeEnemies = currentEnemies.filter(e => e.hp > 0);
      if (activeEnemies.length === 0) { setTimeout(() => endCombat(true), 500); return; }
      setIsPlayerTurn(false);

      for (const enemy of activeEnemies) {
          if (enemy.hp <= 0) continue;
          processStatusEffects(enemy, false);
          if (enemy.hp <= 0) continue;
          const isStunned = enemy.statusEffects.some(e => e.type === 'STUN');
          if (isStunned) {
               addLog(`${enemy.name} is stunned!`, 'combat');
               continue;
          }

          await new Promise(r => setTimeout(r, 600));
          const livingPlayers = playerRef.current.party.filter(c => c.stats.hp > 0); // Use REF to get latest state
          if (livingPlayers.length === 0) break;

          const target = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
          
          const dmg = calculateEnemyAttack(enemy, target);

          setPlayer(p => {
              const np = p.party.map(c => c.id === target.id ? { ...c, stats: { ...c.stats, hp: Math.max(0, c.stats.hp - dmg) } } : c);
              return { ...p, party: np };
          });
          
          addLog(`${enemy.name} attacks ${target.name} for ${dmg} dmg!`, 'combat');
          triggerVfx('DAMAGE', target.id);
          audioService.playAttack();

          if (target.stats.hp - dmg <= 0) {
              addLog(`${target.name} collapsed!`, 'combat');
          }
          
          // CHECK GAME OVER HERE (After every attack)
          const stillAlive = playerRef.current.party.some(c => c.stats.hp > 0);
          if (!stillAlive) {
              endCombat(false);
              return;
          }
      }
      startPlayerTurn(0);
  };

  const endCombat = (victory: boolean) => {
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

  const handleMove = (forward: boolean) => {
      if (phase !== 'EXPLORE') return;
      if (isMoving) return; // Prevent rapid movement spam
      
      const { x, y } = player.pos;
      let nx = x, ny = y;
      
      const dx = player.dir === 'E' ? 1 : player.dir === 'W' ? -1 : 0;
      const dy = player.dir === 'S' ? 1 : player.dir === 'N' ? -1 : 0;

      if (forward) { nx += dx; ny += dy; }
      else { nx -= dx; ny -= dy; }

      if (map[ny][nx] !== TileType.WALL) {
          
          if (map[ny][nx] === TileType.EXIT) {
               if (!levelBossDefeated) {
                   addLog("A powerful foe guards the exit!", 'story');
                   startCombat(true); 
                   return;
               }
               generateLevel(dungeonLevel + 1);
               return;
          }

          // Lock movement briefly for animation
          setIsMoving(true);
          setPrevPos({ x, y });
          setPlayer(p => ({ ...p, pos: { x: nx, y: ny } }));
          setExplored(prev => updateExplored({ x: nx, y: ny }, prev));
          audioService.playStep();

          // PROP INTERACTION LOGIC
          const decorationType = decorations[ny][nx];
          if (decorationType > 1) { // 2=Barrel, 3=Crate, 4=Bones
             // Remove prop
             setDecorations(prev => {
                 const next = prev.map(row => [...row]);
                 next[ny][nx] = 0;
                 return next;
             });

             // Give Scrap (Always)
             audioService.playItemGet();
             const scrapAmount = Math.floor(Math.random() * 5) + 2;
             setPlayer(p => ({ ...p, scrap: p.scrap + scrapAmount }));
             
             let msg = "Smashed a crate.";
             if (decorationType === 2) msg = "Broke open a barrel.";
             if (decorationType === 4) msg = "Searched the bones.";
             addLog(`${msg} Found ${scrapAmount} scrap.`, 'loot');

             // Chance for real item (Improved Logic)
             const roll = Math.random();
             if (roll < 0.02) {
                 // 2% Chance for JACKPOT (Boss Tier Loot)
                 const loot = generateLoot(dungeonLevel, true);
                 if (loot) {
                     addToInventory(loot);
                     addLog(`JACKPOT! Found ${loot.name}!`, 'loot');
                     triggerVfx('HEAL'); // Flash screen
                 }
             } else if (roll < 0.22) {
                 // 20% Chance for Standard Loot
                 const loot = generateLoot(dungeonLevel, false);
                 if (loot) {
                     addToInventory(loot);
                     addLog(`Hidden inside: ${loot.name}!`, 'loot');
                 }
             }
          }
          
          setTimeout(() => setIsMoving(false), 260); // Match interpolation speed

          // Local narrative logic
          setStepCounter(p => p + 1);
          
          // Improved logic: higher chance if seeing interesting things
          let interestScore = 0;
          const neighbors = [map[ny][nx+1], map[ny][nx-1], map[ny+1][nx], map[ny-1][nx]];
          if (neighbors.includes(TileType.DOOR)) interestScore += 3;
          if (decorations[ny][nx] === 1) interestScore += 2;
          
          const chance = 0.05 + (interestScore * 0.1);

          if (Math.random() < chance) {
               const story = getExplorationNarrative(
                   dungeonLevel,
                   neighbors.includes(TileType.DOOR),
                   decorations[ny][nx] === 1,
                   stepCounter,
               );
               addLog(story, 'story');
          }

          // Random Encounter Logic
          const tileKey = `${nx},${ny}`;
          // Only trigger if tile not cleared AND random chance
          if (!levelBossDefeated && !clearedTiles.has(tileKey) && Math.random() < 0.05) { 
              setTimeout(() => startCombat(), 300); // Wait for move animation
          }
      } else {
          audioService.playBump();
      }
  };

  const handleTurn = (left: boolean) => {
      if (phase !== 'EXPLORE') return;
      const dirs: Direction[] = ['N', 'E', 'S', 'W'];
      let idx = dirs.indexOf(player.dir);
      if (left) idx = (idx - 1 + 4) % 4;
      else idx = (idx + 1) % 4;
      setPlayer(p => ({ ...p, dir: dirs[idx] }));
  };

  const handleAction = (action: string) => {
      if (phase === 'EXPLORE') {
          if (action === 'inventory') { setViewCharIndex(0); openModal('INVENTORY'); }
          if (action === 'skills') { setViewCharIndex(0); openModal('SKILLS'); }
          if (action === 'stats') { setViewCharIndex(0); openModal('STATS'); }
          if (action === 'craft') { openModal('CRAFTING'); }
      }
      
      if (phase === 'COMBAT') {
          if (action === 'attack') {
             const target = enemiesRef.current.find(e => e.id === selectedEnemyId) || enemiesRef.current.find(e => e.hp > 0);
             if (!target) return;
             
             const char = player.party[activeCharIndex];
             const { damage: dmg, critical: isCrit } = calculatePlayerAttack(char);
             const newEnemies = damageEnemies(enemiesRef.current, target.id, dmg);
             setEnemies(newEnemies);
             enemiesRef.current = newEnemies;

             addLog(`${char.name} attacks ${target.name} for ${dmg}${isCrit ? ' (CRIT!)' : ''}.`, 'combat');
             triggerVfx(isCrit ? 'CRITICAL' : 'ATTACK', target.id);
             audioService.playAttack();
             
             if (target.hp - dmg <= 0) {
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
      const targetEnemy = enemiesRef.current.find(e => e.id === selectedEnemyId) || enemiesRef.current.find(e => e.hp > 0);
      
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
                   setEnemies(newEnemies);
                   enemiesRef.current = newEnemies;
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
                   setEnemies(newEnemies);
                   enemiesRef.current = newEnemies;
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
    <div className="w-full h-screen bg-zinc-900 text-gray-200 flex flex-col items-center justify-center p-2 md:p-4 select-none">
      {phase === 'MENU' && (
        <div className="flex flex-col gap-6 items-center animate-fadeIn max-w-md w-full">
            <h1 className="text-4xl md:text-6xl font-bold text-yellow-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] text-center tracking-tighter">AETHER<br/>CRAWL</h1>
            <div className="flex flex-col gap-3 w-full">
                {canContinue && <button onClick={handleContinue} className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded border-b-4 border-blue-900 active:border-b-0 active:translate-y-1">{T.CONTINUE}</button>}
                <button onClick={handleNewGame} className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded border-b-4 border-red-900 active:border-b-0 active:translate-y-1">{T.NEW_GAME}</button>
                <button onClick={() => setPhase('OPTIONS')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded border-b-4 border-gray-900 active:border-b-0 active:translate-y-1">{T.OPTIONS}</button>
                <button onClick={handleQuitApp} className="bg-zinc-800 hover:bg-zinc-700 text-gray-400 font-bold py-3 rounded border-b-4 border-black active:border-b-0 active:translate-y-1">{T.EXIT}</button>
            </div>
            <div className="text-xs text-gray-500 mt-8">v1.4.0 - Retro Dungeon Crawler</div>
        </div>
      )}

      {/* Options */}
      {phase === 'OPTIONS' && (
          <div className="bg-gray-800 p-6 rounded-lg border-2 border-gray-600 w-full max-w-md">
              <h2 className="text-xl font-bold text-yellow-500 mb-6 text-center">{T.OPTIONS}</h2>
              <div className="space-y-4">
                  <div className="flex justify-between items-center"><span>{T.MUSIC}</span><button onClick={toggleMusic} className={`w-12 h-6 rounded-full relative transition-colors ${musicOn ? 'bg-green-600' : 'bg-gray-600'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${musicOn ? 'translate-x-6' : ''}`}></div></button></div>
                  <div className="flex justify-between items-center"><span>{T.SFX}</span><button onClick={toggleSfx} className={`w-12 h-6 rounded-full relative transition-colors ${sfxOn ? 'bg-green-600' : 'bg-gray-600'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${sfxOn ? 'translate-x-6' : ''}`}></div></button></div>
                  <div className="flex justify-between items-center"><span>{T.LANGUAGE}</span><button onClick={toggleLanguage} className="bg-gray-700 px-3 py-1 rounded border border-gray-500">{language}</button></div>
              </div>
              <button onClick={() => setPhase('MENU')} className="mt-8 w-full bg-gray-700 py-2 rounded font-bold hover:bg-gray-600">{T.MENU}</button>
          </div>
      )}
      {phase === 'CLASS_SELECT' && (<div className="w-full max-w-4xl h-[80vh] bg-gray-900 border-2 border-gray-700 rounded-lg p-4">{renderClassSelect()}</div>)}
      {phase === 'INIT' && (<div className="text-center animate-pulse"><h2 className="text-2xl text-yellow-500 font-bold mb-2">{T.GENERATING}</h2><div className="w-64 h-4 bg-gray-800 rounded-full overflow-hidden mx-auto border border-gray-600"><div className="h-full bg-yellow-500 animate-[width_2s_ease-in-out_infinite] w-full origin-left"></div></div></div>)}
      {phase === 'GAME_OVER' && (
          <div className="text-center">
               <h1 className="text-5xl text-red-600 font-bold mb-4 glitch-effect">{T.DEFEAT}</h1>
               <p className="text-gray-400 mb-8">The dungeon claimed another soul.</p>
               {!scoreSubmitted ? (<div className="bg-gray-800 p-4 rounded border border-gray-600 inline-block"><input type="text" maxLength={10} placeholder="Enter Name" className="bg-black border border-gray-500 px-2 py-1 text-white mb-2 block w-full" value={playerName} onChange={e => setPlayerName(e.target.value.toUpperCase())}/><button onClick={() => { saveHighScore({ name: playerName || 'UNKNOWN', class: player.party.map(c => c.classType[0]).join('/'), dungeonLevel, charLevel: Math.floor(player.party.reduce((a,b)=>a+b.stats.level,0)/3), xp: player.party.reduce((a,b)=>a+b.stats.xp,0), date: new Date().toLocaleDateString() }); setScoreSubmitted(true); setHighScores(getLeaderboard()); }} className="bg-yellow-700 w-full py-1 text-sm font-bold hover:bg-yellow-600">{T.SUBMIT}</button></div>) : (<div className="bg-gray-900 p-4 rounded border border-gray-700 max-w-sm mx-auto text-left max-h-60 overflow-y-auto"><h3 className="text-yellow-500 text-xs mb-2 border-b border-gray-700 pb-1">LEADERBOARD</h3>{highScores.map((s, i) => (<div key={i} className="flex justify-between text-[10px] mb-1"><span>{i+1}. {s.name} ({s.class})</span><span>L{s.dungeonLevel}</span></div>))}</div>)}
               <button onClick={handleReturnToMenu} className="mt-8 block mx-auto bg-gray-700 px-6 py-2 rounded border border-gray-500 hover:bg-gray-600">{T.EXIT_TO_MENU}</button>
          </div>
      )}

      {(phase === 'EXPLORE' || phase === 'COMBAT') && (
        <div className="w-full h-full max-w-4xl mx-auto flex flex-col gap-2 md:gap-4 relative">
            <div className="flex justify-between items-center h-10 shrink-0 px-1">
                <div className="text-yellow-500 font-bold text-xs md:text-sm drop-shadow-md">DLVL: {dungeonLevel} <span className="text-gray-500 ml-2">SCRAP: {player.scrap}</span></div>
                <div className="flex gap-2"><button onClick={handleSaveGame} className="text-[10px] bg-blue-900 px-2 py-1 rounded border border-blue-700 hover:bg-blue-800">SAVE</button><button onClick={handleReturnToMenu} className="text-[10px] bg-red-900 px-2 py-1 rounded border border-red-700 hover:bg-red-800">EXIT</button></div>
            </div>
            
            <div className="flex-1 min-h-0 relative flex justify-center items-center bg-gray-950 rounded-lg shadow-inner overflow-hidden">
                <Viewport map={map} decorations={decorations} playerPos={player.pos} playerDir={player.dir} prevPlayerPos={prevPos} biomeId={biomeId} enemies={enemies} selectedEnemyId={selectedEnemyId} onSelectEnemy={setSelectedEnemyId} phase={phase} vfx={vfx} player={player} activeCharIndex={activeCharIndex} />
                
                {phase === 'COMBAT' && selectedEnemyId && (() => {
                    const target = enemies.find(e => e.id === selectedEnemyId);
                    if (target && target.hp > 0) {
                        const hpPct = (target.hp / target.maxHp) * 100;
                        return (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 border-2 border-red-900 p-2 rounded shadow-[0_0_15px_rgba(200,0,0,0.5)] min-w-[200px] text-center backdrop-blur-sm animate-fadeIn">
                                <div className="text-yellow-500 font-bold text-sm mb-1 uppercase tracking-wider">{target.name}</div>
                                <div className="w-full bg-gray-900 h-3 rounded-full border border-gray-700 relative overflow-hidden mb-1">
                                    <div className={`h-full transition-all duration-300 ${hpPct > 50 ? 'bg-green-600' : hpPct > 25 ? 'bg-yellow-600' : 'bg-red-600'}`} style={{width: `${hpPct}%`}}></div>
                                </div>
                                <div className="text-white text-xs font-mono">{target.hp} / {target.maxHp} HP</div>
                                {target.statusEffects && target.statusEffects.length > 0 && (
                                    <div className="flex justify-center gap-2 mt-1">
                                        {target.statusEffects.map(eff => (
                                            <span key={eff.id} title={`${eff.type}: ${eff.value}`} className="text-sm bg-gray-800 rounded px-1">{eff.icon}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return null;
                })()}

                <div className="absolute top-2 right-2 opacity-80 pointer-events-none"><Minimap map={map} explored={explored} playerPos={player.pos} playerDir={player.dir} /></div>
            </div>

            <div className="h-20 shrink-0 bg-gray-900 border-y border-gray-700 flex items-center px-4 gap-4 overflow-x-auto">
                {phase === 'COMBAT' ? (
                    (() => {
                        const char = player.party[activeCharIndex];
                        if(!char) return null;
                        const hpPct = (char.stats.hp / char.stats.maxHp) * 100;
                        const mpPct = (char.stats.mp / char.stats.maxMp) * 100;
                        return (
                            <div className="flex items-center w-full justify-between">
                                <div className="flex flex-col flex-1 max-w-md">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-yellow-400 font-bold text-sm">{char.name}</span>
                                        <span className="text-gray-400 text-xs">Lv.{char.stats.level}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <div className="bg-gray-800 h-4 rounded border border-gray-600 relative overflow-hidden">
                                                <div className="bg-red-600 h-full transition-all" style={{width: `${hpPct}%`}}></div>
                                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">{char.stats.hp}/{char.stats.maxHp}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="bg-gray-800 h-4 rounded border border-gray-600 relative overflow-hidden">
                                                <div className="bg-blue-600 h-full transition-all" style={{width: `${mpPct}%`}}></div>
                                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">{char.stats.mp}/{char.stats.maxMp}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    {char.statusEffects.length === 0 && <span className="text-gray-600 text-xs italic">No buffs</span>}
                                    {char.statusEffects.map(eff => (
                                        <div key={eff.id} className="flex flex-col items-center bg-gray-800 p-1 rounded border border-gray-700 w-10">
                                            <span className="text-lg">{eff.icon}</span>
                                            <span className="text-[10px] font-bold">{eff.duration}t</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="flex w-full gap-2">
                        {player.party.map((char, i) => {
                            const hpPct = (char.stats.hp / char.stats.maxHp) * 100;
                            const mpPct = (char.stats.mp / char.stats.maxMp) * 100;
                            return (
                                <div key={char.id} className="flex-1 bg-gray-800 border border-gray-700 rounded p-1 flex flex-col justify-center min-w-[100px]">
                                    <div className="flex justify-between text-[10px] mb-1">
                                        <span className="font-bold text-gray-300 truncate">{char.name}</span>
                                        <span className="flex gap-0.5">
                                            {char.statusEffects.map(e => <span key={e.id} className="text-[8px]">{e.icon}</span>)}
                                        </span>
                                    </div>
                                    <div className="bg-gray-900 h-1.5 rounded mb-1 overflow-hidden">
                                        <div className="bg-red-600 h-full" style={{width: `${hpPct}%`}}></div>
                                    </div>
                                    <div className="bg-gray-900 h-1.5 rounded overflow-hidden">
                                        <div className="bg-blue-600 h-full" style={{width: `${mpPct}%`}}></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="h-48 shrink-0 bg-gray-800 border-t-4 border-gray-600 flex flex-row p-2 gap-2 shadow-2xl">
                <div className="flex-1 min-w-0"><Log logs={logs} /></div>
                <div className="w-[180px] md:w-[220px] shrink-0"><Controls onMove={handleMove} onTurn={handleTurn} onAction={handleAction} phase={phase} combatMenu={combatMenu} activeCharacter={phase === 'COMBAT' ? player.party[activeCharIndex] : null} inventory={player.inventory} onSubAction={handleSubAction} onBack={() => setCombatMenu('MAIN')} isPlayerTurn={isPlayerTurn} /></div>
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

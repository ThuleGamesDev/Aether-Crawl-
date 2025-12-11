
import React, { useEffect, useRef } from 'react';
import { GamePhase, Enemy, Player, BiomeTextures, VFXEvent, TileType, Prop } from '../types';
import { VIEW_DISTANCE, MAP_SIZE } from '../constants';

interface ViewportProps {
  map: number[][];
  decorations: number[][];
  playerPos: { x: number; y: number };
  playerDir: 'N' | 'E' | 'S' | 'W';
  prevPlayerPos?: { x: number; y: number };
  textures: BiomeTextures | null;
  enemies: Enemy[];
  selectedEnemyId: string | null;
  onSelectEnemy: (id: string) => void;
  phase: GamePhase;
  vfx: VFXEvent | null;
  player: Player;
  activeCharIndex: number;
}

const Viewport: React.FC<ViewportProps> = ({ 
  map, decorations, playerPos, playerDir, prevPlayerPos, textures, 
  enemies, selectedEnemyId, onSelectEnemy, phase, vfx, player, activeCharIndex
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const frameId = useRef(0);
  
  // Animation state
  const animProgress = useRef(1); // 0 to 1
  const currentRenderPos = useRef({ x: playerPos.x, y: playerPos.y });

  // Reset animation when player position changes logically
  useEffect(() => {
      if (prevPlayerPos && (prevPlayerPos.x !== playerPos.x || prevPlayerPos.y !== playerPos.y)) {
          animProgress.current = 0;
      }
  }, [playerPos, prevPlayerPos]);

  const handleClick = (e: React.MouseEvent) => {
      if (phase !== 'COMBAT' || !enemies.length) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const W = rect.width;
      const count = enemies.filter(en => en.hp > 0).length;
      if (count === 0) return;

      const sectorWidth = W / count;
      const idx = Math.floor(x / sectorWidth);
      
      const livingEnemies = enemies.filter(en => en.hp > 0);
      if (livingEnemies[idx]) {
          onSelectEnemy(livingEnemies[idx].id);
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = false;

    const render = () => {
        const W = canvas.width;
        const H = canvas.height;
        timeRef.current += 1;

        // --- Movement Interpolation ---
        if (animProgress.current < 1 && prevPlayerPos) {
            animProgress.current += 0.15; // Slightly faster for snappier feel
            if (animProgress.current > 1) animProgress.current = 1;
            
            const t = animProgress.current;
            const ease = 1 - Math.pow(1 - t, 3); // Cubic ease out
            
            currentRenderPos.current.x = prevPlayerPos.x + (playerPos.x - prevPlayerPos.x) * ease;
            currentRenderPos.current.y = prevPlayerPos.y + (playerPos.y - prevPlayerPos.y) * ease;
        } else {
            currentRenderPos.current.x = playerPos.x;
            currentRenderPos.current.y = playerPos.y;
        }

        // Camera Position
        const posX = currentRenderPos.current.x + 0.5;
        const posY = currentRenderPos.current.y + 0.5;

        // Camera Plane Data
        let dirX = 0, dirY = 0, planeX = 0, planeY = 0;
        if (playerDir === 'N') { dirX = 0; dirY = -1; planeX = 0.66; planeY = 0; }
        else if (playerDir === 'S') { dirX = 0; dirY = 1; planeX = -0.66; planeY = 0; }
        else if (playerDir === 'E') { dirX = 1; dirY = 0; planeX = 0; planeY = 0.66; }
        else if (playerDir === 'W') { dirX = -1; dirY = 0; planeX = 0; planeY = -0.66; }

        // Initialize Z-Buffer
        const zBuffer = new Float32Array(W).fill(Infinity);

        // Clear Background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        if (!map || map.length === 0 || !map[0]) {
            frameId.current = requestAnimationFrame(render);
            return;
        }

        // --- 1. Ceiling & Floor ---
        if (textures) {
            const gradC = ctx.createLinearGradient(0,0,0,H/2);
            gradC.addColorStop(0, '#000');
            gradC.addColorStop(1, '#222');
            ctx.fillStyle = gradC;
            ctx.fillRect(0,0,W,H/2);

            const gradF = ctx.createLinearGradient(0,H/2,0,H);
            gradF.addColorStop(0, '#111');
            gradF.addColorStop(1, '#333');
            ctx.fillStyle = gradF;
            ctx.fillRect(0,H/2,W,H/2);
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, W, H/2);
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, H/2, W, H/2);
        }

        // --- 2. Walls (Raycasting) ---
        for (let x = 0; x < W; x += 4) { 
            const cameraX = 2 * x / W - 1;
            const rayDirX = dirX + planeX * cameraX;
            const rayDirY = dirY + planeY * cameraX;

            let mapX = Math.floor(posX);
            let mapY = Math.floor(posY);
            
            let sideDistX, sideDistY;
            const deltaDistX = Math.abs(1 / rayDirX);
            const deltaDistY = Math.abs(1 / rayDirY);
            let perpWallDist;
            let stepX, stepY;
            let hit = 0;
            let side = 0;
            let tileHit = TileType.EMPTY;

            if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX; }
            else { stepX = 1; sideDistX = (mapX + 1.0 - posX) * deltaDistX; }
            if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY; }
            else { stepY = 1; sideDistY = (mapY + 1.0 - posY) * deltaDistY; }

            let distCount = 0;
            while (hit === 0 && distCount < VIEW_DISTANCE * 2) {
                if (sideDistX < sideDistY) {
                    sideDistX += deltaDistX;
                    mapX += stepX;
                    side = 0;
                } else {
                    sideDistY += deltaDistY;
                    mapY += stepY;
                    side = 1;
                }
                
                if (mapX >= 0 && mapX < MAP_SIZE && mapY >= 0 && mapY < MAP_SIZE) {
                     if (map[mapY] && map[mapY][mapX] !== TileType.EMPTY) {
                         hit = 1;
                         tileHit = map[mapY][mapX];
                     }
                } else {
                    hit = 1;
                }
                distCount++;
            }

            if (hit) {
                if (side === 0) perpWallDist = (mapX - posX + (1 - stepX) / 2) / rayDirX;
                else perpWallDist = (mapY - posY + (1 - stepY) / 2) / rayDirY;

                // STORE Z-BUFFER
                // We fill the 4-pixel strip in zBuffer
                for (let k = 0; k < 4; k++) {
                    if (x + k < W) zBuffer[x + k] = perpWallDist;
                }

                const lineHeight = Math.floor(H / perpWallDist);
                const drawStart = -lineHeight / 2 + H / 2;
                
                let color = '#555';
                if (tileHit === TileType.DOOR) color = '#5c4033';
                if (tileHit === TileType.EXIT) color = '#FFD700';

                const shadow = Math.min(1, perpWallDist / VIEW_DISTANCE);
                
                ctx.fillStyle = color;
                if (side === 1) {
                     ctx.fillStyle = shadeColor(color, -20);
                }
                ctx.fillRect(x, drawStart, 4, lineHeight);
                
                // Fog
                ctx.fillStyle = `rgba(0,0,0,${shadow})`;
                ctx.fillRect(x, drawStart, 4, lineHeight);
            }
        }

        // --- 3. Sprite Casting (Props) ---
        // Collect all visible props
        const props: {x: number, y: number, type: number, dist: number}[] = [];
        
        for(let y=0; y<MAP_SIZE; y++) {
            for(let x=0; x<MAP_SIZE; x++) {
                if (decorations[y][x] > 0) {
                     const dx = x + 0.5 - posX;
                     const dy = y + 0.5 - posY;
                     const dist = dx*dx + dy*dy;
                     // Simple culling
                     if (dist < VIEW_DISTANCE * VIEW_DISTANCE * 1.5) {
                         props.push({ x: x + 0.5, y: y + 0.5, type: decorations[y][x], dist });
                     }
                }
            }
        }

        // Sort by distance (far to near)
        props.sort((a, b) => b.dist - a.dist);

        // Draw Props
        if (textures) {
            for (const prop of props) {
                // Transform sprite with the inverse camera matrix
                // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
                // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
                // [ planeY   dirY ]                                          [ -planeY  planeX ]

                const spriteX = prop.x - posX;
                const spriteY = prop.y - posY;

                const invDet = 1.0 / (planeX * dirY - dirX * planeY); // required for correct matrix multiplication

                const transformX = invDet * (dirY * spriteX - dirX * spriteY);
                const transformY = invDet * (-planeY * spriteX + planeX * spriteY); // this is actually the depth inside the screen

                if (transformY > 0) { // In front of camera
                    const spriteScreenX = Math.floor((W / 2) * (1 + transformX / transformY));
                    const spriteHeight = Math.abs(Math.floor(H / (transformY))); // Using 'transformY' instead of real dist prevents fisheye
                    
                    // Center sprite vertically
                    const spriteTop = -spriteHeight / 2 + H / 2 + (spriteHeight * 0.2); // Offset down slightly to sit on floor

                    const spriteWidth = Math.abs(Math.floor(H / (transformY)));
                    const spriteLeft = Math.floor(spriteScreenX - spriteWidth / 2);

                    // Determine texture
                    let texSrc = null;
                    if (prop.type === 1) texSrc = textures.torch;
                    if (prop.type === 2) texSrc = textures.prop_barrel;
                    if (prop.type === 3) texSrc = textures.prop_crate;
                    if (prop.type === 4) texSrc = textures.prop_bones;

                    if (texSrc) {
                        const img = new Image();
                        img.src = texSrc;
                        if (img.src) {
                            // Check Z-Buffer for visibility
                            // We check the center column of the sprite to decide visibility or iterate columns
                            // For simplicity/performance in JS canvas, we check a few points or just draw if not totally occluded?
                            // Proper way: Iterate columns.
                            
                            // Optimization: Check center of sprite. If center is visible, draw whole thing.
                            // Better: Loop through columns of the sprite on screen.
                            
                            // Since we are using Canvas drawImage, we can't easily do per-column z-check without doing manual pixel manipulation (slow).
                            // Hybrid approach: Check if center is visible.
                            
                            const centerIdx = Math.max(0, Math.min(W-1, spriteScreenX));
                            if (transformY < zBuffer[centerIdx]) {
                                // Simple distance fade
                                const shadow = Math.min(1, transformY / VIEW_DISTANCE);
                                
                                ctx.filter = `brightness(${Math.max(0.2, 1 - shadow)})`;
                                ctx.drawImage(img, spriteLeft, spriteTop, spriteWidth, spriteHeight);
                                ctx.filter = 'none';
                            }
                        }
                    }
                }
            }
        }


        // --- 4. Enemies (Combat Overlay) ---
        // This remains an overlay for combat focus
        if (phase === 'COMBAT') {
            const livingEnemies = enemies.filter(e => e.hp > 0);
            const count = livingEnemies.length;
            
            livingEnemies.forEach((enemy, index) => {
                if (enemy.image) {
                     const eImg = new Image(); 
                     eImg.src = enemy.image;
                     if(eImg.src) { 
                        let ex = (W - (H * 0.8))/2; 
                        if (count === 2) ex = (W/3) * (index + 1) - (H * 0.4); 
                        if (count === 3) ex = (W/4) * (index + 1) - (H * 0.4);

                        const size = H * 0.8; 
                        const ey = (H - size)/2 + 40;
                        const bob = Math.sin((timeRef.current + index * 100) * 0.05) * 10;
                        const breath = Math.sin((timeRef.current + index * 50) * 0.03) * 0.02 + 1;

                        if (selectedEnemyId === enemy.id) {
                             ctx.shadowColor = "red";
                             ctx.shadowBlur = 30;
                             ctx.fillStyle = "red";
                             ctx.beginPath();
                             ctx.moveTo(ex + size/2, ey - 40 + bob);
                             ctx.lineTo(ex + size/2 - 15, ey - 60 + bob);
                             ctx.lineTo(ex + size/2 + 15, ey - 60 + bob);
                             ctx.fill();
                        } else {
                            ctx.shadowBlur = 0;
                        }

                        ctx.drawImage(eImg, ex + (size - size*breath)/2, ey + bob, size * breath, size * breath);
                        ctx.shadowBlur = 0;

                        // HP Bar
                        const hpPct = enemy.hp / enemy.maxHp;
                        const barW = size * 0.6;
                        const barX = ex + (size - barW)/2;
                        const barY = ey + bob - 20;
                        
                        ctx.fillStyle = '#333';
                        ctx.fillRect(barX, barY, barW, 8);
                        ctx.fillStyle = hpPct > 0.5 ? '#0f0' : hpPct > 0.2 ? '#ff0' : '#f00';
                        ctx.fillRect(barX, barY, barW * hpPct, 8);

                        // Status Icons
                        if (enemy.statusEffects && enemy.statusEffects.length > 0) {
                            enemy.statusEffects.forEach((eff, i) => {
                                ctx.font = "24px monospace";
                                ctx.fillStyle = "white";
                                ctx.fillText(eff.icon, barX + (i * 24), barY - 10);
                            });
                        }
                        
                        if (vfx && vfx.targetId === enemy.id && (Date.now() - vfx.id < 500)) {
                             ctx.fillStyle = '#fff';
                             ctx.font = "bold 40px 'Press Start 2P'";
                             ctx.strokeStyle = '#f00';
                             ctx.lineWidth = 2;
                             const txt = "HIT!";
                             ctx.fillText(txt, ex + size/2 - 40, ey + size/2);
                             ctx.strokeText(txt, ex + size/2 - 40, ey + size/2);
                        }
                     }
                }
            });
        }

        // --- 5. Hands / Weapons (FPS View) ---
        if (phase === 'EXPLORE' || phase === 'COMBAT') {
            const isWalking = animProgress.current < 1;
            const walkBob = isWalking ? Math.sin(timeRef.current * 0.5) * 30 : 0;
            const bobX = Math.cos(timeRef.current * 0.1) * 10;
            const bobY = Math.abs(Math.sin(timeRef.current * 0.1)) * 10 + Math.abs(walkBob);
            
            // Determine active hand texture
            let handTex = textures?.hand_default;
            const weapon = player.party[activeCharIndex]?.equipment.weapon;
            const offhand = player.party[activeCharIndex]?.equipment.offhand;

            if (textures) {
                if (weapon) {
                    if (weapon.name.includes("Axe")) handTex = textures.hand_axe;
                    else if (weapon.name.includes("Mace") || weapon.name.includes("Hammer")) handTex = textures.hand_mace;
                    else if (weapon.name.includes("Dagger")) handTex = textures.hand_dagger;
                    else if (weapon.name.includes("Staff")) handTex = textures.hand_staff;
                    else if (weapon.name.includes("Bow")) handTex = textures.hand_bow;
                    else if (weapon.name.includes("Wraps")) handTex = textures.hand_default;
                    else handTex = textures.hand_sword;
                }

                // Render Left Hand (Offhand/Torch)
                // If offhand is shield, show shield
                if (offhand && offhand.type === 'SHIELD' && textures.hand_shield) {
                    const hImg = new Image(); hImg.src = textures.hand_shield;
                    if (hImg.src) ctx.drawImage(hImg, -80 + bobX, H - 220 + bobY, 240, 240);
                } else if (textures.hand_default) {
                     // Default Torch in left hand
                     const hImg = new Image(); hImg.src = textures.hand_default;
                     if (hImg.src) ctx.drawImage(hImg, -50 + bobX, H - 200 + bobY, 200, 200);
                }

                // Render Right Hand (Main Weapon)
                if (handTex) {
                     const hImg = new Image(); hImg.src = handTex;
                     if (hImg.src) ctx.drawImage(hImg, W - 150 - bobX, H - 200 + bobY, 200, 200);
                }
            }
        }
        
        // --- 6. VFX Overlay ---
        if (vfx && Date.now() - vfx.id < 300) {
            ctx.globalCompositeOperation = 'add';
            if (vfx.type === 'ATTACK') ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            else if (vfx.type === 'DAMAGE') ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            else if (vfx.type === 'HEAL') ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            else ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';
        }

        frameId.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId.current);
  }, [map, decorations, playerPos, playerDir, prevPlayerPos, textures, enemies, selectedEnemyId, phase, vfx, activeCharIndex, player.party]);

  return <canvas ref={canvasRef} onClick={handleClick} width={800} height={450} className="w-full h-full object-contain bg-black rounded cursor-crosshair" />;
};

function shadeColor(color: string, percent: number) {
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);
    R = parseInt(String(R * (100 + percent) / 100));
    G = parseInt(String(G * (100 + percent) / 100));
    B = parseInt(String(B * (100 + percent) / 100));
    R = (R<255)?R:255;  G = (G<255)?G:255;  B = (B<255)?B:255;  
    const RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));
    return "#"+RR+GG+BB;
}

export default Viewport;

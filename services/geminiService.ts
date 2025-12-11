
import { GoogleGenAI } from "@google/genai";
import { BiomeTextures, Enemy, Item } from '../types';
import { ASSET_LIBRARY, PREFER_AI_GENERATION } from '../constants';
import { FALLBACK_ENEMIES } from './gameLogic';
import { getCachedAsset, cacheAsset } from './assetCache';

// Helper to get fresh client with current key
const getAiClient = (): GoogleGenAI | null => {
    let apiKey = process.env.API_KEY || '';
    if (typeof localStorage !== 'undefined') {
        const customKey = localStorage.getItem('aether_custom_api_key');
        if (customKey) apiKey = customKey;
    }
    
    // STRICT CHECK: If empty string, return null immediately.
    if (!apiKey || apiKey.trim() === '') return null;

    try {
        return new GoogleGenAI({ apiKey });
    } catch (e) {
        return null;
    }
};

// Helper: Remove black background pixels to create transparency
const processImageTransparency = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') { resolve(base64); return; }
        if (base64.startsWith('http')) { resolve(base64); return; }

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64); return; }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // ADJUSTED THRESHOLD: Lowered to 10 to preserve dark details of the object
            // Only remove very dark/black pixels
            for(let i = 0; i < data.length; i += 4) {
                const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
                if (r < 12 && g < 12 && b < 12) { 
                    data[i + 3] = 0; // Alpha 0
                }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
};

// IMPROVED FALLBACK GENERATOR (Procedural Textures)
// Creates decent looking pixel-art textures when AI is unavailable
const createFallbackTexture = (type: string, color: string, variant: string = '') => {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 128; // Higher res for better tiling
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Helpers
    const noise = (amount: number) => {
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = id.data;
        for(let i = 0; i < d.length; i += 4) {
             const val = (Math.random() - 0.5) * amount;
             d[i] = Math.min(255, Math.max(0, d[i] + val));
             d[i+1] = Math.min(255, Math.max(0, d[i+1] + val));
             d[i+2] = Math.min(255, Math.max(0, d[i+2] + val));
        }
        ctx.putImageData(id, 0, 0);
    };

    const drawBricks = (baseColor: string, mortarColor: string) => {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0,0,128,128);
        ctx.fillStyle = mortarColor;
        const brickH = 32;
        const brickW = 64;
        for(let y=0; y<128; y+=brickH) {
            ctx.fillRect(0, y, 128, 2); // Horizontal mortar
            const offset = (y/brickH) % 2 === 0 ? 0 : brickW/2;
            for(let x=offset; x<128; x+=brickW) {
                ctx.fillRect(x, y, 2, brickH); // Vertical mortar
            }
        }
        noise(30);
    };

    if (type === 'wall') {
        // Brick texture
        drawBricks(color || '#5a5a5a', '#111111');
    } else if (type === 'floor') {
        // Stone tiles / Gravel
        ctx.fillStyle = color || '#2a2a2a';
        ctx.fillRect(0,0,128,128);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for(let i=0; i<200; i++) {
            ctx.fillRect(Math.random()*128, Math.random()*128, 4, 4);
        }
        noise(20);
    } else if (type === 'door') {
        // Wood Planks
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(0,0,128,128);
        ctx.fillStyle = '#3e2723';
        for(let x=0; x<128; x+=32) {
             ctx.fillRect(x, 0, 2, 128); // Plank lines
        }
        // Iron bands
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 20, 128, 16);
        ctx.fillRect(0, 90, 128, 16);
        ctx.fillStyle = '#555'; // Rivets
        ctx.beginPath(); ctx.arc(16, 28, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(112, 28, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 98, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(112, 98, 3, 0, Math.PI*2); ctx.fill();
        noise(15);
    } else if (type === 'exit') {
        // Glowing portal/stairs
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,128,128);
        const grad = ctx.createRadialGradient(64,64, 10, 64,64, 60);
        grad.addColorStop(0, '#ffff00');
        grad.addColorStop(0.5, '#ff8800');
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,128,128);
    } else if (type === 'enemy') {
        // Simple token
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(64,64, 50, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        // Face
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(44, 54, 8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(84, 54, 8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(44, 84); ctx.quadraticCurveTo(64, 94, 84, 84); ctx.strokeStyle='#000'; ctx.stroke();
    } else {
        // Generic noise
        ctx.fillStyle = color;
        ctx.fillRect(0,0,128,128);
        noise(40);
    }

    return canvas.toDataURL();
};

// --- GENERIC RETRY WRAPPER ---
async function generateWithRetry(
    ai: GoogleGenAI, 
    prompt: string, 
    retries = 2
): Promise<string | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', // Using Flash as requested for stability
                contents: { parts: [{ text: prompt }] },
            });
            
            // Check parts
            const parts = response.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
            throw new Error("No image data in response");
        } catch (e) {
            console.warn(`Attempt ${attempt + 1} failed for prompt: "${prompt}". Error:`, e);
            if (attempt === retries) return null;
            // Short delay before retry
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return null;
}


export const generateBiomeTextures = async (level: number): Promise<BiomeTextures> => {
  const ai = getAiClient();
  
  let biomeKey = "biome_dungeon";
  // Updated prompts for better quality
  let wallDesc = "Texture of an ancient dark grey stone dungeon wall, cracked bricks, heavy contrast, ambient occlusion, realistic, seamless, high detail, 8k";
  let floorDesc = "Texture of old cold stone dungeon floor, dirty flagstones, realistic, dark moody lighting, seamless, top down view";
  let exitDesc = "A dark staircase leading down into a deep abyss, stone steps, eerie lighting, dungeon exit";
  let wallColor = '#555555';
  let floorColor = '#222222';
  
  if (level > 5 && level <= 10) {
      biomeKey = "biome_mossy";
      wallColor = '#3a4a3a';
      floorColor = '#2a3a2a';
      wallDesc = "Texture of a damp cave wall covered in green moss and slime, rocky surface, wet look, realistic, high detail";
      floorDesc = "Texture of a muddy cave floor, dirt and small rocks, wet patches, dark earth tones, seamless";
      exitDesc = "A hole in the cavern floor covered in roots and thick vines leading down, mysterious";
  } else if (level > 10 && level <= 15) {
      biomeKey = "biome_catacomb";
      wallColor = '#4a3b3b';
      floorColor = '#1a1a1a';
      wallDesc = "Texture of a catacomb wall densely packed with human skulls and bones, ancient crypt, horror atmosphere, stone framing, realistic";
      floorDesc = "Texture of a dusty crypt floor with scattered bones and debris, cracked stone, ancient";
      exitDesc = "A heavy rusted iron gate leading to a lower crypt, dark ominous fog";
  } else if (level > 15 && level <= 20) {
      biomeKey = "biome_obsidian";
      wallColor = '#1a0a1a';
      floorColor = '#1a0000';
      wallDesc = "Texture of a sharp black obsidian wall with glowing purple veins, volcanic rock, magical, reflective, high contrast";
      floorDesc = "Texture of volcanic rock floor with cooling lava cracks, dark basalt, dangerous terrain";
      exitDesc = "A glowing magical portal gate made of obsidian shards and flowing lava";
  } else if (level > 20 && level <= 25) {
      biomeKey = "biome_frozen";
      wallColor = '#aaccff';
      floorColor = '#ddeeff';
      wallDesc = "Texture of a frozen ice wall, translucent blue ice, cracked glacier, magical, cold atmosphere, detailed";
      floorDesc = "Texture of a slippery ice floor, frozen lake, snow patches, blue and white, seamless";
      exitDesc = "A swirling portal made of blizzard and ice shards";
  } else if (level > 25) {
      biomeKey = "biome_gilded";
      wallColor = '#d4af37';
      floorColor = '#f5f5f5';
      wallDesc = "Texture of an ancient golden wall, hieroglyphs, gold bars, rich, shiny, temple atmosphere";
      floorDesc = "Texture of a pristine white marble floor with gold inlays, clean, rich, seamless";
      exitDesc = "A massive golden gate shining with divine light";
  }

  const getAsset = async (desc: string, fallbackType: string, fallbackColor: string, type: string = "texture", useChromaKey = false): Promise<string> => {
      // Versioned key to invalidate old bad transparencies
      const cacheKey = `aether_asset_v8_${desc}`; 
      
      const cached = await getCachedAsset(cacheKey);
      if (cached) return cached;

      // Try AI
      if (ai) {
            const promptBase = type === "texture" 
                ? `Seamless texture of ${desc}, game asset, no text, flat lighting.`
                : `Sprite of ${desc}, fantasy style, solid black background, single isolated object, centered, sharp edges, no shadows, 2d game asset.`;
            
            const rawBase64 = await generateWithRetry(ai, promptBase);

            if (rawBase64) {
                let finalBase64 = rawBase64;
                if (useChromaKey) finalBase64 = await processImageTransparency(rawBase64);
                
                // Store in IndexedDB
                await cacheAsset(cacheKey, finalBase64);
                return finalBase64;
            }
      }
      
      // FALLBACK TO PROCEDURAL TEXTURE IF NO AI
      return createFallbackTexture(fallbackType, fallbackColor);
  };

  const wall = await getAsset(wallDesc, 'wall', wallColor);
  const floor = await getAsset(floorDesc, 'floor', floorColor);
  const ceiling = await getAsset("Texture of a dark rough stone ceiling, cave roof, stalactites, dark shadows", 'floor', '#111111');
  const door = await getAsset("Texture of a heavy reinforced medieval wooden door with iron bands and rivets, ancient, sturdy", 'door', '#5c4033');
  const exit = await getAsset(exitDesc, 'exit', '#000');
  const torch = await getAsset("Medieval wall torch with burning orange fire, pixel art style, bright flame", 'other', '#FFA500', "sprite", true);
  
  // Hands
  const hand_default = await getAsset("First person view hand holding a burning torch, realistic style", 'other', '#DD9977', "sprite", true);
  const hand_sword = await getAsset("First person view hand holding a steel sword, realistic style", 'other', '#CCC', "sprite", true);
  const hand_axe = await getAsset("First person view hand holding a battle axe, realistic style", 'other', '#888', "sprite", true);
  const hand_mace = await getAsset("First person view hand holding a heavy mace, realistic style", 'other', '#666', "sprite", true);
  const hand_dagger = await getAsset("First person view hand holding a sharp dagger, realistic style", 'other', '#AAA', "sprite", true);
  const hand_staff = await getAsset("First person view hand holding a magic wooden staff with glowing gem, realistic style", 'other', '#8B4513', "sprite", true);
  const hand_bow = await getAsset("First person view hand holding a wooden bow, realistic style", 'other', '#8B4513', "sprite", true);
  const hand_shield = await getAsset("First person view hand holding a shield, realistic style", 'other', '#666', "sprite", true);

  // Props
  const prop_barrel = await getAsset("Wooden barrel with iron hoops, standing upright, dungeon prop", 'other', '#8B4513', "sprite", true);
  const prop_crate = await getAsset("Wooden crate, reinforced box, dungeon prop", 'other', '#A0522D', "sprite", true);
  const prop_bones = await getAsset("Pile of human skull and bones on the ground, dungeon prop, scary", 'other', '#EEE', "sprite", true);

  return { 
      wall, floor, ceiling, door, exit, torch, 
      hand_default, hand_sword, hand_axe, hand_mace, hand_dagger, hand_staff, hand_bow, hand_shield,
      prop_barrel, prop_crate, prop_bones
  };
};

export const generateItemTexture = async (item: Item): Promise<string> => {
    return createFallbackTexture('other', '#888');
}

export const generateEnemy = async (level: number, isBoss = false): Promise<Enemy> => {
   const ai = getAiClient();
   const available = FALLBACK_ENEMIES.filter(e => e.minLvl <= level);
   let template = available[available.length - 1];
   if (available.length > 1 && Math.random() < 0.3) template = available[Math.floor(Math.random() * available.length)];
   const scale = 1.0 + (level - template.minLvl) * 0.1;
   
   const enemyData = {
       name: template.name,
       hp: Math.floor(template.hp * scale),
       damage: Math.floor(template.damage * scale),
       xpReward: Math.floor(template.xp * scale),
   };

   let image = "";
   const cacheKey = `aether_enemy_v8_${enemyData.name}`; // Bumped version
   
   const cached = await getCachedAsset(cacheKey);
   if (cached) image = cached;

   if (!image && ai) {
        // Enforce solid black background more strictly in prompt
        const imgPrompt = `Sprite of ${enemyData.name}, fantasy rpg monster, full body, solid black background, isolated, centered, detailed, menacing, high contrast.`;
        const rawBase64 = await generateWithRetry(ai, imgPrompt);
        if (rawBase64) {
            image = await processImageTransparency(rawBase64);
            await cacheAsset(cacheKey, image);
        }
   }

   if (!image) {
       let color = '#880000';
       if (enemyData.name.includes("Rat")) color = '#8B4513';
       if (enemyData.name.includes("Spider")) color = '#4B0082';
       if (enemyData.name.includes("Goblin")) color = '#228B22';
       if (enemyData.name.includes("Ghost")) color = '#ADD8E6';
       if (enemyData.name.includes("Slime")) color = '#00FF00';
       if (enemyData.name.includes("Ice")) color = '#AACCFF';
       if (enemyData.name.includes("Fire")) color = '#FF4400';
       if (enemyData.name.includes("Gold")) color = '#FFD700';
       if (enemyData.name.includes("Void")) color = '#220033';
       image = createFallbackTexture('enemy', color, isBoss ? 'boss' : '');
   }

   return {
       id: `gen_${Date.now()}`,
       name: enemyData.name,
       hp: enemyData.hp,
       maxHp: enemyData.hp,
       damage: enemyData.damage,
       xpReward: enemyData.xpReward,
       image,
       statusEffects: []
   };
};

export const generateNarrative = async (context: string): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return ""; // Fail silently, no text

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are the Dungeon Master. Based on this context: "${context}", write a ONE sentence atmospheric description of what the player sees or feels. Keep it mysterious and dark. Do not mention game mechanics.`,
        });
        return response.text.trim();
    } catch (e) {
        console.warn("Narrative generation failed", e);
        return "";
    }
}

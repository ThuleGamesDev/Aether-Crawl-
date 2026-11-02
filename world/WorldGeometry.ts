import * as THREE from 'three';
import { DungeonDecoration, TileType, type ArchitecturalLightingTheme, type BiomeId } from '../types';
import type { DungeonWorldState } from './DungeonWorld';
import { AssetManager } from '../presentation/AssetManager';
import { findWallMount } from './architecture';

const WALL_HEIGHT = 2.6;
const MAX_LOCAL_LIGHTS = 6;

interface FlickeringLight {
  light: THREE.PointLight;
  baseIntensity: number;
  phase: number;
}

const THEME_LIGHTS: Record<ArchitecturalLightingTheme, { color: number; intensity: number; distance: number }> = {
  AMBER: { color: 0xffb760, intensity: 0.78, distance: 6.5 },
  NEUTRAL: { color: 0xffd795, intensity: 0.66, distance: 5.8 },
  COOL: { color: 0x87bed2, intensity: 0.56, distance: 5.6 },
  CHTHONIC: { color: 0xe87852, intensity: 0.84, distance: 7 },
};

export class WorldGeometry {
  readonly group = new THREE.Group();
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedTextures: THREE.Texture[] = [];
  private readonly flickeringLights: FlickeringLight[] = [];
  private readonly roomThemes = new Map<string, ArchitecturalLightingTheme>();

  constructor(world: DungeonWorldState, assets: AssetManager) {
    this.group.name = 'DungeonWorld';
    const rows = world.map.length;
    const columns = world.map[0]?.length ?? 0;
    for (const room of world.floor.architectureRooms ?? []) for (const cell of room.cells) this.roomThemes.set(`${cell.x},${cell.y}`, room.lightingTheme);
    this.addGround(columns, rows, world.biome, assets);
    this.addWalls(world, assets);
    this.addExit(world, assets);
    this.addProps(world, assets);
  }

  updateLighting(elapsedSeconds: number): void {
    for (const source of this.flickeringLights) {
      source.light.intensity = source.baseIntensity * (0.93 + Math.sin(elapsedSeconds * 7.1 + source.phase) * 0.035 + Math.sin(elapsedSeconds * 13.7 + source.phase * 1.7) * 0.02);
    }
  }

  private addGround(columns: number, rows: number, biome: BiomeId, assets: AssetManager): void {
    const groundTexture = assets.texture('floor', biome).clone();
    groundTexture.repeat.set(columns, rows);
    groundTexture.needsUpdate = true;
    const ceilingTexture = assets.texture('ceiling', biome).clone();
    ceilingTexture.repeat.set(columns, rows);
    ceilingTexture.needsUpdate = true;
    this.ownedTextures.push(groundTexture, ceilingTexture);
    const floorMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ map: ceilingTexture, color: 0xb7bac0, roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true });
    const plane = new THREE.PlaneGeometry(columns, rows);
    this.ownedGeometries.push(plane);
    this.ownedMaterials.push(floorMaterial, ceilingMaterial);
    const floor = new THREE.Mesh(plane, floorMaterial);
    floor.name = 'DungeonFloor';
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(columns / 2, 0, rows / 2);
    this.group.add(floor);
    const ceiling = new THREE.Mesh(plane, ceilingMaterial);
    ceiling.name = 'DungeonCeiling';
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.set(columns / 2, WALL_HEIGHT, rows / 2);
    this.group.add(ceiling);
  }

  private addWalls(world: DungeonWorldState, assets: AssetManager): void {
    const wallCells: Array<{ x: number; z: number; tile: number }> = [];
    const pillarCells: Array<{ x: number; z: number }> = [];
    world.map.forEach((row, z) => row.forEach((tile, x) => {
      if (tile === TileType.WALL && world.decorations[z]?.[x] === DungeonDecoration.PILLAR) pillarCells.push({ x, z });
      else if (tile === TileType.WALL || tile === TileType.DOOR || tile === TileType.LOCKED || tile === TileType.SECRET) wallCells.push({ x, z, tile });
    }));
    const grouped = new Map<number, Array<{ x: number; z: number }>>();
    for (const cell of wallCells) {
      const entries = grouped.get(cell.tile) ?? [];
      entries.push(cell);
      grouped.set(cell.tile, entries);
    }
    for (const [tile, cells] of grouped) {
      const kind = tile === TileType.DOOR ? 'door' : 'wall';
      const texture = assets.texture(kind, world.biome);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        color: tile === TileType.LOCKED ? 0x756168 : tile === TileType.SECRET ? 0x797d71 : 0xffffff,
        roughness: 1,
        metalness: 0,
        flatShading: true,
      });
      const geometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
      const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
      mesh.name = tile === TileType.DOOR ? 'DungeonDoors' : tile === TileType.LOCKED ? 'LockedWalls' : tile === TileType.SECRET ? 'SecretWalls' : 'DungeonWalls';
      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();
      cells.forEach((cell, index) => {
        matrix.makeTranslation(cell.x + 0.5, WALL_HEIGHT / 2, cell.z + 0.5);
        mesh.setMatrixAt(index, matrix);
        if (tile === TileType.WALL && (cell.x + cell.z) % 5 === 0) {
          color.setHex(0xb2a18e);
          mesh.setColorAt(index, color);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.ownedGeometries.push(geometry);
      this.ownedMaterials.push(material);
      this.group.add(mesh);
    }
    if (pillarCells.length) this.addPillars(pillarCells);
  }

  private addPillars(cells: Array<{ x: number; z: number }>): void {
    const stone = new THREE.MeshStandardMaterial({ color: 0x9b4e3e, roughness: 0.94, metalness: 0, flatShading: true });
    const bronze = new THREE.MeshStandardMaterial({ color: 0x987144, roughness: 0.82, metalness: 0.08, flatShading: true });
    const shaftGeometry = new THREE.CylinderGeometry(0.34, 0.39, WALL_HEIGHT - 0.16, 8, 1, false);
    const capGeometry = new THREE.CylinderGeometry(0.47, 0.44, 0.16, 8, 1, false);
    const baseGeometry = new THREE.CylinderGeometry(0.44, 0.48, 0.16, 8, 1, false);
    for (const geometry of [shaftGeometry, capGeometry, baseGeometry]) this.ownedGeometries.push(geometry);
    this.ownedMaterials.push(stone, bronze);
    const matrix = new THREE.Matrix4();
    const shaft = new THREE.InstancedMesh(shaftGeometry, stone, cells.length);
    const capital = new THREE.InstancedMesh(capGeometry, bronze, cells.length);
    const base = new THREE.InstancedMesh(baseGeometry, bronze, cells.length);
    shaft.name = 'RedLimestonePillars';
    capital.name = 'PillarCapitals';
    base.name = 'PillarBases';
    cells.forEach((cell, index) => {
      matrix.makeTranslation(cell.x + 0.5, WALL_HEIGHT / 2, cell.z + 0.5);
      shaft.setMatrixAt(index, matrix);
      matrix.makeTranslation(cell.x + 0.5, WALL_HEIGHT - 0.08, cell.z + 0.5);
      capital.setMatrixAt(index, matrix);
      matrix.makeTranslation(cell.x + 0.5, 0.08, cell.z + 0.5);
      base.setMatrixAt(index, matrix);
    });
    shaft.instanceMatrix.needsUpdate = true;
    capital.instanceMatrix.needsUpdate = true;
    base.instanceMatrix.needsUpdate = true;
    this.group.add(shaft, capital, base);
  }

  private addExit(world: DungeonWorldState, assets: AssetManager): void {
    const exit = world.floor.rooms.find(room => room.type === 'BOSS');
    if (!exit) return;
    const x = exit.anchor.x + 0.5, z = exit.anchor.y + 0.5;
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x615243, roughness: 1, flatShading: true });
    const glowMaterial = new THREE.MeshBasicMaterial({ map: assets.texture('exit', world.biome), transparent: true, depthWrite: false });
    const pillarGeometry = new THREE.BoxGeometry(0.22, 2.25, 0.25);
    const lintelGeometry = new THREE.BoxGeometry(1.18, 0.26, 0.28);
    const portalGeometry = new THREE.PlaneGeometry(0.72, 1.75);
    const left = new THREE.Mesh(pillarGeometry, stoneMaterial);
    const right = new THREE.Mesh(pillarGeometry, stoneMaterial);
    const lintel = new THREE.Mesh(lintelGeometry, stoneMaterial);
    const portal = new THREE.Mesh(portalGeometry, glowMaterial);
    const bullMaterial = new THREE.SpriteMaterial({ map: assets.propTexture('bullRelief'), transparent: true, alphaTest: 0.08, depthWrite: false });
    const bull = new THREE.Sprite(bullMaterial);
    bull.center.set(0.5, 0.5);
    bull.scale.set(0.82, 0.6, 1);
    bull.position.set(x, 1.96, z + 0.2);
    bull.name = 'KnossianBullRelief';
    left.position.set(x - 0.48, 1.12, z);
    right.position.set(x + 0.48, 1.12, z);
    lintel.position.set(x, 2.22, z);
    portal.position.set(x, 1.08, z - 0.04);
    for (const mesh of [left, right, lintel, portal, bull]) this.group.add(mesh);
    this.ownedGeometries.push(pillarGeometry, lintelGeometry, portalGeometry);
    this.ownedMaterials.push(stoneMaterial, glowMaterial, bullMaterial);
  }

  private addProps(world: DungeonWorldState, assets: AssetManager): void {
    const ids = ['amphora', 'brokenAmphora', 'labyrinthTablet', 'offeringAltar', 'chthonicAltar', 'columnFragment', 'oilBowl', 'wallTorch', 'frescoPanel', 'bullRelief'] as const;
    const materials = new Map<(typeof ids)[number], THREE.SpriteMaterial>();
    for (const id of ids) {
      const material = new THREE.SpriteMaterial({ map: assets.propTexture(id), transparent: true, alphaTest: 0.08, depthTest: true, depthWrite: false });
      materials.set(id, material);
      this.ownedMaterials.push(material);
    }
    const architectural = Boolean(world.floor.architectureRooms?.length);
    world.decorations.forEach((row, z) => row.forEach((decoration, x) => {
      if (decoration <= 0) return;
      if (decoration === DungeonDecoration.WALL_TORCH) {
        this.addWallMountedProp(world, assets, 'wallTorch', x, z);
        return;
      }
      if (architectural && (decoration === DungeonDecoration.FRESCO_PANEL || decoration === DungeonDecoration.BULL_RELIEF)) {
        const id = decoration === DungeonDecoration.FRESCO_PANEL ? 'frescoPanel' : 'bullRelief';
        this.addWallMountedProp(world, assets, id, x, z);
        return;
      }
      if (architectural && decoration === DungeonDecoration.PILLAR) return;
      const legacyId = decoration === 2 ? 'amphora' : decoration === 3 ? 'brokenAmphora' : decoration === 4 ? 'labyrinthTablet' : decoration === 5 ? 'offeringAltar' : 'columnFragment';
      const id = architectural
        ? decoration === DungeonDecoration.OIL_BOWL ? 'oilBowl'
          : decoration === DungeonDecoration.AMPHORA ? 'amphora'
          : decoration === DungeonDecoration.BROKEN_AMPHORA ? 'brokenAmphora'
            : decoration === DungeonDecoration.LABYRINTH_TABLET ? 'labyrinthTablet'
          : decoration === DungeonDecoration.OFFERING_ALTAR ? this.roomThemes.get(`${x},${z}`) === 'CHTHONIC' ? 'chthonicAltar' : 'offeringAltar'
                : decoration === DungeonDecoration.COLUMN_FRAGMENT ? 'columnFragment' : 'oilBowl'
        : legacyId;
      const prop = new THREE.Sprite(materials.get(id)!);
      prop.center.set(0.5, 0);
      const scale = id === 'offeringAltar' || id === 'chthonicAltar' || id === 'columnFragment' ? 0.76 : id === 'oilBowl' ? 0.48 : 0.62;
      prop.scale.set(scale, scale * (id === 'columnFragment' ? 1.35 : 1), 1);
      prop.position.set(x + 0.5, 0.02, z + 0.5);
      prop.name = 'KnossianProp_' + id + '_' + x + '_' + z;
      this.group.add(prop);
      if (architectural && id === 'oilBowl') this.addLocalLight(world, x + 0.5, 0.55, z + 0.5, x, z);
    }));
  }

  private addWallMountedProp(world: DungeonWorldState, assets: AssetManager, id: 'wallTorch' | 'frescoPanel' | 'bullRelief', x: number, z: number): void {
    const mount = findWallMount(world.map, x, z);
    if (!mount) return;
    const dimensions = id === 'wallTorch' ? [0.54, 0.76] : id === 'frescoPanel' ? [0.92, 0.82] : [0.76, 0.7];
    const geometry = new THREE.PlaneGeometry(dimensions[0], dimensions[1]);
    const material = new THREE.MeshBasicMaterial({ map: assets.propTexture(id), transparent: true, alphaTest: 0.06, depthTest: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'WallMounted_' + id + '_' + x + '_' + z;
    mesh.position.set(mount.x + mount.normalX * 0.012, id === 'wallTorch' ? 1.58 : 1.48, mount.z + mount.normalZ * 0.012);
    mesh.rotation.y = Math.atan2(mount.normalX, mount.normalZ);
    this.ownedGeometries.push(geometry);
    this.ownedMaterials.push(material);
    this.group.add(mesh);
    if (id === 'wallTorch') this.addLocalLight(world, mesh.position.x + mount.normalX * 0.08, 1.72, mesh.position.z + mount.normalZ * 0.08, x + mount.normalX, z + mount.normalZ);
  }

  private addLocalLight(world: DungeonWorldState, x: number, y: number, z: number, roomX: number, roomZ: number): void {
    if (this.flickeringLights.length >= MAX_LOCAL_LIGHTS) return;
    const theme = this.roomThemes.get(`${roomX},${roomZ}`) ?? 'AMBER';
    const profile = THEME_LIGHTS[theme];
    const light = new THREE.PointLight(profile.color, profile.intensity, profile.distance, 2);
    light.position.set(x, y, z);
    light.name = 'LabyrinthLocalLight_' + this.flickeringLights.length;
    light.castShadow = false;
    const phase = ((Math.floor(x * 37) + Math.floor(z * 19)) % 97) * 0.071;
    this.flickeringLights.push({ light, baseIntensity: profile.intensity, phase });
    this.group.add(light);
  }

  dispose(): void {
    this.ownedGeometries.forEach(geometry => geometry.dispose());
    this.ownedMaterials.forEach(material => {
      material.dispose();
    });
    this.ownedTextures.forEach(texture => texture.dispose());
    this.group.clear();
  }
}

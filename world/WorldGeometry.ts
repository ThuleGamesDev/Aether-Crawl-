import * as THREE from 'three';
import { TileType, type BiomeId } from '../types';
import type { DungeonWorldState } from './DungeonWorld';
import { AssetManager } from '../presentation/AssetManager';

const WALL_HEIGHT = 2.6;

export class WorldGeometry {
  readonly group = new THREE.Group();
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedTextures: THREE.Texture[] = [];

  constructor(world: DungeonWorldState, assets: AssetManager) {
    this.group.name = 'DungeonWorld';
    const rows = world.map.length;
    const columns = world.map[0]?.length ?? 0;
    this.addGround(columns, rows, world.biome, assets);
    this.addWalls(world, assets);
    this.addExit(world, assets);
    this.addProps(world, assets);
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
    world.map.forEach((row, z) => row.forEach((tile, x) => {
      if (tile === TileType.WALL || tile === TileType.DOOR || tile === TileType.LOCKED || tile === TileType.SECRET) wallCells.push({ x, z, tile });
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
    left.position.set(x - 0.48, 1.12, z);
    right.position.set(x + 0.48, 1.12, z);
    lintel.position.set(x, 2.22, z);
    portal.position.set(x, 1.08, z - 0.04);
    for (const mesh of [left, right, lintel, portal]) this.group.add(mesh);
    this.ownedGeometries.push(pillarGeometry, lintelGeometry, portalGeometry);
    this.ownedMaterials.push(stoneMaterial, glowMaterial);
  }

  private addProps(world: DungeonWorldState, assets: AssetManager): void {
    const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x765334, map: assets.texture('door', world.biome), roughness: 1, flatShading: true });
    const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xbeb7a5, roughness: 1, flatShading: true });
    const torchMaterial = new THREE.MeshBasicMaterial({ color: 0xffb452 });
    const crateGeometry = new THREE.BoxGeometry(0.52, 0.62, 0.52);
    const boneGeometry = new THREE.BoxGeometry(0.4, 0.08, 0.17);
    const torchGeometry = new THREE.BoxGeometry(0.1, 0.28, 0.1);
    this.ownedMaterials.push(crateMaterial, boneMaterial, torchMaterial);
    this.ownedGeometries.push(crateGeometry, boneGeometry, torchGeometry);
    world.decorations.forEach((row, z) => row.forEach((decoration, x) => {
      if (decoration <= 0) return;
      if (decoration === 1) {
        const torch = new THREE.Mesh(torchGeometry, torchMaterial);
        torch.position.set(x + 0.5, 1.15, z + 0.42);
        this.group.add(torch);
        return;
      }
      let geometry = crateGeometry, material: THREE.Material = crateMaterial, height = 0.31;
      if (decoration === 4) { geometry = boneGeometry; material = boneMaterial; height = 0.08; }
      if (decoration === 5 || decoration === 6) { geometry = torchGeometry; material = torchMaterial; height = 0.16; }
      const prop = new THREE.Mesh(geometry, material);
      prop.position.set(x + 0.5, height, z + 0.5);
      prop.rotation.y = ((x * 3 + z) % 4) * Math.PI / 8;
      this.group.add(prop);
    }));
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

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../data/config';
import { Puppet, type CitizenState } from './puppet';
import { outlineGeometry, paperMaterial } from './materials';

export interface CrowdSnapshot { total: number; awake: number; recruiting: number; believers: number; arguing: number }
export interface Drop { kind: string; x: number; z: number; life: number; capacity: number; age: number; title?: string; line?: string; mesh?: THREE.Object3D }

const paper = 0xf4f3ef;
const ink = 0x14140f;
const loader = new GLTFLoader();

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 250);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly citizens: Puppet[] = [];
  readonly drops: Drop[] = [];
  private readonly clock = new THREE.Clock();
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly holder: HTMLElement;
  private readonly modelGroup = new THREE.Group();
  private readonly coinGroup = new THREE.Group();
  private readonly coins: { mesh: THREE.Mesh; age: number; life: number; spin: number }[] = [];
  private coinClock = 0;
  private attractionClock = 0;
  private giant: THREE.Group | null = null;
  private toppleTime = -1;
  private victoryTime = -1;
  private victoryStart = new THREE.Vector3();
  private victoryTarget = new THREE.Vector3();
  private readonly puffs: { mesh: THREE.Group; velocity: THREE.Vector3; age: number; life: number }[] = [];
  private readonly cursor: THREE.LineSegments;
  private frame = 0;
  private lastDt = 0;
  private ambientTime = 0;
  private active = false;
  private handover = 0;
  private handoverStart = new THREE.Vector3();
  private paused = false;
  private onTick: (dt: number) => void = () => {};
  private onFrame: (time: number) => void = () => {};
  private resizeObserver: ResizeObserver;

  constructor(holder: HTMLElement) {
    this.holder = holder;
    this.scene.background = new THREE.Color(paper);
    this.scene.fog = new THREE.Fog(paper, 80, 160);
    this.camera.position.set(0, 43, 54);
    this.camera.lookAt(0, 2, -3);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    holder.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...CONFIG.camera.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minDistance = CONFIG.camera.minDistance;
    this.controls.maxDistance = CONFIG.camera.maxDistance;
    this.controls.minPolarAngle = CONFIG.camera.minPolar;
    this.controls.maxPolarAngle = CONFIG.camera.maxPolar;
    this.controls.enabled = false;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd4d2c9, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-15, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -48;
    sun.shadow.camera.right = sun.shadow.camera.top = 48;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshLambertMaterial({ color: paper }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground, this.modelGroup, this.coinGroup);
    const segments: number[] = [];
    for (let i = 0; i < CONFIG.cursor.dashes; i++) {
      const a = i / CONFIG.cursor.dashes * Math.PI * 2;
      const b = (i + CONFIG.cursor.dashFill) / CONFIG.cursor.dashes * Math.PI * 2;
      const radius = 3.2;
      segments.push(Math.cos(a)*radius,0.05,Math.sin(a)*radius,Math.cos(b)*radius,0.05,Math.sin(b)*radius);
    }
    const cursorGeometry = new THREE.BufferGeometry();
    cursorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    this.cursor = new THREE.LineSegments(cursorGeometry, new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.55 }));
    this.cursor.visible = false;
    this.scene.add(this.cursor);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(holder);
    this.resize();
    this.seedCrowd();
    this.seedCoins();
    this.loadGiant();
    this.animate();
  }

  setTick(callback: (dt: number) => void) { this.onTick = callback; }
  setFrame(callback: (time: number) => void) { this.onFrame = callback; }
  setActive(value: boolean) {
    if (value && !this.active) { this.handover = 0; this.handoverStart.copy(this.camera.position); }
    if (!value) this.controls.enabled = false;
    this.active = value;
  }
  setPaused(value: boolean) { this.paused = value; }
  celebrate() {
    this.victoryTime = 0;
    this.victoryStart.copy(this.camera.position);
    this.victoryTarget.copy(this.controls.target);
    this.controls.enabled = false;
  }

  private seedCrowd() {
    const count = matchMedia('(pointer: coarse)').matches || innerWidth < 620 ? 26 : 48;
    let seed = 0x5d19f3;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const centers = Array.from({ length: 11 }, () => {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 22;
      return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius + 2 };
    });
    for (let i = 0; i < count; i++) {
      const chatting = i >= 2 && i < Math.min(24, count - 1);
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 25;
      const center = centers[Math.floor((i - 2) / 2)] ?? { x: 0, z: 0 };
      const x = chatting ? center.x + (i % 2 ? -0.55 : 0.55) : Math.sin(angle) * radius;
      const z = chatting ? center.z + (random() - 0.5) * 0.8 : Math.cos(angle) * radius + 2;
      const kind = i % 3 === 0 ? 'hat' : i % 3 === 1 ? 'shirt' : 'plain';
      const citizen = new Puppet(x, z, kind, 0.9 + (i % 7) / 35, i * 1.81);
      if (chatting) citizen.group.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
      if (i < 2) citizen.setState('awake');
      else if (i < 24) citizen.setState('talking');
      this.citizens.push(citizen);
      this.scene.add(citizen.group);
    }
  }

  private seedCoins() {
    const texture = new THREE.TextureLoader().load('/assets/brand/coin.png');
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.PlaneGeometry(0.56, 0.56);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const coin = new THREE.Mesh(geometry, material);
      coin.position.set(Math.sin(i * 2.8) * (10 + i * 2), 0.8 + i % 3, Math.cos(i * 2.8) * (8 + i * 2));
      coin.rotation.y = i * 0.7;
      coin.rotation.x = 0.15;
      this.coinGroup.add(coin);
      this.coins.push({ mesh: coin, age: i * 0.43, life: 3 + i * 0.43, spin: 1 + i * 0.2 });
    }
  }

  private async loadGiant() {
    try {
      const gltf = await loader.loadAsync('/assets/giant.glb');
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      root.scale.setScalar(48 / size.y);
      const scaled = new THREE.Box3().setFromObject(root);
      root.position.set(0, -scaled.min.y, -26);
      root.rotation.y = CONFIG.giant.rotation;
      const meshes: THREE.Mesh[] = [];
      root.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
      for (const object of meshes) {
        object.castShadow = true;
        const original = Array.isArray(object.material) ? object.material[0] : object.material;
        const map = original instanceof THREE.MeshStandardMaterial ? this.grayscaleMap(original.map) : null;
        object.material = paperMaterial(map);
        const edge = new THREE.Mesh(outlineGeometry(object.geometry, 0.2 / root.scale.x), new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide }));
        object.add(edge);
      }
      this.giant = root;
      this.scene.add(root);
    } catch (error) { console.warn('Could not load the original giant model', error); }
  }

  private grayscaleMap(map: THREE.Texture | null) {
    const image = map?.image;
    if (!map || !image?.width || !image?.height) return map;
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const largest = Math.max(r, g, b), smallest = Math.min(r, g, b);
      if (largest > 0 && (largest - smallest) / largest > 0.2) { data[i] = data[i+1] = data[i+2] = 255; continue; }
      let value = Math.max(0, Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b - 34) / (96 - 34)));
      value = value * value * (3 - 2 * value);
      data[i] = data[i + 1] = data[i + 2] = 22 + (255 - 22) * value;
    }
    context.putImageData(pixels, 0, 0);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.flipY = map.flipY;
    result.wrapS = map.wrapS; result.wrapT = map.wrapT;
    result.anisotropy = 4;
    return result;
  }

  private resize() {
    const width = Math.max(1, this.holder.clientWidth);
    const height = Math.max(1, this.holder.clientHeight);
    this.camera.aspect = width / height;
    const aspectFactor = Math.max(1, 1.4 / this.camera.aspect);
    this.camera.fov = Math.min(58, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(34) / 2) * aspectFactor)));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  screenToWorld(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height * 2 - 1));
    this.ray.setFromCamera(mouse, this.camera);
    const point = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, point) ? { x: point.x, z: point.z } : null;
  }

  setCursorPosition(x: number, z: number) { this.cursor.position.set(x, 0, z); }
  setCursorVisible(visible: boolean) { this.cursor.visible = visible; }

  addDrop(kind: string, x: number, z: number, life: number, capacity: number, title?: string, line?: string) {
    const drop: Drop = { kind, x, z, life, capacity, age: 0, title, line };
    this.drops.push(drop);
    const geo = new THREE.RingGeometry(0.7, 0.75, 48);
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.025, z);
    this.scene.add(ring);
    setTimeout(() => { this.scene.remove(ring); geo.dispose(); (ring.material as THREE.Material).dispose(); }, 450);
    const modelPath = ({ ball: 'prop_ball.glb', cat: 'prop_cat.glb', tv: 'prop_tv.glb' } as Record<string,string>)[kind];
    if (modelPath) loader.load('/assets/' + modelPath, (gltf) => {
      if (!this.drops.includes(drop)) return;
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const height = bounds.getSize(new THREE.Vector3()).y;
      model.scale.setScalar((kind === 'ball' ? 0.44 : kind === 'cat' ? 0.8 : 1.2) / Math.max(height, 0.001));
      const after = new THREE.Box3().setFromObject(model);
      model.position.set(x, -after.min.y, z);
      this.modelGroup.add(model);
      drop.mesh = model;
    });
    else {
      const object = this.buildProp(kind);
      object.position.set(x, 0, z);
      this.modelGroup.add(object);
      drop.mesh = object;
    }
  }

  private buildProp(kind: string) {
    const group = new THREE.Group();
    const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, dark = false) => {
      const mesh = new THREE.Mesh(geometry, dark ? new THREE.MeshBasicMaterial({ color: ink }) : paperMaterial());
      mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh);
      if (!dark) {
        const outline = new THREE.Mesh(outlineGeometry(geometry, 0.045), new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide }));
        outline.position.copy(mesh.position); group.add(outline);
      }
    };
    if (kind === 'dance' || kind === 'news') {
      add(new THREE.BoxGeometry(0.7, 1.2, 0.16), 0, 0.75, 0);
      add(new THREE.PlaneGeometry(0.52, 0.9), 0, 0.75, 0.09, true);
      add(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8), 0, 0.22, 0);
    } else {
      add(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 10), 0, 0.6, 0);
      add(new THREE.BoxGeometry(kind === 'trainer' ? 1.25 : 0.9, 0.55, 0.28), 0, 1.3, 0);
      add(new THREE.BoxGeometry(1.05, 0.1, 0.55), 0, 0.48, 0);
      if (kind === 'priest') {
        add(new THREE.BoxGeometry(0.08, 0.55, 0.08), 0, 1.78, 0);
        add(new THREE.BoxGeometry(0.33, 0.08, 0.08), 0, 1.87, 0);
      }
    }
    return group;
  }

  snapshot(): CrowdSnapshot {
    return this.citizens.reduce<CrowdSnapshot>((s, c) => {
      if (c.state === 'awake') { s.awake++; if (Math.hypot(c.x, c.z + 26) < CONFIG.uprising.recruitRadius) s.recruiting++; }
      if (c.state === 'believing') s.believers++;
      if (c.state === 'arguing') s.arguing++;
      return s;
    }, { total: this.citizens.length, awake: 0, recruiting: 0, believers: 0, arguing: 0 });
  }

  affectNearest(x: number, z: number, radius: number, limit: number, state: CitizenState) {
    const close = this.citizens.filter(c => Math.hypot(c.x - x, c.z - z) < radius && c.state === 'awake')
      .sort((a,b) => Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z)).slice(0, limit);
    close.forEach(c => c.setState(state));
    return close.length;
  }

  reset() {
    for (const drop of this.drops) if (drop.mesh) this.modelGroup.remove(drop.mesh);
    this.drops.length = 0;
    this.toppleTime = -1;
    this.victoryTime = -1;
    this.controls.enabled = false;
    if (this.giant) { this.giant.rotation.x = 0; this.giant.rotation.z = 0; }
    for (const puff of this.puffs) this.scene.remove(puff.mesh);
    this.puffs.length = 0;
    this.citizens.forEach((c, i) => { c.setState(i < 2 ? 'awake' : i < 24 ? 'talking' : 'living'); c.targetX = c.x; c.targetZ = c.z; });
  }

  topple() { this.toppleTime = 0; }

  private impact() {
    const origin = new THREE.Vector3(0, 0.4, -26);
    for (let i = 0; i < 30; i++) {
      const radius = 0.25 + Math.random() * 0.55;
      const shell = new THREE.Group();
      const geometry = new THREE.SphereGeometry(radius, 8, 6);
      shell.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: paper })));
      shell.add(new THREE.Mesh(outlineGeometry(geometry, 0.03), new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide })));
      shell.position.copy(origin);
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      const velocity = new THREE.Vector3(Math.sin(angle) * speed, 1.5 + Math.random() * 5, Math.cos(angle) * speed);
      this.scene.add(shell);
      this.puffs.push({ mesh: shell, velocity, age: 0, life: 2.8 + Math.random() * 1.6 });
    }
  }

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.lastDt = dt;
    this.ambientTime += dt;
    const time = this.ambientTime;
    this.coinClock += dt;
    for (const coin of this.coins) {
      coin.age += dt;
      coin.mesh.position.y += dt * 0.34;
      coin.mesh.rotation.y += dt * coin.spin;
      if (coin.age > coin.life) {
        coin.age = 0;
        const index = Math.floor(Math.random() * this.citizens.length);
        const person = this.citizens[index];
        coin.mesh.position.set(person.x, 0.4, person.z);
      }
    }
    if (this.active && !this.paused) {
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const drop = this.drops[i];
        drop.life -= dt; drop.age += dt;
        if (drop.life <= 0) {
          if (drop.mesh) this.modelGroup.remove(drop.mesh);
          this.drops.splice(i, 1);
        }
      }
      this.attractionClock += dt;
      if (this.attractionClock >= 0.35) { this.attractionClock = 0; this.updateDrops(); }
    }
    if (!this.active) {
      const intro = CONFIG.intro;
      const blend = 0.5 - 0.5 * Math.cos(time / intro.cycle * Math.PI * 2);
      const distance = THREE.MathUtils.lerp(intro.wide.dist, intro.close.dist, blend);
      const height = THREE.MathUtils.lerp(intro.wide.height, intro.close.height, blend);
      const angle = time * intro.spin;
      this.camera.position.set(Math.sin(angle) * distance, height, Math.cos(angle) * distance);
      this.camera.lookAt(0, 1.7, 0);
    } else if (this.victoryTime >= 0) {
      this.victoryTime += dt;
      const t = this.victoryTime;
      const move = 2.9;
      const hold = 5.4;
      const giant = new THREE.Vector3(0, 1.5, -26);
      const first = Math.min(1, t / move);
      const firstEase = first * first * (3 - 2 * first);
      const second = Math.min(1, Math.max(0, (t - move * 0.7) / (move * 0.3 + hold)));
      const secondEase = second * second * (3 - 2 * second);
      const angle = Math.atan2(this.victoryStart.x - this.victoryTarget.x, this.victoryStart.z - this.victoryTarget.z) + 0.3 * firstEase;
      const distance = THREE.MathUtils.lerp(this.victoryStart.distanceTo(this.victoryTarget), 62, firstEase);
      const height = THREE.MathUtils.lerp(this.victoryStart.y, giant.y + 6.5, firstEase);
      this.camera.position.set(giant.x + Math.sin(angle) * distance, height, giant.z + Math.cos(angle) * distance);
      this.camera.lookAt(this.victoryTarget.clone().lerp(giant, secondEase));
    } else if (this.handover < CONFIG.intro.handover) {
      this.handover = Math.min(CONFIG.intro.handover, this.handover + dt);
      const fraction = this.handover / CONFIG.intro.handover;
      const ease = fraction * fraction * (3 - 2 * fraction);
      const destination = new THREE.Vector3(...CONFIG.camera.position);
      if (matchMedia('(pointer: coarse)').matches) { destination.multiplyScalar(CONFIG.mobile.pullBack); destination.y *= CONFIG.mobile.tilt; }
      this.camera.position.lerpVectors(this.handoverStart, destination, ease);
      this.camera.lookAt(...CONFIG.camera.target);
      if (this.handover >= CONFIG.intro.handover) {
        this.controls.target.set(...CONFIG.camera.target);
        this.controls.enabled = true;
        this.controls.update();
      }
    } else {
      this.controls.update();
    }
    for (const [index, citizen] of this.citizens.entries()) {
      if ((index + Math.floor(time * 0.55)) % 19 === 0 && Math.hypot(citizen.targetX - citizen.x, citizen.targetZ - citizen.z) < 1) {
        const angle = time * 0.5 + index * 2.4;
        citizen.targetX = Math.max(-25, Math.min(25, citizen.x + Math.cos(angle) * 2.5));
        citizen.targetZ = Math.max(-15, Math.min(26, citizen.z + Math.sin(angle) * 2.5));
      }
      if (this.active && !this.paused && citizen.state === 'awake') {
        citizen.targetX = citizen.x * 0.95;
        citizen.targetZ = -24;
      }
      citizen.update(this.paused ? 0 : dt, time);
    }
    if (this.giant) {
      if (this.toppleTime >= 0) {
        const was = this.toppleTime;
        this.toppleTime = Math.min(1.5, this.toppleTime + dt);
        const fraction = this.toppleTime / 1.5;
        const ease = fraction * fraction * (3 - 2 * fraction);
        this.giant.rotation.x = -ease * 1.62;
        if (was < 1.5 && this.toppleTime >= 1.5) this.impact();
      } else this.giant.rotation.z = Math.sin(time * 0.21) * 0.009;
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      puff.age += dt;
      puff.velocity.y -= dt * 3;
      puff.mesh.position.addScaledVector(puff.velocity, dt);
      puff.mesh.scale.setScalar(1 + puff.age * 0.4);
      if (puff.age >= puff.life) { this.scene.remove(puff.mesh); this.puffs.splice(i, 1); }
    }
    if (this.active && !this.paused) this.onTick(dt);
    this.onFrame(time);
    this.renderer.render(this.scene, this.camera);
  };

  private updateDrops() {
    for (const drop of this.drops) {
      const prop = CONFIG.props.kinds[drop.kind as keyof typeof CONFIG.props.kinds];
      if (!prop) continue;
      const radius = prop.pull;
      const state: CitizenState = prop.mode === 'influence' ? 'believing' : prop.mode === 'blame' ? 'arguing' : 'watching';
      const nearby = this.citizens.filter(c => c.state === state && Math.hypot(c.x - drop.x, c.z - drop.z) < radius);
      const room = Math.max(0, drop.capacity - nearby.length);
      const candidates = this.citizens.filter(c => c.state === 'awake' && Math.hypot(c.x - drop.x, c.z - drop.z) < radius)
        .sort((a, b) => Math.hypot(a.x - drop.x, a.z - drop.z) - Math.hypot(b.x - drop.x, b.z - drop.z))
        .slice(0, room);
      for (const [i, citizen] of candidates.entries()) {
        citizen.setState(state);
        citizen.targetX = drop.x + Math.sin(i * 2.4) * (state === 'arguing' ? 7 : 1.6);
        citizen.targetZ = drop.z + Math.cos(i * 2.4) * (state === 'arguing' ? 7 : 1.6);
      }
      if (prop.mode === 'influence' && 'convertEvery' in prop && drop.age > prop.convertEvery) {
        const convert = nearby.filter(c => c.state === 'believing');
        if (convert.length) convert[Math.floor(Math.random() * convert.length)].targetZ = Math.min(24, drop.z + 4);
        drop.age = 0;
      }
    }
    for (const citizen of this.citizens) {
      if (citizen.state === 'watching' && !this.drops.some(d => Math.hypot(citizen.x - d.x, citizen.z - d.z) < 7)) citizen.setState('living');
    }
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.citizens.forEach(c => c.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

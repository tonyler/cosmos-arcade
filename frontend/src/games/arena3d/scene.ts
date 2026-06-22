// Void Arena — Three.js scene management
// No post-processing libs needed: emissive materials + point lights = glow.

import * as THREE from 'three'
import { OBSTACLES, ARENA_W, ARENA_D, PLAYER_RADIUS, RELOAD_TIME, type Arena3DState } from './engine'

const P1_HEX = 0x00d4ff  // cyan  (matches app P1 color)
const P2_HEX = 0xff6b35  // orange (matches app P2 color)

export interface SceneHandle {
  canvas: HTMLCanvasElement
  getWorldXZ: (screenX: number, screenY: number) => { x: number; z: number } | null
  render: (state: Arena3DState, mySlot: 1 | 2) => void
  resize: (w: number, h: number) => void
  dispose: () => void
}

export function createScene(container: HTMLElement): SceneHandle {
  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x050810)
  // ponytail: canvas fills container via CSS; WebGL buffer sized by ResizeObserver
  renderer.domElement.style.width  = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  container.appendChild(renderer.domElement)

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x050810, 70, 130)

  // ── Camera — overhead isometric perspective ────────────────────────────────
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200)
  camera.position.set(0, 52, 42)
  camera.lookAt(0, 0, 8)

  const resize = (w: number, h: number) => {
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize(container.clientWidth, container.clientHeight)

  // ── Lights ────────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x1a1a2e, 3))

  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(8, 30, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { near: 0.5, far: 120, left: -50, right: 50, top: 35, bottom: -35 })
  scene.add(sun)

  // Player point lights — follow each player to tint surroundings
  const p1Light = new THREE.PointLight(P1_HEX, 1.2, 22)
  const p2Light = new THREE.PointLight(P2_HEX, 1.2, 22)
  p1Light.position.set(-22, 3, 0)
  p2Light.position.set( 22, 3, 0)
  scene.add(p1Light, p2Light)

  // ── Arena floor ───────────────────────────────────────────────────────────
  const floorGeo = new THREE.PlaneGeometry(ARENA_W, ARENA_D)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x080d18, roughness: 0.9, metalness: 0.1 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Grid helper (neon tinted)
  const grid = new THREE.GridHelper(80, 40, 0x112244, 0x0d1a2e)
  grid.position.y = 0.01
  scene.add(grid)

  // Neon border lines
  const hw = ARENA_W / 2 - 0.1, hd = ARENA_D / 2 - 0.1
  const borderPts = [
    new THREE.Vector3(-hw, 0.05, -hd), new THREE.Vector3( hw, 0.05, -hd),
    new THREE.Vector3( hw, 0.05,  hd), new THREE.Vector3(-hw, 0.05,  hd),
    new THREE.Vector3(-hw, 0.05, -hd),
  ]
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(borderPts),
    new THREE.LineBasicMaterial({ color: 0x1e4080 }),
  ))

  // ── Obstacles ─────────────────────────────────────────────────────────────
  const obsMat = new THREE.MeshStandardMaterial({
    color: 0x0d1f3a, emissive: 0x081530, emissiveIntensity: 1,
    roughness: 0.2, metalness: 0.9,
  })
  const obsEdgeMat = new THREE.LineBasicMaterial({ color: 0x1e4080 })

  for (const obs of OBSTACLES) {
    const geo = new THREE.BoxGeometry(obs.hw * 2, 2, obs.hd * 2)
    const mesh = new THREE.Mesh(geo, obsMat)
    mesh.position.set(obs.cx, 1, obs.cz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), obsEdgeMat)
    edges.position.set(obs.cx, 1, obs.cz)
    scene.add(edges)
  }

  // ── Player meshes ─────────────────────────────────────────────────────────
  function makePlayerGroup(color: number): THREE.Group {
    const group = new THREE.Group()

    const bodyMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.7,
    })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 16), bodyMat)
    body.position.y = 0.8
    body.castShadow = true
    group.add(body)

    // Gun barrel pointing in local +Z direction
    const gunMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, metalness: 0.95 })
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.9), gunMat)
    gun.position.set(0, 0.9, PLAYER_RADIUS + 0.45)
    group.add(gun)

    // Glowing top orb
    const orbMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5, transparent: true, opacity: 0.85 })
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), orbMat)
    orb.position.y = 1.85
    group.add(orb)

    return group
  }

  const p1Mesh = makePlayerGroup(P1_HEX)
  const p2Mesh = makePlayerGroup(P2_HEX)
  scene.add(p1Mesh, p2Mesh)

  // ── Reload rings ──────────────────────────────────────────────────────────
  function makeReloadRing(color: number): THREE.Mesh {
    const geo = new THREE.TorusGeometry(1.5, 0.12, 8, 40)
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.08
    mesh.visible = false
    return mesh
  }
  const p1Ring = makeReloadRing(P1_HEX)
  const p2Ring = makeReloadRing(P2_HEX)
  scene.add(p1Ring, p2Ring)

  // ── Bullet pool ───────────────────────────────────────────────────────────
  const bulletGeo = new THREE.SphereGeometry(0.28, 6, 6)
  const myBulletMat  = new THREE.MeshStandardMaterial({ color: P1_HEX, emissive: P1_HEX, emissiveIntensity: 3 })
  const oppBulletMat = new THREE.MeshStandardMaterial({ color: P2_HEX, emissive: P2_HEX, emissiveIntensity: 3 })

  const myBulletMeshes  = new Map<number, THREE.Mesh>()
  const oppBulletMeshes = new Map<number, THREE.Mesh>()

  function syncBullets(
    live: { id: number; x: number; z: number }[],
    pool: Map<number, THREE.Mesh>,
    mat: THREE.Material,
    mySlotColor: boolean,
    mySlot: 1 | 2,
  ) {
    const liveIds = new Set(live.map(b => b.id))
    // Remove stale
    for (const [id, mesh] of pool) {
      if (!liveIds.has(id)) { scene.remove(mesh); pool.delete(id) }
    }
    // Create/update
    for (const b of live) {
      if (!pool.has(b.id)) {
        // ponytail: shared geometry is fine — Three.js handles it
        const mesh = new THREE.Mesh(bulletGeo, mat)
        mesh.position.y = 0.9
        scene.add(mesh)
        pool.set(b.id, mesh)
      }
      pool.get(b.id)!.position.set(b.x, 0.9, b.z)
    }
    void mySlotColor; void mySlot // used only to determine which mat to pass in
  }

  // ── Mouse raycasting ──────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // y=0 plane
  const mouseNDC = new THREE.Vector2()
  const worldPoint = new THREE.Vector3()

  function getWorldXZ(screenX: number, screenY: number): { x: number; z: number } | null {
    const rect = renderer.domElement.getBoundingClientRect()
    mouseNDC.set(
      ((screenX - rect.left) / rect.width)  *  2 - 1,
      ((screenY - rect.top)  / rect.height) * -2 + 1,
    )
    raycaster.setFromCamera(mouseNDC, camera)
    const hit = raycaster.ray.intersectPlane(groundPlane, worldPoint)
    return hit ? { x: worldPoint.x, z: worldPoint.z } : null
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render(state: Arena3DState, mySlot: 1 | 2) {
    const { myPlayer, oppPlayer } = state

    const myMesh  = mySlot === 1 ? p1Mesh : p2Mesh
    const oppMesh = mySlot === 1 ? p2Mesh : p1Mesh

    myMesh.position.set(myPlayer.x, 0, myPlayer.z)
    myMesh.rotation.y = myPlayer.rotY
    myMesh.visible = myPlayer.alive

    oppMesh.position.set(oppPlayer.x, 0, oppPlayer.z)
    oppMesh.rotation.y = oppPlayer.rotY
    oppMesh.visible = oppPlayer.alive

    // Reload rings
    const p1Player = mySlot === 1 ? myPlayer : oppPlayer
    const p2Player = mySlot === 1 ? oppPlayer : myPlayer

    const updateRing = (ring: THREE.Mesh, player: typeof myPlayer) => {
      if (player.reloadTimer > 0) {
        const progress = 1 - player.reloadTimer / RELOAD_TIME
        ring.visible = true
        ring.position.set(player.x, 0.08, player.z)
        ring.scale.set(progress, 1, progress)
        ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + progress * 0.6
      } else {
        ring.visible = false
      }
    }
    updateRing(p1Ring, p1Player)
    updateRing(p2Ring, p2Player)

    // Dynamic player lights
    p1Light.position.set(p1Player.x, 3, p1Player.z)
    p2Light.position.set(p2Player.x, 3, p2Player.z)
    p1Light.intensity = p1Player.alive ? 1.2 : 0.2
    p2Light.intensity = p2Player.alive ? 1.2 : 0.2

    // Swap bullet materials based on mySlot
    const myMat  = mySlot === 1 ? myBulletMat  : oppBulletMat
    const oppMat = mySlot === 1 ? oppBulletMat : myBulletMat

    syncBullets(state.myBullets,  myBulletMeshes,  myMat,  true,  mySlot)
    syncBullets(state.oppBullets, oppBulletMeshes, oppMat, false, mySlot)

    renderer.render(scene, camera)
  }

  // ── Dispose ───────────────────────────────────────────────────────────────
  function dispose() {
    for (const m of myBulletMeshes.values())  scene.remove(m)
    for (const m of oppBulletMeshes.values()) scene.remove(m)
    myBulletMeshes.clear()
    oppBulletMeshes.clear()
    bulletGeo.dispose()
    myBulletMat.dispose()
    oppBulletMat.dispose()
    ;(p1Ring.material as THREE.MeshBasicMaterial).dispose()
    ;(p2Ring.material as THREE.MeshBasicMaterial).dispose()
    renderer.dispose()
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
  }

  return { canvas: renderer.domElement, getWorldXZ, render, resize, dispose }
}

// ── Preview scene (landing page hero) ─────────────────────────────────────────
// Runs two bot players orbiting and shooting. No engine dependency.

export interface PreviewHandle {
  resize: (w: number, h: number) => void
  dispose: () => void
}

export function createPreviewScene(container: HTMLElement): PreviewHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = false
  renderer.setClearColor(0x050810, 1)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x050810, 40, 80)

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 150)
  camera.position.set(0, 30, 16)
  camera.lookAt(0, 0, -1)

  const resize = (w: number, h: number) => {
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize(container.clientWidth || 400, container.clientHeight || 260)

  // Lights
  scene.add(new THREE.AmbientLight(0x1a1a2e, 3))
  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.position.set(8, 25, 10)
  scene.add(sun)
  const p1L = new THREE.PointLight(P1_HEX, 1.5, 20)
  const p2L = new THREE.PointLight(P2_HEX, 1.5, 20)
  scene.add(p1L, p2L)

  // Floor + grid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_W, ARENA_D),
    new THREE.MeshStandardMaterial({ color: 0x080d18 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
  scene.add(new THREE.GridHelper(60, 30, 0x112244, 0x0d1a2e))

  // Border
  const hw = ARENA_W / 2 - 0.1, hd = ARENA_D / 2 - 0.1
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-hw, 0.05, -hd), new THREE.Vector3( hw, 0.05, -hd),
      new THREE.Vector3( hw, 0.05,  hd), new THREE.Vector3(-hw, 0.05,  hd),
      new THREE.Vector3(-hw, 0.05, -hd),
    ]),
    new THREE.LineBasicMaterial({ color: 0x1e4080 }),
  ))

  // Obstacles
  const obsMat = new THREE.MeshStandardMaterial({ color: 0x0d1f3a, emissive: 0x081530, emissiveIntensity: 1, roughness: 0.2, metalness: 0.9 })
  const obsEdgeMat = new THREE.LineBasicMaterial({ color: 0x1e4080 })
  for (const obs of OBSTACLES) {
    const geo = new THREE.BoxGeometry(obs.hw * 2, 2, obs.hd * 2)
    const m = new THREE.Mesh(geo, obsMat)
    m.position.set(obs.cx, 1, obs.cz)
    scene.add(m)
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), obsEdgeMat)
    e.position.set(obs.cx, 1, obs.cz)
    scene.add(e)
  }

  // Bot meshes
  function makeBotGroup(color: number): THREE.Group {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.7 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 16), mat)
    body.position.y = 0.8
    g.add(body)
    const gunMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, metalness: 0.95 })
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.9), gunMat)
    gun.position.set(0, 0.9, PLAYER_RADIUS + 0.45)
    g.add(gun)
    const orbMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5, transparent: true, opacity: 0.85 })
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), orbMat)
    orb.position.y = 1.85
    g.add(orb)
    return g
  }

  const b1 = makeBotGroup(P1_HEX)
  const b2 = makeBotGroup(P2_HEX)
  scene.add(b1, b2)

  // Preview bullet pool
  const bulletGeo = new THREE.SphereGeometry(0.25, 5, 5)
  const mat1 = new THREE.MeshStandardMaterial({ color: P1_HEX, emissive: P1_HEX, emissiveIntensity: 3 })
  const mat2 = new THREE.MeshStandardMaterial({ color: P2_HEX, emissive: P2_HEX, emissiveIntensity: 3 })

  type PreviewBullet = { mesh: THREE.Mesh; x: number; z: number; vx: number; vz: number; age: number }
  const bullets: PreviewBullet[] = []
  let lastShot1 = 0, lastShot2 = 0

  let raf = 0
  const clock = new THREE.Clock()

  function loop() {
    raf = requestAnimationFrame(loop)
    const t = clock.getElapsedTime()
    const dt = Math.min(clock.getDelta() * 1000, 50)

    // Smooth bot orbits
    const p1x = Math.sin(t * 0.6) * 16
    const p1z = Math.cos(t * 0.4) * 9
    const p2x = Math.sin(t * 0.6 + Math.PI) * 16
    const p2z = Math.cos(t * 0.4 + Math.PI) * 9

    b1.position.set(p1x, 0, p1z)
    b1.rotation.y = Math.atan2(p2x - p1x, p2z - p1z)
    b2.position.set(p2x, 0, p2z)
    b2.rotation.y = Math.atan2(p1x - p2x, p1z - p2z)

    p1L.position.set(p1x, 3, p1z)
    p2L.position.set(p2x, 3, p2z)

    // Spawn bullets periodically
    const now = t * 1000
    const spawnInterval = 1400
    if (now - lastShot1 > spawnInterval) {
      lastShot1 = now
      const rotY = b1.rotation.y
      const mesh = new THREE.Mesh(bulletGeo, mat1)
      mesh.position.set(p1x + Math.sin(rotY) * 1.1, 0.9, p1z + Math.cos(rotY) * 1.1)
      scene.add(mesh)
      bullets.push({ mesh, x: mesh.position.x, z: mesh.position.z, vx: Math.sin(rotY) * 38, vz: Math.cos(rotY) * 38, age: 0 })
    }
    if (now - lastShot2 > spawnInterval) {
      lastShot2 = now + 700 // offset so bullets don't overlap
      const rotY = b2.rotation.y
      const mesh = new THREE.Mesh(bulletGeo, mat2)
      mesh.position.set(p2x + Math.sin(rotY) * 1.1, 0.9, p2z + Math.cos(rotY) * 1.1)
      scene.add(mesh)
      bullets.push({ mesh, x: mesh.position.x, z: mesh.position.z, vx: Math.sin(rotY) * 38, vz: Math.cos(rotY) * 38, age: 0 })
    }

    // Move + cull bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]
      b.x += b.vx * dt / 1000
      b.z += b.vz * dt / 1000
      b.age += dt
      b.mesh.position.set(b.x, 0.9, b.z)
      if (b.age > 2000 || Math.abs(b.x) > 32 || Math.abs(b.z) > 22) {
        scene.remove(b.mesh)
        bullets.splice(i, 1)
      }
    }

    renderer.render(scene, camera)
  }

  loop()

  function dispose() {
    cancelAnimationFrame(raf)
    for (const b of bullets) scene.remove(b.mesh)
    bulletGeo.dispose()
    mat1.dispose(); mat2.dispose()
    renderer.dispose()
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
  }

  return { resize, dispose }
}

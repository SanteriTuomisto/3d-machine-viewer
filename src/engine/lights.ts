import { AmbientLight, DirectionalLight, type Scene } from 'three'

export function addDefaultLights(scene: Scene) {
  scene.add(new AmbientLight(0xffffff, 0.35))
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(6, 10, 8)
  scene.add(key)
  const fill = new DirectionalLight(0xffffff, 0.5)
  fill.position.set(-6, -4, -8)
  scene.add(fill)
}

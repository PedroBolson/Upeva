import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import * as THREE from 'three'

gsap.registerPlugin(useGSAP)

const DOG_MODEL_URL = '/models/hero/dog.glb'
const CAT_MODEL_URL = '/models/hero/cat.glb'

type PetAnimation = 'Walk' | 'Idle' | 'Headbutt'

interface LoadedPetModel {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
}

interface PetAnimationController {
  play: (animation: PetAnimation, fadeDuration?: number) => void
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    function handleChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

function useSupportsWebGL() {
  const [supportsWebGL] = useState(() => {
    if (typeof document === 'undefined') {
      return false
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')

    return Boolean(context)
  })

  return supportsWebGL
}

export function Hero3DFallback() {
  return null
}

interface Hero3DSceneProps {
  compact?: boolean
  copyRevealTarget?: React.RefObject<HTMLDivElement | null>
}

export function Hero3DScene({ compact = false, copyRevealTarget }: Hero3DSceneProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const supportsWebGL = useSupportsWebGL()
  const logoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!prefersReducedMotion && supportsWebGL) {
      return
    }

    const target = copyRevealTarget?.current

    if (target) {
      gsap.set(target, { '--hero-copy-reveal': '100%', opacity: 1 })
    }
  }, [copyRevealTarget, prefersReducedMotion, supportsWebGL])

  useGSAP(() => {
    if (!logoRef.current || prefersReducedMotion || !supportsWebGL) {
      return
    }

    gsap.fromTo(
      logoRef.current,
      { autoAlpha: 0, y: 52, scale: 0.62, rotateX: -18 },
      { autoAlpha: 1, y: 0, scale: 1, rotateX: 0, duration: 0.68, delay: 1.92, ease: 'back.out(1.8)' },
    )
  }, [prefersReducedMotion, supportsWebGL])

  if (prefersReducedMotion || !supportsWebGL) {
    return <Hero3DFallback />
  }

  return (
    <div className={compact ? 'pointer-events-none relative h-full min-h-80 overflow-hidden' : 'pointer-events-none absolute inset-0 z-20 overflow-hidden'}>
      <Canvas
        aria-hidden="true"
        camera={{ position: [0, compact ? 1 : 1.15, compact ? 9.2 : 8.7], fov: compact ? 45 : 43 }}
        dpr={[1, 1.35]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
      >
        <HeroSceneContent compact={compact} copyRevealTarget={copyRevealTarget} />
      </Canvas>
      <div
        ref={logoRef}
        aria-hidden="true"
        className={
          compact
            ? 'absolute left-1/2 bottom-[41%] flex -translate-x-1/2 origin-center select-none items-center gap-0 font-black leading-none opacity-0'
            : 'absolute left-[69%] top-[67%] hidden -translate-x-1/2 origin-center select-none items-center gap-0 font-black leading-none opacity-0 sm:flex'
        }
        style={{ perspective: '900px' }}
      >
        <img
          src="/brand/upeva-wordmark.svg"
          alt=""
          className={compact ? 'h-auto w-[min(76vw,360px)]' : 'h-auto w-[clamp(260px,31vw,430px)]'}
          draggable={false}
        />
      </div>
    </div>
  )
}

function HeroSceneContent({
  compact,
  copyRevealTarget,
}: {
  compact: boolean
  copyRevealTarget?: React.RefObject<HTMLDivElement | null>
}) {
  const dogRef = useRef<THREE.Group>(null)
  const catRef = useRef<THREE.Group>(null)
  const dogAnimationRef = useRef<PetAnimationController>(null)
  const catAnimationRef = useRef<PetAnimationController>(null)

  useGSAP(() => {
    if (!dogRef.current || !catRef.current) {
      return
    }

    const dogStartX = compact ? -4.9 : -7.1
    const catStartX = compact ? 4.9 : 7.4
    const dogWalkX = compact ? -1.92 : 0.18
    const catWalkX = compact ? 1.92 : 3.28
    const dogFinalX = compact ? -1.68 : 0.42
    const catFinalX = compact ? 1.68 : 3.04
    const baseY = compact ? -0.7 : -0.98

    const copyTarget = copyRevealTarget?.current

    gsap.set(dogRef.current.position, { x: dogStartX, y: baseY - 0.12, z: 0.25 })
    gsap.set(catRef.current.position, { x: catStartX, y: baseY - 0.12, z: 0.18 })
    gsap.set(dogRef.current.rotation, { x: 0, y: 1.08, z: 0.03 })
    gsap.set(catRef.current.rotation, { x: 0, y: -1.08, z: -0.03 })
    if (copyTarget) {
      gsap.set(copyTarget, { '--hero-copy-reveal': '0%', opacity: 0 })
    }

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })

    timeline
      .add(() => {
        dogAnimationRef.current?.play('Walk', 0.12)
        catAnimationRef.current?.play('Walk', 0.12)
      })
      .to(dogRef.current.position, { x: dogWalkX, y: baseY, z: 0.25, duration: 1.55, ease: 'none' })
      .to(catRef.current.position, { x: catWalkX, y: baseY, z: 0.18, duration: 1.55, ease: 'none' }, '<')
      .to(dogRef.current.rotation, { y: 0.5, z: 0, duration: 1.08, ease: 'power2.out' }, '<0.12')
      .to(catRef.current.rotation, { y: -0.5, z: 0, duration: 1.08, ease: 'power2.out' }, '<')
      .add(() => {
        dogAnimationRef.current?.play('Idle', 0.28)
        catAnimationRef.current?.play('Idle', 0.28)
      })
      .to(dogRef.current.position, { x: dogFinalX, y: baseY + 0.04, duration: 0.36, ease: 'back.out(1.7)' })
      .to(catRef.current.position, { x: catFinalX, y: baseY + 0.04, duration: 0.36, ease: 'back.out(1.7)' }, '<')
      .to(dogRef.current.rotation, { y: 0.32, duration: 0.36, ease: 'power2.out' }, '<')
      .to(catRef.current.rotation, { y: -0.32, duration: 0.36, ease: 'power2.out' }, '<')
      .add(() => {
        dogAnimationRef.current?.play('Headbutt', 0.18)
        catAnimationRef.current?.play('Headbutt', 0.18)
      }, '-=0.08')
      .add(() => {
        dogAnimationRef.current?.play('Idle', 0.24)
        catAnimationRef.current?.play('Idle', 0.24)
      })

    if (copyTarget) {
      timeline.to(
        copyTarget,
        {
          '--hero-copy-reveal': '100%',
          opacity: 1,
          duration: compact ? 0.9 : 1.05,
          ease: 'power2.out',
        },
        compact ? 0.18 : 0.58,
      )
    }

    return () => timeline.kill()
  }, [])

  return (
    <>
      <ambientLight intensity={1.35} />
      <hemisphereLight args={['#fff6e8', '#65b8aa', 1.7]} />
      <directionalLight position={[2.4, 4.2, 4.8]} intensity={2.1} />
      <directionalLight position={[-4, 2.2, 2.6]} intensity={0.95} color="#f3b2c8" />
      <directionalLight position={[0, 2.5, -3.5]} intensity={0.7} color="#79d4c8" />

      <group position={[0, 0.08, 0]}>
        <PetModel
          ref={dogRef}
          url={DOG_MODEL_URL}
          animationControllerRef={dogAnimationRef}
          scale={compact ? 1.9 : 1.34}
          modelRotationY={0}
        />
        <PetModel
          ref={catRef}
          url={CAT_MODEL_URL}
          animationControllerRef={catAnimationRef}
          scale={compact ? 1.8 : 1.28}
          modelRotationY={0}
        />
      </group>
    </>
  )
}

function PetModel({
  ref,
  url,
  animationControllerRef,
  scale,
  modelRotationY,
}: {
  ref: React.Ref<THREE.Group>
  url: string
  animationControllerRef: React.RefObject<PetAnimationController | null>
  scale: number
  modelRotationY: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const activeActionRef = useRef<THREE.AnimationAction>(null)
  const model = useGLTF(url) as LoadedPetModel
  const { actions } = useAnimations(model.animations, groupRef)

  useEffect(() => {
    function play(animation: PetAnimation, fadeDuration = 0.18) {
      const clipName = model.animations.find((clip) => clip.name.includes(animation))?.name
      const action = clipName ? actions[clipName] : undefined

      if (!action || activeActionRef.current === action) {
        return
      }

      activeActionRef.current?.fadeOut(fadeDuration)
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fadeDuration).play()
      activeActionRef.current = action
    }

    animationControllerRef.current = { play }
    play('Walk', 0)

    return () => {
      Object.values(actions).forEach((action) => action?.stop())
      activeActionRef.current = null
      animationControllerRef.current = null
    }
  }, [actions, animationControllerRef, model.animations])

  return (
    <group ref={ref}>
      <group ref={groupRef} rotation={[0, modelRotationY, 0]} scale={scale}>
        <primitive object={model.scene} />
      </group>
    </group>
  )
}

useGLTF.preload(DOG_MODEL_URL)
useGLTF.preload(CAT_MODEL_URL)

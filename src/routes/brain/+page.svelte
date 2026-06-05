<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
	import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
	import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

	let canvas: HTMLCanvasElement;
	let rafId: number;
	let renderer: THREE.WebGLRenderer;
	let composer: EffectComposer;

	let showOverlay = $state(false);

	const PULSE_PARAMS: Record<string, { freq: number; phase: number; amp: number }> = $state({
		brain_frontal:         { freq: 0.8,  phase: 0.0, amp: 1.0 },
		brain_parietal:        { freq: 1.1,  phase: 1.2, amp: 0.8 },
		brain_temporal_left:   { freq: 0.9,  phase: 2.4, amp: 1.2 },
		brain_temporal_right:  { freq: 0.9,  phase: 3.6, amp: 1.2 },
		brain_occipital:       { freq: 1.3,  phase: 0.5, amp: 0.9 },
		brain_cerebellum:      { freq: 0.7,  phase: 1.8, amp: 1.0 },
		brain_amygdala_left:   { freq: 1.5,  phase: 0.3, amp: 1.5 },
		brain_amygdala_right:  { freq: 1.5,  phase: 3.0, amp: 1.5 },
	});

	const REGION_META: Record<string, { label: string; color: string }> = {
		brain_frontal:        { label: 'Frontal',    color: '#3380ff' },
		brain_parietal:       { label: 'Parietal',   color: '#b233ff' },
		brain_temporal_left:  { label: 'Temporal L', color: '#ff8c00' },
		brain_temporal_right: { label: 'Temporal R', color: '#ff8c00' },
		brain_occipital:      { label: 'Occipital',  color: '#1aff4d' },
		brain_cerebellum:     { label: 'Cerebellum', color: '#ffe600' },
		brain_amygdala_left:  { label: 'Amygdala L', color: '#ff1a1a' },
		brain_amygdala_right: { label: 'Amygdala R', color: '#ff1a1a' },
	};

	onMount(() => {
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x080810);
		scene.fog = new THREE.Fog(0x080810, 8, 20);

		const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
		camera.position.set(0, 1.6, 4.5);

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		renderer.setPixelRatio(devicePixelRatio);
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		renderer.toneMapping = THREE.ReinhardToneMapping;
		renderer.toneMappingExposure = 1.2;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// --- Lighting ---
		scene.add(new THREE.AmbientLight(0xffffff, 0.15));

		const spot = new THREE.SpotLight(0xfff5e0, 4, 12, Math.PI / 7, 0.4, 1.2);
		spot.position.set(0, 5, 1);
		spot.target.position.set(0, 0.5, 0);
		spot.castShadow = true;
		spot.shadow.mapSize.width = 1024;
		spot.shadow.mapSize.height = 1024;
		spot.shadow.camera.near = 1;
		spot.shadow.camera.far = 14;
		scene.add(spot);
		scene.add(spot.target);

		// cool fill light from behind
		const fillLight = new THREE.PointLight(0x0a1030, 1.5, 8);
		fillLight.position.set(-2, 2, -2);
		scene.add(fillLight);

		// --- Table ---
		const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2208, roughness: 0.7, metalness: 0.05 });
		const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.07, 1.4), woodMat);
		tableTop.position.y = 0;
		tableTop.receiveShadow = true;
		tableTop.castShadow = true;
		scene.add(tableTop);

		const legOffsets = [[-0.95, 0.61], [0.95, 0.61], [-0.95, -0.61], [0.95, -0.61]];
		for (const [lx, lz] of legOffsets) {
			const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.86, 0.07), woodMat);
			leg.position.set(lx, -0.465, lz);
			leg.castShadow = true;
			leg.receiveShadow = true;
			scene.add(leg);
		}

		// --- Floor ---
		const floorMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.95, metalness: 0.0 });
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -0.465;
		floor.receiveShadow = true;
		scene.add(floor);

		// --- Bloom post-processing ---
		composer = new EffectComposer(renderer);
		composer.addPass(new RenderPass(scene, camera));
		composer.addPass(new UnrealBloomPass(
			new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
			0.55, 0.5, 0.2
		));

		// --- Controls ---
		const controls = new OrbitControls(camera, canvas);
		controls.enableDamping = true;
		controls.target.set(0, 0.4, 0);
		controls.minDistance = 1.5;
		controls.maxDistance = 12;
		controls.update();

		// --- Brain model ---
		const regions = new Map<string, THREE.Mesh>();
		const loader = new GLTFLoader();
		loader.load('/brain.glb', (gltf) => {
			const box = new THREE.Box3().setFromObject(gltf.scene);
			const center = box.getCenter(new THREE.Vector3());
			gltf.scene.position.x = -center.x;
			gltf.scene.position.z = -center.z;
			gltf.scene.position.y = -box.min.y + 0.035;

			gltf.scene.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					obj.castShadow = true;
					obj.receiveShadow = true;
					if (obj.name in PULSE_PARAMS) regions.set(obj.name, obj);
				}
			});
			scene.add(gltf.scene);
		});

		const clock = new THREE.Clock();

		const onResize = () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
			composer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
		window.addEventListener('resize', onResize);

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'p' || e.key === 'P') showOverlay = !showOverlay;
		};
		window.addEventListener('keydown', onKeyDown);

		const animate = () => {
			rafId = requestAnimationFrame(animate);
			const t = clock.getElapsedTime();
			controls.update();
			regions.forEach((mesh, name) => {
				const p = PULSE_PARAMS[name];
				(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
					p.amp * (Math.sin(t * p.freq + p.phase) * 0.5 + 0.5);
			});
			composer.render();
		};
		animate();

		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('keydown', onKeyDown);
			controls.dispose();
		};
	});

	onDestroy(() => {
		if (!browser) return;
		cancelAnimationFrame(rafId);
		composer?.dispose();
		renderer?.dispose();
	});
</script>

<svelte:head><title>Brain — WebGL Demo</title></svelte:head>

<canvas bind:this={canvas} style="width:100vw;height:100vh;display:block;"></canvas>

<button class="toggle-btn" onclick={() => (showOverlay = !showOverlay)}>
	PARAMS {showOverlay ? '◂' : '▸'}
</button>

<aside class="overlay" class:open={showOverlay}>
	<div class="overlay-header">REGION ACTIVATION</div>

	{#each Object.entries(PULSE_PARAMS) as [key, params]}
		{@const meta = REGION_META[key]}
		<div class="region-row">
			<div class="region-label">
				<span class="color-dot" style="background:{meta.color}"></span>
				{meta.label}
			</div>
			<div class="slider-row">
				<span class="param-name">Speed</span>
				<input
					type="range" min="0.1" max="3" step="0.01"
					value={params.freq}
					oninput={(e) => (params.freq = parseFloat(e.currentTarget.value))}
				/>
				<span class="val">{params.freq.toFixed(2)}</span>
			</div>
			<div class="slider-row">
				<span class="param-name">Offset</span>
				<input
					type="range" min="0" max="6.28" step="0.01"
					value={params.phase}
					oninput={(e) => (params.phase = parseFloat(e.currentTarget.value))}
				/>
				<span class="val">{params.phase.toFixed(2)}</span>
			</div>
			<div class="slider-row">
				<span class="param-name">Intensity</span>
				<input
					type="range" min="0" max="2.5" step="0.01"
					value={params.amp}
					oninput={(e) => (params.amp = parseFloat(e.currentTarget.value))}
				/>
				<span class="val">{params.amp.toFixed(2)}</span>
			</div>
		</div>
	{/each}
</aside>

<style>
	.toggle-btn {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 200;
		background: rgba(10, 10, 20, 0.85);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.85);
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.45rem 0.9rem;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}
	.toggle-btn:hover {
		color: #fff;
		border-color: rgba(255, 255, 255, 0.5);
	}

	.overlay {
		position: fixed;
		top: 52px;
		right: 0;
		width: 280px;
		max-height: calc(100vh - 52px);
		overflow-y: auto;
		z-index: 150;
		background: rgba(5, 5, 16, 0.9);
		backdrop-filter: blur(10px);
		border-left: 1px solid rgba(255, 255, 255, 0.1);
		font-family: 'Courier New', monospace;
		transform: translateX(100%);
		transition: transform 0.2s ease;
	}
	.overlay.open {
		transform: translateX(0);
	}

	.overlay-header {
		padding: 0.6rem 1rem;
		font-size: 0.65rem;
		letter-spacing: 0.15em;
		color: rgba(255, 255, 255, 0.35);
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}

	.region-row {
		padding: 0.6rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.region-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.85);
		letter-spacing: 0.06em;
		margin-bottom: 0.4rem;
	}

	.color-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.param-name {
		font-size: 0.63rem;
		color: rgba(255, 255, 255, 0.35);
		letter-spacing: 0.05em;
		width: 3.8rem;
		flex-shrink: 0;
	}

	.slider-row input[type='range'] {
		flex: 1;
		height: 2px;
		accent-color: rgba(255, 255, 255, 0.6);
		cursor: pointer;
	}

	.val {
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.55);
		width: 3.2ch;
		text-align: right;
		flex-shrink: 0;
	}
</style>

<svelte:head>
	<title>AR</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	let renderer: THREE.WebGLRenderer | null = null;
	let rafId = 0;
	let stream: MediaStream | null = null;
	let showPermBtn = $state(false);
	let onResize: (() => void) | null = null;

	const orient = { alpha: 0, beta: 90, gamma: 0 };

	onMount(() => {
		(window as any).THREE = THREE;

		const script = document.createElement('script');
		script.src =
			'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/three.js/build/ar.js';
		script.onload = () => initScene(true);
		script.onerror = () => initScene(false);
		document.head.appendChild(script);

		if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
			showPermBtn = true;
		} else {
			window.addEventListener('deviceorientation', handleOrientation);
		}

		return cleanup;
	});

	function handleOrientation(e: DeviceOrientationEvent) {
		orient.alpha = e.alpha ?? 0;
		orient.beta = e.beta ?? 90;
		orient.gamma = e.gamma ?? 0;
	}

	async function grantOrientation() {
		try {
			const result = await (DeviceOrientationEvent as any).requestPermission();
			if (result === 'granted') {
				window.addEventListener('deviceorientation', handleOrientation);
				showPermBtn = false;
			}
		} catch {}
	}

	function styleBackground(video: HTMLVideoElement) {
		Object.assign(video.style, {
			position: 'fixed',
			inset: '0',
			width: '100vw',
			height: '100vh',
			objectFit: 'cover',
			zIndex: '-1'
		});
	}

	function initScene(useArJs: boolean) {
		if (useArJs && (window as any).THREEx) {
			const arSource = new (window as any).THREEx.ArToolkitSource({ sourceType: 'webcam' });
			arSource.init(() => {
				const video = arSource.domElement as HTMLVideoElement;
				styleBackground(video);
				container.insertBefore(video, canvas);
				stream = video.srcObject as MediaStream;
			});
		} else {
			navigator.mediaDevices
				.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
				.then((s) => {
					stream = s;
					const video = document.createElement('video');
					video.srcObject = s;
					video.autoplay = true;
					video.playsInline = true;
					video.muted = true;
					styleBackground(video);
					container.insertBefore(video, canvas);
				});
		}

		renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(0x000000, 0);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(
			60,
			window.innerWidth / window.innerHeight,
			0.01,
			100
		);

		const box = new THREE.Mesh(
			new THREE.BoxGeometry(0.4, 0.4, 0.4),
			new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true })
		);
		box.position.z = -1.5;
		scene.add(box);
		scene.add(new THREE.AxesHelper(0.3));

		onResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer?.setSize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener('resize', onResize);

		(function loop() {
			rafId = requestAnimationFrame(loop);
			box.rotation.y += 0.005;

			camera.rotation.set(
				THREE.MathUtils.degToRad(orient.beta - 90),
				THREE.MathUtils.degToRad(orient.alpha),
				-THREE.MathUtils.degToRad(orient.gamma),
				'YXZ'
			);

			renderer!.render(scene, camera);
		})();
	}

	function cleanup() {
		cancelAnimationFrame(rafId);
		if (onResize) window.removeEventListener('resize', onResize);
		window.removeEventListener('deviceorientation', handleOrientation);
		stream?.getTracks().forEach((t) => t.stop());
		renderer?.dispose();
	}

	onDestroy(cleanup);
</script>

<div bind:this={container} class="ar-container">
	<canvas bind:this={canvas}></canvas>

	{#if showPermBtn}
		<button class="perm-btn" onclick={grantOrientation}>
			Enable Motion Sensors
		</button>
	{/if}
</div>

<style>
	.ar-container {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: #000;
	}

	canvas {
		position: fixed;
		inset: 0;
		z-index: 1;
		pointer-events: none;
	}

	.perm-btn {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		translate: -50% 0;
		z-index: 10;
		padding: 0.75rem 1.5rem;
		background: rgba(0, 229, 255, 0.15);
		border: 1px solid rgba(0, 229, 255, 0.5);
		color: #00e5ff;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		backdrop-filter: blur(8px);
	}
</style>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createScene, handleResize, buildHumanFigure, createBobbingAnimation, exportSceneToGlb } from '$lib';
	import type { SceneRig, AnimationRig } from '$lib';

	let canvasEl: HTMLCanvasElement;
	let wrapperEl: HTMLElement;

	let isExporting = $state(false);
	let glbBlobUrl = $state<string | null>(null);
	let exportError = $state<string | null>(null);

	let rig: SceneRig | null = null;
	let animRig: AnimationRig | null = null;
	let rafId = 0;
	let observer: ResizeObserver | null = null;

	onMount(() => {
		rig = createScene(canvasEl);
		const figure = buildHumanFigure();
		rig.scene.add(figure.root);

		animRig = createBobbingAnimation(figure.root);

		function animate() {
			rafId = requestAnimationFrame(animate);
			const delta = rig!.clock.getDelta();
			animRig!.mixer.update(delta);
			rig!.controls.update();
			rig!.renderer.render(rig!.scene, rig!.camera);
		}
		animate();

		observer = new ResizeObserver(() => {
			if (rig) handleResize(rig, wrapperEl);
		});
		observer.observe(wrapperEl);

		// Initial size pass — canvas may be 0×0 before first paint
		handleResize(rig, wrapperEl);

		isExporting = true;
		exportSceneToGlb(rig.scene, [animRig.clip])
			.then((blob) => {
				glbBlobUrl = URL.createObjectURL(blob);
			})
			.catch((e) => {
				exportError = String(e);
			})
			.finally(() => {
				isExporting = false;
			});
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
		observer?.disconnect();
		rig?.dispose();
		if (glbBlobUrl) URL.revokeObjectURL(glbBlobUrl);
	});
</script>

<div class="page">
	<header>
		<h1>Human Figure — WebGL Animation Demo</h1>
		<div class="controls">
			{#if isExporting}
				<span class="status">Generating GLB…</span>
			{:else if exportError}
				<span class="error">GLB export failed: {exportError}</span>
			{:else if glbBlobUrl}
				<a href={glbBlobUrl} download="human-animated.glb" class="btn">Download GLB</a>
			{/if}
		</div>
	</header>

	<div class="canvas-wrapper" bind:this={wrapperEl}>
		<canvas bind:this={canvasEl}></canvas>
		<p class="hint">Drag to orbit · Scroll to zoom</p>
	</div>
</div>

<style>
	:global(body, html) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	.page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		font-family: system-ui, sans-serif;
		background: #0f0f1a;
		color: #e8e8f0;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		background: rgba(255 255 255 / 0.04);
		border-bottom: 1px solid rgba(255 255 255 / 0.08);
		flex-shrink: 0;
	}

	h1 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.status {
		font-size: 0.85rem;
		opacity: 0.6;
	}

	.error {
		font-size: 0.85rem;
		color: #ff6b6b;
	}

	.btn {
		padding: 0.35rem 0.9rem;
		border-radius: 6px;
		background: #4caf82;
		color: #fff;
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 500;
		transition: background 0.15s;
	}

	.btn:hover {
		background: #3d9e70;
	}

	.canvas-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.hint {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.35;
		pointer-events: none;
		white-space: nowrap;
	}
</style>

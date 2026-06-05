<svelte:head>
	<title>Face Mesh — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { FaceLandmarker, FilesetResolver, type Classifications } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
	const W = 640;
	const H = 480;
	const DETECT_INTERVAL_MS = 66;

	let videoEl: HTMLVideoElement;
	let videoCanvas: HTMLCanvasElement;
	let overlayCanvas: HTMLCanvasElement;
	let videoCtx!: CanvasRenderingContext2D;
	let overlayCtx!: CanvasRenderingContext2D;

	let stream: MediaStream | null = null;
	let rafId: number | null = null;
	let landmarker: FaceLandmarker | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	let blendshapes: Classifications[] = $state([]);

	function drawResults(results: ReturnType<FaceLandmarker['detectForVideo']>) {
		overlayCtx.clearRect(0, 0, W, H);
		blendshapes = results.faceBlendshapes ?? [];
		for (const landmarks of results.faceLandmarks) {
			overlayCtx.strokeStyle = 'rgba(0, 220, 180, 0.35)';
			overlayCtx.lineWidth = 1;
			overlayCtx.beginPath();
			for (const { start, end } of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
				const p1 = landmarks[start];
				const p2 = landmarks[end];
				overlayCtx.moveTo((1 - p1.x) * W, p1.y * H);
				overlayCtx.lineTo((1 - p2.x) * W, p2.y * H);
			}
			overlayCtx.stroke();

			overlayCtx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
			overlayCtx.lineWidth = 1.5;
			overlayCtx.beginPath();
			for (const conn of [
				...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
				...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
				...FaceLandmarker.FACE_LANDMARKS_LIPS
			]) {
				const p1 = landmarks[conn.start];
				const p2 = landmarks[conn.end];
				overlayCtx.moveTo((1 - p1.x) * W, p1.y * H);
				overlayCtx.lineTo((1 - p2.x) * W, p2.y * H);
			}
			overlayCtx.stroke();
		}
	}

	function loop() {
		videoCtx.save();
		videoCtx.translate(W, 0);
		videoCtx.scale(-1, 1);
		videoCtx.drawImage(videoEl, 0, 0, W, H);
		videoCtx.restore();

		if (landmarker && videoEl.readyState >= 2) {
			const now = performance.now();
			if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
				lastDetectTime = now;
				const results = landmarker.detectForVideo(videoEl, now);
				drawResults(results);
			}
		}

		rafId = requestAnimationFrame(loop);
	}

	onMount(async () => {
		videoCtx = videoCanvas.getContext('2d')!;
		overlayCtx = overlayCanvas.getContext('2d')!;

		stream = await navigator.mediaDevices.getUserMedia({ video: true });
		videoEl.srcObject = stream;
		await videoEl.play();
		videoW = videoEl.videoWidth || 640;
		videoH = videoEl.videoHeight || 480;
		rafId = requestAnimationFrame(loop);

		try {
			const vision = await FilesetResolver.forVisionTasks(WASM);
			landmarker = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO',
				numFaces: 2,
				outputFaceBlendshapes: true,
				outputFacialTransformationMatrixes: false
			});
		} catch (err) {
			console.error('MediaPipe failed:', err);
		}
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		stream?.getTracks().forEach((t) => t.stop());
	});
</script>

<div class="page">
	<video bind:this={videoEl} autoplay playsinline muted style="display:none"></video>
	<div class="scene">
		<div class="wrapper" style="aspect-ratio: {videoW} / {videoH}">
			<canvas bind:this={videoCanvas} width={W} height={H}></canvas>
			<canvas bind:this={overlayCanvas} width={W} height={H} class="overlay"></canvas>
		</div>

		{#if blendshapes.length > 0}
			<div class="panels">
				{#each blendshapes as face, i}
					<div class="panel">
						<div class="panel-title">Face {i + 1}</div>
						{#each face.categories as cat}
							<div class="row">
								<span class="label">{cat.categoryName}</span>
								<div class="bar-track">
									<div class="bar-fill" style="width:{(cat.score * 100).toFixed(1)}%"></div>
								</div>
								<span class="val">{cat.score.toFixed(2)}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		min-height: 100vh;
		background: #111;
		padding: 90px 0.5rem 2rem;
		box-sizing: border-box;
	}

	.scene {
		display: flex;
		gap: 20px;
		align-items: flex-start;
		width: 100%;
		max-width: 1000px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.wrapper {
		position: relative;
		width: min(640px, 100%);
		flex-shrink: 0;
	}

	canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	.overlay {
		pointer-events: none;
	}

	.panels {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		flex: 1;
		min-width: 0;
	}

	.panel {
		width: min(280px, 100%);
		max-height: 480px;
		overflow-y: auto;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.panel-title {
		font-family: monospace;
		font-size: 11px;
		color: rgba(100, 200, 255, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 8px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 3px;
	}

	.label {
		font-family: monospace;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.5);
		width: 130px;
		flex-shrink: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar-track {
		flex: 1;
		height: 4px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: rgba(0, 220, 180, 0.7);
		border-radius: 2px;
		transition: width 66ms linear;
	}

	.val {
		font-family: monospace;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.35);
		width: 30px;
		text-align: right;
		flex-shrink: 0;
	}
</style>

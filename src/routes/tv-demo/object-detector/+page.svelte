<svelte:head>
	<title>Object Detector — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
	const W = 640;
	const H = 480;
	const DETECT_INTERVAL_MS = 100;

	let videoEl: HTMLVideoElement;
	let videoCanvas: HTMLCanvasElement;
	let overlayCanvas: HTMLCanvasElement;
	let videoCtx!: CanvasRenderingContext2D;
	let overlayCtx!: CanvasRenderingContext2D;

	let stream: MediaStream | null = null;
	let rafId: number | null = null;
	let detector: ObjectDetector | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	const BOX_COLORS = ['#ff4d6d', '#4dffb0', '#4db8ff', '#ffd24d', '#c84dff', '#ff9a4d'];

	function drawResults(results: ReturnType<ObjectDetector['detectForVideo']>) {
		overlayCtx.clearRect(0, 0, W, H);

		const scaleX = W / (videoEl.videoWidth || W);
		const scaleY = H / (videoEl.videoHeight || H);

		for (let i = 0; i < results.detections.length; i++) {
			const det = results.detections[i];
			const bb = det.boundingBox;
			if (!bb) continue;

			const color = BOX_COLORS[i % BOX_COLORS.length];
			const x = bb.originX * scaleX;
			const y = bb.originY * scaleY;
			const w = bb.width * scaleX;
			const h = bb.height * scaleY;
			const mirroredX = W - x - w;

			overlayCtx.strokeStyle = color;
			overlayCtx.lineWidth = 2;
			overlayCtx.strokeRect(mirroredX, y, w, h);

			const label = det.categories[0]?.categoryName ?? '?';
			const score = det.categories[0]?.score ?? 0;
			const text = `${label} ${Math.round(score * 100)}%`;

			overlayCtx.font = 'bold 13px Courier New';
			const textW = overlayCtx.measureText(text).width;
			const labelX = mirroredX;
			const labelY = y > 20 ? y - 6 : y + h + 16;

			overlayCtx.fillStyle = color;
			overlayCtx.fillRect(labelX - 2, labelY - 13, textW + 8, 18);

			overlayCtx.fillStyle = '#000';
			overlayCtx.fillText(text, labelX + 2, labelY);
		}
	}

	function loop() {
		videoCtx.save();
		videoCtx.translate(W, 0);
		videoCtx.scale(-1, 1);
		videoCtx.drawImage(videoEl, 0, 0, W, H);
		videoCtx.restore();

		if (detector && videoEl.readyState >= 2) {
			const now = performance.now();
			if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
				lastDetectTime = now;
				const results = detector.detectForVideo(videoEl, now);
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
			detector = await ObjectDetector.createFromOptions(vision, {
				baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO',
				scoreThreshold: 0.4,
				maxResults: 8
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
	<div class="wrapper" style="aspect-ratio: {videoW} / {videoH}">
		<canvas bind:this={videoCanvas} width={W} height={H}></canvas>
		<canvas bind:this={overlayCanvas} width={W} height={H} class="overlay"></canvas>
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		min-height: 100vh;
		background: #111;
		padding: 90px 0.5rem 1.5rem;
		box-sizing: border-box;
	}

	.wrapper {
		position: relative;
		width: min(640px, 100%);
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
</style>

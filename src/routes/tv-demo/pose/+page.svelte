<svelte:head>
	<title>Pose — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
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
	let landmarker: PoseLandmarker | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	const LEFT_INDICES = new Set([1, 2, 3, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);

	function isLeft(start: number, end: number) {
		return LEFT_INDICES.has(start) || LEFT_INDICES.has(end);
	}

	function drawResults(results: ReturnType<PoseLandmarker['detectForVideo']>) {
		overlayCtx.clearRect(0, 0, W, H);

		for (const landmarks of results.landmarks) {
			for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
				const p1 = landmarks[start];
				const p2 = landmarks[end];
				if ((p1.visibility ?? 1) < 0.5 || (p2.visibility ?? 1) < 0.5) continue;

				overlayCtx.beginPath();
				overlayCtx.strokeStyle = isLeft(start, end)
					? 'rgba(255, 100, 100, 0.9)'
					: 'rgba(100, 180, 255, 0.9)';
				overlayCtx.lineWidth = 3;
				overlayCtx.moveTo((1 - p1.x) * W, p1.y * H);
				overlayCtx.lineTo((1 - p2.x) * W, p2.y * H);
				overlayCtx.stroke();
			}

			for (let i = 0; i < landmarks.length; i++) {
				const lm = landmarks[i];
				if ((lm.visibility ?? 1) < 0.5) continue;
				overlayCtx.beginPath();
				overlayCtx.arc((1 - lm.x) * W, lm.y * H, 5, 0, Math.PI * 2);
				overlayCtx.fillStyle = LEFT_INDICES.has(i) ? '#ff6464' : '#64b4ff';
				overlayCtx.fill();
			}
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
			landmarker = await PoseLandmarker.createFromOptions(vision, {
				baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO',
				numPoses: 1
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
		<div class="legend">
			<span class="left">Left</span>
			<span class="right">Right</span>
		</div>
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

	.legend {
		position: absolute;
		bottom: 12px;
		right: 14px;
		display: flex;
		gap: 1rem;
		font-family: 'Courier New', monospace;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		pointer-events: none;
	}

	.left {
		color: #ff6464;
	}

	.right {
		color: #64b4ff;
	}
</style>

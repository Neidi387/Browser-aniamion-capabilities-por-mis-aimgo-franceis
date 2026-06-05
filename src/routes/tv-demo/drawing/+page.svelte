<svelte:head>
	<title>Drawing — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
	const W = 640;
	const H = 480;
	const DETECT_INTERVAL_MS = 66;
	const INDEX_TIP = 8;

	let videoEl: HTMLVideoElement;
	let videoCanvas: HTMLCanvasElement;
	let drawCanvas: HTMLCanvasElement;
	let handCanvas: HTMLCanvasElement;
	let videoCtx!: CanvasRenderingContext2D;
	let drawCtx!: CanvasRenderingContext2D;
	let handCtx!: CanvasRenderingContext2D;

	let stream: MediaStream | null = null;
	let rafId: number | null = null;
	let landmarker: HandLandmarker | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	type Point = { x: number; y: number };
	type Stroke = Point[];
	let strokes: Stroke[] = [];
	let currentStroke: Stroke | null = null;
	let isDrawing = false;

	const COLORS = ['#ff4d6d', '#4dffb0', '#4db8ff', '#ffd24d', '#c84dff'];
	let colorIdx = 0;

	function mirrorX(nx: number) {
		return (1 - nx) * W;
	}

	function renderStrokes() {
		drawCtx.clearRect(0, 0, W, H);
		const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
		for (let si = 0; si < allStrokes.length; si++) {
			const stroke = allStrokes[si];
			if (stroke.length < 2) continue;
			drawCtx.beginPath();
			drawCtx.strokeStyle = COLORS[si % COLORS.length];
			drawCtx.lineWidth = 4;
			drawCtx.lineCap = 'round';
			drawCtx.lineJoin = 'round';
			drawCtx.moveTo(stroke[0].x, stroke[0].y);
			for (let i = 1; i < stroke.length; i++) {
				drawCtx.lineTo(stroke[i].x, stroke[i].y);
			}
			drawCtx.stroke();
		}
	}

	function renderHandDot(x: number, y: number) {
		handCtx.clearRect(0, 0, W, H);
		handCtx.beginPath();
		handCtx.arc(x, y, 8, 0, Math.PI * 2);
		handCtx.fillStyle = COLORS[colorIdx % COLORS.length];
		handCtx.fill();
		handCtx.beginPath();
		handCtx.arc(x, y, 14, 0, Math.PI * 2);
		handCtx.strokeStyle = COLORS[colorIdx % COLORS.length];
		handCtx.lineWidth = 2;
		handCtx.globalAlpha = 0.4;
		handCtx.stroke();
		handCtx.globalAlpha = 1;
	}

	function isIndexExtended(landmarks: { x: number; y: number; z: number }[]) {
		const indexTip = landmarks[8];
		const indexPip = landmarks[6];
		const middleTip = landmarks[12];
		const middlePip = landmarks[10];
		const ringTip = landmarks[16];
		const ringPip = landmarks[14];
		const pinkyTip = landmarks[20];
		const pinkyPip = landmarks[18];
		const indexUp = indexTip.y < indexPip.y;
		const middleDown = middleTip.y > middlePip.y;
		const ringDown = ringTip.y > ringPip.y;
		const pinkyDown = pinkyTip.y > pinkyPip.y;
		return indexUp && middleDown && ringDown && pinkyDown;
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

				if (results.landmarks.length > 0) {
					const lm = results.landmarks[0];
					const tip = lm[INDEX_TIP];
					const px = mirrorX(tip.x);
					const py = tip.y * H;

					renderHandDot(px, py);

					if (isIndexExtended(lm)) {
						if (!isDrawing) {
							currentStroke = [];
							isDrawing = true;
						}
						currentStroke!.push({ x: px, y: py });
					} else {
						if (isDrawing && currentStroke && currentStroke.length > 1) {
							strokes.push(currentStroke);
							colorIdx++;
						}
						currentStroke = null;
						isDrawing = false;
					}

					renderStrokes();
				} else {
					handCtx.clearRect(0, 0, W, H);
					if (isDrawing && currentStroke && currentStroke.length > 1) {
						strokes.push(currentStroke);
						colorIdx++;
					}
					currentStroke = null;
					isDrawing = false;
					renderStrokes();
				}
			}
		}

		rafId = requestAnimationFrame(loop);
	}

	function clearCanvas() {
		strokes = [];
		currentStroke = null;
		isDrawing = false;
		colorIdx = 0;
		drawCtx.clearRect(0, 0, W, H);
	}

	onMount(async () => {
		videoCtx = videoCanvas.getContext('2d')!;
		drawCtx = drawCanvas.getContext('2d')!;
		handCtx = handCanvas.getContext('2d')!;

		stream = await navigator.mediaDevices.getUserMedia({ video: true });
		videoEl.srcObject = stream;
		await videoEl.play();
		videoW = videoEl.videoWidth || 640;
		videoH = videoEl.videoHeight || 480;
		rafId = requestAnimationFrame(loop);

		try {
			const vision = await FilesetResolver.forVisionTasks(WASM);
			landmarker = await HandLandmarker.createFromOptions(vision, {
				baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO',
				numHands: 1
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
		<canvas bind:this={drawCanvas} width={W} height={H} class="overlay"></canvas>
		<canvas bind:this={handCanvas} width={W} height={H} class="overlay"></canvas>
		<div class="ui">
			<p class="hint">Point with index finger to draw · Curl fingers to stop</p>
			<button onclick={clearCanvas}>Clear</button>
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

	.ui {
		position: absolute;
		bottom: 12px;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 14px;
		font-family: 'Courier New', monospace;
	}

	.hint {
		color: rgba(255, 255, 255, 0.45);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		margin: 0;
	}

	button {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #fff;
		font-family: 'Courier New', monospace;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.35rem 0.9rem;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>

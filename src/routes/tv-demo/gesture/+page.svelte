<svelte:head>
	<title>Gesture — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
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
	let recognizer: GestureRecognizer | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	interface GestureInfo {
		name: string;
		score: number;
		hand: string;
	}
	let gestures: GestureInfo[] = [];

	const GESTURE_LABELS: Record<string, string> = {
		None: '—',
		Closed_Fist: 'Fist ✊',
		Open_Palm: 'Open Hand 🖐',
		Pointing_Up: 'Pointing ☝',
		Thumb_Down: 'Thumbs Down 👎',
		Thumb_Up: 'Thumbs Up 👍',
		Victory: 'Peace ✌',
		ILoveYou: 'I Love You 🤟'
	};

	function drawOverlay() {
		overlayCtx.clearRect(0, 0, W, H);
		if (gestures.length === 0) return;

		for (let i = 0; i < gestures.length; i++) {
			const g = gestures[i];
			const label = GESTURE_LABELS[g.name] ?? g.name;
			const pct = Math.round(g.score * 100);
			const y = 80 + i * 110;

			overlayCtx.font = 'bold 52px Courier New';
			overlayCtx.textAlign = 'center';
			overlayCtx.fillStyle = 'rgba(0,0,0,0.5)';
			overlayCtx.fillText(label, W / 2 + 2, y + 2);
			overlayCtx.fillStyle = '#fff';
			overlayCtx.fillText(label, W / 2, y);

			overlayCtx.font = '14px Courier New';
			overlayCtx.fillStyle = 'rgba(255,255,255,0.55)';
			overlayCtx.fillText(`${g.hand} · ${pct}%`, W / 2, y + 28);
		}
	}

	function loop() {
		videoCtx.save();
		videoCtx.translate(W, 0);
		videoCtx.scale(-1, 1);
		videoCtx.drawImage(videoEl, 0, 0, W, H);
		videoCtx.restore();

		if (recognizer && videoEl.readyState >= 2) {
			const now = performance.now();
			if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
				lastDetectTime = now;
				const results = recognizer.recognizeForVideo(videoEl, now);

				gestures = [];
				for (let i = 0; i < results.gestures.length; i++) {
					const top = results.gestures[i][0];
					const hand = results.handedness[i]?.[0]?.displayName ?? '';
					gestures.push({ name: top.categoryName, score: top.score, hand });
				}
				drawOverlay();
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
			recognizer = await GestureRecognizer.createFromOptions(vision, {
				baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO',
				numHands: 2
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
		<p class="hint">Show your hand to the camera</p>
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

	.hint {
		position: absolute;
		bottom: 12px;
		left: 0;
		right: 0;
		text-align: center;
		color: rgba(255, 255, 255, 0.35);
		font-size: 0.72rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 0.06em;
		margin: 0;
		pointer-events: none;
	}
</style>

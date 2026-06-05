<svelte:head>
	<title>TV Demo — Tasks Vision</title>
</svelte:head>

<main>
	<h1>Tasks Vision</h1>
	<p class="subtitle">MediaPipe tasks-vision demos — running entirely in your browser</p>

	<div class="cards">
		<a href="/tv-demo/drawing" class="card">
			<div class="card-icon">&#9998;</div>
			<h2>Drawing</h2>
			<p>Paint on screen with your index finger using real-time hand landmark tracking.</p>
		</a>

		<a href="/tv-demo/gesture" class="card">
			<div class="card-icon">&#9996;</div>
			<h2>Gesture</h2>
			<p>Live hand gesture recognition — thumbs up, peace, open palm, and more.</p>
		</a>

		<a href="/tv-demo/face-detector" class="card">
			<div class="card-icon">&#9635;</div>
			<h2>Face Detector</h2>
			<p>Bounding boxes and facial keypoints detected live from your webcam.</p>
		</a>

		<a href="/tv-demo/face-landmarks" class="card">
			<div class="card-icon">&#11042;</div>
			<h2>Face Mesh</h2>
			<p>478-point face landmark mesh rendered over your face in real time.</p>
		</a>

		<a href="/tv-demo/pose" class="card">
			<div class="card-icon">&#9681;</div>
			<h2>Pose</h2>
			<p>Full-body skeleton overlay — 33 landmarks with left/right color coding.</p>
		</a>

		<a href="/tv-demo/object-detector" class="card">
			<div class="card-icon">&#9974;</div>
			<h2>Object Detector</h2>
			<p>Identify everyday objects in the scene with labelled bounding boxes.</p>
		</a>

		<a href="/tv-demo/image-segmenter" class="card">
			<div class="card-icon">&#9680;</div>
			<h2>Segmenter</h2>
			<p>Selfie segmentation isolates the person from the background in real time.</p>
		</a>

		<a href="/tv-demo/holistic" class="card">
			<div class="card-icon">&#10022;</div>
			<h2>Holistic</h2>
			<p>Face mesh, hand landmarks, and body pose all detected simultaneously.</p>
		</a>

		<a href="/tv-demo/face-landmarks-crop" class="card">
			<div class="card-icon">&#9901;</div>
			<h2>Face Crop</h2>
			<p>Tracked face crop with 478-point landmark mesh, auto-zooming and smoothly following your face.</p>
		</a>
	</div>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #0e0e1a;
		padding: 8rem 1.5rem 3rem;
		font-family: 'Courier New', monospace;
	}

	h1 {
		color: #fff;
		font-size: clamp(1.8rem, 5vw, 3rem);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin: 0 0 0.5rem;
	}

	.subtitle {
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		margin: 0 0 3.5rem;
		text-align: center;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.5rem;
		width: 100%;
		max-width: 680px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 2rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: background 0.2s, border-color 0.2s, transform 0.2s;
	}

	.card:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.25);
		transform: translateY(-2px);
	}

	.card-icon {
		font-size: 2rem;
		line-height: 1;
		color: rgba(255, 255, 255, 0.6);
	}

	.card h2 {
		color: #fff;
		font-size: 1.1rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin: 0;
	}

	.card p {
		color: rgba(255, 255, 255, 0.45);
		font-size: 0.82rem;
		line-height: 1.6;
		margin: 0;
	}
</style>

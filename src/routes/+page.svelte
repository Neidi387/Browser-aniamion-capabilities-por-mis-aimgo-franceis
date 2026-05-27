<svelte:head>
	<title>WebGL Demos</title>
</svelte:head>

<main>
	<h1>WebGL Demos</h1>
	<p class="subtitle">Browser animation capabilities with Three.js</p>

	<div class="cards">
		<a href="/jumping-man" class="card">
			<div class="card-icon">&#9664;</div>
			<h2>Jumping Man</h2>
			<p>3D character that reacts to device motion, gyroscope tilt, and scroll color shifts.</p>
		</a>

		<a href="/blender-circle" class="card">
			<div class="card-icon">&#9711;</div>
			<h2>Blender Circle</h2>
			<p>Rotating torus with dynamic lighting — drag to orbit, scroll to zoom.</p>
		</a>

		<a href="/cv-demo" class="card">
			<div class="card-icon">&#9673;</div>
			<h2>CV Demo</h2>
			<p>Computer vision demo using your webcam feed with real-time canvas overlay.</p>
		</a>

		<a href="/gravity" class="card">
			<div class="card-icon">&#11053;</div>
			<h2>Gravity</h2>
			<p>300 colored particles orbit two gravity centers, bouncing off the edges of the viewport.</p>
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
		padding: 6rem 1.5rem 3rem;
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

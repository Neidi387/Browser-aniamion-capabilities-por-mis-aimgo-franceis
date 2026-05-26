import * as THREE from 'three';
import type { AnimationRig } from './types.js';

export function createBobbingAnimation(root: THREE.Group): AnimationRig {
	const track = new THREE.VectorKeyframeTrack(
		'humanRoot.position',
		[0, 0.5, 1.0],
		[0, 0, 0, 0, 0.08, 0, 0, 0, 0],
		THREE.InterpolateSmooth
	);

	const clip = new THREE.AnimationClip('bobbing', 1.0, [track]);
	const mixer = new THREE.AnimationMixer(root);
	const action = mixer.clipAction(clip);
	action.setLoop(THREE.LoopRepeat, Infinity);
	action.play();

	return { mixer, clip };
}

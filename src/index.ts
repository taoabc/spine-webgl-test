let lastFrameTime = 0;
let canvas: HTMLCanvasElement;
let shader: spine.webgl.Shader;
let batcher: spine.webgl.PolygonBatcher;
let gl: WebGLRenderingContext | null;
let mvp = new spine.webgl.Matrix4();
let assetManager: spine.webgl.AssetManager;
let skeletonRenderer: spine.webgl.SkeletonRenderer;
let debugRenderer: spine.webgl.SkeletonDebugRenderer;
let shapes: spine.webgl.ShapeRenderer;
let skeletons: Skeletons = {};
let activeSkeleton = "spineboy";
let swirlEffect = new spine.SwirlEffect(0);
let jitterEffect = new spine.JitterEffect(20, 20);
let swirlTime = 0;
let debugShader: spine.webgl.Shader;

const $ = document.querySelector.bind(document);

function getSelectedText(id: string): string {
	const e = document.getElementById(id) as HTMLSelectElement;
	if (!e) debugger;
	return e.options[e.selectedIndex].value;
}

console.log(spine);

interface Bounds {
	offset: spine.Vector2;
	size: spine.Vector2;
};

interface LoadSkeletonRet {
	skeleton: spine.Skeleton;
	state: spine.AnimationState;
	bounds: Bounds;
	premultipliedAlpha: boolean;
}

interface Skeletons {
	[propName: string]: LoadSkeletonRet
}

function init () {
	// Setup canvas and WebGL context. We pass alpha: false to canvas.getContext() so we don't use premultiplied alpha when
	// loading textures. That is handled separately by PolygonBatcher.
	canvas = document.getElementById("canvas") as HTMLCanvasElement;
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	let config = { alpha: false };
	gl = (canvas.getContext("webgl", config) || canvas.getContext("experimental-webgl", config)) as WebGLRenderingContext | null;
	if (!gl) {
		alert('WebGL is unavailable.');
		return;
	}

	// Create a simple shader, mesh, model-view-projection matrix and SkeletonRenderer.
	shader = spine.webgl.Shader.newTwoColoredTextured(gl);
	batcher = new spine.webgl.PolygonBatcher(gl);
	mvp.ortho2d(0, 0, canvas.width - 1, canvas.height - 1);
	skeletonRenderer = new spine.webgl.SkeletonRenderer(new spine.webgl.ManagedWebGLRenderingContext(gl));
	debugRenderer = new spine.webgl.SkeletonDebugRenderer(gl);
	debugRenderer.drawRegionAttachments = true;
	debugRenderer.drawBoundingBoxes = true;
	debugRenderer.drawMeshHull = true;
	debugRenderer.drawMeshTriangles = true;
	debugRenderer.drawPaths = true;
	debugShader = spine.webgl.Shader.newColored(gl);
	shapes = new spine.webgl.ShapeRenderer(gl);
	assetManager = new spine.webgl.AssetManager(gl);

	// Tell AssetManager to load the resources for each model, including the exported .json file, the .atlas file and the .png
	// file for the atlas. We then wait until all resources are loaded in the load() method.
	assetManager.loadText("assets/spineboy-pro.json");
	assetManager.loadTextureAtlas("assets/spineboy-pma.atlas");
	assetManager.loadText("assets/raptor-pro.json");
	assetManager.loadTextureAtlas("assets/raptor-pma.atlas");
	assetManager.loadText("assets/tank-pro.json");
	assetManager.loadTextureAtlas("assets/tank-pma.atlas");
	assetManager.loadText("assets/goblins-pro.json");
	assetManager.loadTextureAtlas("assets/goblins-pma.atlas");
	assetManager.loadText("assets/vine-pro.json");
	assetManager.loadTextureAtlas("assets/vine-pma.atlas");
	assetManager.loadText("assets/stretchyman-pro.json");
	assetManager.loadTextureAtlas("assets/stretchyman-pma.atlas");
	assetManager.loadText("assets/stretchyman-stretchy-ik-pro.json");
	assetManager.loadText("assets/coin-pro.json");
	assetManager.loadTextureAtlas("assets/coin-pma.atlas");
	requestAnimationFrame(load);
}

function load () {
	// Wait until the AssetManager has loaded all resources, then load the skeletons.
	if (assetManager.isLoadingComplete()) {
		skeletons["raptor"] = loadSkeleton("raptor-pro", "walk", true);
		skeletons["spineboy"] = loadSkeleton("spineboy-pro", "run", true);
		skeletons["tank"] = loadSkeleton("tank-pro", "drive", true);
		skeletons["goblins"] = loadSkeleton("goblins-pro", "walk", true, "goblin");
		skeletons["vine"] = loadSkeleton("vine-pro", "grow", true);
		skeletons["stretchyman"] = loadSkeleton("stretchyman-pro", "sneak", true);
		skeletons["stretchyman-stretchy-ik"] = loadSkeleton("stretchyman-stretchy-ik-pro", "sneak", true);
		skeletons["coin"] = loadSkeleton("coin-pro", "animation", true);
		setupUI();
		requestAnimationFrame(render);
	} else {
		requestAnimationFrame(load);
	}
}

function loadSkeleton (name: string, initialAnimation: string, premultipliedAlpha: boolean, skin?: string) {
	if (skin === undefined) skin = "default";

	// Load the texture atlas using name.atlas from the AssetManager.
	const atlas = assetManager.get("assets/" + name.replace("-ess", "").replace("-pro", "").replace("-stretchy-ik", "") + (premultipliedAlpha ? "-pma": "") + ".atlas");

	// Create a AtlasAttachmentLoader that resolves region, mesh, boundingbox and path attachments
	const atlasLoader = new spine.AtlasAttachmentLoader(atlas);

	// Create a SkeletonJson instance for parsing the .json file.
	let skeletonJson = new spine.SkeletonJson(atlasLoader);

	// Set the scale to apply during parsing, parse the file, and create a new skeleton.
	let skeletonData = skeletonJson.readSkeletonData(assetManager.get("assets/" + name + ".json"));
	let skeleton = new spine.Skeleton(skeletonData);
	skeleton.setSkinByName(skin);
	let bounds = calculateBounds(skeleton);

	// Create an AnimationState, and set the initial animation in looping mode.
	const animationStateData = new spine.AnimationStateData(skeleton.data);
	let animationState = new spine.AnimationState(animationStateData);
	if (name == "spineboy") {
		animationStateData.setMix("walk", "jump", 0.4)
		animationStateData.setMix("jump", "run", 0.4);
		animationState.setAnimation(0, "walk", true);
		// let jumpEntry = animationState.addAnimation(0, "jump", false, 3);
		animationState.addAnimation(0, "run", true, 0);
	} else {
		animationState.setAnimation(0, initialAnimation, true);
	}
	animationState.addListener({
		start: function(track: spine.TrackEntry) {
			console.log("Animation on track " + track.trackIndex + " started");
		},
		interrupt: function(track: spine.TrackEntry) {
			console.log("Animation on track " + track.trackIndex + " interrupted");
		},
		end: function(track: spine.TrackEntry) {
			console.log("Animation on track " + track.trackIndex + " ended");
		},
		dispose: function(track: spine.TrackEntry) {
			console.log("Animation on track " + track.trackIndex + " disposed");
		},
		complete: function(track: spine.TrackEntry) {
			console.log("Animation on track " + track.trackIndex + " completed");
		},
		event: function(track: spine.TrackEntry, event: spine.Event) {
			console.log("Event on track " + track.trackIndex + ": " + JSON.stringify(event));
		}
	})

	// Pack everything up and return to caller.
	return { skeleton: skeleton, state: animationState, bounds: bounds, premultipliedAlpha: premultipliedAlpha };
}

function calculateBounds(skeleton: spine.Skeleton) {
	skeleton.setToSetupPose();
	skeleton.updateWorldTransform();
	let offset = new spine.Vector2();
	let size = new spine.Vector2();
	skeleton.getBounds(offset, size, []);
	return { offset: offset, size: size };
}

function setupUI () {
	let skeletonList = $("#skeletonList") as HTMLSelectElement;
	for (let skeletonName in skeletons) {
		let option = document.createElement('option');
		option.setAttribute("value", skeletonName);
		option.text = skeletonName;
		if (skeletonName === activeSkeleton) option.setAttribute("selected", "selected");
		skeletonList.append(option);
	}
	let effectList = $("#effectList")!;
	let effects = ["None", "Swirl", "Jitter"];
	for (let effect in effects) {
		let effectName = effects[effect];
		let option = document.createElement('option');
		option.setAttribute("value", effectName);
		option.text = effectName;
		effectList.append(option);
	}
	let setupAnimationUI = function() {
		let animationList = $("#animationList")! as HTMLSelectElement;
		animationList.innerHTML = '';
		let skeleton = skeletons[activeSkeleton].skeleton;
		let state = skeletons[activeSkeleton].state;
		let activeAnimation = state.tracks[0].animation.name;
		for (let i = 0; i < skeleton.data.animations.length; i++) {
			let name = skeleton.data.animations[i].name;
			let option = document.createElement('option');
			option.setAttribute("value", name);
			option.text = name;
			if (name === activeAnimation) option.setAttribute("selected", "selected");
			animationList.append(option);
		}

		animationList.onchange = function() {
			let state = skeletons[activeSkeleton].state;
			let skeleton = skeletons[activeSkeleton].skeleton;
			let animationName = getSelectedText('animationList');
			skeleton.setToSetupPose();
			state.setAnimation(0, animationName, true);
		}
	}

	let setupSkinUI = function() {
		let skinList = $("#skinList") as HTMLSelectElement;
		skinList.innerHTML = '';
		let skeleton = skeletons[activeSkeleton].skeleton;
		let activeSkin = skeleton.skin == null ? "default" : skeleton.skin.name;
		for (let i = 0; i < skeleton.data.skins.length; i++) {
			let name = skeleton.data.skins[i].name;
			let option = document.createElement('option');
			option.setAttribute("value", name);
			option.text = name;
			if (name === activeSkin) option.setAttribute("selected", "selected");
			skinList.append(option);
		}

		skinList.onchange = function() {
			let skeleton = skeletons[activeSkeleton].skeleton;
			let skinName = getSelectedText('skinList');
			skeleton.setSkinByName(skinName);
			skeleton.setSlotsToSetupPose();
		}
	}

	skeletonList.onchange = function() {
		activeSkeleton = getSelectedText('skeletonList');
		setupAnimationUI();
		setupSkinUI();
	}
	setupAnimationUI();
	setupSkinUI();
}

function render (timestamp: DOMHighResTimeStamp) {
	let now = timestamp / 1000;
	let delta = now - lastFrameTime;
	lastFrameTime = now;

	// Update the MVP matrix to adjust for canvas size changes
	resize();

	gl!.clearColor(0.3, 0.3, 0.3, 1);
	gl!.clear(gl!.COLOR_BUFFER_BIT);

	// Apply the animation state based on the delta time.
	let state = skeletons[activeSkeleton].state;
	let skeleton = skeletons[activeSkeleton].skeleton;
	let bounds = skeletons[activeSkeleton].bounds;
	let premultipliedAlpha = skeletons[activeSkeleton].premultipliedAlpha;
	state.update(delta);
	state.apply(skeleton);
	skeleton.updateWorldTransform();

	// Bind the shader and set the texture and model-view-projection matrix.
	shader.bind();
	shader.setUniformi(spine.webgl.Shader.SAMPLER, 0);
	shader.setUniform4x4f(spine.webgl.Shader.MVP_MATRIX, mvp.values);

	// Start the batch and tell the SkeletonRenderer to render the active skeleton.
	batcher.begin(shader);

	let effect = getSelectedText('effectList');
	if (effect == "None") {
		skeletonRenderer.vertexEffect = { begin: (skeleton: spine.Skeleton) => {},
			transform: (position: spine.Vector2, uv: spine.Vector2, light: spine.Color, dark: spine.Color) => {},
			end: ()=> {}
		}
	} else if (effect == "Swirl") {
		swirlTime += delta;
		let percent = swirlTime % 2;
		if (percent > 1) percent = 1 - (percent -1 );
		// swirlEffect.angle = -60 + 120 * (perecent < 0.5 ? Math.pow(percent * 2, 2) / 2 : Math.pow((percent - 1) * 2, 2) / -2 + 1);
		swirlEffect.angle = 360 * percent;
		swirlEffect.centerX = 200; //bounds.offset.x + bounds.size.x / 2
		swirlEffect.centerY = 200; //bounds.offset.y + bounds.size.y / 2
		swirlEffect.radius = Math.sqrt(bounds.size.x * bounds.size.x + bounds.size.y * bounds.size.y);
		skeletonRenderer.vertexEffect = swirlEffect;
	} else if (effect == "Jitter") {
		skeletonRenderer.vertexEffect = jitterEffect;
	}

	skeletonRenderer.premultipliedAlpha = premultipliedAlpha;
	skeletonRenderer.draw(batcher, skeleton);
	batcher.end();

	shader.unbind();

	// draw debug information
	let debug = ($('#debug') as HTMLInputElement).checked;
	if (debug) {
		debugShader.bind();
		debugShader.setUniform4x4f(spine.webgl.Shader.MVP_MATRIX, mvp.values);
		debugRenderer.premultipliedAlpha = premultipliedAlpha;
		shapes.begin(debugShader);
		debugRenderer.draw(shapes, skeleton);
		shapes.end();
		debugShader.unbind();
	}

	requestAnimationFrame(render);
}

function resize () {
	let w = canvas.clientWidth;
	let h = canvas.clientHeight;
	let bounds = skeletons[activeSkeleton].bounds;
	if (canvas.width != w || canvas.height != h) {
		canvas.width = w;
		canvas.height = h;
	}

	// magic
	let centerX = bounds.offset.x + bounds.size.x / 2;
	let centerY = bounds.offset.y + bounds.size.y / 2;
	let scaleX = bounds.size.x / canvas.width;
	let scaleY = bounds.size.y / canvas.height;
	let scale = Math.max(scaleX, scaleY) * 1.2;
	if (scale < 1) scale = 1;
	let width = canvas.width * scale;
	let height = canvas.height * scale;

	mvp.ortho2d(centerX - width / 2, centerY - height / 2, width, height);
	gl!.viewport(0, 0, canvas.width, canvas.height);
}

init();

<template>
	<div class="polygonjs-scene-container">
		<div
			v-if="displayLoadingPoster"
			ref="posterContainerRef"
			class="poster-container"
			:style="containerStyleObject"
			:class="fadeableElementClassObject"
		></div>
		<div
			v-if="displayLoadingProgressBar"
			ref="progressBarRef"
			class="progress-bar"
			:class="fadeableElementClassObject"
		>
			<div
				class="progress-bar-bar"
				:style="progressBarBarStyleObject"
			></div>
		</div>
		<div class="polygonjs-scene" ref="sceneContainer"></div>
	</div>
</template>

<script lang="ts">
import {
	defineComponent,
	onBeforeUnmount,
	onMounted,
	Ref,
	ref,
	computed,
} from "vue";
import { PolyScene } from "@polygonjs/polygonjs/dist/src/engine/scene/PolyScene";
import { BaseViewerType } from "@polygonjs/polygonjs/dist/src/engine/viewers/_Base";
import {
	SceneJsonExporterData,
	SceneJsonExporterDataProperties,
} from "@polygonjs/polygonjs/dist/src/engine/io/json/export/Scene";
import { PolyEventName } from "@polygonjs/polygonjs/dist/src/engine/poly/utils/PolyEventName";
import { sanitizeUrl } from "@polygonjs/polygonjs/dist/src/core/UrlHelper";

type ConfigureSceneData = (sceneData: SceneJsonExporterData) => void;

interface LoadSceneOptions {
	onProgress: (progress: number) => void;
	domElement: HTMLElement;
	printWarnings: boolean;
	cameraMaskOverride?: string;
	autoPlay: boolean;
	configureSceneData?: ConfigureSceneData;
	sceneDataRoot?: string;
	assetsRoot?: string;
	libsRootPrefix?: string;
}
interface LoadedData {
	scene: PolyScene;
	viewer: BaseViewerType | undefined;
}
type LoadScene = (options: LoadSceneOptions) => Promise<LoadedData>;

const sceneReadyEventName: string =
	PolyEventName.SCENE_READY.toLowerCase().replace("poly", "");
const viewerMountedEventName: string =
	PolyEventName.VIEWER_MOUNTED.toLowerCase().replace("poly", "");
const viewerReadyEventName: string =
	PolyEventName.VIEWER_READY.toLowerCase().replace("poly", "");
const sceneAvailableEventName = "sceneAvailable";
const loadedDataBySceneName: Map<string, LoadedData> = new Map();

export default defineComponent({
	name: "Polygonjs-Scene",
	emits: [
		sceneReadyEventName,
		viewerMountedEventName,
		viewerReadyEventName,
		sceneAvailableEventName,
		"progress",
	],
	props: {
		sceneName: {
			type: String,
			required: true,
		},
		loadFunction: {
			type: Function,
			required: true,
		},
		configureSceneData: {
			type: Function,
			required: false,
		},
		displayLoadingProgressBar: {
			type: Boolean,
			default: true,
		},
		displayLoadingPoster: {
			type: Boolean,
			default: true,
		},
		posterExtension: {
			type: String,
			default: "png",
		},
		posterUrl: {
			type: String,
		},
		printWarnings: {
			type: Boolean,
			default: false,
		},
		cameraMaskOverride: {
			type: String,
			default: null,
			required: false,
		},
		autoPlay: {
			type: Boolean,
			default: true,
		},
		baseUrl: {
			type: String,
			default: "",
		},
		keepAlive: {
			type: Boolean,
			default: false,
		},
	},
	async setup(props, context) {
		const sceneContainer: Ref<HTMLElement | null> = ref(null);
		const posterContainerRef: Ref<HTMLElement | null> = ref(null);
		const progressBarRef: Ref<HTMLElement | null> = ref(null);
		const progress = ref(0);
		let scene: PolyScene | undefined;
		let viewer: BaseViewerType | undefined;

		async function loadScene() {
			if (!sceneContainer.value) {
				return;
			}

			const loadFunction = props.loadFunction as LoadScene;
			const configureSceneData = props.configureSceneData as
				| ConfigureSceneData
				| undefined;
			const domElement = sceneContainer.value;
			domElement.addEventListener(
				PolyEventName.SCENE_READY,
				(/*event*/) => {
					context.emit(sceneReadyEventName, scene);
				}
			);
			domElement.addEventListener(
				PolyEventName.VIEWER_MOUNTED,
				(event) => {
					viewer = viewer || (event as CustomEvent).detail.viewer;
					if (viewer) {
						context.emit(viewerMountedEventName, viewer);
					}
				}
			);
			domElement.addEventListener(PolyEventName.VIEWER_READY, (event) => {
				viewer = viewer || (event as CustomEvent).detail.viewer;
				if (viewer) {
					context.emit(viewerReadyEventName, viewer);
				}
			});
			let loadedData = loadedDataBySceneName.get(props.sceneName);
			if (loadedData) {
				loadedData.viewer?.mount(domElement);
				scene = loadedData.scene;
				viewer = loadedData.viewer;
				_restart();
			} else {
				loadedData = await loadFunction({
					onProgress,
					domElement,
					printWarnings: props.printWarnings,
					cameraMaskOverride: props.cameraMaskOverride,
					autoPlay: props.autoPlay,
					configureSceneData,
					sceneDataRoot: `${props.baseUrl}/polygonjs/scenes`,
					assetsRoot: props.baseUrl,
					libsRootPrefix: props.baseUrl,
				});
				if (props.keepAlive == true) {
					loadedDataBySceneName.set(props.sceneName, loadedData);
				}
				scene = loadedData.scene;
				viewer = loadedData.viewer;
			}

			context.emit(sceneAvailableEventName, scene);
		}
		function onProgress(p: number) {
			progress.value = p;
			context.emit("progress", p);
			if (progress.value >= 1) {
				setTimeout(_removePosterAndProgressBar, 1000); // delay should match the css fadeout time
			}
		}
		function _removePosterAndProgressBar() {
			if (posterContainerRef.value) {
				posterContainerRef.value.parentElement?.removeChild(
					posterContainerRef.value
				);
			}
			if (progressBarRef.value) {
				progressBarRef.value.parentElement?.removeChild(
					progressBarRef.value
				);
			}
		}

		function _restart() {
			if (scene) {
				scene.play();
			}
			if (viewer) {
				viewer.setAutoRender(true);
			}
		}

		function disposeScene() {
			if (scene) {
				scene.pause();
			}
			if (viewer) {
				viewer.setAutoRender(false);
				viewer.unmount();
			}
			if (props.keepAlive == false) {
				if (scene) {
					scene.pause();
					scene.dispose();
				}
				if (viewer) {
					viewer.dispose();
				}
			}
		}

		onMounted(loadScene);
		onBeforeUnmount(disposeScene);

		// style and classes
		const fadeableElementClassObject = computed(() => {
			const visible = progress.value > 0 && progress.value < 1;
			return {
				["polygonjs-loader-fadeable"]: true,
				["polygonjs-loader-visible"]: visible,
				["polygonjs-loader-hidden"]: !visible,
			};
		});
		const progressBarBarStyleObject = computed(() => {
			const percent = Math.round(progress.value * 100);
			return {
				width: `${percent}%`,
			};
		});

		// poster

		const posterUrl = computed(() => {
			return sanitizeUrl(
				props.posterUrl ||
					`${props.baseUrl}/polygonjs/screenshots/scenes/${props.sceneName}/poster.${props.posterExtension}`
			);
		});
		const containerStyleObject = computed(() => {
			return {
				backgroundImage: `url('${posterUrl.value}')`,
			};
		});

		return {
			sceneContainer,
			posterContainerRef,
			progressBarRef,
			fadeableElementClassObject,
			progressBarBarStyleObject,
			containerStyleObject,
		};
	},
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.polygonjs-scene-container {
	position: relative;
}
.polygonjs-scene-container,
.polygonjs-scene {
	height: 100%;
}
.polygonjs-scene canvas {
	display: block;
}
/*
	progress bar
	*/
.progress-bar {
	position: absolute;
	top: 0px;
	left: 0px;
	width: 100%;
	height: 4px;
	pointer-events: none;
}
.progress-bar-bar {
	height: 100%;
	background-color: orange;
	animation-name: progress-bar-color;
	animation-duration: 4s;
	animation-iteration-count: infinite;
}
.polygonjs-loader-fadeable {
	opacity: 1;
	transition: opacity 0.5s ease-in-out;
	-webkit-transition: opacity 0.5s ease-in-out;
	-moz-transition: opacity 0.5s ease-in-out;
	-ms-transition: opacity 0.5s ease-in-out;
	-o-transition: opacity 0.5s ease-in-out;
}

/*
	poster
	*/
.poster-container {
	position: absolute;
	top: 0px;
	left: 0px;
	width: 100%;
	height: 100%;
	pointer-events: none;
	background-size: cover;
	background-position: center;
	z-index: 10;
}
/*
	common
	*/
.polygonjs-loader-visible {
	opacity: 1;
}
.polygonjs-loader-hidden {
	opacity: 0;
}
@keyframes progress-bar-color {
	0% {
		background-color: rgb(115, 214, 115);
	}
	50% {
		background-color: rgb(60, 60, 211);
	}
	100% {
		background-color: rgb(115, 214, 115);
	}
}
</style>

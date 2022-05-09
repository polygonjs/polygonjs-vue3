<template>
  <div class="polygonjs-scene-container">
    <div
      v-if="displayLoadingProgressBar"
      class="progress-bar"
      :class="progressBarClassObject"
    >
      <div class="progress-bar-bar" :style="progressBarBarStyleObject"></div>
    </div>
    <div class="polygonjs-scene" ref="container"></div>
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
import { PolyEventName } from "@polygonjs/polygonjs/dist/src/engine/io/common/EventsDispatcher";
import { PolyScene } from "@polygonjs/polygonjs/dist/src/engine/scene/PolyScene";
import { BaseViewerType } from "@polygonjs/polygonjs/dist/src/engine/viewers/_Base";

interface LoadSceneOptions {
  onProgress: (progress: number) => void;
  domElement: HTMLElement;
  printWarnings: boolean;
}
interface LoadedData {
  scene: PolyScene;
  viewer: BaseViewerType|undefined;
}
type LoadScene = (options: LoadSceneOptions) => Promise<LoadedData>;

export default defineComponent({
  name: "Polygonjs-Scene",
  props: {
    loadFunction: {
      type: Function,
       required: true
    },
    displayLoadingProgressBar: {
      type: Boolean,
      default: true,
    },
    printWarnings: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const container: Ref<HTMLElement | null> = ref(null);
    const progress = ref(0);
    let scene: PolyScene | undefined;
    let viewer: BaseViewerType | undefined;

    async  function loadScene() {
      if (!container.value) {
        return;
      }
      const loadFunction = props.loadFunction as LoadScene;

      const loadedData = await loadFunction({
        onProgress,
        domElement: container.value,
        printWarnings: props.printWarnings,
      })
      scene = loadedData.scene;
      viewer = loadedData.viewer;
      const sceneReady = PolyEventName.SCENE_READY.toLowerCase().replace(
        "poly",
        ""
      );
      const viewerMounted = PolyEventName.VIEWER_MOUNTED.toLowerCase().replace(
        "poly",
        ""
      );
      context.emit(sceneReady, scene);
      if(viewer){
      context.emit(viewerMounted, viewer);
      }
    }
    function onProgress(p:number){
      progress.value = p;
      context.emit("progress", scene);
    }

    function disposeScene() {
      if (scene) {
        scene.dispose();
      }
      if (viewer) {
        viewer.dispose();
      }
    }

    onMounted(loadScene);
    onBeforeUnmount(disposeScene);

    // style and classes
    const progressBarClassObject = computed(() => {
      const visible = progress.value > 0 && progress.value < 1;
      return {
        fadeable: true,
        visible: visible,
        hidden: !visible,
      };
    });
    const progressBarBarStyleObject = computed(() => {
      const percent = Math.round(progress.value * 100);
      return {
        width: `${percent}%`,
      };
    });

    return {
      container,
      progressBarClassObject,
      progressBarBarStyleObject,
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
.fadeable {
  opacity: 1;
  transition: opacity 0.5s ease-in-out;
}
.visible {
  opacity: 1;
}
.hidden {
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

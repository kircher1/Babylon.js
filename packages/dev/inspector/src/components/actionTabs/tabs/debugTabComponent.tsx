import type { IPaneComponentProps } from "../paneComponent";
import { PaneComponent } from "../paneComponent";
import { LineContainerComponent } from "shared-ui-components/lines/lineContainerComponent";
import { CheckBoxLineComponent } from "shared-ui-components/lines/checkBoxLineComponent";
import { RenderGridPropertyGridComponent } from "./propertyGrids/renderGridPropertyGridComponent";

import { PhysicsViewer } from "core/Debug/physicsViewer";
import { StandardMaterial } from "core/Materials/standardMaterial";
import type { Mesh } from "core/Meshes/mesh";
import { MaterialFlags } from "core/Materials/materialFlags";

import "core/Physics/physicsEngineComponent";
import "core/Physics/v1/physicsEngineComponent";
import "core/Physics/v2/physicsEngineComponent";
import { FontAsset } from "addons/msdfText/fontAsset";
import type { Nullable } from "core/types";
import { TextRenderer } from "addons/msdfText/textRenderer";
import { Matrix } from "core/Maths/math.vector";

let _FontAsset: Nullable<FontAsset> = null;

export class DebugTabComponent extends PaneComponent {
    private _physicsViewersEnabled = false;
    private _namesViewerEnabled = false;

    constructor(props: IPaneComponentProps) {
        super(props);

        const scene = this.props.scene;

        if (!scene) {
            return;
        }

        if (!scene.reservedDataStore) {
            scene.reservedDataStore = {};
        }

        this._physicsViewersEnabled = scene.reservedDataStore.physicsViewer != null;
        this._namesViewerEnabled = scene.reservedDataStore.textRenderers != null;
    }

    switchPhysicsViewers() {
        this._physicsViewersEnabled = !this._physicsViewersEnabled;
        const scene = this.props.scene;

        if (this._physicsViewersEnabled) {
            const physicsViewer = new PhysicsViewer(scene);
            scene.reservedDataStore.physicsViewer = physicsViewer;

            for (const mesh of scene.meshes) {
                if (mesh.physicsImpostor) {
                    const debugMesh = physicsViewer.showImpostor(mesh.physicsImpostor, mesh as Mesh);

                    if (debugMesh) {
                        debugMesh.reservedDataStore = { hidden: true };
                        debugMesh.material!.reservedDataStore = { hidden: true };
                    }
                } else if (mesh.physicsBody) {
                    const debugMesh = physicsViewer.showBody(mesh.physicsBody);

                    if (debugMesh) {
                        debugMesh.reservedDataStore = { hidden: true };
                        debugMesh.material!.reservedDataStore = { hidden: true };
                    }
                }
            }

            for (const transformNode of scene.transformNodes) {
                if (transformNode.physicsBody) {
                    const debugMesh = physicsViewer.showBody(transformNode.physicsBody);

                    if (debugMesh) {
                        debugMesh.reservedDataStore = { hidden: true };
                        debugMesh.material!.reservedDataStore = { hidden: true };
                    }
                }
            }
        } else {
            scene.reservedDataStore.physicsViewer.dispose();
            scene.reservedDataStore.physicsViewer = null;
            _FontAsset?.dispose();
            _FontAsset = null;
        }
    }

    async switchNameViewerAsync() {
        this._namesViewerEnabled = !this._namesViewerEnabled;
        const scene = this.props.scene;

        if (this._namesViewerEnabled) {
            scene.reservedDataStore.textRenderers = [];
            if (!_FontAsset) {
                const sdfFontDefinition = await (await fetch("https://assets.babylonjs.com/fonts/roboto-regular.json")).text();
                // eslint-disable-next-line require-atomic-updates
                _FontAsset = new FontAsset(sdfFontDefinition, "https://assets.babylonjs.com/fonts/roboto-regular.png");
            }

            const textRendererPromises = scene.meshes.map(async (mesh) => {
                const textRenderer = await TextRenderer.CreateTextRendererAsync(_FontAsset!, scene.getEngine());

                textRenderer.addParagraph(mesh.name);
                textRenderer.isBillboard = true;
                textRenderer.isBillboardScreenProjected = true;
                textRenderer.parent = mesh;
                textRenderer.ignoreDepthBuffer = true;
                textRenderer.transformMatrix = Matrix.Scaling(0.02, 0.02, 0.02);

                scene.reservedDataStore.textRenderers.push(textRenderer);
            });

            await Promise.all(textRendererPromises);

            scene.reservedDataStore.textRenderersHook = scene.onAfterRenderObservable.add(() => {
                for (const textRenderer of scene.reservedDataStore.textRenderers) {
                    if (!textRenderer.parent.isVisible || !textRenderer.parent.isEnabled()) {
                        continue;
                    }
                    textRenderer.render(scene.getViewMatrix(), scene.getProjectionMatrix());
                }
            });
        } else {
            scene.onAfterRenderObservable.remove(scene.reservedDataStore.textRenderersHook);
            for (const textRenderer of scene.reservedDataStore.textRenderers) {
                textRenderer.dispose();
            }
            scene.reservedDataStore.textRenderersHook = null;
            scene.reservedDataStore.textRenderers = null;
        }
    }

    override render() {
        const scene = this.props.scene;

        if (!scene) {
            return null;
        }

        return (
            <div className="pane">
                <LineContainerComponent title="HELPERS" selection={this.props.globalState}>
                    <RenderGridPropertyGridComponent globalState={this.props.globalState} scene={scene} />
                    <CheckBoxLineComponent label="Physics" isSelected={() => this._physicsViewersEnabled} onSelect={() => this.switchPhysicsViewers()} />
                    <CheckBoxLineComponent
                        label="Names"
                        isSelected={() => this._namesViewerEnabled}
                        onSelect={() => {
                            void this.switchNameViewerAsync();
                        }}
                    />
                </LineContainerComponent>
                <LineContainerComponent title="CORE TEXTURE CHANNELS" selection={this.props.globalState}>
                    <CheckBoxLineComponent
                        label="Diffuse"
                        isSelected={() => StandardMaterial.DiffuseTextureEnabled}
                        onSelect={() => (StandardMaterial.DiffuseTextureEnabled = !StandardMaterial.DiffuseTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Ambient"
                        isSelected={() => StandardMaterial.AmbientTextureEnabled}
                        onSelect={() => (StandardMaterial.AmbientTextureEnabled = !StandardMaterial.AmbientTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Specular"
                        isSelected={() => StandardMaterial.SpecularTextureEnabled}
                        onSelect={() => (StandardMaterial.SpecularTextureEnabled = !StandardMaterial.SpecularTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Emissive"
                        isSelected={() => StandardMaterial.EmissiveTextureEnabled}
                        onSelect={() => (StandardMaterial.EmissiveTextureEnabled = !StandardMaterial.EmissiveTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Bump"
                        isSelected={() => StandardMaterial.BumpTextureEnabled}
                        onSelect={() => (StandardMaterial.BumpTextureEnabled = !StandardMaterial.BumpTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Opacity"
                        isSelected={() => StandardMaterial.OpacityTextureEnabled}
                        onSelect={() => (StandardMaterial.OpacityTextureEnabled = !StandardMaterial.OpacityTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Reflection"
                        isSelected={() => StandardMaterial.ReflectionTextureEnabled}
                        onSelect={() => (StandardMaterial.ReflectionTextureEnabled = !StandardMaterial.ReflectionTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Refraction"
                        isSelected={() => StandardMaterial.RefractionTextureEnabled}
                        onSelect={() => (StandardMaterial.RefractionTextureEnabled = !StandardMaterial.RefractionTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="ColorGrading"
                        isSelected={() => StandardMaterial.ColorGradingTextureEnabled}
                        onSelect={() => (StandardMaterial.ColorGradingTextureEnabled = !StandardMaterial.ColorGradingTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Lightmap"
                        isSelected={() => StandardMaterial.LightmapTextureEnabled}
                        onSelect={() => (StandardMaterial.LightmapTextureEnabled = !StandardMaterial.LightmapTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Fresnel"
                        isSelected={() => StandardMaterial.FresnelEnabled}
                        onSelect={() => (StandardMaterial.FresnelEnabled = !StandardMaterial.FresnelEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Detail"
                        isSelected={() => MaterialFlags.DetailTextureEnabled}
                        onSelect={() => (MaterialFlags.DetailTextureEnabled = !MaterialFlags.DetailTextureEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Decal"
                        isSelected={() => MaterialFlags.DecalMapEnabled}
                        onSelect={() => (MaterialFlags.DecalMapEnabled = !MaterialFlags.DecalMapEnabled)}
                    />
                </LineContainerComponent>
                <LineContainerComponent title="FEATURES" selection={this.props.globalState}>
                    <CheckBoxLineComponent label="Animations" isSelected={() => scene.animationsEnabled} onSelect={() => (scene.animationsEnabled = !scene.animationsEnabled)} />
                    <CheckBoxLineComponent label="Physics" isSelected={() => scene.physicsEnabled} onSelect={() => (scene.physicsEnabled = !scene.physicsEnabled)} />
                    <CheckBoxLineComponent label="Collisions" isSelected={() => scene.collisionsEnabled} onSelect={() => (scene.collisionsEnabled = !scene.collisionsEnabled)} />
                    <CheckBoxLineComponent label="Fog" isSelected={() => scene.fogEnabled} onSelect={() => (scene.fogEnabled = !scene.fogEnabled)} />
                    <CheckBoxLineComponent label="Lens flares" isSelected={() => scene.lensFlaresEnabled} onSelect={() => (scene.lensFlaresEnabled = !scene.lensFlaresEnabled)} />
                    <CheckBoxLineComponent label="Lights" isSelected={() => scene.lightsEnabled} onSelect={() => (scene.lightsEnabled = !scene.lightsEnabled)} />
                    <CheckBoxLineComponent label="Particles" isSelected={() => scene.particlesEnabled} onSelect={() => (scene.particlesEnabled = !scene.particlesEnabled)} />
                    <CheckBoxLineComponent
                        label="Post-processes"
                        isSelected={() => scene.postProcessesEnabled}
                        onSelect={() => (scene.postProcessesEnabled = !scene.postProcessesEnabled)}
                    />
                    <CheckBoxLineComponent label="Probes" isSelected={() => scene.probesEnabled} onSelect={() => (scene.probesEnabled = !scene.probesEnabled)} />
                    <CheckBoxLineComponent label="Textures" isSelected={() => scene.texturesEnabled} onSelect={() => (scene.texturesEnabled = !scene.texturesEnabled)} />
                    <CheckBoxLineComponent
                        label="Procedural textures"
                        isSelected={() => scene.proceduralTexturesEnabled}
                        onSelect={() => (scene.proceduralTexturesEnabled = !scene.proceduralTexturesEnabled)}
                    />
                    <CheckBoxLineComponent
                        label="Render targets"
                        isSelected={() => scene.renderTargetsEnabled}
                        onSelect={() => (scene.renderTargetsEnabled = !scene.renderTargetsEnabled)}
                    />
                    <CheckBoxLineComponent label="Shadows" isSelected={() => scene.shadowsEnabled} onSelect={() => (scene.shadowsEnabled = !scene.shadowsEnabled)} />
                    <CheckBoxLineComponent label="Skeletons" isSelected={() => scene.skeletonsEnabled} onSelect={() => (scene.skeletonsEnabled = !scene.skeletonsEnabled)} />
                    <CheckBoxLineComponent label="Sprites" isSelected={() => scene.spritesEnabled} onSelect={() => (scene.spritesEnabled = !scene.spritesEnabled)} />
                </LineContainerComponent>
            </div>
        );
    }
}

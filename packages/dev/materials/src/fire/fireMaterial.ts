/* eslint-disable @typescript-eslint/naming-convention */
import type { Nullable } from "core/types";
import { serializeAsTexture, serialize, expandToProperty, serializeAsColor3 } from "core/Misc/decorators";
import { SerializationHelper } from "core/Misc/decorators.serialization";
import type { Matrix } from "core/Maths/math.vector";
import { Color3 } from "core/Maths/math.color";
import { Tags } from "core/Misc/tags";
import type { BaseTexture } from "core/Materials/Textures/baseTexture";
import { Texture } from "core/Materials/Textures/texture";
import { MaterialDefines } from "core/Materials/materialDefines";
import { PushMaterial } from "core/Materials/pushMaterial";
import { MaterialFlags } from "core/Materials/materialFlags";
import { VertexBuffer } from "core/Buffers/buffer";
import type { AbstractMesh } from "core/Meshes/abstractMesh";
import type { SubMesh } from "core/Meshes/subMesh";
import type { Mesh } from "core/Meshes/mesh";
import { Scene } from "core/scene";
import { RegisterClass } from "core/Misc/typeStore";
import type { IAnimatable } from "core/Animations/animatable.interface";

import "./fire.fragment";
import "./fire.vertex";
import { EffectFallbacks } from "core/Materials/effectFallbacks";
import { AddClipPlaneUniforms, BindClipPlane } from "core/Materials/clipPlaneMaterialHelper";
import {
    BindBonesParameters,
    BindFogParameters,
    BindLogDepth,
    PrepareAttributesForBones,
    PrepareAttributesForInstances,
    PrepareDefinesForAttributes,
    PrepareDefinesForFrameBoundValues,
} from "core/Materials/materialHelper.functions";

class FireMaterialDefines extends MaterialDefines {
    public DIFFUSE = false;
    public CLIPPLANE = false;
    public CLIPPLANE2 = false;
    public CLIPPLANE3 = false;
    public CLIPPLANE4 = false;
    public CLIPPLANE5 = false;
    public CLIPPLANE6 = false;
    public ALPHATEST = false;
    public DEPTHPREPASS = false;
    public POINTSIZE = false;
    public FOG = false;
    public UV1 = false;
    public VERTEXCOLOR = false;
    public VERTEXALPHA = false;
    public BonesPerMesh = 0;
    public NUM_BONE_INFLUENCERS = 0;
    public INSTANCES = false;
    public INSTANCESCOLOR = false;
    public IMAGEPROCESSINGPOSTPROCESS = false;
    public SKIPFINALCOLORCLAMP = false;
    public LOGARITHMICDEPTH = false;

    constructor() {
        super();
        this.rebuild();
    }
}

export class FireMaterial extends PushMaterial {
    @serializeAsTexture("diffuseTexture")
    private _diffuseTexture: Nullable<BaseTexture>;
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public diffuseTexture: Nullable<BaseTexture>;

    @serializeAsTexture("distortionTexture")
    private _distortionTexture: Nullable<BaseTexture>;
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public distortionTexture: Nullable<BaseTexture>;

    @serializeAsTexture("opacityTexture")
    private _opacityTexture: Nullable<BaseTexture>;
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public opacityTexture: Nullable<BaseTexture>;

    @serializeAsColor3("diffuse")
    public diffuseColor = new Color3(1, 1, 1);

    @serialize()
    public speed = 1.0;

    private _scaledDiffuse = new Color3();
    private _lastTime: number = 0;

    constructor(name: string, scene?: Scene) {
        super(name, scene);
    }

    public override needAlphaBlending(): boolean {
        return false;
    }

    public override needAlphaTesting(): boolean {
        return true;
    }

    public override getAlphaTestTexture(): Nullable<BaseTexture> {
        return null;
    }

    // Methods
    public override isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        const drawWrapper = subMesh._drawWrapper;

        if (this.isFrozen) {
            if (drawWrapper._wasPreviouslyReady && drawWrapper._wasPreviouslyUsingInstances === useInstances) {
                return true;
            }
        }

        if (!subMesh.materialDefines) {
            subMesh.materialDefines = new FireMaterialDefines();
        }

        const defines = <FireMaterialDefines>subMesh.materialDefines;
        const scene = this.getScene();

        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const engine = scene.getEngine();

        // Textures
        if (defines._areTexturesDirty) {
            defines._needUVs = false;
            if (this._diffuseTexture && MaterialFlags.DiffuseTextureEnabled) {
                if (!this._diffuseTexture.isReady()) {
                    return false;
                } else {
                    defines._needUVs = true;
                    defines.DIFFUSE = true;
                }
            }
        }

        defines.ALPHATEST = this._opacityTexture ? true : false;

        // Misc.
        if (defines._areMiscDirty) {
            defines.POINTSIZE = this.pointsCloud || scene.forcePointsCloud;
            defines.FOG = scene.fogEnabled && mesh.applyFog && scene.fogMode !== Scene.FOGMODE_NONE && this.fogEnabled;
            defines.LOGARITHMICDEPTH = this._useLogarithmicDepth;
        }

        // Values that need to be evaluated on every frame
        PrepareDefinesForFrameBoundValues(scene, engine, this, defines, useInstances ? true : false);

        // Attribs
        PrepareDefinesForAttributes(mesh, defines, false, true);

        // Get correct effect
        if (defines.isDirty) {
            defines.markAsProcessed();

            scene.resetCachedMaterial();

            // Fallbacks
            const fallbacks = new EffectFallbacks();
            if (defines.FOG) {
                fallbacks.addFallback(1, "FOG");
            }

            if (defines.NUM_BONE_INFLUENCERS > 0) {
                fallbacks.addCPUSkinningFallback(0, mesh);
            }

            defines.IMAGEPROCESSINGPOSTPROCESS = scene.imageProcessingConfiguration.applyByPostProcess;

            //Attributes
            const attribs = [VertexBuffer.PositionKind];

            if (defines.UV1) {
                attribs.push(VertexBuffer.UVKind);
            }

            if (defines.VERTEXCOLOR) {
                attribs.push(VertexBuffer.ColorKind);
            }

            PrepareAttributesForBones(attribs, mesh, defines, fallbacks);
            PrepareAttributesForInstances(attribs, defines);

            // Legacy browser patch
            const shaderName = "fire";

            const uniforms = [
                "world",
                "view",
                "viewProjection",
                "vEyePosition",
                "vFogInfos",
                "vFogColor",
                "pointSize",
                "vDiffuseInfos",
                "mBones",
                "diffuseMatrix",
                "logarithmicDepthConstant",
                // Fire
                "time",
                "speed",
            ];
            AddClipPlaneUniforms(uniforms);

            const join = defines.toString();
            subMesh.setEffect(
                scene.getEngine().createEffect(
                    shaderName,
                    {
                        attributes: attribs,
                        uniformsNames: uniforms,
                        uniformBuffersNames: [],
                        samplers: [
                            "diffuseSampler",
                            // Fire
                            "distortionSampler",
                            "opacitySampler",
                        ],
                        defines: join,
                        fallbacks: fallbacks,
                        onCompiled: this.onCompiled,
                        onError: this.onError,
                        indexParameters: null,
                        maxSimultaneousLights: 4,
                        transformFeedbackVaryings: null,
                    },
                    engine
                ),
                defines,
                this._materialContext
            );
        }

        if (!subMesh.effect || !subMesh.effect.isReady()) {
            return false;
        }

        defines._renderId = scene.getRenderId();
        drawWrapper._wasPreviouslyReady = true;
        drawWrapper._wasPreviouslyUsingInstances = !!useInstances;

        return true;
    }

    public override bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const scene = this.getScene();

        const defines = <FireMaterialDefines>subMesh.materialDefines;
        if (!defines) {
            return;
        }

        const effect = subMesh.effect;
        if (!effect) {
            return;
        }
        this._activeEffect = effect;

        // Matrices
        this.bindOnlyWorldMatrix(world);
        this._activeEffect.setMatrix("viewProjection", scene.getTransformMatrix());

        // Bones
        BindBonesParameters(mesh, this._activeEffect);

        if (this._mustRebind(scene, effect, subMesh)) {
            // Textures
            if (this._diffuseTexture && MaterialFlags.DiffuseTextureEnabled) {
                this._activeEffect.setTexture("diffuseSampler", this._diffuseTexture);

                this._activeEffect.setFloat2("vDiffuseInfos", this._diffuseTexture.coordinatesIndex, this._diffuseTexture.level);
                this._activeEffect.setMatrix("diffuseMatrix", this._diffuseTexture.getTextureMatrix());

                this._activeEffect.setTexture("distortionSampler", this._distortionTexture);
                this._activeEffect.setTexture("opacitySampler", this._opacityTexture);
            }

            // Clip plane
            BindClipPlane(this._activeEffect, this, scene);

            // Point size
            if (this.pointsCloud) {
                this._activeEffect.setFloat("pointSize", this.pointSize);
            }

            // Log. depth
            if (this._useLogarithmicDepth) {
                BindLogDepth(defines, effect, scene);
            }

            scene.bindEyePosition(effect);
        }

        this._activeEffect.setColor4("vDiffuseColor", this._scaledDiffuse, this.alpha * mesh.visibility);

        // View
        if (scene.fogEnabled && mesh.applyFog && scene.fogMode !== Scene.FOGMODE_NONE) {
            this._activeEffect.setMatrix("view", scene.getViewMatrix());
        }

        // Fog
        BindFogParameters(scene, mesh, this._activeEffect);

        // Time
        this._lastTime += scene.getEngine().getDeltaTime();
        this._activeEffect.setFloat("time", this._lastTime);

        // Speed
        this._activeEffect.setFloat("speed", this.speed);

        this._afterBind(mesh, this._activeEffect, subMesh);
    }

    public override getAnimatables(): IAnimatable[] {
        const results = [];

        if (this._diffuseTexture && this._diffuseTexture.animations && this._diffuseTexture.animations.length > 0) {
            results.push(this._diffuseTexture);
        }
        if (this._distortionTexture && this._distortionTexture.animations && this._distortionTexture.animations.length > 0) {
            results.push(this._distortionTexture);
        }
        if (this._opacityTexture && this._opacityTexture.animations && this._opacityTexture.animations.length > 0) {
            results.push(this._opacityTexture);
        }

        return results;
    }

    public override getActiveTextures(): BaseTexture[] {
        const activeTextures = super.getActiveTextures();

        if (this._diffuseTexture) {
            activeTextures.push(this._diffuseTexture);
        }

        if (this._distortionTexture) {
            activeTextures.push(this._distortionTexture);
        }

        if (this._opacityTexture) {
            activeTextures.push(this._opacityTexture);
        }

        return activeTextures;
    }

    public override hasTexture(texture: BaseTexture): boolean {
        if (super.hasTexture(texture)) {
            return true;
        }

        if (this._diffuseTexture === texture) {
            return true;
        }

        if (this._distortionTexture === texture) {
            return true;
        }

        if (this._opacityTexture === texture) {
            return true;
        }

        return false;
    }

    public override getClassName(): string {
        return "FireMaterial";
    }

    public override dispose(forceDisposeEffect?: boolean): void {
        if (this._diffuseTexture) {
            this._diffuseTexture.dispose();
        }
        if (this._distortionTexture) {
            this._distortionTexture.dispose();
        }

        super.dispose(forceDisposeEffect);
    }

    public override clone(name: string): FireMaterial {
        return SerializationHelper.Clone<FireMaterial>(() => new FireMaterial(name, this.getScene()), this);
    }

    public override serialize(): any {
        const serializationObject = super.serialize();
        serializationObject.customType = "BABYLON.FireMaterial";
        serializationObject.diffuseColor = this.diffuseColor.asArray();
        serializationObject.speed = this.speed;

        if (this._diffuseTexture) {
            serializationObject._diffuseTexture = this._diffuseTexture.serialize();
        }

        if (this._distortionTexture) {
            serializationObject._distortionTexture = this._distortionTexture.serialize();
        }

        if (this._opacityTexture) {
            serializationObject._opacityTexture = this._opacityTexture.serialize();
        }

        return serializationObject;
    }

    public static override Parse(source: any, scene: Scene, rootUrl: string): FireMaterial {
        const material = new FireMaterial(source.name, scene);

        material.diffuseColor = Color3.FromArray(source.diffuseColor);
        material.speed = source.speed;

        material.alpha = source.alpha;

        material.id = source.id;

        Tags.AddTagsTo(material, source.tags);
        material.backFaceCulling = source.backFaceCulling;
        material.wireframe = source.wireframe;

        if (source._diffuseTexture) {
            material._diffuseTexture = Texture.Parse(source._diffuseTexture, scene, rootUrl);
        }

        if (source._distortionTexture) {
            material._distortionTexture = Texture.Parse(source._distortionTexture, scene, rootUrl);
        }

        if (source._opacityTexture) {
            material._opacityTexture = Texture.Parse(source._opacityTexture, scene, rootUrl);
        }

        return material;
    }
}

RegisterClass("BABYLON.FireMaterial", FireMaterial);

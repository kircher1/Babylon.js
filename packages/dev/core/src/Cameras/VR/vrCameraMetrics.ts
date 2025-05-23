import { Matrix } from "../../Maths/math.vector";
/**
 * This represents all the required metrics to create a VR camera.
 * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_introduction#device-orientation-camera
 */
export class VRCameraMetrics {
    /**
     * Define the horizontal resolution off the screen.
     */
    public hResolution: number;
    /**
     * Define the vertical resolution off the screen.
     */
    public vResolution: number;
    /**
     * Define the horizontal screen size.
     */
    public hScreenSize: number;
    /**
     * Define the vertical screen size.
     */
    public vScreenSize: number;
    /**
     * Define the vertical screen center position.
     */
    public vScreenCenter: number;
    /**
     * Define the distance of the eyes to the screen.
     */
    public eyeToScreenDistance: number;
    /**
     * Define the distance between both lenses
     */
    public lensSeparationDistance: number;
    /**
     * Define the distance between both viewer's eyes.
     */
    public interpupillaryDistance: number;
    /**
     * Define the distortion factor of the VR postprocess.
     * Please, touch with care.
     */
    public distortionK: number[];
    /**
     * Define the chromatic aberration correction factors for the VR post process.
     */
    public chromaAbCorrection: number[];
    /**
     * Define the scale factor of the post process.
     * The smaller the better but the slower.
     */
    public postProcessScaleFactor: number;
    /**
     * Define an offset for the lens center.
     */
    public lensCenterOffset: number;
    /**
     * Define if the current vr camera should compensate the distortion of the lens or not.
     */
    public compensateDistortion = true;

    /**
     * Defines if multiview should be enabled when rendering (Default: false)
     */
    public multiviewEnabled = false;

    /**
     * Gets the rendering aspect ratio based on the provided resolutions.
     */
    public get aspectRatio(): number {
        return this.hResolution / (2 * this.vResolution);
    }

    /**
     * Gets the aspect ratio based on the FOV, scale factors, and real screen sizes.
     */
    public get aspectRatioFov(): number {
        return 2 * Math.atan((this.postProcessScaleFactor * this.vScreenSize) / (2 * this.eyeToScreenDistance));
    }

    /**
     * @internal
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public get leftHMatrix(): Matrix {
        const meters = this.hScreenSize / 4 - this.lensSeparationDistance / 2;
        const h = (4 * meters) / this.hScreenSize;

        return Matrix.Translation(h, 0, 0);
    }

    /**
     * @internal
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public get rightHMatrix(): Matrix {
        const meters = this.hScreenSize / 4 - this.lensSeparationDistance / 2;
        const h = (4 * meters) / this.hScreenSize;

        return Matrix.Translation(-h, 0, 0);
    }

    /**
     * @internal
     */
    public get leftPreViewMatrix(): Matrix {
        return Matrix.Translation(0.5 * this.interpupillaryDistance, 0, 0);
    }

    /**
     * @internal
     */
    public get rightPreViewMatrix(): Matrix {
        return Matrix.Translation(-0.5 * this.interpupillaryDistance, 0, 0);
    }

    /**
     * Get the default VRMetrics based on the most generic setup.
     * @returns the default vr metrics
     */
    public static GetDefault(): VRCameraMetrics {
        const result = new VRCameraMetrics();

        result.hResolution = 1280;
        result.vResolution = 800;
        result.hScreenSize = 0.149759993;
        result.vScreenSize = 0.0935999975;
        result.vScreenCenter = 0.0467999987;
        result.eyeToScreenDistance = 0.0410000011;
        result.lensSeparationDistance = 0.063500002;
        result.interpupillaryDistance = 0.064000003;
        result.distortionK = [1.0, 0.219999999, 0.239999995, 0.0];
        result.chromaAbCorrection = [0.995999992, -0.00400000019, 1.01400006, 0.0];
        result.postProcessScaleFactor = 1.714605507808412;
        result.lensCenterOffset = 0.151976421;

        return result;
    }
}

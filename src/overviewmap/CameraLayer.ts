/*
 *
 * Copyright (c) 1999-2025 Luciad All Rights Reserved.
 *
 * Luciad grants you ("Licensee") a non-exclusive, royalty free, license to use,
 * modify and redistribute this software in source and binary code form,
 * provided that i) this copyright notice and license appear on all copies of
 * the software; and ii) Licensee does not utilize the software in a manner
 * which is disparaging to Luciad.
 *
 * This software is provided "AS IS," without a warranty of any kind. ALL
 * EXPRESS OR IMPLIED CONDITIONS, REPRESENTATIONS AND WARRANTIES, INCLUDING ANY
 * IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR
 * NON-INFRINGEMENT, ARE HEREBY EXCLUDED. LUCIAD AND ITS LICENSORS SHALL NOT BE
 * LIABLE FOR ANY DAMAGES SUFFERED BY LICENSEE AS A RESULT OF USING, MODIFYING
 * OR DISTRIBUTING THE SOFTWARE OR ITS DERIVATIVES. IN NO EVENT WILL LUCIAD OR ITS
 * LICENSORS BE LIABLE FOR ANY LOST REVENUE, PROFIT OR DATA, OR FOR DIRECT,
 * INDIRECT, SPECIAL, CONSEQUENTIAL, INCIDENTAL OR PUNITIVE DAMAGES, HOWEVER
 * CAUSED AND REGARDLESS OF THE THEORY OF LIABILITY, ARISING OUT OF THE USE OF
 * OR INABILITY TO USE SOFTWARE, EVEN IF LUCIAD HAS BEEN ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGES.
 */
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";
import {MemoryStore} from "@luciad/ria/model/store/MemoryStore.js";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {Transformation} from "@luciad/ria/transformation/Transformation.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {DEG2RAD, RAD2DEG} from "@luciad/ria-toolbox-core/util/Math.js";
import {CameraLocationPainter} from "./CameraLocationPainter.js";

export type CameraFeature = Feature<Point, { heading: number, fov: number }>;

const refLLH = getReference("CRS:84");

class CameraLocationStore extends MemoryStore<CameraFeature> {
  private readonly _cameraFeature: CameraFeature;
  private readonly _toLLH: Transformation;

  constructor(private mainMap: WebGLMap) {
    super();
    this._toLLH = createTransformation(mainMap.reference, refLLH);
    this._cameraFeature = new Feature(createPoint(refLLH, [0, 0]), {heading: 0, fov: 60}, 1);
  }

  updateCameraFeature() {
    const {yaw} = this.mainMap.camera.asLookFrom();
    const {fovY, aspectRatio} = this.mainMap.camera as PerspectiveCamera;
    const fovX = 2 * Math.atan(Math.tan(fovY * DEG2RAD / 2) * aspectRatio) * RAD2DEG;
    this._cameraFeature.properties.heading = yaw;
    this._cameraFeature.properties.fov = fovX;

    if (this.mainMap.camera instanceof PerspectiveCamera) {
      this._cameraFeature.shape = this._toLLH.transform(this.mainMap.camera.eyePoint);
    }
    this.put(this._cameraFeature);
  }
}

export function createCameraLayer(mainMap: WebGLMap): [FeatureLayer, Handle] {
  const cameraStore = new CameraLocationStore(mainMap);
  cameraStore.updateCameraFeature();
  const handle = mainMap.on('MapChange', () => cameraStore.updateCameraFeature());

  const model = new FeatureModel(cameraStore, {reference: refLLH});
  const painter = new CameraLocationPainter();
  const layer = new FeatureLayer(model, {
    id: 'overview-camera-layer',
    painter,
    hoverable: false,
    selectable: false
  });
  return [layer, handle];
}

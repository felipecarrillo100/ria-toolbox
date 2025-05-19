# LuciadRIA Overview Map tool

This package contains the OverviewMapSupport API.

## Overview

The `OverviewMapSupport` provides a secondary 2D overview map that is synchronized with a primary 3D map.
The overview map, upon instantiation, automatically zooms in to the camera's position on the main map,
maintaining the same scale as the main map.

As you navigate in the 3D map, changing the camera position, orientation, and field of view,
the `OverviewMapSupport` constantly updates the overview map to reflect these changes.

For detailed API information, please refer to the `OverviewMapSupport` file in the source code.

## Limitations

- The tool is currently not compatible with main maps that use a Cartesian reference.
- The tool creates only a 2D overview map in EPSG:3857.
- The main map's camera must be an instance of type `PerspectiveCamera`.

## Usage

Code below shows a typical use of the tool.

```
const overviewSupport = new OverviewMapSupport({
    mainMap: map,                // Specify the primary 3D map instance
    overviewMapDomNode: mapDiv   // Provide the HTML element for the overview map
});

// Retrieve the created overview map object
const overviewMap = overviewSupport.overviewMap;

// Add a layer to the overview map
overviewMap.layerTree.addLayer(aLayer);

// Modify the length of the visualized frustum to 60 pixels
overviewMap.cameraFrustumLayer.painter.frustumIconSize = 60;
```

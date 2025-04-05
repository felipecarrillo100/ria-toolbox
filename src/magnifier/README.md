# LuciadRIA Magnifier tool

This package contains the Magnifier API

## Overview

The Magnifier Support allows users to visualize a detailed part of the map.
Through a magnifier, users get an enlarged view of 3D layers on the map covered by the magnifier,
revealing finer details that may not be immediately visible on the main map.
For ease of use, a Magnifier Controller is also exposed, which will magnify whatever is under the cursor.

This tool is customizable, ensuring its adaptability to a variety of use-cases.

For detailed API information, please refer to the `MagnifierSupport` and `MagnifierController` files in the source code.

## Limitations

- The tool works only with the `TileSet3DLayer` layers. Other layer types, including raster and vector layers, 
are not supported and hence should not be set on the magnifier's map.
- The tool is designed to operate on 3D maps with the `PerspectiveCamera` only.

## Usage

Code below shows how to customize the magnifier's shape, as well as the center element. 

```
const magnifier = new MagnifierController({ 
  roundness: 0.8,
  width: 300,
  height: 200,
  positionOffset: 16,
});

magnifier.centerNode.style.backgroundColor = 'green';
magnifier.centerNode.style.borderRadius = '50%';

magnifier.onInit((magnifierSupport: MagnifierSupport) => {
  const magnifierMap: WebGLMap = magnifierSupport.magnifierMap; 
  // recreate main map's OGC 3D layers on the magnifier map
});
```

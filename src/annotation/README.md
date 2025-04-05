# LuciadRIA Annotation tool

The Annotation tool uses a combination of a LuciadRIA layer and controller to allow users to annotate 3D points or
measurements on a map and visualize these annotations.
For point annotations, labels for unselected annotations are drawn by LuciadRIA but the idea is that, when selected,
more information is displayed next to the annotation using raw HMTL or a rendering framework like React.

For detailed API information, please refer to the `LabelAnnotationSupport` and `MeasurementAnnotationSupport` files
in the source code.

## Limitations

- The tool is only designed to work on a map with a geocentric reference


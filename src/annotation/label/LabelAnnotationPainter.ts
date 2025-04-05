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
import {FeaturePainter, PaintState} from '@luciad/ria/view/feature/FeaturePainter.js';
import {GeoCanvas} from '@luciad/ria/view/style/GeoCanvas.js';
import {LabelCanvas} from '@luciad/ria/view/style/LabelCanvas.js';
import {Shape} from '@luciad/ria/shape/Shape.js';
import {Feature} from '@luciad/ria/model/feature/Feature.js';
import {Layer} from '@luciad/ria/view/Layer.js';
import {Map} from '@luciad/ria/view/Map.js';
import {Point} from "@luciad/ria/shape/Point.js";
import {OcclusionMode} from "@luciad/ria/view/style/OcclusionMode.js";
import {IconStyle} from "@luciad/ria/view/style/IconStyle.js";

/**
 * The properties of annotation features
 */
export interface LabelAnnotationProperties {
  /**
   * Whether the annotation should be visible on the map or not
   */
  visible: boolean;

  /**
   * The title of the annotation, which will be used as label on the RIA map
   */
  title: string;
}

/**
 * Styles that are used by the {@link LabelAnnotationPainter} to paint annotations in various states.
 */
export interface LabelAnnotationStyles {
  /**
   * The style used when an annotation is visible and not selected or hovered
   */
  defaultStyle?: IconStyle;

  /**
   * The style used when an annotation is selected
   */
  selectedStyle?: IconStyle;

  /**
   * The style used when an annotation is hovered, but not visible
   */
  hoveredHiddenStyle?: IconStyle;

  /**
   * The style used when an annotation is hovered and is visible
   */
  hoveredVisibleStyle?: IconStyle;
}

/**
 * A feature representing a point annotation on the map
 */
export type LabelAnnotationFeature = Feature<Point, LabelAnnotationProperties>

const annotationCrosshairIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZyBmaWx0ZXI9InVybCgjZmlsdGVyMF9iKSI+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4zIi8+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPC9nPgogIDxwYXRoIGQ9Ik0zOSAyMEgxLjUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMiIvPgogIDxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9ImJsYWNrIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8cGF0aCBkPSJNMjAgMS41VjM4LjUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMiIvPgogIDxkZWZzPgogICAgPGZpbHRlciBpZD0iZmlsdGVyMF9iIiB4PSItMjAiIHk9Ii0yMCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+CiAgICAgIDxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+CiAgICAgIDxmZUdhdXNzaWFuQmx1ciBpbj0iQmFja2dyb3VuZEltYWdlIiBzdGREZXZpYXRpb249IjEwIi8+CiAgICAgIDxmZUNvbXBvc2l0ZSBpbjI9IlNvdXJjZUFscGhhIiBvcGVyYXRvcj0iaW4iIHJlc3VsdD0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1ciIvPgogICAgICA8ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImVmZmVjdDFfYmFja2dyb3VuZEJsdXIiIHJlc3VsdD0ic2hhcGUiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KPC9zdmc+Cg==';
const annotationIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfYl8zMzE2XzE5NDUwMykiPgo8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgZmlsbD0iIzEyMTIxMiIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPC9nPgo8ZyBmaWx0ZXI9InVybCgjZmlsdGVyMV9iXzMzMTZfMTk0NTAzKSI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjAgMzhDMjkuOTQxMSAzOCAzOCAyOS45NDExIDM4IDIwQzM4IDEwLjA1ODkgMjkuOTQxMSAyIDIwIDJDMTAuMDU4OSAyIDIgMTAuMDU4OSAyIDIwQzIgMjkuOTQxMSAxMC4wNTg5IDM4IDIwIDM4Wk0yMCA0MEMzMS4wNDU3IDQwIDQwIDMxLjA0NTcgNDAgMjBDNDAgOC45NTQzIDMxLjA0NTcgMCAyMCAwQzguOTU0MyAwIDAgOC45NTQzIDAgMjBDMCAzMS4wNDU3IDguOTU0MyA0MCAyMCA0MFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMiIvPgo8L2c+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjYiIGZpbGw9IndoaXRlIi8+CjxkZWZzPgo8ZmlsdGVyIGlkPSJmaWx0ZXIwX2JfMzMxNl8xOTQ1MDMiIHg9Ii0yIiB5PSItMiIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjQ0IiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+CjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+CjxmZUdhdXNzaWFuQmx1ciBpbj0iQmFja2dyb3VuZEltYWdlIiBzdGREZXZpYXRpb249IjIiLz4KPGZlQ29tcG9zaXRlIGluMj0iU291cmNlQWxwaGEiIG9wZXJhdG9yPSJpbiIgcmVzdWx0PSJlZmZlY3QxX2JhY2tncm91bmRCbHVyXzMzMTZfMTk0NTAzIi8+CjxmZUJsZW5kIG1vZGU9Im5vcm1hbCIgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1cl8zMzE2XzE5NDUwMyIgcmVzdWx0PSJzaGFwZSIvPgo8L2ZpbHRlcj4KPGZpbHRlciBpZD0iZmlsdGVyMV9iXzMzMTZfMTk0NTAzIiB4PSItNCIgeT0iLTQiIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsdGVyVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiPgo8ZmVGbG9vZCBmbG9vZC1vcGFjaXR5PSIwIiByZXN1bHQ9IkJhY2tncm91bmRJbWFnZUZpeCIvPgo8ZmVHYXVzc2lhbkJsdXIgaW49IkJhY2tncm91bmRJbWFnZSIgc3RkRGV2aWF0aW9uPSIyIi8+CjxmZUNvbXBvc2l0ZSBpbjI9IlNvdXJjZUFscGhhIiBvcGVyYXRvcj0iaW4iIHJlc3VsdD0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1cl8zMzE2XzE5NDUwMyIvPgo8ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImVmZmVjdDFfYmFja2dyb3VuZEJsdXJfMzMxNl8xOTQ1MDMiIHJlc3VsdD0ic2hhcGUiLz4KPC9maWx0ZXI+CjwvZGVmcz4KPC9zdmc+Cg==';
const annotationHighlight = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgb3BhY2l0eT0iMC41IiBmaWx0ZXI9InVybCgjZmlsdGVyMF9iXzMzMTZfMTk0NTA3KSI+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjE4IiBmaWxsPSIjNTA5OEExIi8+CjwvZz4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjFfYl8zMzE2XzE5NDUwNykiPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTIwIDM4QzI5Ljk0MTEgMzggMzggMjkuOTQxMSAzOCAyMEMzOCAxMC4wNTg5IDI5Ljk0MTEgMiAyMCAyQzEwLjA1ODkgMiAyIDEwLjA1ODkgMiAyMEMyIDI5Ljk0MTEgMTAuMDU4OSAzOCAyMCAzOFpNMjAgNDBDMzEuMDQ1NyA0MCA0MCAzMS4wNDU3IDQwIDIwQzQwIDguOTU0MyAzMS4wNDU3IDAgMjAgMEM4Ljk1NDMgMCAwIDguOTU0MyAwIDIwQzAgMzEuMDQ1NyA4Ljk1NDMgNDAgMjAgNDBaIiBmaWxsPSIjNTA5OEExIi8+CjwvZz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iNiIgZmlsbD0iIzUwOThBMSIvPgo8ZGVmcz4KPGZpbHRlciBpZD0iZmlsdGVyMF9iXzMzMTZfMTk0NTA3IiB4PSItMiIgeT0iLTIiIHdpZHRoPSI0NCIgaGVpZ2h0PSI0NCIgZmlsdGVyVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiPgo8ZmVGbG9vZCBmbG9vZC1vcGFjaXR5PSIwIiByZXN1bHQ9IkJhY2tncm91bmRJbWFnZUZpeCIvPgo8ZmVHYXVzc2lhbkJsdXIgaW49IkJhY2tncm91bmRJbWFnZSIgc3RkRGV2aWF0aW9uPSIyIi8+CjxmZUNvbXBvc2l0ZSBpbjI9IlNvdXJjZUFscGhhIiBvcGVyYXRvcj0iaW4iIHJlc3VsdD0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1cl8zMzE2XzE5NDUwNyIvPgo8ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImVmZmVjdDFfYmFja2dyb3VuZEJsdXJfMzMxNl8xOTQ1MDciIHJlc3VsdD0ic2hhcGUiLz4KPC9maWx0ZXI+CjxmaWx0ZXIgaWQ9ImZpbHRlcjFfYl8zMzE2XzE5NDUwNyIgeD0iLTQiIHk9Ii00IiB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj4KPGZlRmxvb2QgZmxvb2Qtb3BhY2l0eT0iMCIgcmVzdWx0PSJCYWNrZ3JvdW5kSW1hZ2VGaXgiLz4KPGZlR2F1c3NpYW5CbHVyIGluPSJCYWNrZ3JvdW5kSW1hZ2UiIHN0ZERldmlhdGlvbj0iMiIvPgo8ZmVDb21wb3NpdGUgaW4yPSJTb3VyY2VBbHBoYSIgb3BlcmF0b3I9ImluIiByZXN1bHQ9ImVmZmVjdDFfYmFja2dyb3VuZEJsdXJfMzMxNl8xOTQ1MDciLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJlZmZlY3QxX2JhY2tncm91bmRCbHVyXzMzMTZfMTk0NTA3IiByZXN1bHQ9InNoYXBlIi8+CjwvZmlsdGVyPgo8L2RlZnM+Cjwvc3ZnPgo=';
const annotationGhost = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgb3BhY2l0eT0iMC41Ij4KPGcgb3BhY2l0eT0iMC41IiBmaWx0ZXI9InVybCgjZmlsdGVyMF9iXzMzMTZfMTk0NTE4KSI+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjE4IiBmaWxsPSIjNTA5OEExIi8+CjwvZz4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjFfYl8zMzE2XzE5NDUxOCkiPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTIwIDM4QzI5Ljk0MTEgMzggMzggMjkuOTQxMSAzOCAyMEMzOCAxMC4wNTg5IDI5Ljk0MTEgMiAyMCAyQzEwLjA1ODkgMiAyIDEwLjA1ODkgMiAyMEMyIDI5Ljk0MTEgMTAuMDU4OSAzOCAyMCAzOFpNMjAgNDBDMzEuMDQ1NyA0MCA0MCAzMS4wNDU3IDQwIDIwQzQwIDguOTU0MyAzMS4wNDU3IDAgMjAgMEM4Ljk1NDMgMCAwIDguOTU0MyAwIDIwQzAgMzEuMDQ1NyA4Ljk1NDMgNDAgMjAgNDBaIiBmaWxsPSIjNTA5OEExIi8+CjwvZz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iNiIgZmlsbD0iIzUwOThBMSIvPgo8L2c+CjxkZWZzPgo8ZmlsdGVyIGlkPSJmaWx0ZXIwX2JfMzMxNl8xOTQ1MTgiIHg9Ii0yIiB5PSItMiIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjQ0IiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+CjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+CjxmZUdhdXNzaWFuQmx1ciBpbj0iQmFja2dyb3VuZEltYWdlIiBzdGREZXZpYXRpb249IjIiLz4KPGZlQ29tcG9zaXRlIGluMj0iU291cmNlQWxwaGEiIG9wZXJhdG9yPSJpbiIgcmVzdWx0PSJlZmZlY3QxX2JhY2tncm91bmRCbHVyXzMzMTZfMTk0NTE4Ii8+CjxmZUJsZW5kIG1vZGU9Im5vcm1hbCIgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1cl8zMzE2XzE5NDUxOCIgcmVzdWx0PSJzaGFwZSIvPgo8L2ZpbHRlcj4KPGZpbHRlciBpZD0iZmlsdGVyMV9iXzMzMTZfMTk0NTE4IiB4PSItNCIgeT0iLTQiIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsdGVyVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiPgo8ZmVGbG9vZCBmbG9vZC1vcGFjaXR5PSIwIiByZXN1bHQ9IkJhY2tncm91bmRJbWFnZUZpeCIvPgo8ZmVHYXVzc2lhbkJsdXIgaW49IkJhY2tncm91bmRJbWFnZSIgc3RkRGV2aWF0aW9uPSIyIi8+CjxmZUNvbXBvc2l0ZSBpbjI9IlNvdXJjZUFscGhhIiBvcGVyYXRvcj0iaW4iIHJlc3VsdD0iZWZmZWN0MV9iYWNrZ3JvdW5kQmx1cl8zMzE2XzE5NDUxOCIvPgo8ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImVmZmVjdDFfYmFja2dyb3VuZEJsdXJfMzMxNl8xOTQ1MTgiIHJlc3VsdD0ic2hhcGUiLz4KPC9maWx0ZXI+CjwvZGVmcz4KPC9zdmc+Cg==';

const LABEL_ANNOTATION_ICON_SIZE = '34px';

const DEFAULT_STYLE: IconStyle = {
  url: annotationIcon,
  width: LABEL_ANNOTATION_ICON_SIZE,
  height: LABEL_ANNOTATION_ICON_SIZE,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const SELECTED_STYLE: IconStyle = {
  url: annotationCrosshairIcon,
  width: LABEL_ANNOTATION_ICON_SIZE,
  height: LABEL_ANNOTATION_ICON_SIZE,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const HOVERED_STYLE: IconStyle = {
  url: annotationHighlight,
  width: LABEL_ANNOTATION_ICON_SIZE,
  height: LABEL_ANNOTATION_ICON_SIZE,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

const HOVERED_HIDDEN_STYLE: IconStyle = {
  url: annotationGhost,
  width: LABEL_ANNOTATION_ICON_SIZE,
  height: LABEL_ANNOTATION_ICON_SIZE,
  occlusionMode: OcclusionMode.ALWAYS_VISIBLE,
};

function createLabelHtmlTemplate() {
  const shadowHalo = `1px 1px #3C3C3C, 1px -1px #3C3C3C, -1px 1px #3C3C3C, -1px -1px #3C3C3C;`;
  return `<div style='font: bold 16px sans-serif; padding-left: 20px; padding-top: 10px; margin-bottom: -10px; color: #FAFAFA; text-shadow: ${shadowHalo}'>{content}</div>`;
}

/**
 * Painter responsible to paint point annotations on a Map.
 * By default, `visible` property of a feature is used to determine whether it should be visible or not,
 * but hovered features are always visible.
 * Labels are painted when the feature is either hovered, or `alwaysShowLabel` is set to true, but never when the
 * feature is selected.
 * This painter does not paint labels when annotations are selected, since it is expected that the labels are painted
 * using UI elements, outside of LuciadRIA (for example using a React component).
 */
export class LabelAnnotationPainter extends FeaturePainter {
  private readonly _styles: Required<LabelAnnotationStyles>;
  private _alwaysShowLabel: boolean = false;
  private _hideFeatures: boolean = false;

  /**
   * Constructs a new LabelAnnotationPainter
   * @param styles the styles used to paint annotations. If some styles are not specified, defaults are used.
   */
  constructor(styles?: LabelAnnotationStyles) {
    super();
    this._styles = {
      defaultStyle: styles?.defaultStyle ?? DEFAULT_STYLE,
      selectedStyle: styles?.selectedStyle ?? SELECTED_STYLE,
      hoveredHiddenStyle: styles?.hoveredHiddenStyle ?? HOVERED_HIDDEN_STYLE,
      hoveredVisibleStyle: styles?.hoveredVisibleStyle ?? HOVERED_STYLE,
    }
  }

  /**
   * Denotes whether labels of visible features should always be drawn or not, independent of whether they're hovered or not.
   */
  get alwaysShowLabel(): boolean {
    return this._alwaysShowLabel;
  }

  set alwaysShowLabel(value: boolean) {
    if (value !== this._alwaysShowLabel) {
      this._alwaysShowLabel = value;
      this.invalidateAll();
    }
  }

  /**
   * Denotes whether all features should be hidden or not, independent of their visible property.
   */
  get hideFeatures(): boolean {
    return this._hideFeatures;
  }

  set hideFeatures(value: boolean) {
    if (value !== this._hideFeatures) {
      this._hideFeatures = value;
      this.invalidateAll();
    }
  }

  paintBody(
      geoCanvas: GeoCanvas,
      feature: LabelAnnotationFeature,
      shape: Shape,
      _layer: Layer,
      _map: Map,
      paintState: PaintState
  ): void {
    if (this._hideFeatures) {
      return
    }

    if (feature.properties.visible || paintState.hovered) {
      let style: IconStyle
      if (paintState.selected) {
        style = this._styles.selectedStyle;
      } else if (paintState.hovered) {
        if (feature.properties.visible) {
          style = this._styles.hoveredVisibleStyle
        } else {
          style = this._styles.hoveredHiddenStyle;
        }
      } else {
        style = this._styles.defaultStyle;
      }

      geoCanvas.drawIcon(
          shape,
          style
      );
    }
  }

  paintLabel(
      labelCanvas: LabelCanvas,
      feature: LabelAnnotationFeature,
      shape: Shape,
      _layer: Layer,
      _map: Map,
      paintState: PaintState
  ): void {
    if (this._hideFeatures) {
      return
    }

    if (feature.properties.title &&
        (feature.properties.visible || paintState.hovered) &&
        (
            (paintState.hovered && !paintState.selected) ||
            this._alwaysShowLabel
        )
    ) {
      const html = createLabelHtmlTemplate().replace(new RegExp('{content}', 'g'), feature.properties.title);
      labelCanvas.drawLabel(html, shape, {
        padding: 0,
        priority: -100,
      });
    }
  }
}

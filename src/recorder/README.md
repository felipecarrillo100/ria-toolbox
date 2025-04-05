# LuciadRIA Recorder Tool

This package contains the `RecorderSupport` API, which allows recording LuciadRIA maps.

## Overview

The `RecorderSupport` tool manages the recording of map animations.
It facilitates control over the recordings, allowing to start, stop, and control various recording settings
such as recording duration, frames per second, and compression factor.
The tool also enables subscriptions to various status events like fps rate change, fraction change,
and recording start/stop.

Additionally, the tool also has an optional feature to include labels displayed over the map views in the recorded video.
However, please note that enabling this feature requires extra processing to rasterize HTML-based labels 
into the video frames and could extend the recording duration.

## External Dependencies

The tool utilizes external libraries to fulfill certain functionalities:

- mp4-muxer: This library handles the encoding of video data into MP4 format.

- html2canvas: This library is used for conversion of HTML content to a canvas representation.
It aids in capturing labels displayed on the map views to be recorded.

## Limitations

- The default recorder implementation relies on the browser's video encoder API, 
which is currently supported by Chrome and Edge only.
Users can provide a custom implementation of the recorder and pass it to the RecorderSupport constructor.
- Please note that the length of the video recording functionality is influenced by 
the memory size of the machine in use. 
The recording process requires sufficient memory to capture the video data. 

## Usage

The following code snippet illustrates how to initiate a `RecorderSupport` instance and record a map animation:

```typescript
// Create a new instance
const recorderSupport = new RecorderSupport({
  map: myMap,
  updatable: myUpdatable,     // Responsible for updating the map when capturing the image snapshot
  duration: 5000,             // Recording duration in milliseconds
  fileName: 'myRecording',    // Filename for the recorded animation
  fps: 30,                    // Frames per second for the recording
  qualityFactor: 0.6          // The quality factor for the recording
});

// Set the initial fraction for the recording (25% of the total animation)
recorderSupport.fraction = 0.25;

// Start recording
recorderSupport.record();

// Stop recording
recorderSupport.stop();
```
# RIA Toolbox

An easy-to-integrate LuciadRIA toolbox derived from the LuciadRIA 2024.1.06 samples.

## Key Advantages

1. **Seamless Deployment**: Deploy as a standard npm package without complex wiring.
2. **TypeScript Flexibility**: Use your preferred TypeScript version and configuration.
3. **React Compatibility**: Compatible with React version 16.14 or higher.
4. **LuciadRIA Compatibility**: Works with any LuciadRIA version 2024.1.x or higher.

## Overview of LuciadRIA Toolbox

The LuciadRIA Toolbox is a comprehensive collection of advanced tools and utility code designed for integration into your LuciadRIA application. It offers a straightforward integration API for easy access.

The toolbox's extensive feature set makes it suitable for a variety of customer projects. You have the flexibility to use the toolbox as-is or modify it entirely from the source code.

Please note that as LuciadRIA components, the toolbox samples are provided without guarantees of maintenance or backward compatibility.

For more detailed information, please visit the [LuciadRIA Toolbox Documentation](https://dev.luciad.com/portal/productDocumentation/LuciadRIA/docs/articles/tutorial/getting_started/use_toolbox.html#_tools_in_the_luciadria_toolbox).

## Installation

To install the RIA Toolbox, use the following npm command:

```bash
npm install ria-toolbox
```

### Integration

Integrate it similarly to the original, with the exception that the path to the libraries is 

`ria-toolbox/libs`

For instance:

```typescript
// Instead of:
import { MeasurementPaintStyles } from "@luciad/ria-toolbox-ruler3d/measurement/Measurement.ts";

// Use:
import { MeasurementPaintStyles } from "ria-toolbox/libs/ruler3d/measurement/Measurement";
```

Here's an improved and more professional version of your text:

---

### Customization

The original source code is located in the `src` folder. Feel free to create a branch and modify it to suit your specific requirements. Make the changes you need and run the build script to generate the libs folder.

### Upgrading to a New LuciadRIA Version?

If a new version of LuciadRIA is released and you wish to use the latest Toolkit, follow these steps:

1. **Create a Branch**: Start by branching this repository to keep your customizations separate.
2. **Update Source**: Replace the entire contents of the `src` folder with the new official LuciadRIA toolbox libraries.
3. **Build the Project**: Run the build script. You might need to resolve a few type mismatches during this process.
4. **Completion**: Once resolved, you will have a new transpiled version based on the latest official library.

---


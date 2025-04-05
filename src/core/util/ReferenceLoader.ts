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
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {addReference, isValidReferenceIdentifier, parseWellKnownText} from "@luciad/ria/reference/ReferenceProvider.js";

/**
 * Reads Well-Known Text strings from the given file, associates them with an EPSG code and
 * registers these associations in the
 *
 * <p>When the method is resolved, the references can be retrieved from the ReferenceProvider
 * by calling its getReference method with the corresponding EPSG code. </p>
 *
 * <p>The file should adhere to this format:</p>
 * <ul>
 *   <li>For each reference, there should be
 *     <ul>
 *       <li>The identifier of the reference, formatted as <code>AUTHORITY_NAME:AUTHORITY_CODE</code> (e.g. EPSG:3086)</li>
 *       <li>The WKT encoding of the reference.</li>
 *     </ul>
 *   </li>
 *   <li>Empty lines or lines starting with a # are ignored</li>
 * </ul>
 *
 * <p>Any lines that do not follow this format are ignored. If a WKT string cannot be parsed into a reference, it is ignored</p>
 *
 * <p>For instance, the text could look like the following:</p>
 * <pre>
 * #A subset of the NAD83 references from the EPSG database
 * EPSG:3086
 * PROJCS["NAD83 / Florida GDL Albers",GEOGCS["NAD83",DATUM["North American Datum 1983",SPHEROID["GRS 1980",6378137.0,298.257222101],TOWGS84[0.0,0.0,0.0]],PRIMEM["Greenwich",0.0],UNIT["degree",0.017453292519943295],AXIS["Geodetic latitude",NORTH],AXIS["Geodetic longitude",EAST]],PROJECTION["Albers Equal Area"],PARAMETER["Latitude of false origin",24.0],PARAMETER["Longitude of false origin",-84.0],PARAMETER["Latitude of 1st standard parallel",24.0],PARAMETER["Latitude of 2nd standard parallel",31.5],PARAMETER["Easting at false origin",400000.0],PARAMETER["Northing at false origin",0.0],UNIT["Meter",1.0],AXIS["Easting",EAST],AXIS["Northing",NORTH]]
 * EPSG:3087
 * PROJCS["NAD83(HARN) / Florida GDL Albers",GEOGCS["NAD83(HARN)",DATUM["NAD83 (High Accuracy Reference Network)",SPHEROID["GRS 1980",6378137.0,298.257222101],TOWGS84[0.0,0.0,0.0]],PRIMEM["Greenwich",0.0],UNIT["degree",0.017453292519943295],AXIS["Geodetic latitude",NORTH],AXIS["Geodetic longitude",EAST]],PROJECTION["Albers Equal Area"],PARAMETER["Latitude of false origin",24.0],PARAMETER["Longitude of false origin",-84.0],PARAMETER["Latitude of 1st standard parallel",24.0],PARAMETER["Latitude of 2nd standard parallel",31.5],PARAMETER["Easting at false origin",400000.0],PARAMETER["Northing at false origin",0.0],UNIT["Meter",1.0],AXIS["Easting",EAST],AXIS["Northing",NORTH]]
 * EPSG:3088
 * PROJCS["NAD83 / Kentucky Single Zone",GEOGCS["NAD83",DATUM["North American Datum 1983",SPHEROID["GRS 1980",6378137.0,298.257222101],TOWGS84[0.0,0.0,0.0]],PRIMEM["Greenwich",0.0],UNIT["degree",0.017453292519943295],AXIS["Geodetic latitude",NORTH],AXIS["Geodetic longitude",EAST]],PROJECTION["Lambert Conic Conformal (2SP)"],PARAMETER["Latitude of false origin",36.333333333333336],PARAMETER["Longitude of false origin",-85.75],PARAMETER["Latitude of 1st standard parallel",37.083333333333336],PARAMETER["Latitude of 2nd standard parallel",38.666666666666664],PARAMETER["Easting at false origin",1500000.0],PARAMETER["Northing at false origin",1000000.0],UNIT["Meter",1.0],AXIS["Easting",EAST],AXIS["Northing",NORTH]]
 * EPSG:3089
 * PROJCS["NAD83 / Kentucky Single Zone (ftUS)",GEOGCS["NAD83",DATUM["North American Datum 1983",SPHEROID["GRS 1980",6378137.0,298.257222101],TOWGS84[0.0,0.0,0.0]],PRIMEM["Greenwich",0.0],UNIT["degree",0.017453292519943295],AXIS["Geodetic latitude",NORTH],AXIS["Geodetic longitude",EAST]],PROJECTION["Lambert Conic Conformal (2SP)"],PARAMETER["Latitude of false origin",36.333333333333336],PARAMETER["Longitude of false origin",-85.75],PARAMETER["Latitude of 1st standard parallel",37.083333333333336],PARAMETER["Latitude of 2nd standard parallel",38.666666666666664],PARAMETER["Easting at false origin",4921250.0],PARAMETER["Northing at false origin",3280833.333],UNIT["US survey foot",0.30480060960121924],AXIS["Easting",EAST],AXIS["Northing",NORTH]]
 * </pre>
 *
 * <p>The <tt>epsg_coord_ref.txt</tt> file in <tt>sampledata/projection</tt> follows this format and contains
 * all the references from the EPSG database that are supported by LuciadRIA.</p>
 *
 * <p>The <tt>references.txt</tt> file in <tt>sampledata/projection</tt> contains a subset of the references in
 * <tt>epsg_coord_ref.txt</tt> that are used in the sample.
 *

 * @param text The text containing the identifiers and WKT-encoded references.
 * @return A Promise with the loadedReferences
 */
export const loadReferencesFromWKT = (text: string): Promise<CoordinateReference[]> => {
  return new Promise((resolve) => {
    const loadedReferences = [];
    const supportedReferenceIdentifierPattern = /(EPSG):(\d+)/i;

    const lines = text.replace(new RegExp("\r", "gm"), "").split(/\n/);
    for (let epsgLineIndex = 0; epsgLineIndex < lines.length; epsgLineIndex++) {
      let reference = null;
      const epsgLine = lines[epsgLineIndex];
      if (epsgLine.length === 0 || epsgLine.substring(0, 1) === "#") {
        continue;
      }

      supportedReferenceIdentifierPattern.exec(epsgLine);

      const matchResult = supportedReferenceIdentifierPattern.exec(epsgLine);
      if (!matchResult) {
        console.log(`Found unsupported reference identifier pattern: ${epsgLine} . Ignoring.`);
        continue;
      }

      epsgLineIndex++;

      const wkt = lines[epsgLineIndex];

      try {
        reference = parseWellKnownText(wkt, matchResult[1], matchResult[2]);
        // Add new reference to the ReferenceProvider if not present
        if (!isValidReferenceIdentifier(reference.identifier)) {
          addReference(reference);
        }
        loadedReferences.push(reference);
      } catch (ignore) {
        console.log(`Could not parse the following WKT string: ${wkt}. Ignoring the string.`)
      }
    }
    resolve(loadedReferences);
  });
}

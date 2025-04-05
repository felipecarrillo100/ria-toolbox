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
import {useEffect, useRef, useState} from "react";
import {SuggestionSection} from "./typings/AutoComplete.js";
import {throttle} from "@luciad/ria-toolbox-core/util/Throttle.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";

const CRS_84 = getReference("CRS:84");
const DEFAULT_BOUND_RADIUS = 0.01; //in degrees, used when fitting on points of interest

function toSuggestionSection(geocodeResponse: any): SuggestionSection<LocationSuggestion> {
  const suggestions = geocodeResponse.items as LocationSuggestion[];

  return {
    id: "HERE - suggestions",
    header: null,
    suggestions: suggestions.splice(0, 5).map(suggestion => {
      return {id: suggestion.id, label: suggestion.title, value: suggestion};
    }),
  };
}

export interface LocationSuggestion {
  id: string;
  title: string;
  position: { lat: number; lng: number };
  mapView: {
    west: number;
    east: number;
    north: number;
    south: number;
  }
}

export function useHEREAutoComplete(text: string, apiKey: string | null) {
  const [suggestionSections, setSuggestionSections] = useState<SuggestionSection<LocationSuggestion>[]>([]);
  const throttledUpdaterRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setSuggestionSections([]);
      throttledUpdaterRef.current = null;
      return;
    }

    setSuggestionSections([]);
    let requestedText = ""; //used to handle out-of-order responses without needing to depend on state.

    throttledUpdaterRef.current = throttle((text: string) => {
      if (text.length > 0) {
        requestedText = text;
        fetch(
            `https://discover.search.hereapi.com/v1/geocode?apiKey=${apiKey}&q=${text}`
        )
            .then(response => response.json())
            .then(geocodeResponse => {
              if (requestedText === text) {
                setSuggestionSections([toSuggestionSection(geocodeResponse)])
              }
            }).catch((e) => console.error("Error while getting HERE geocoding suggestions", e));
      } else {
        setSuggestionSections([]);
      }
    }, 300);
  }, [apiKey])

  useEffect(() => {
    if (throttledUpdaterRef.current) {
      throttledUpdaterRef.current(text);
    }
  }, [text]);

  return suggestionSections;
}

export function suggestionToFitBounds(suggestion: LocationSuggestion) {
  if (suggestion.mapView) {
    const {west, east, north, south} = suggestion.mapView;
    return createBounds(CRS_84, [west, east - west, south, north - south]);
  } else {
    return createBounds(CRS_84, [
      suggestion.position.lng - DEFAULT_BOUND_RADIUS / 2,
      DEFAULT_BOUND_RADIUS,
      suggestion.position.lat - DEFAULT_BOUND_RADIUS / 2,
      DEFAULT_BOUND_RADIUS,
    ]);
  }

}
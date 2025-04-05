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
import BloodHound from "bloodhound-js";
import {ReactNode, useEffect, useRef, useState} from "react";
import {SuggestionSection} from "./typings/AutoComplete.js";
import "./typings/bloodhound-js.d.ts"; //fixes typings of bloodhound in all depending samples

export interface AutoCompleteDataset<S> {
  /**
   * An id identifying the dataset
   */
  id: string;
  /**
   * An optional header to show above suggestions. Useful if you want to suggest different types of objects (e.g. airlines and airports)
   */
  header: ReactNode | null;
  /**
   * The available options
   */
  options: S[];
  /**
   * Returns a unique id for a given option
   */
  identify: (option: S) => string;
  /**
   * The key of an option object to display as suggestion. Null if the options are strings and should be displayed as-is
   */
  displayKey: string | null;
  /**
   * The keys of option objects to search in. Null if the options are strings and should be searched as-is
   */
  datumKeys: string[] | null;
}

const createBloodhoundEngine = async <S>(options: S[], identify: (option: S) => string,
                                         datumKeys: string[] | null): Promise<BloodHound> => {
  const datumTokenizer = datumKeys === null ? BloodHound.tokenizers.whitespace : BloodHound.tokenizers.obj.whitespace(
      ...datumKeys);
  const bloodHoundEngine = new BloodHound({
    initialize: false,
    local: options,
    identify,
    datumTokenizer,
    queryTokenizer: BloodHound.tokenizers.whitespace
  });
  await bloodHoundEngine.initialize();
  return bloodHoundEngine;
}

export function useLocalAutoComplete<S extends any>(text: string,
                                                       datasets: AutoCompleteDataset<S>[]): SuggestionSection<S>[] {
  const [sections, setSections] = useState<SuggestionSection<S>[]>([]);
  const bloodHounds = useRef<Map<string, BloodHound>>(new Map());

  useEffect(() => {
    bloodHounds.current.clear();
    for (const dataset of datasets) {
      createBloodhoundEngine(dataset.options, dataset.identify, dataset.datumKeys).then(bloodHoundEngine => {
        bloodHounds.current.set(dataset.id, bloodHoundEngine);
      });
    }
  }, [datasets]);

  useEffect(() => {
    const newSections: SuggestionSection<S>[] = [];
    for (const dataset of datasets) {
      const bloodhound = bloodHounds.current.get(dataset.id);
      if (bloodhound) {
        bloodhound.search(text, (suggestions) => {
          newSections.push({
            id: dataset.id,
            header: dataset.header,
            suggestions: suggestions.slice(0, 5).map(sugg => {
              const value = sugg;
              const label = dataset.displayKey ? sugg[dataset.displayKey] : sugg;
              return {
                id: dataset.identify(value),
                value,
                label,
                datasetId: dataset.id
              };
            })
          });
        });
      }
    }
    setSections(newSections);
  }, [text, datasets]);

  return sections;
}
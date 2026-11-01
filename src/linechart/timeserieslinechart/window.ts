// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Fitting the Y viewport to the data in the time viewport, and trimming old
// data. The methods (fitYToView, fitYToViewWithOpts, trimBefore) are on the
// Model class in timeserieslinechart.ts.

/** FitYOpts configures fitting the Y viewport to stored points in the time viewport. */
export interface FitYOpts {
  /**
   * DataSets selects the data sets to fit. Undefined or null selects all data
   * sets on the left Y axis; an empty array selects none. Unknown names are ignored.
   */
  dataSets?: string[] | null;
  /**
   * IncludeZero includes a zero baseline on a linear Y axis.
   * It is ignored on a logarithmic Y axis.
   */
  includeZero?: boolean;
}

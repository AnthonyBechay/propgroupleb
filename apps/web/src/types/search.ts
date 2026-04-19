export interface SearchParams {
  goal?: string;
  budget?: string;
  country?: string;
  city?: string;
  status?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  minBedrooms?: string;
  maxBedrooms?: string;
  bathrooms?: string;
  minArea?: string;
  maxArea?: string;
  propertyType?: string;
  goldenVisa?: string;
  isGoldenVisaEligible?: string;
  highRoi?: string;
  q?: string;
  sort?: string;
  [key: string]: string | undefined;
}

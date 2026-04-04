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
  propertyType?: string;
  goldenVisa?: string;
  q?: string;
  sort?: string;
  [key: string]: string | undefined;
}

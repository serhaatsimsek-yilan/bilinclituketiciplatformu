import { searchFlight, routeDistanceFromAirports, resolveRouteDomestic } from "./flight-service.js";
import { getStoredAirportCatalog } from "./airport-selector.js";
import { evaluateCompensation } from "./compensation-engine.js";

/**
 * Lookup by date + flight number. Paid providers are never called from the browser.
 */
export async function lookupFlight(input) {
  const result = await searchFlight({
    flightNumber: input.flightNumber,
    date: input.flightDate,
    departureIata: input.departureIata,
    arrivalIata: input.arrivalIata
  });
  return {
    flightDate: result.date,
    flightNumber: result.flightNumber,
    departureIata: result.departureIata,
    arrivalIata: result.arrivalIata,
    distanceKm: result.distanceKm,
    isDomestic: result.isDomestic == null ? null : result.isDomestic === true,
    flights: result.flights,
    dataSource: "live",
    manualReviewRequired: result.manualReviewRequired,
    providerVerifiedCancellation: result.providerVerifiedCancellation
  };
}

export function buildLookupState(flight, query) {
  const depIata = query.departureIata || (flight.departure && flight.departure.iata);
  const arrIata = query.arrivalIata || (flight.arrival && flight.arrival.iata);
  const enrichedFlight = Object.assign({}, flight);
  if (enrichedFlight.distanceKm == null && query.distanceKm != null) {
    enrichedFlight.distanceKm = query.distanceKm;
  }
  if (enrichedFlight.isDomestic == null && query.isDomestic != null) {
    enrichedFlight.isDomestic = query.isDomestic === true;
  }
  return {
    input: {
      flightDate: query.flightDate,
      flightNumber: flight.flightNumber || query.flightNumber,
      departureIata: depIata,
      arrivalIata: arrIata,
      distanceKm: enrichedFlight.distanceKm != null ? enrichedFlight.distanceKm : query.distanceKm || null,
      isDomestic: enrichedFlight.isDomestic != null ? enrichedFlight.isDomestic : query.isDomestic == null ? null : query.isDomestic === true,
      airline: flight.airlineName || flight.airline,
      departureAirport: flight.departureAirport,
      arrivalAirport: flight.arrivalAirport
    },
    flight: enrichedFlight,
    weather: null,
    dataSource: flight.source || "live",
    manualReviewRequired: flight.manualReviewRequired === true || query.manualReviewRequired === true,
    providerVerifiedCancellation:
      flight.providerVerifiedCancellation === true
        ? true
        : flight.providerVerifiedCancellation === false
          ? false
          : null
  };
}

export function assessConfirmedFlight(lookupState, extras) {
  const input = Object.assign({}, lookupState.input, extras);
  const flight = Object.assign({}, lookupState.flight);
  const userCancelled = extras.incidentType === "cancelled";
  input.userReportedIssue = extras.incidentType || null;
  flight.userReportedIssue = extras.incidentType || null;
  flight.providerVerifiedCancellation =
    lookupState.providerVerifiedCancellation === true
      ? true
      : lookupState.providerVerifiedCancellation === false
        ? false
        : flight.providerVerifiedCancellation === true
          ? true
          : flight.providerVerifiedCancellation === false
            ? false
            : null;
  if (userCancelled) {
    flight.cancelled = true;
  }
  if (flight.providerVerifiedCancellation == null && userCancelled) {
    flight.manualReviewRequired = true;
  }
  if (flight.distanceKm == null && input.distanceKm != null) {
    flight.distanceKm = input.distanceKm;
  }
  if (flight.distanceKm == null) {
    flight.distanceKm = routeDistanceFromAirports(
      getStoredAirportCatalog(),
      input.departureIata || (flight.departure && flight.departure.iata),
      input.arrivalIata || (flight.arrival && flight.arrival.iata)
    );
  }
  const catalog = getStoredAirportCatalog();
  const depIata = input.departureIata || (flight.departure && flight.departure.iata);
  const arrIata = input.arrivalIata || (flight.arrival && flight.arrival.iata);
  let isDomestic =
    flight.isDomestic != null
      ? flight.isDomestic === true
      : input.isDomestic != null
        ? input.isDomestic === true
        : lookupState.input && lookupState.input.isDomestic != null
          ? lookupState.input.isDomestic === true
          : resolveRouteDomestic(catalog, depIata, arrIata);
  const assessment = evaluateCompensation({
    flight,
    weather: lookupState.weather,
    airlineReason: extras.airlineReason || "not_stated",
    incidentType: extras.incidentType || null,
    isDomestic: isDomestic
  });
  if (flight.manualReviewRequired) {
    assessment.manualReviewRequired = true;
  }
  return {
    input,
    flight,
    weather: lookupState.weather,
    assessment,
    dataSource: lookupState.dataSource
  };
}

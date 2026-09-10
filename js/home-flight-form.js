import { bindAirportSelector } from "./flight-compensation/airport-selector.js";
import { normalizeFlightNumber } from "./flight-compensation/flight-service.js";

function showHomeFieldError(groupId, errorId, show) {
  const group = document.getElementById(groupId);
  const err = document.getElementById(errorId);
  if (group) group.classList.toggle("has-error", !!show);
  if (err) err.hidden = !show;
}

function bindUppercaseFlightNumber(input) {
  if (!input) return;
  input.addEventListener("input", function () {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const upper = input.value.toUpperCase();
    if (input.value !== upper) {
      input.value = upper;
      if (start != null && end != null) {
        input.setSelectionRange(start, end);
      }
    }
  });
  input.addEventListener("blur", function () {
    input.value = normalizeFlightNumber(input.value);
  });
}

const form = document.querySelector(".query-card");
if (form) {
  const flightNumberInput = document.getElementById("homeFlightNumber");
  bindUppercaseFlightNumber(flightNumberInput);

  const originSelector = bindAirportSelector({
    inputId: "homeOriginAirport",
    listId: "homeOriginAirportList",
    hiddenId: "homeOriginIata",
    groupId: "group-home-origin"
  });

  const destinationSelector = bindAirportSelector({
    inputId: "homeDestinationAirport",
    listId: "homeDestinationAirportList",
    hiddenId: "homeDestinationIata",
    groupId: "group-home-destination"
  });

  form.addEventListener("submit", function (e) {
    if (flightNumberInput) {
      flightNumberInput.value = normalizeFlightNumber(flightNumberInput.value);
    }
    const originOk = !!originSelector.getIata();
    const destOk = !!destinationSelector.getIata();
    showHomeFieldError("group-home-origin", "error-home-origin", !originOk);
    showHomeFieldError("group-home-destination", "error-home-destination", !destOk);
    if (!originOk || !destOk) {
      e.preventDefault();
    }
  });
}

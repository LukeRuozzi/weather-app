export class Location {
  constructor(name, latLng) {
    this.name = name;
    this.latLng = latLng;
    this.id =
      Date.now().toString(16) +
      Math.random().toString(16).slice(2).padStart(16, 0);
  }

  setLatLng(latLng) {
    this.latLng = latLng;
  }
}

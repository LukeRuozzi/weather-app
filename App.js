const GEOCODING_URL = 'https://geocode.maps.co/search?q=';
const REVERSE_GEOCODING_URL =
  'https://geocode.maps.co/reverse?lat=%LAT%&lon=%LNG%';

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=%LAT%&longitude=%LNG%&current_weather=true';

import WEATHER_CODES from './weatherCodes.json';

import { Location } from './Location';

export class App {
  #locations = [];
  #lastMarker;

  constructor() {
    this.locationForm = document.getElementById('location-form');
    this.locationElm = document.querySelector('.location');
    this.locationContainerElm = document.querySelector('.location-container');

    // init map
    this._map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
      this._map
    );

    this._map.on('click', this._mapClickHandler.bind(this));

    this.#locations = this._getLocations() || [];

    // show current location (and stored locations) on map
    this._initByLocations();

    // add change location listener
    this.locationForm.addEventListener(
      'submit',
      this._changeLocationHandler.bind(this)
    );

    this.locationContainerElm.addEventListener(
      'click',
      this._locationClickHandler.bind(this)
    );
  }

  // fetch current location data
  _initByLocations() {
    const locationObj = new Location('current', {});
    navigator.geolocation.getCurrentPosition((position) => {
      locationObj.setLatLng({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });

      const locations = [locationObj];

      const storedLocations = this.#locations;
      if (storedLocations) {
        storedLocations.forEach((l) => locations.push(l));
      }

      Promise.all(locations.map((loc) => this.getWeather(loc))).then(
        (weatherLocations) => {
          weatherLocations.forEach((res) => {
            const weather = res.weather;
            res.weather = {
              ...WEATHER_CODES[weather.weathercode].day,
              temp: weather.temperature,
            };
          });
          this._drawStoredLocationsOnList(
            weatherLocations.filter((l, idx) => idx > 0)
          );
          this._drawStoredLocationsOnMap(weatherLocations);
        }
      );
    });
  }

  // geocode given location
  geocode(location) {
    return fetch(`${GEOCODING_URL}${location}`)
      .then((res) => res.json())
      .then((data) => {
        const latLng = {
          lat: data[0].lat,
          lng: data[0].lon,
        };
        return latLng;
      })
      .catch((err) => console.log(err));
  }

  // fetch weather for given coordinates
  getWeather(location) {
    const { latLng } = location;
    const weatherUrl = WEATHER_URL.replace('%LAT%', latLng.lat).replace(
      '%LNG%',
      latLng.lng
    );

    return fetch(weatherUrl)
      .then((res) => res.json())
      .then((data) => {
        return { ...location, weather: data.current_weather };
      });
  }

  // handler for location input
  _changeLocationHandler(e) {
    e.preventDefault();

    let location = this.locationElm.value.trim();

    if (!location) {
      return;
    }

    location = location.charAt(0).toUpperCase() + location.slice(1);

    const locationObj = new Location(location, {});
    this._handleAddLocation(locationObj);
  }

  _handleAddLocation(locationObj) {
    this.geocode(locationObj.name)
      .then((latLng) => {
        if (
          this.#locations.find(
            (l) => l.latLng.lat === latLng.lat && l.latLng.lng === latLng.lng
          )
        ) {
          throw new Error(`Location ${location} already added`);
        }

        locationObj.setLatLng(latLng);
        this.#locations.push(locationObj);
        this._saveLocations();
        return this.getWeather(locationObj);
      })
      .then((res) => {
        const { weather } = res;
        const weatherData = {
          ...WEATHER_CODES[weather.weathercode].day,
          temp: weather.temperature,
        };
        const locObj = { ...locationObj, weather: weatherData };
        this._drawSingleLocationOnMap(locObj);
        this._addLocationToList(locObj);
      })
      .catch((err) => console.error(err))
      .finally(() => (this.locationElm.value = ''));
  }

  _addMarker(location, open, showFav) {
    let tooltipHtml = `
      <div>
        <span>${location.weather.description}</span>
        <span>${location.weather.temp}&deg;</span>
      </div>
      <img src='${location.weather.image}' height='30' />
    `;

    if (showFav) {
      tooltipHtml += `<i class='favorite fa fa-heart' data-lat='${location.latLng.lat}' data-lng='${location.latLng.lng}'></i>`;

      if (this.#lastMarker) {
        this._map.removeLayer(this.#lastMarker);
      }
    }

    const coords = [location.latLng.lat, location.latLng.lng];

    this.#lastMarker = L.marker(coords).addTo(this._map);
    const markerPopup = this.#lastMarker
      .bindPopup(tooltipHtml, {
        maxWidth: 250,
        minWidth: 100,
        autoClose: false,
        className: 'weather-popup',
      })
      .on('popupopen', () => {
        const favBtn = document.querySelector(
          `.favorite[data-lat='${location.latLng.lat}'][data-lng='${location.latLng.lng}']`
        );

        if (favBtn) {
          favBtn.addEventListener(
            'click',
            this._addMapPointToFavorite.bind(this, markerPopup)
          );
        }
      })
      .on('popupclose', () => {
        const favBtn = document.querySelector(
          `.favorite[data-lat='${location.latLng.lat}'][data-lng='${location.latLng.lng}']`
        );
        if (favBtn) {
          favBtn.removeEventListener('click', this._addMapPointToFavorite);
        }
      });

    if (!showFav) {
      this.#lastMarker = null;
    }

    if (open) {
      markerPopup.openPopup();
    }
  }

  _moveMapToLocation(locationObj) {
    const coords = [locationObj.latLng.lat, locationObj.latLng.lng];
    this._map.setView(coords, 13);
  }

  // draws find location on map
  _drawSingleLocationOnMap(locationObj, skipMove, showFav) {
    if (!skipMove) {
      this._moveMapToLocation(locationObj);
    }

    this._addMarker(locationObj, true, showFav);
  }

  // draws stored locations on map
  _drawStoredLocationsOnMap(locations) {
    const firstLocationObj = locations[0];
    this._moveMapToLocation(firstLocationObj);

    locations.forEach((locationObj, idx) => {
      this._addMarker(locationObj, idx === 0, false);
    });
  }

  _drawStoredLocationsOnList(locations) {
    locations.forEach((locationObj) => {
      this._addLocationToList(locationObj);
    });
  }

  _addLocationToList(location) {
    const html = `
      <div>
        <span class="location-desc">${location.name}</span>
        <span class="weather-desc">${location.weather.description}</span>
      </div>
      <div>
        <img
          src="${location.weather.image}"
          height="50"
        />
        ${location.weather.temp}°
      </div>
    `;

    const li = document.createElement('li');
    li.setAttribute('data-id', location.id);
    li.innerHTML = html;

    const firstElm = this.locationContainerElm.querySelector(
      'ul > li:first-child'
    );

    if (firstElm) {
      firstElm.insertAdjacentElement('beforebegin', li);
    } else {
      this.locationContainerElm.querySelector('ul').appendChild(li);
    }
  }

  _saveLocations() {
    localStorage.setItem('locations', JSON.stringify(this.#locations));
  }

  _getLocations() {
    const data = localStorage.getItem('locations');
    return data ? JSON.parse(data) : null;
  }

  _locationClickHandler(e) {
    const li = e.target.closest('li');
    if (!li) {
      return;
    }

    const id = li.getAttribute('data-id');
    const location = this.#locations.find((loc) => loc.id === id);

    if (e.offsetX > 190) {
      this.#locations = this.#locations.filter((l) => l.id !== id);
      this._saveLocations();
      li.remove();
    } else {
      if (location) {
        this._moveMapToLocation(location);
      }

      this._map.eachLayer((layer) => {
        if (
          layer._latlng &&
          layer._latlng.lat === +location.latLng.lat &&
          layer._latlng.lng === +location.latLng.lng
        ) {
          layer.openPopup();
        }
      });
    }
  }

  _mapClickHandler(em) {
    console.log(em.latlng);

    const location = new Location('', {
      lat: em.latlng.lat,
      lng: em.latlng.lng,
    });
    this.getWeather(location).then((res) => {
      const { weather } = res;
      const weatherData = {
        ...WEATHER_CODES[weather.weathercode].day,
        temp: weather.temperature,
      };
      const locObj = { ...location, weather: weatherData };
      this._drawSingleLocationOnMap(locObj, true, true);
    });
  }

  _addMapPointToFavorite(marker, e) {
    if (this.#lastMarker) {
      this._map.removeLayer(this.#lastMarker);
    }

    marker.closePopup();
    const lat = e.target.getAttribute('data-lat');
    const lng = e.target.getAttribute('data-lng');
    const url = REVERSE_GEOCODING_URL.replace('%LAT%', lat).replace(
      '%LNG%',
      lng
    );

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const location =
          data.address.village || data.address.town || data.address.city;
        console.log(location);
        const locationObj = new Location(location, {});
        this._handleAddLocation(locationObj);
      });
  }
}
